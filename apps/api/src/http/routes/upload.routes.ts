import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { fileTypeFromBuffer } from 'file-type';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { invalidUploadTotal } from '../../infrastructure/metrics/registry.js';

export async function uploadRoutes(app: FastifyInstance): Promise<void> {
  // Register multipart with limits (10MB)
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit per file
    },
  });

  app.addHook('preHandler', authMiddleware);

  app.post('/', async (request, reply) => {
    const data = await request.file();
    
    if (!data) {
      invalidUploadTotal.inc({ reason: 'no_file' });
      return reply.status(400).send({
        errors: [{ code: 'VALIDATION_ERROR', message: 'No file uploaded', requestId: request.requestId }]
      });
    }

    // Wait if the file is too large, fastify-multipart will throw or truncate. 
    // toBuffer() might throw a LimitError if it exceeds fileSize.
    let buffer: Buffer;
    try {
      buffer = await data.toBuffer();
      if (data.file.truncated) {
        invalidUploadTotal.inc({ reason: 'size_limit_exceeded' });
        return reply.status(413).send({
          errors: [{ code: 'PAYLOAD_TOO_LARGE', message: 'File size exceeds 10MB limit', requestId: request.requestId }]
        });
      }
    } catch (_err: any) {
      invalidUploadTotal.inc({ reason: 'size_limit_exceeded' });
      return reply.status(413).send({
        errors: [{ code: 'PAYLOAD_TOO_LARGE', message: 'File size exceeds 10MB limit', requestId: request.requestId }]
      });
    }
    
    // Security check: validate magic bytes
    const type = await fileTypeFromBuffer(buffer);
    
    // If we can't determine type from magic bytes, and it's not a known text type
    if (!type && !data.filename.endsWith('.csv') && !data.filename.endsWith('.txt')) {
      invalidUploadTotal.inc({ reason: 'unknown_type' });
      return reply.status(400).send({
        errors: [{ code: 'VALIDATION_ERROR', message: 'Could not determine file type', requestId: request.requestId }]
      });
    }

    // Verify if it's an executable masquerading as something else
    if (type && (type.ext === 'exe' || type.mime === 'application/x-msdownload')) {
      invalidUploadTotal.inc({ reason: 'executable_file' });
      return reply.status(400).send({
        errors: [{ code: 'SECURITY_ERROR', message: 'Executable files are not allowed', requestId: request.requestId }]
      });
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'application/pdf', 'application/json'];
    const isAllowed = type && allowedMimeTypes.includes(type.mime) || data.filename.endsWith('.csv') || data.filename.endsWith('.txt');
    
    if (!isAllowed) {
      invalidUploadTotal.inc({ reason: 'blocked_mime_type' });
      return reply.status(400).send({
        errors: [{ code: 'SECURITY_ERROR', message: 'Invalid or blocked file type', requestId: request.requestId }]
      });
    }

    // Process file upload here (e.g. S3, local storage)
    // For now we just return success
    return reply.status(200).send({
      data: {
        filename: data.filename,
        mimetype: type ? type.mime : data.mimetype,
        size: buffer.length,
        url: `https://storage.agentepro.local/mock/${data.filename}`,
      },
      meta: { requestId: request.requestId, timestamp: new Date().toISOString() }
    });
  });
}
