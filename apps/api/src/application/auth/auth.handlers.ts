import { hash, verify, type Options } from "argon2";
import { SignJWT, importPKCS8 } from "jose";
import { ulid } from "ulid";
import { eq, and } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "../../infrastructure/db/schema.js";
import { config } from "../../config.js";
import {
  AuthenticationError,
  ok,
  err,
  type Result,
} from "../../domain/shared/Result.js";
import { authFailuresTotal } from "../../infrastructure/metrics/registry.js";
import { AuthEmailService } from "./auth-email.service.js";
import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";

// Argon2id config per PRD §11.1 (mCost 64MB)
const ARGON2_OPTIONS: Options = {
  type: 2, // argon2id
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
};

export interface AuthTokens {
  accessToken:    string;
  refreshToken:   string;
  expiresIn:      number;
  organizationId: string;
}

let privateKey: Awaited<ReturnType<typeof importPKCS8>> | null = null;

async function getPrivateKey() {
  if (!privateKey) {
    const pk = config.JWT_PRIVATE_KEY.split("\\n").join("\n");
    privateKey = await importPKCS8(pk, "RS256");
  }
  return privateKey;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateSecureToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("hex"); // 64 chars
  const tokenHash = createHash("sha256").update(token).digest("hex");
  return { token, tokenHash };
}

function verifyTokenHash(providedToken: string, storedHash: string): boolean {
  try {
    const providedHash = createHash("sha256")
      .update(providedToken)
      .digest("hex");
    const providedBuffer = Buffer.from(providedHash, "hex");
    const storedBuffer = Buffer.from(storedHash, "hex");
    if (providedBuffer.length !== storedBuffer.length) return false;
    return timingSafeEqual(providedBuffer, storedBuffer);
  } catch {
    return false;
  }
}

export class RegisterHandler {
  constructor(
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly authEmailService: AuthEmailService,
  ) {}

  async execute(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<Result<void, Error>> {
    const emailLower = input.email.toLowerCase().trim();

    // Hash password immediately
    const passwordHash = await hash(input.password, ARGON2_OPTIONS);

    try {
      const [operator] = await this.db
        .insert(schema.operators)
        .values({
          name: input.name,
          email: emailLower,
          passwordHash,
          isActive: true,
          emailVerified: false,
        })
        .returning();

      if (!operator) return err(new Error("Failed to create user"));

      // Auto-assign to bootstrap org as owner
      const orgId = process.env["BOOTSTRAP_ORG_ID"] ?? "org_mvp";
      await this.db.insert(schema.members).values({
        id:             randomUUID(),
        organizationId: orgId,
        userId:         operator.id,
        role:           "owner",
        createdAt:      new Date(),
      });

      // Generate verification token
      const { token, tokenHash } = generateSecureToken();

      await this.db.insert(schema.emailVerifications).values({
        operatorId: operator.id,
        tokenHash,
        type: "EMAIL_VERIFICATION",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      });

      // Send email
      await this.authEmailService.sendVerificationEmail(
        operator.email,
        operator.name,
        token,
      );

      return ok(undefined);
    } catch (e: any) {
      // If email already exists (unique constraint violation)
      // Anti-enumeration: We return OK, but we do NOT send the verification email.
      if (e.code === "23505") {
        return ok(undefined);
      }
      return err(e);
    }
  }
}

export class VerifyEmailHandler {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async execute(token: string): Promise<Result<void, Error>> {
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const [verification] = await this.db
      .select()
      .from(schema.emailVerifications)
      .where(
        and(
          eq(schema.emailVerifications.tokenHash, tokenHash),
          eq(schema.emailVerifications.type, "EMAIL_VERIFICATION"),
        ),
      )
      .limit(1);

    if (
      !verification ||
      verification.usedAt ||
      new Date() > verification.expiresAt
    ) {
      return err(new Error("Invalid or expired token"));
    }

    if (!verifyTokenHash(token, verification.tokenHash)) {
      return err(new Error("Invalid token"));
    }

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
    private readonly authEmailService: AuthEmailService,
  ) {}

