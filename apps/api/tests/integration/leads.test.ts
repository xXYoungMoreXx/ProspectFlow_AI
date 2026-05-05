import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';
import { SignJWT, importPKCS8 } from 'jose';
import { ulid } from 'ulid';

describe('Leads Endpoints Integration', () => {
  let app: FastifyInstance;
  let validToken: string;
  
  const mockLeadRepo = {
    save: vi.fn(),
    findById: vi.fn(),
    findList: vi.fn(),
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
    app.container.leadRepo = mockLeadRepo as any;
  });

  it('should create a lead successfully', async () => {
    mockLeadRepo.save.mockResolvedValueOnce(undefined);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/leads',
      headers: { authorization: `Bearer ${validToken}` },
      payload: { contactName: 'Test Lead', contactCompany: 'example.com', contactEmail: 'test@example.com' },
    });

    if (response.statusCode === 400) console.log(response.body);
    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.data.contact.name).toBe('Test Lead');
  });

  it('should return validation error for invalid lead', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/leads',
      headers: { authorization: `Bearer ${validToken}` },
      payload: { contactName: '', contactCompany: 'invalid' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('should return 404 for unknown lead', async () => {
    mockLeadRepo.findById.mockResolvedValueOnce(null);

    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/leads/lead-123',
      headers: { authorization: `Bearer ${validToken}` },
    });

    expect(response.statusCode).toBe(404);
  });
});
