import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError, NotFoundError, ValidationError, AuthenticationError, AuthorizationError } from '../../domain/shared/Result.js';

/**
 * Centralized error handler — PRD §12 response contract.
 * All errors return `{ errors: [{ code, message, field?, requestId }] }`.
 */
export function errorHandler(
  error: FastifyError | DomainError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  const requestId = request.requestId ?? 'unknown';

  // Fastify validation errors (schema-based)
  if ('validation' in error && error.validation) {
    request.log.warn({ err: error, requestId }, 'Validation error');
    void reply.status(400).send({
      errors: error.validation.map((v) => ({
        code: 'VALIDATION_ERROR',
        message: v.message ?? 'Invalid input',
        field: v.instancePath?.replace('/', '') || undefined,
        requestId,
      })),
    });
    return;
  }

  // Domain errors
  if (error instanceof ValidationError) {
    request.log.warn({ err: error, requestId }, 'Domain validation error');
    void reply.status(400).send({
      errors: [{ code: error.code, message: error.message, field: error.field, requestId }],
    });
    return;
  }

  if (error instanceof AuthenticationError) {
    request.log.warn({ err: error, requestId }, 'Authentication error');
    void reply.status(401).send({
      errors: [{ code: error.code, message: error.message, requestId }],
    });
    return;
  }

  if (error instanceof AuthorizationError) {
    request.log.warn({ err: error, requestId }, 'Authorization error');
    void reply.status(403).send({
      errors: [{ code: error.code, message: error.message, requestId }],
    });
    return;
  }

  if (error instanceof NotFoundError) {
    request.log.warn({ err: error, requestId }, 'Not found error');
    void reply.status(404).send({
      errors: [{ code: error.code, message: error.message, requestId }],
    });
    return;
  }

  if (error instanceof DomainError) {
    request.log.warn({ err: error, requestId }, 'Generic domain error');
    void reply.status(400).send({
      errors: [{ code: error.code, message: error.message, requestId }],
    });
    return;
  }

  // Rate limit errors
  if ('statusCode' in error && error.statusCode === 429) {
    request.log.warn({ err: error, requestId }, 'Rate limit error');
    void reply.status(429).send({
      errors: [{ code: 'RATE_LIMITED', message: 'Too many requests', requestId }],
    });
    return;
  }

  // Payload too large
  if ('statusCode' in error && error.statusCode === 413) {
    void reply.status(413).send({
      errors: [{ code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large', requestId }],
    });
    return;
  }

  // Unknown errors — log and return generic message
  request.log.error({ err: error, requestId }, 'Unhandled error');
  void reply.status(500).send({
    errors: [{ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', requestId }],
  });
}
