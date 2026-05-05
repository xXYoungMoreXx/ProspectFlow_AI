import { test, expect, Page } from '@playwright/test';

// Helper to login and set state
async function loginAndSetState(page: Page) {
  await page.goto('/login');
  // Inject state directly to bypass login screen quickly for these tests
  await page.evaluate(() => {
    localStorage.setItem('agentepro_token', 'mocked-jwt-token');
    localStorage.setItem('agentepro_email', 'operator@example.com');
  });
}

test.describe('HITL Approvals Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginAndSetState(page);
  });

  test('should display empty state when no approvals pending', async ({ page }) => {
    // Mock empty response
    await page.route('**/api/v1/hitl/pending', async route => {
      await route.fulfill({ json: { data: [] } });
    });

    await page.goto('/hitl');
    
    await expect(page.getByText('All clear!')).toBeVisible();
    await expect(page.getByText('No pending approvals at this time')).toBeVisible();
  });

  test('should display pending approvals and handle approval', async ({ page }) => {
    // Mock response with one pending approval
    await page.route('**/api/v1/hitl/pending', async route => {
      await route.fulfill({
        json: {
          data: [
            {
              id: 'hitl-123',
              agentId: 'agent-456',
              actionType: 'SEND_PROPOSAL',
              status: 'PENDING',
              payload: {
                client: 'Acme Corp',
                price: 5000,
              },
              createdAt: new Date().toISOString(),
            }
          ]
        }
      });
    });

    await page.goto('/hitl');
    
    // Check if the item is displayed
    await expect(page.getByText('SEND_PROPOSAL')).toBeVisible();
    await expect(page.getByText('Acme Corp')).toBeVisible();
    
    // Setup mock for the approve action
    await page.route('**/api/v1/hitl/hitl-123/approve', async route => {
      // Once approved, return empty list for the next pending fetch
      await page.route('**/api/v1/hitl/pending', async route2 => {
        await route2.fulfill({ json: { data: [] } });
      });
      
      await route.fulfill({ json: { data: { success: true } } });
    });

    // Click Approve
    await page.getByRole('button', { name: /approve/i }).click();
    
    // Should transition to empty state because we mocked the refetch to return []
    await expect(page.getByText('All clear!')).toBeVisible();
  });

  test('should handle rejection flow with note', async ({ page }) => {
    // Mock response with one pending approval
    await page.route('**/api/v1/hitl/pending', async route => {
      await route.fulfill({
        json: {
          data: [
            {
              id: 'hitl-789',
              agentId: 'agent-456',
              actionType: 'SEND_PROPOSAL',
              status: 'PENDING',
              createdAt: new Date().toISOString(),
            }
          ]
        }
      });
    });

    await page.goto('/hitl');
    
    // Setup mock for the reject action
    let capturedNote = '';
    await page.route('**/api/v1/hitl/hitl-789/reject', async route => {
      const postData = JSON.parse(route.request().postData() || '{}');
      capturedNote = postData.note;
      
      // Once rejected, return empty list for the next pending fetch
      await page.route('**/api/v1/hitl/pending', async route2 => {
        await route2.fulfill({ json: { data: [] } });
      });
      
      await route.fulfill({ json: { data: { success: true } } });
    });

    // Click Reject to open Dialog
    await page.getByRole('button', { name: /reject/i }).click();
    
    // Expect Dialog to be open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /reject action/i })).toBeVisible();
    
    // Fill the reason
    await page.getByLabel(/reason/i).fill('Price is too low');
    
    // Confirm rejection
    await page.getByRole('button', { name: /confirm reject/i }).click();
    
    // Should transition to empty state
    await expect(page.getByText('All clear!')).toBeVisible();
    
    // Verify the note was sent to the API
    expect(capturedNote).toBe('Price is too low');
  });
});
