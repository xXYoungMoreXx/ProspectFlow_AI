import type { FastifyInstance } from "fastify";
import {
  LoginHandler,
  RefreshTokenHandler,
  LogoutHandler,
  RegisterHandler,
  VerifyEmailHandler,
  ForgotPasswordHandler,
  ResetPasswordHandler,
  ResendVerificationHandler,
  DevLoginHandler,
} from "../../application/auth/auth.handlers.js";
import {
  LoginSchema,
  RefreshSchema,
  RegisterSchema,
  VerifyEmailSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  ResendVerificationSchema,
} from "../schemas/auth.schemas.js";
import { authMiddleware } from "../middleware/auth.middleware.js";

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post(
    "/register",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "1 hour",
        },
      },
    },
    async (request, reply) => {
      const parsed = RegisterSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            field: i.path.join("."),
            requestId: request.requestId,
          })),
        });
      }

      const handler = new RegisterHandler(
        app.container.db,
        app.container.authEmailService,
      );
      const result = await handler.execute(parsed.data);

      if (result.isErr()) {
        return reply.status(500).send({
          errors: [
            {
              code: "INTERNAL_ERROR",
              message: "Erro ao registrar usuário",
              requestId: request.requestId,
            },
          ],
        });
      }

      return reply.status(200).send({
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  app.post(
    "/verify-email",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
    },
    async (request, reply) => {
      const parsed = VerifyEmailSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            field: i.path.join("."),
            requestId: request.requestId,
          })),
        });
      }

      const handler = new VerifyEmailHandler(app.container.db);
      const result = await handler.execute(parsed.data.token);

      if (result.isErr()) {
        return reply.status(400).send({
          errors: [
            {
              code: "INVALID_TOKEN",
              message: "Token inválido ou expirado",
              requestId: request.requestId,
            },
          ],
        });
      }

      return reply.status(200).send({
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  app.post(
    "/resend-verification",
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: "1 hour",
        },
      },
    },
    async (request, reply) => {
      const parsed = ResendVerificationSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            field: i.path.join("."),
            requestId: request.requestId,
          })),
        });
      }

      const handler = new ResendVerificationHandler(
        app.container.db,
        app.container.authEmailService,
      );
      await handler.execute(parsed.data.email);

      return reply.status(200).send({
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  app.post(
    "/forgot-password",
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: "1 hour",
        },
      },
    },
    async (request, reply) => {
      const parsed = ForgotPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            field: i.path.join("."),
            requestId: request.requestId,
          })),
        });
      }

      const handler = new ForgotPasswordHandler(
        app.container.db,
        app.container.authEmailService,
      );
      await handler.execute(parsed.data.email);

      return reply.status(200).send({
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  app.post(
    "/reset-password",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
    },
    async (request, reply) => {
      const parsed = ResetPasswordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            field: i.path.join("."),
            requestId: request.requestId,
          })),
        });
      }

      const handler = new ResetPasswordHandler(app.container.db);
      const result = await handler.execute(
        parsed.data.token,
        parsed.data.password,
      );

      if (result.isErr()) {
        return reply.status(400).send({
          errors: [
            {
              code: "INVALID_TOKEN",
              message: "Token inválido ou expirado",
              requestId: request.requestId,
            },
          ],
        });
      }

      return reply.status(200).send({
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // Rate limit: 5 attempts per 15 minutes for login (PRD §11.8)
  app.post(
    "/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: "15 minutes",
        },
      },
    },
    async (request, reply) => {
      const parsed = LoginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          errors: parsed.error.issues.map((i) => ({
            code: "VALIDATION_ERROR",
            message: i.message,
            field: i.path.join("."),
            requestId: request.requestId,
          })),
        });
      }

      const loginHandler = new LoginHandler(app.container.db);
      const result = await loginHandler.execute(
        parsed.data.email,
        parsed.data.password,
      );
      if (result.isErr()) {
        // Generic message — anti-enumeration (PRD §11.2)
        return reply.status(401).send({
          errors: [
            {
              code: "AUTHENTICATION_ERROR",
              message: result.error.message || "Credenciais inválidas",
              requestId: request.requestId,
            },
          ],
        });
      }

      return reply.status(200).send({
        data: result.value,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  app.post("/refresh", async (request, reply) => {
    const parsed = RefreshSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({
          code: "VALIDATION_ERROR",
          message: i.message,
          field: i.path.join("."),
          requestId: request.requestId,
        })),
      });
    }

    const refreshHandler = new RefreshTokenHandler(app.container.db);
    const result = await refreshHandler.execute(parsed.data.refreshToken);
    if (result.isErr()) {
      return reply.status(401).send({
        errors: [
          {
            code: "AUTHENTICATION_ERROR",
            message: "Credenciais inválidas",
            requestId: request.requestId,
          },
        ],
      });
    }

    return reply.status(200).send({
      data: result.value,
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.delete(
    "/logout",
    { preHandler: authMiddleware },
    async (request, reply) => {
      const logoutHandler = new LogoutHandler(app.container.db);
      await logoutHandler.execute(request.operatorId);
      return reply.status(204).send();
    },
  );

  // Dev-only endpoint — creates or re-authenticates a dev user without SMTP
  // Disabled in production (handler enforces NODE_ENV check)
  if (process.env.NODE_ENV !== "production") {
    app.post("/dev-login", async (request, reply) => {
      const body = request.body as { email?: string; password?: string };
      const email =
        body?.email ?? process.env.DEV_ADMIN_EMAIL ?? "admin@agentepro.dev";
      const password =
        body?.password ?? process.env.DEV_ADMIN_PASSWORD ?? "admin123";

      const handler = new DevLoginHandler(app.container.db);
      const result = await handler.execute(email, password);

      if (result.isErr()) {
        return reply.status(401).send({
          errors: [
            {
              code: "AUTH_ERROR",
              message: result.error.message,
              requestId: request.requestId,
            },
          ],
        });
      }

      return reply.status(200).send({
        data: result.value,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    });
  }
}
