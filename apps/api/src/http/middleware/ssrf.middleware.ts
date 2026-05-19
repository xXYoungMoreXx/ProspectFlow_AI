import type { FastifyRequest, FastifyReply } from "fastify";
import { ssrfBlockedTotal } from "../../infrastructure/metrics/registry.js";

export async function ssrfMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  // Check common SSRF patterns in request query/body
  const strBody = JSON.stringify(request.body || {});
  const strQuery = JSON.stringify(request.query || {});

  const ssrfPatterns = [
    /169\.254\.169\.254/i, // AWS/GCP Metadata
    /metadata\.google\.internal/i,
    /127\.0\.0\.1/i,
    /localhost/i,
    /0\.0\.0\.0/i,
    /file:\/\//i,
    /gopher:\/\//i,
  ];

  for (const pattern of ssrfPatterns) {
    if (pattern.test(strBody) || pattern.test(strQuery)) {
      ssrfBlockedTotal.inc();
      return reply.status(400).send({
        errors: [
          {
            code: "SECURITY_ERROR",
            message: "Blocked by SSRF protection",
            requestId: request.requestId,
          },
        ],
      });
    }
  }
}