  async execute(email: string): Promise<Result<void, Error>> {
    const emailLower = email.toLowerCase().trim();

    const [operator] = await this.db
      .select()
      .from(schema.operators)
      .where(eq(schema.operators.email, emailLower))
      .limit(1);

    if (!operator || operator.emailVerified) {
      return ok(undefined);
    }

    const { token, tokenHash } = generateSecureToken();

    await this.db.insert(schema.emailVerifications).values({
      operatorId: operator.id,
      tokenHash,
      type: "EMAIL_VERIFICATION",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    await this.authEmailService.sendVerificationEmail(
      operator.email,
      operator.name,
      token,
    );

    return ok(undefined);
  }
}

export class ForgotPasswordHandler {
  constructor(
    private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly authEmailService: AuthEmailService,
  ) {}

  async execute(email: string): Promise<Result<void, Error>> {
    const emailLower = email.toLowerCase().trim();

    const [operator] = await this.db
      .select()
      .from(schema.operators)
      .where(eq(schema.operators.email, emailLower))
      .limit(1);

    const { token, tokenHash } = generateSecureToken();

    if (!operator || !operator.isActive) {
      // VULN-003 Remediation: Perform dummy work
      await hash(token, { ...ARGON2_OPTIONS, memoryCost: 2048, timeCost: 2 });
      return ok(undefined);
    }

    await this.db.insert(schema.emailVerifications).values({
      operatorId: operator.id,
      tokenHash,
      type: "PASSWORD_RESET",
      expiresAt: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour
    });

    await this.authEmailService.sendPasswordResetEmail(
      operator.email,
      operator.name,
      token,
    );

    return ok(undefined);
  }
}

export class ResetPasswordHandler {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async execute(token: string, password: string): Promise<Result<void, Error>> {
    const tokenHash = createHash("sha256").update(token).digest("hex");

    const [verification] = await this.db
      .select()
      .from(schema.emailVerifications)
      .where(
        and(
          eq(schema.emailVerifications.tokenHash, tokenHash),
          eq(schema.emailVerifications.type, "PASSWORD_RESET"),
        ),
      )
      .limit(1);

    if (
      !verification ||
      verification.usedAt ||
      new Date() > verification.expiresAt
    ) {
      return err(new Error("Invalid or expired token"));
    }

    if (!verifyTokenHash(token, verification.tokenHash)) {
      return err(new Error("Invalid token"));
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

      await tx
        .update(schema.refreshTokens)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(schema.refreshTokens.operatorId, verification.operatorId),
            eq(schema.refreshTokens.revokedAt, null as unknown as Date),
          ),
        );
    });

    return ok(undefined);
  }
}

