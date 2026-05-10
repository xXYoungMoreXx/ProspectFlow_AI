import { hash, verify, type Options } from 'argon2';
import { SignJWT, importPKCS8 } from 'jose';
import { ulid } from 'ulid';
import { eq, and } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infrastructure/db/schema.js';
import { config } from '../../config.js';
import { AuthenticationError, ok, err, type Result } from '../../domain/shared/Result.js';
import { authFailuresTotal } from '../../infrastructure/metrics/registry.js';

// Argon2id config per PRD §11.1 (mCost 64MB)
const ARGON2_OPTIONS: Options = {
  type: 2, // argon2id
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

let privateKey: Awaited<ReturnType<typeof importPKCS8>> | null = null;

async function getPrivateKey() {
  if (!privateKey) {
    privateKey = await importPKCS8(config.JWT_PRIVATE_KEY.replace(/\\n/g, '\n'), 'RS256');
  }
  return privateKey;
}

export class LoginHandler {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  /**
   * Login with email + password.
   * Anti-enumeration: always hash even if user doesn't exist (timing attack prevention).
   * PRD §11.2 + §14 security tests.
   */
  async execute(email: string, password: string): Promise<Result<AuthTokens, AuthenticationError>> {
    // Always execute Argon2 verify to prevent timing attacks
    const [operator] = await this.db
      .select()
      .from(schema.operators)
      .where(eq(schema.operators.email, email.toLowerCase().trim()))
      .limit(1);

    // Dummy hash for timing consistency when user not found
    const hashToVerify = operator?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$dummysalt$dummyhash';
    const isValid = await verify(hashToVerify, password).catch(() => false);

    if (!operator || !isValid || !operator.isActive) {
      authFailuresTotal.inc({ reason: 'invalid_credentials' });
      return err(new AuthenticationError());
    }

    // Generate tokens
    const key = await getPrivateKey();
    const jti = ulid();
    const now = Math.floor(Date.now() / 1000);

    const accessToken = await new SignJWT({ sub: operator.id, email: operator.email })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuedAt(now)
      .setExpirationTime(config.JWT_ACCESS_EXPIRY)
      .setIssuer(config.JWT_ISSUER)
      .setAudience(config.JWT_AUDIENCE)
      .setJti(jti)
      .sign(key);

    // Create refresh token (opaque, stored hashed)
    const rawRefreshToken = ulid() + ulid(); // 52-char opaque token
    const refreshHash = await hash(rawRefreshToken, ARGON2_OPTIONS);

    // Calculate refresh expiry
    const refreshExpiryMs = parseDuration(config.JWT_REFRESH_EXPIRY);
    const expiresAt = new Date(Date.now() + refreshExpiryMs);

    // Store refresh token
    await this.db.insert(schema.refreshTokens).values({
      operatorId: operator.id,
      tokenHash: refreshHash,
      expiresAt,
    });

    return ok({
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 3600,
    });
  }
}

export class RefreshTokenHandler {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  /**
   * Rotate refresh token.
   * Old token is revoked, new token is issued.
   */
  async execute(rawRefreshToken: string): Promise<Result<AuthTokens, AuthenticationError>> {
    // Find all non-revoked tokens and verify
    const tokens = await this.db
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.revokedAt, null as unknown as Date))
      .limit(50);

    let matchedToken: typeof tokens[0] | undefined;
    for (const token of tokens) {
      const isMatch = await verify(token.tokenHash, rawRefreshToken).catch(() => false);
      if (isMatch) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken || new Date() > matchedToken.expiresAt) {
      return err(new AuthenticationError());
    }

    // Revoke old token
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.id, matchedToken.id));

    // Get operator
    const [operator] = await this.db
      .select()
      .from(schema.operators)
      .where(eq(schema.operators.id, matchedToken.operatorId))
      .limit(1);

    if (!operator || !operator.isActive) {
      return err(new AuthenticationError());
    }

    // Issue new tokens
    const key = await getPrivateKey();
    const jti = ulid();

    const accessToken = await new SignJWT({ sub: operator.id, email: operator.email })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(config.JWT_ACCESS_EXPIRY)
      .setIssuer(config.JWT_ISSUER)
      .setAudience(config.JWT_AUDIENCE)
      .setJti(jti)
      .sign(key);

    const newRawRefresh = ulid() + ulid();
    const newRefreshHash = await hash(newRawRefresh, ARGON2_OPTIONS);
    const refreshExpiryMs = parseDuration(config.JWT_REFRESH_EXPIRY);

    await this.db.insert(schema.refreshTokens).values({
      operatorId: operator.id,
      tokenHash: newRefreshHash,
      expiresAt: new Date(Date.now() + refreshExpiryMs),
    });

    return ok({
      accessToken,
      refreshToken: newRawRefresh,
      expiresIn: 3600,
    });
  }
}

export class LogoutHandler {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async execute(operatorId: string): Promise<void> {
    // Revoke all active refresh tokens for this operator
    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.refreshTokens.operatorId, operatorId),
          eq(schema.refreshTokens.revokedAt, null as unknown as Date),
        ),
      );
  }
}

/** Parse duration string (e.g. "7d", "1h") to milliseconds */
function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 3600000; // fallback 1h
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  const multipliers: Record<string, number> = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  return value * (multipliers[unit] ?? 3600000);
}
