import { importSPKI, jwtVerify, type JWTPayload } from 'jose';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config.js';

type JoseKey = Awaited<ReturnType<typeof importSPKI>>;

declare module 'fastify' {
  interface FastifyRequest {
    operatorId: string;
    jwtPayload: JWTPayload;
  }
}

let publicKey: JoseKey | null = null;

async function getPublicKey(): Promise<JoseKey> {
  if (!publicKey) {
    publicKey = await importSPKI(config.JWT_PUBLIC_KEY.replace(/\\n/g, '\n'), 'RS256');
  }
  return publicKey;
}

/**
 * JWT RS256 verification middleware.
 * Extracts operatorId from the verified token and attaches to request.
 * PRD §11.3: RS256 algorithm only, reject "none" algorithm.
 */
export async function authMiddleware(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    void reply.status(401).send({
      errors: [{ code: 'AUTHENTICATION_ERROR', message: 'Missing or invalid Authorization header', requestId: request.requestId }],
    });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const key = await getPublicKey();
    const { payload } = await jwtVerify(token, key, {
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
      algorithms: ['RS256'],
    });

    if (!payload.sub) {
      void reply.status(401).send({
        errors: [{ code: 'AUTHENTICATION_ERROR', message: 'Invalid token: missing subject', requestId: request.requestId }],
      });
      return;
    }

    request.operatorId = payload.sub;
    request.jwtPayload = payload;
  } catch {
    void reply.status(401).send({
      errors: [{ code: 'AUTHENTICATION_ERROR', message: 'Invalid or expired token', requestId: request.requestId }],
    });
  }
}
