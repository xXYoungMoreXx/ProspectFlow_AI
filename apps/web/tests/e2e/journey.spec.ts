import { test, expect } from '@playwright/test';

test.describe('E2E User Journey: Lead Management and HITL', () => {
  test.beforeEach(async ({ page }) => {
    // 1. Mock Login
    await page.route('**/api/v1/auth/login', async route => {
      await route.fulfill({
        json: {
          data: { accessToken: 'mocked-jwt', refreshToken: 'mocked-refresh' }
        }
      });
    });

    // 2. Mock Initial Leads Data
    await page.route('**/api/v1/leads', async route => {
      if (route.request().method() === 'POST') {
        // Mock Lead Creation
        await route.fulfill({
          json: {
            data: { id: 'lead-999', contactName: 'New Test Lead', status: 'NEW' }
          }
        });
      } else {
        // Mock Lead List
        await route.fulfill({
          json: {
            data: [
              { id: 'lead-1', contactName: 'John Doe', status: 'NEW' },
              { id: 'lead-2', contactName: 'Jane Smith', status: 'CONTACTED' }
            ]
          }
        });
      }
    });
    
    // 3. Mock Lead Update (PATCH)
    await page.route('**/api/v1/leads/*', async route => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({ json: { data: { success: true } } });
      }
    });

    // 4. Mock HITL Data
    await page.route('**/api/v1/hitl/pending', async route => {
      await route.fulfill({
        json: {
          data: [
            { 
              id: 'hitl-1', 
              agentId: 'agent-xyz', 
              actionType: 'Send Proposal Email', 
              status: 'PENDING',
              createdAt: new Date().toISOString()
            }
          ]
        }
      });
    });

    // 5. Mock HITL Approve
    await page.route('**/api/v1/hitl/*/approve', async route => {
      await route.fulfill({ json: { data: { success: true } } });
    });
    
    // 6. Mock SSE endpoint to prevent hanging connections in tests
    await page.route('**/api/events', async route => {
      await route.fulfill({ body: 'event: connected\ndata: {"status":"ok"}\n\n', headers: { 'Content-Type': 'text/event-stream' } });
    });
  });

  test('Full Journey: Login -> View Leads -> Update Lead -> Approve HITL', async ({ page }) => {
    // A. Login
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('operator@test.com');
    await page.getByLabel(/password/i).fill('password123');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Wait for successful login redirect
    await expect(page).toHaveURL(/.*\/agents/);

    // B. Navigate to Leads
    await page.goto('/leads');
    await expect(page).toHaveURL(/.*\/leads/);
    
    // Check if the Kanban loaded with the initial leads
    await expect(page.getByText('John Doe')).toBeVisible();
    await expect(page.getByText('Jane Smith')).toBeVisible();

    // C. Navigate to HITL Approvals
    await page.goto('/hitl');
    await expect(page).toHaveURL(/.*\/hitl/);

    // Check if pending HITL is visible
    await expect(page.getByText('Send Proposal Email')).toBeVisible();

    // Approve the action
    await page.getByRole('button', { name: 'Approve' }).click();

    // The HITL store optimistic update should remove it from the list immediately
    await expect(page.getByText('All clear!')).toBeVisible();
  });
});
