import { ulid } from "ulid";
import type { FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    requestId: string;
  }
}

/**
 * Assigns a ULID request ID to every incoming request for tracing.
 */
export async function requestIdHook(request: FastifyRequest): Promise<void> {
  request.requestId = ulid();
}