export class LoginHandler {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async execute(
    email: string,
    password: string,
  ): Promise<Result<AuthTokens, AuthenticationError>> {
    const [operator] = await this.db
      .select()
      .from(schema.operators)
      .where(eq(schema.operators.email, email.toLowerCase().trim()))
      .limit(1);

    const hashToVerify =
      operator?.passwordHash ??
      "$argon2id$v=19$m=65536,t=3,p=4$dummysalt$dummyhash";
    const isValid = await verify(hashToVerify, password).catch(() => false);

    if (!operator || !isValid || !operator.isActive) {
      authFailuresTotal.inc({ reason: "invalid_credentials" });
      return err(new AuthenticationError("Credenciais inválidas"));
    }

    if (!operator.emailVerified) {
      authFailuresTotal.inc({ reason: "email_not_verified" });
      return err(
        new AuthenticationError(
          "E-mail não verificado. Por favor, verifique sua caixa de entrada.",
        ),
      );
    }

    // Look up org membership
    const membership = await this.db
      .select({
        organizationId: schema.members.organizationId,
        role:           schema.members.role,
      })
      .from(schema.members)
      .where(eq(schema.members.userId, operator.id))
      .limit(1);

    const organizationId = membership[0]?.organizationId ?? (process.env["BOOTSTRAP_ORG_ID"] ?? "org_mvp");
    const role           = membership[0]?.role ?? "owner";

    const key = await getPrivateKey();
    const jti = ulid();
    const now = Math.floor(Date.now() / 1000);

    const accessToken = await new SignJWT({
      sub: operator.id,
      email: operator.email,
      organizationId,
      role,
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt(now)
      .setExpirationTime(config.JWT_ACCESS_EXPIRY)
      .setIssuer(config.JWT_ISSUER)
      .setAudience(config.JWT_AUDIENCE)
      .setJti(jti)
      .sign(key);

    const tokenId = randomUUID();
    const rawRefreshToken = `${tokenId}.${ulid()}`;
    const refreshHash = await hash(rawRefreshToken, ARGON2_OPTIONS);

    const refreshExpiryMs = parseDuration(config.JWT_REFRESH_EXPIRY);
    const expiresAt = new Date(Date.now() + refreshExpiryMs);

    await this.db.insert(schema.refreshTokens).values({
      id: tokenId,
      operatorId: operator.id,
      tokenHash: refreshHash,
      expiresAt,
    });

    return ok({
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: 900,
      organizationId,
    });
  }
}

export class RefreshTokenHandler {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async execute(
    rawRefreshToken: string,
  ): Promise<Result<AuthTokens, AuthenticationError>> {
    const [tokenId] = rawRefreshToken.split(".");
    if (!tokenId) return err(new AuthenticationError());

    const [token] = await this.db
      .select()
      .from(schema.refreshTokens)
      .where(
        and(
          eq(schema.refreshTokens.id, tokenId),
          eq(schema.refreshTokens.revokedAt, null as unknown as Date),
        ),
      )
      .limit(1);

    if (!token || new Date() > token.expiresAt) {
      await verify(
        "$argon2id$v=19$m=65536,t=3,p=4$dummysalt$dummyhash",
        "dummy",
      ).catch(() => {});
      return err(new AuthenticationError());
    }

    const isMatch = await verify(token.tokenHash, rawRefreshToken).catch(
      () => false,
    );
    if (!isMatch) {
      return err(new AuthenticationError());
    }

    await this.db
      .update(schema.refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(schema.refreshTokens.id, token.id));

    const [operator] = await this.db
      .select()
      .from(schema.operators)
      .where(eq(schema.operators.id, token.operatorId))
      .limit(1);

    if (!operator || !operator.isActive || !operator.emailVerified) {
      return err(new AuthenticationError());
    }

    // Look up org membership
    const membership = await this.db
      .select({
        organizationId: schema.members.organizationId,
        role:           schema.members.role,
      })
      .from(schema.members)
      .where(eq(schema.members.userId, operator.id))
      .limit(1);

    const organizationId = membership[0]?.organizationId ?? (process.env["BOOTSTRAP_ORG_ID"] ?? "org_mvp");
    const role           = membership[0]?.role ?? "owner";

    const key = await getPrivateKey();
    const jti = ulid();

    const accessToken = await new SignJWT({
      sub: operator.id,
      email: operator.email,
      organizationId,
      role,
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuedAt()
      .setExpirationTime(config.JWT_ACCESS_EXPIRY)
      .setIssuer(config.JWT_ISSUER)
      .setAudience(config.JWT_AUDIENCE)
      .setJti(jti)
      .sign(key);

    const newTokenId = randomUUID();
    const newRawRefresh = `${newTokenId}.${ulid()}`;
    const newRefreshHash = await hash(newRawRefresh, ARGON2_OPTIONS);
    const refreshExpiryMs = parseDuration(config.JWT_REFRESH_EXPIRY);

    await this.db.insert(schema.refreshTokens).values({
      id: newTokenId,
      operatorId: operator.id,
      tokenHash: newRefreshHash,
      expiresAt: new Date(Date.now() + refreshExpiryMs),
    });

    return ok({
      accessToken,
      refreshToken: newRawRefresh,
      expiresIn: 900,
      organizationId,
    });
  }
}

// ── Dev-only: auto-create + login for localhost dev mode ─────────────────────
// Only active when NODE_ENV !== 'production'. Never ships to prod.
export class DevLoginHandler {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async execute(
    email: string,
    password: string,
  ): Promise<Result<AuthTokens, AuthenticationError>> {
    if (process.env["NODE_ENV"] === "production") {
      return err(new AuthenticationError("Não disponível em produção"));
    }

    const emailLower = email.toLowerCase().trim();

    // Upsert dev user with emailVerified=true — bypasses SMTP requirement
    const passwordHash = await hash(password, ARGON2_OPTIONS);
    await this.db
      .insert(schema.operators)
      .values({
        name: "Dev Admin",
        email: emailLower,
        passwordHash,
        isActive: true,
        emailVerified: true,
      })
      .onConflictDoNothing();

    const loginHandler = new LoginHandler(this.db);
    const firstTry = await loginHandler.execute(email, password);
    if (firstTry.isOk()) return firstTry;

    // Hash mismatch (user existed with different password) — update hash
    await this.db
      .update(schema.operators)
      .set({ passwordHash, emailVerified: true, isActive: true })
      .where(eq(schema.operators.email, emailLower));

    return loginHandler.execute(email, password);
  }
}

export class LogoutHandler {
  constructor(private readonly db: PostgresJsDatabase<typeof schema>) {}

  async execute(operatorId: string): Promise<void> {
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

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return 3600000;
  const value = parseInt(match[1]!, 10);
  const unit = match[2]!;
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
  };
  return value * (multipliers[unit] ?? 3600000);
}
