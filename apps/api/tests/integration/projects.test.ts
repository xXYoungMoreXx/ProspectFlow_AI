import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';
import { SignJWT, importPKCS8 } from 'jose';
import { ulid } from 'ulid';

describe('Projects Endpoints Integration', () => {
  let app: FastifyInstance;
  let validToken: string;
  
  const mockProjectRepo = {
    save: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
  };

  beforeAll(async () => {
    const keyStr = process.env.JWT_PRIVATE_KEY || 'dummy';
    const key = await importPKCS8(keyStr.replace(/\\n/g, '\n'), 'RS256');
    validToken = await new SignJWT({ sub: 'op-123', email: 'test@example.com' })
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('agentepro.local')
      .setAudience('agentepro-api')
      .setJti(ulid())
      .sign(key);
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    app.container.projectRepo = mockProjectRepo as any;
  });

  it('should return empty list of projects', async () => {
    mockProjectRepo.findMany.mockResolvedValueOnce({ projects: [], total: 0, nextCursor: null });

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/projects',
      headers: { authorization: `Bearer ${validToken}` },
    });

    if (response.statusCode === 500) console.log(response.body);
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toEqual([]);
    expect(mockProjectRepo.findMany).toHaveBeenCalled();
  });

  it('should return 404 for unknown project by id', async () => {
    mockProjectRepo.findById.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/projects/proj-123',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
