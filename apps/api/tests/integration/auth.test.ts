import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildApp } from '../../src/app.js';
import type { FastifyInstance } from 'fastify';

describe('Auth Endpoints Integration', () => {
  let app: FastifyInstance;
  
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockResolvedValue([{ id: '1' }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
    app.container.db = mockDb as any;
  });

  it('should return 400 for invalid login payload', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'not-an-email', password: '12' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.errors[0].code).toBe('VALIDATION_ERROR');
  });

  it('should prevent enumeration by returning generic error when user not found', async () => {
    mockDb.limit.mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'test@example.com', password: 'Password123!' },
    });

    if (response.statusCode === 500) {
      console.log('500 ERROR:', response.body);
    }
    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.errors[0].code).toBe('AUTHENTICATION_ERROR');
    expect(body.errors[0].message).toBe('Credenciais inválidas');
  });

  it('should enforce rate limiting on login', async () => {
    mockDb.limit.mockResolvedValue([]); 

    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'test@example.com', password: 'Password123!' },
      });
    }

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { email: 'test@example.com', password: 'Password123!' },
    });

    expect(response.statusCode).toBe(429);
  });
});
