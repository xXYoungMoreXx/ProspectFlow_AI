import { test, expect } from '@playwright/test';

test.describe('Agents Module E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    // Mock user authentication context using correct keys
    await page.evaluate(() => {
      localStorage.setItem('agentepro_token', 'mocked-jwt-token');
      localStorage.setItem('agentepro_email', 'operator@example.com');
    });

    // Mock Agents List API
    await page.route('**/api/v1/agents', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: [
              {
                id: 'agent-1',
                name: 'Alpha Hunter',
                persona: 'HUNTER',
                status: 'ACTIVE',
                llmConfig: { model: 'claude-4.7-sonnet' },
                skills: ['web_search', 'read_file']
              }
            ]
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto('/agents');
    await page.waitForLoadState('networkidle');
  });

  test('should display the agents list and navigate to new agent form', async ({ page }) => {
    // Check if the agents page loaded and shows the mocked agent
    await expect(page.getByRole('heading', { name: 'AI Agents' })).toBeVisible();
    await expect(page.getByText('Alpha Hunter')).toBeVisible();
    await expect(page.getByText('claude-4.7-sonnet')).toBeVisible();

    // Navigate to new agent
    await page.getByRole('button', { name: 'New Agent' }).click();
    await expect(page).toHaveURL(/.*\/agents\/new/);
    await expect(page.getByRole('heading', { name: 'Create Agent' })).toBeVisible();
  });

  test('should allow filling the new agent form including skills and knowledge base', async ({ page }) => {
    await page.goto('/agents/new');

    // Fill general config
    await page.getByLabel('Agent Name').fill('Support Bot Beta');
    
    // Select persona
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'QA (Quality Assurance)' }).click();

    // Fill prompt and check token counter
    const promptInput = page.getByPlaceholder('You are an expert lead generator...');
    await promptInput.fill('You are a helpful assistant.');
    
    // Check if token counter updates (6 words ~ 8 tokens)
    await expect(page.getByText('~7 tokens')).toBeVisible(); // 5 words * 1.3 = 6.5 (ceil = 7)

    // Select LLM provider (Google)
    await page.getByRole('combobox').nth(1).click();
    await page.getByRole('option', { name: 'Google Gemini' }).click();

    // Select LLM model
    await page.getByRole('combobox').nth(2).click();
    await page.getByRole('option', { name: 'Gemini 3.1 Pro', exact: true }).click();

    // Toggle a skill
    await page.getByRole('switch', { name: 'Web Search' }).click();

    // Using a fake file input trigger
    await page.locator('input[type="file"]').setInputFiles({
      name: 'kb-document.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('mock pdf content')
    });
    
    // Explicitly wait for the upload to complete
    await page.waitForTimeout(2000);

    // Check if file appears in list
    await expect(page.getByText('kb-document.pdf')).toBeVisible();

    // Validate the Deploy Agent button is active
    const saveButton = page.getByRole('button', { name: 'Deploy Agent' });
    await expect(saveButton).not.toBeDisabled();
  });
});
