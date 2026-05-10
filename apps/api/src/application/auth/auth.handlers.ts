import { hash, verify, type Options } from 'argon2';
import { SignJWT, importPKCS8 } from 'jose';
import { ulid } from 'ulid';
import { eq, and } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../infrastructure/db/schema.js';
import { config } from '../../config.js';
import { AuthenticationError, ok, err, type Result } from '../../domain/shared/Result.js';
import { authFailuresTotal } from '../../infrastructure/metrics/registry.js';
import { AuthEmailService } from './auth-email.service.js';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateSecureToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('hex'); // 64 chars
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

function verifyTokenHash(providedToken: string, storedHash: string): boolean {
  try {
    const providedHash = createHash('sha256').update(providedToken).digest('hex');
    const providedBuffer = Buffer.from(providedHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');
    if (providedBuffer.length !== storedBuffer.length) return false;
    return timingSafeEqual(providedBuffer, storedBuffer);
  } catch {
    return false;
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export class RegisterHandler {
  constructor(
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly authEmailService: AuthEmailService
  ) {}

  async execute(input: { name: string; email: string; password: string }): Promise<Result<void, Error>> {
    const emailLower = input.email.toLowerCase().trim();
    
    // Hash password immediately
    const passwordHash = await hash(input.password, ARGON2_OPTIONS);

    try {
      const [operator] = await this.db.insert(schema.operators).values({
        name: input.name,
        email: emailLower,
        passwordHash,
        isActive: true,
        emailVerified: false,
      }).returning();

      if (!operator) return err(new Error('Failed to create user'));

      // Generate verification token
      const { token, tokenHash } = generateSecureToken();
      
      await this.db.insert(schema.emailVerifications).values({
        operatorId: operator.id,
        tokenHash,
        type: 'EMAIL_VERIFICATION',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      // Send email
      await this.authEmailService.sendVerificationEmail(operator.email, operator.name, token);

      return ok(undefined);
    } catch (e: any) {
      // If email already exists (unique constraint violation)
      // Anti-enumeration: We return OK, but we do NOT send the verification email.
      // Alternatively, we could send a "you already have an account" email, but for now we just return OK.
      if (e.code === '23505') {
        return ok(undefined); 
      }
      return err(e);
    }
  }
}

export class VerifyEmailHandler {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async execute(token: string): Promise<Result<void, Error>> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const [verification] = await this.db
      .select()
      .from(schema.emailVerifications)
      .where(
        and(
          eq(schema.emailVerifications.tokenHash, tokenHash),
          eq(schema.emailVerifications.type, 'EMAIL_VERIFICATION')
        )
      )
      .limit(1);

    if (!verification) {
      return err(new Error('Invalid token'));
    }

    if (verification.usedAt || new Date() > verification.expiresAt) {
      return err(new Error('Token expired or already used'));
    }

    // Verify constant time just to be safe, though db query already matched it
    if (!verifyTokenHash(token, verification.tokenHash)) {
      return err(new Error('Invalid token'));
    }

    // Mark user as verified and token as used
    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.operators)
        .set({ emailVerified: true })
        .where(eq(schema.operators.id, verification.operatorId));

      await tx
        .update(schema.emailVerifications)
        .set({ usedAt: new Date() })
        .where(eq(schema.emailVerifications.id, verification.id));
    });

    return ok(undefined);
  }
}

export class ResendVerificationHandler {
  constructor(
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly authEmailService: AuthEmailService
  ) {}

  async execute(email: string): Promise<Result<void, Error>> {
    const emailLower = email.toLowerCase().trim();

    const [operator] = await this.db
      .select()
      .from(schema.operators)
      .where(eq(schema.operators.email, emailLower))
      .limit(1);

    // Anti-enumeration: Return ok even if user doesn't exist or is already verified
    if (!operator || operator.emailVerified) {
      return ok(undefined);
    }

    const { token, tokenHash } = generateSecureToken();
    
    await this.db.insert(schema.emailVerifications).values({
      operatorId: operator.id,
      tokenHash,
      type: 'EMAIL_VERIFICATION',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    await this.authEmailService.sendVerificationEmail(operator.email, operator.name, token);

    return ok(undefined);
  }
}

export class ForgotPasswordHandler {
  constructor(
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly authEmailService: AuthEmailService
  ) {}

  async execute(email: string): Promise<Result<void, Error>> {
    const emailLower = email.toLowerCase().trim();

    const [operator] = await this.db
      .select()
      .from(schema.operators)
      .where(eq(schema.operators.email, emailLower))
      .limit(1);

    // Anti-enumeration: Return ok even if user doesn't exist
    if (!operator || !operator.isActive) {
      return ok(undefined);
    }

    const { token, tokenHash } = generateSecureToken();
    
    await this.db.insert(schema.emailVerifications).values({
      operatorId: operator.id,
      tokenHash,
      type: 'PASSWORD_RESET',
      expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
    });

    await this.authEmailService.sendPasswordResetEmail(operator.email, operator.name, token);

    return ok(undefined);
  }
}

export class ResetPasswordHandler {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async execute(token: string, password: string): Promise<Result<void, Error>> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const [verification] = await this.db
      .select()
      .from(schema.emailVerifications)
      .where(
        and(
          eq(schema.emailVerifications.tokenHash, tokenHash),
          eq(schema.emailVerifications.type, 'PASSWORD_RESET')
        )
      )
      .limit(1);

    if (!verification || verification.usedAt || new Date() > verification.expiresAt) {
      // Provide generic error
      return err(new Error('Invalid or expired token'));
    }

    if (!verifyTokenHash(token, verification.tokenHash)) {
      return err(new Error('Invalid token'));
    }

    const passwordHash = await hash(password, ARGON2_OPTIONS);

    await this.db.transaction(async (tx) => {
      await tx
        .update(schema.operators)
        .set({ passwordHash })
        .where(eq(schema.operators.id, verification.operatorId));

      await tx
        .update(schema.emailVerifications)
        .set({ usedAt: new Date() })
        .where(eq(schema.emailVerifications.id, verification.id));
        
      // Revoke all existing refresh tokens
      await tx
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(schema.refreshTokens.operatorId, verification.operatorId),
            eq(schema.refreshTokens.revokedAt, null as unknown as Date)
          )
        );
    });

    return ok(undefined);
  }
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
      return err(new AuthenticationError('Credenciais inválidas'));
    }
    
    if (!operator.emailVerified) {
      authFailuresTotal.inc({ reason: 'email_not_verified' });
      return err(new AuthenticationError('E-mail não verificado. Por favor, verifique sua caixa de entrada.'));
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

    if (!operator || !operator.isActive || !operator.emailVerified) {
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
