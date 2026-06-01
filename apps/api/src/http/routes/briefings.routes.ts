import type { FastifyInstance } from "fastify";
import { authMiddleware } from "../middleware/auth.middleware.js";
import { eq, desc } from "drizzle-orm";
import * as schema from "../../infrastructure/db/schema.js";
import { DrizzleBriefingRepository } from "../../infrastructure/db/repositories/DrizzleBriefingRepository.js";

const MAX_ASSET_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_ASSET_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

// Magic bytes for image validation
const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF header
  { mime: "image/svg+xml", bytes: [] }, // SVG is text, skip magic check
];

function validateMagicBytes(buffer: Buffer, declaredMime: string): boolean {
  if (declaredMime === "image/svg+xml") return true; // SVG = XML text, skip
  const magic = MAGIC_BYTES.find((m) => m.mime === declaredMime);
  if (!magic || magic.bytes.length === 0) return false;
  return magic.bytes.every((b, i) => buffer[i] === b);
}

export async function briefingRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", authMiddleware);

  const getBriefingRepo = () => new DrizzleBriefingRepository(app.container.db);

  // GET /api/v1/briefings
  app.get("/", async (request, reply) => {
    const rows = await app.container.db
      .select()
      .from(schema.briefings)
      .where(eq(schema.briefings.operatorId, request.operatorId))
      .orderBy(desc(schema.briefings.createdAt))
      .limit(50);

    return reply.status(200).send({
      data: rows,
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // GET /api/v1/briefings/:id
  app.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const repo = getBriefingRepo();
    const briefing = await repo.findById(request.params.id, request.operatorId);
    if (!briefing) {
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
    return reply.status(200).send({
      data: briefing.toJSON(),
      meta: {
        requestId: request.requestId,
        timestamp: new Date().toISOString(),
      },
    });
  });

  // PATCH /api/v1/briefings/:id/approve — emits BriefingApproved and triggers Builder
  app.patch<{ Params: { id: string } }>(
    "/:id/approve",
    async (request, reply) => {
      const repo = getBriefingRepo();
      const briefing = await repo.findById(
        request.params.id,
        request.operatorId,
      );
      if (!briefing) {
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

      const result = briefing.approve();
      if (result.isErr()) {
        return reply.status(409).send({
          errors: [
            {
              code: "INVALID_STATE",
              message: result.error.message,
              requestId: request.requestId,
            },
          ],
        });
      }

      await repo.save(briefing);

      // Publish BriefingApproved event — triggers Builder agent
      const events = briefing.clearDomainEvents();
      for (const event of events) {
        await app.container.queue.publishEvent(event);
      }

      // Dispatch builder task
      await app.container.queue.enqueueAgentTask(
        "builder.generate",
        {
          briefingId: briefing.id,
          dealId: briefing.dealId,
          briefingData: briefing.briefingData,
        },
        request.requestId,
      );

      return reply.status(200).send({
        data: briefing.toJSON(),
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
    async (request, reply) => {
      const repo = getBriefingRepo();
      const briefing = await repo.findById(
        request.params.id,
        request.operatorId,
      );
      if (!briefing) {
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
        // base64 content for magic bytes check
        content?: string;
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

      // Magic bytes validation when base64 content provided
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
          briefingId: briefing.id,
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
}
