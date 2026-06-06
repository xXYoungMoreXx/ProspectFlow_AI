import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { ListBriefingsQuery } from "../../application/briefing/ListBriefingsQuery.js";
import { GetBriefingQuery } from "../../application/briefing/GetBriefingQuery.js";
import { ApproveBriefingUseCase } from "../../application/briefing/ApproveBriefingUseCase.js";
import { ExtractBriefingUseCase } from "../../application/briefing/ExtractBriefingUseCase.js";
import * as schema from "../../infrastructure/db/schema.js";
import type { DomainError } from "../../domain/shared/Result.js";

const MAX_ASSET_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_ASSET_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

const MAGIC_BYTES: Array<{ mime: string; bytes: number[] }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  { mime: "image/svg+xml", bytes: [] },
];

function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  if (declaredMime === "image/svg+xml") return true;
  const magic = MAGIC_BYTES.find((m) => m.mime === declaredMime);
  if (!magic || magic.bytes.length === 0) return false;
  return magic.bytes.every((b, i) => buffer[i] === b);
}

function domainErrToHttp(code: string): number {
  if (code === "NOT_FOUND") return 404;
  if (code === "CONFLICT") return 409;
  if (code === "VALIDATION_ERROR") return 422;
  if (code === "INVALID_STATE") return 409;
  return 422;
}

export async function briefingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);

  // GET /api/v1/briefings
  app.get(
    "/",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const query = new ListBriefingsQuery(app.container.briefingRepo);
      const result = await query.execute({ operatorId: request.operatorId, organizationId: request.organizationId });
      return reply.status(200).send({
        data: result.unwrap(),
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // GET /api/v1/briefings/:id
  app.get<{ Params: { id: string } }>(
    "/:id",
    { config: { rateLimit: { max: 60, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const query = new GetBriefingQuery(app.container.briefingRepo);
      const result = await query.execute({
        id: request.params.id,
        operatorId: request.operatorId,
        organizationId: request.organizationId,
      });
      if (result.isErr()) {
        const e = result.error as DomainError;
        return reply.status(domainErrToHttp(e.code)).send({
          errors: [
            { code: e.code, message: e.message, requestId: request.requestId },
          ],
        });
      }
      return reply.status(200).send({
        data: result.unwrap(),
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // PATCH /api/v1/briefings/:id/approve
  app.patch<{ Params: { id: string } }>(
    "/:id/approve",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const uc = new ApproveBriefingUseCase(
        app.container.briefingRepo,
        app.container.queue,
      );
      const result = await uc.execute({
        briefingId: request.params.id,
        operatorId: request.operatorId,
        organizationId: request.organizationId,
        correlationId: request.requestId,
      });
      if (result.isErr()) {
        const e = result.error as DomainError;
        return reply.status(domainErrToHttp(e.code)).send({
          errors: [
            { code: e.code, message: e.message, requestId: request.requestId },
          ],
        });
      }
      return reply.status(200).send({
        data: result.unwrap(),
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // POST /api/v1/briefings/:id/assets — upload logo/photo/document
  app.post<{ Params: { id: string } }>(
    "/:id/assets",
    { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const getQuery = new GetBriefingQuery(app.container.briefingRepo);
      const found = await getQuery.execute({
        id: request.params.id,
        operatorId: request.operatorId,
        organizationId: request.organizationId,
      });
      if (found.isErr()) {
        return reply.status(404).send({
          errors: [
            {
              code: "NOT_FOUND",
              message: "Briefing not found",
              requestId: request.requestId,
            },
          ],
        });
      }

      const body = request.body as {
        assetType?: string;
        mimeType?: string;
        storageRef?: string;
        sizeBytes?: number;
        content?: string; // base64 for magic bytes check
      };

      if (
        !body.assetType ||
        !body.mimeType ||
        !body.storageRef ||
        body.sizeBytes === undefined
      ) {
        return reply.status(400).send({
          errors: [
            {
              code: "VALIDATION_ERROR",
              message: "assetType, mimeType, storageRef, sizeBytes required",
              requestId: request.requestId,
            },
          ],
        });
      }
      if (body.sizeBytes > MAX_ASSET_SIZE) {
        return reply.status(422).send({
          errors: [
            {
              code: "VALIDATION_ERROR",
              message: "Asset exceeds 10MB limit",
              requestId: request.requestId,
            },
          ],
        });
      }
      if (!ALLOWED_ASSET_MIME.has(body.mimeType)) {
        return reply.status(422).send({
          errors: [
            {
              code: "VALIDATION_ERROR",
              message: `MIME type '${body.mimeType}' not allowed. Use JPEG, PNG, WebP, or SVG`,
              requestId: request.requestId,
            },
          ],
        });
      }

      let magicBytesValidated = body.mimeType === "image/svg+xml";
      if (body.content && !magicBytesValidated) {
        const buf = Buffer.from(body.content, "base64");
        magicBytesValidated = validateMagicBytes(buf, body.mimeType);
        if (!magicBytesValidated) {
          return reply.status(422).send({
            errors: [
              {
                code: "INVALID_IMAGE_MAGIC_BYTES",
                message: "File content does not match declared MIME type",
                requestId: request.requestId,
              },
            ],
          });
        }
      }

      const [row] = await app.container.db
        .insert(schema.briefingAssets)
        .values({
          briefingId: request.params.id,
          assetType: body.assetType as "logo" | "photo" | "document" | "other",
          mimeType: body.mimeType,
          storageRef: body.storageRef,
          sizeBytes: body.sizeBytes,
          magicBytesValidated,
        })
        .returning();

      return reply.status(201).send({
        data: row,
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );

  // POST /api/v1/briefings/:id/extract — manual fallback for operators when WhatsApp fails
  app.post<{ Params: { id: string } }>(
    "/:id/extract",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const uc = new ExtractBriefingUseCase(
        app.container.briefingRepo,
        app.container.redis,
      );
      const result = await uc.execute({
        briefingId: request.params.id,
        operatorId: request.operatorId,
        organizationId: request.organizationId,
        correlationId: request.requestId,
      });

      if (result.isErr()) {
        const e = result.error as DomainError;
        return reply.status(domainErrToHttp(e.code)).send({
          errors: [
            { code: e.code, message: e.message, requestId: request.requestId },
          ],
        });
      }

      const { briefingId, transcript } = result.unwrap();

      const runtimeUrl =
        process.env["PYTHON_RUNTIME_URL"] ?? "http://localhost:8001";
      try {
        await fetch(`${runtimeUrl}/tasks`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_type: "briefing.extract",
            agent_id: "system",
            correlation_id: request.requestId,
            payload: { briefingId, transcript },
          }),
          signal: AbortSignal.timeout(10_000),
        });
      } catch (fetchErr) {
        request.log.warn(
          { err: fetchErr, briefingId },
          "briefing_extract_runtime_dispatch_failed",
        );
      }

      return reply.status(200).send({
        data: { briefingId, status: "queued" },
        meta: {
          requestId: request.requestId,
          timestamp: new Date().toISOString(),
        },
      });
    },
  );
}
