import { describe, it, expect, vi } from 'vitest';
import { DeploymentRouter, type DeploymentProvider } from '../../../../src/infrastructure/deploy/DeploymentRouter.js';
import { ok, err } from '../../../../src/domain/shared/Result.js';

describe('DeploymentRouter', () => {
  it('should use Vercel when quota is sufficient (>= 5)', async () => {
    const mockVercel = {
      getRemainingQuota: vi.fn().mockResolvedValue(10),
      deploy: vi.fn().mockResolvedValue(ok({ url: 'vercel.com', provider: 'vercel', deploymentId: '1' }))
    } as unknown as DeploymentProvider;

    const mockNetlify = {
      getRemainingQuota: vi.fn().mockResolvedValue(100),
      deploy: vi.fn().mockResolvedValue(ok({ url: 'netlify.com', provider: 'netlify', deploymentId: '2' }))
    } as unknown as DeploymentProvider;

    const router = new DeploymentRouter(mockVercel, mockNetlify);
    
    const result = await router.deploy({ projectId: 'test', sourceCodePath: '/tmp' });
    
    expect(result.isOk()).toBe(true);
    expect(result.isOk() && result.value.provider).toBe('vercel');
    expect(mockVercel.deploy).toHaveBeenCalledTimes(1);
    expect(mockNetlify.deploy).not.toHaveBeenCalled();
  });

  it('should fallback to Netlify when Vercel quota is < threshold (5)', async () => {
    const mockVercel = {
      getRemainingQuota: vi.fn().mockResolvedValue(2), // Less than 5
      deploy: vi.fn().mockResolvedValue(ok({ url: 'vercel.com', provider: 'vercel', deploymentId: '1' }))
    } as unknown as DeploymentProvider;

    const mockNetlify = {
      getRemainingQuota: vi.fn().mockResolvedValue(100),
      deploy: vi.fn().mockResolvedValue(ok({ url: 'netlify.com', provider: 'netlify', deploymentId: '2' }))
    } as unknown as DeploymentProvider;

    const router = new DeploymentRouter(mockVercel, mockNetlify);
    
    const result = await router.deploy({ projectId: 'test', sourceCodePath: '/tmp' });
    
    expect(result.isOk()).toBe(true);
    expect(result.isOk() && result.value.provider).toBe('netlify');
    expect(mockVercel.deploy).not.toHaveBeenCalled();
    expect(mockNetlify.deploy).toHaveBeenCalledTimes(1);
  });

  it('should fallback to Netlify if Vercel deploy fails despite having quota', async () => {
    const mockVercel = {
      getRemainingQuota: vi.fn().mockResolvedValue(10),
      deploy: vi.fn().mockResolvedValue(err(new Error('Vercel API down')))
    } as unknown as DeploymentProvider;

    const mockNetlify = {
      getRemainingQuota: vi.fn().mockResolvedValue(100),
      deploy: vi.fn().mockResolvedValue(ok({ url: 'netlify.com', provider: 'netlify', deploymentId: '2' }))
    } as unknown as DeploymentProvider;

    const router = new DeploymentRouter(mockVercel, mockNetlify);
    
    // Simulate quota check throwing an error or not. We covered deploy failing via error above
    // Let's test the catch block by making getRemainingQuota throw
    mockVercel.getRemainingQuota = vi.fn().mockRejectedValue(new Error('Quota check failed'));
    
    const result = await router.deploy({ projectId: 'test', sourceCodePath: '/tmp' });
    
    expect(result.isOk()).toBe(true);
    expect(result.isOk() && result.value.provider).toBe('netlify');
    expect(mockVercel.deploy).toHaveBeenCalledTimes(1); // It tried vercel anyway
    expect(mockNetlify.deploy).toHaveBeenCalledTimes(1); // Then fell back to netlify
  });
});
