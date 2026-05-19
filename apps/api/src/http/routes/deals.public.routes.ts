import type { FastifyInstance } from "fastify";
import { RecordContractAcceptanceHandler } from "../../application/deal/RecordContractAcceptanceHandler.js";
import { z } from "zod";

const AcceptProposalSchema = z.object({
  contractText: z.string(),
});

export async function publicDealRoutes(app: FastifyInstance): Promise<void> {
  // Public routes (no authMiddleware)

  app.get<{ Params: { id: string }; Querystring: { token: string } }>(
    "/:id/proposal",
    async (request, reply) => {
      // In a real app, this would return an HTML page or redirect to frontend
      // For API purposes, we just return the proposal details if token is valid.
      // The actual token validation for acceptance is in RecordContractAcceptanceHandler.
      return reply.status(200).send({
        message:
          "Please submit a POST to /:id/accept with the token and contractText to accept.",
        dealId: request.params.id,
        token: request.query.token,
      });
    },
  );

  app.post<{
    Params: { id: string };
    Querystring: { token: string };
    Body: z.infer<typeof AcceptProposalSchema>;
  }>("/:id/accept", async (request, reply) => {
    const parsed = AcceptProposalSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        errors: parsed.error.issues.map((i) => ({
          code: "VALIDATION_ERROR",
          message: i.message,
          field: i.path.join("."),
        })),
      });
    }

    if (!request.query.token) {
      return reply
        .status(401)
        .send({
          errors: [{ code: "UNAUTHORIZED", message: "Token is required" }],
        });
    }

    const handler = new RecordContractAcceptanceHandler(
      app.container.contractAcceptanceRepo,
      process.env["JWT_SECRET"] || "super-secret-key",
    );

    const result = await handler.execute({
      token: request.query.token,
      dealId: request.params.id,
      ipRaw: request.ip || "127.0.0.1",
      userAgent: request.headers["user-agent"] || "unknown",
      sessionId: (request.headers["x-session-id"] as string) || "anonymous",
      contractText: parsed.data.contractText,
    });

    if (result.isErr()) {
      return reply
        .status(400)
        .send({
          errors: [{ code: "VALIDATION_ERROR", message: result.error.message }],
        });
    }

    return reply.status(200).send({
      data: { status: "ACCEPTED" },
      meta: { timestamp: new Date().toISOString() },
    });
  });
}
