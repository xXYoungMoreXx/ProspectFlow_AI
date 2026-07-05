import { test, expect } from "@playwright/test";

test.describe("Agents Module E2E", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");

    // Mock API responses for login
    await page.route("**/api/v1/auth/refresh", async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          data: {
            accessToken: "mocked-jwt-token",
            refreshToken:
              "eb24050a-5c12-42b7-873b-554471e98d1a.mocked-refresh-token",
          },
        },
      });
    });

    await page.route("**/api/v1/auth/login", async (route) => {
      await route.fulfill({
        status: 200,
        json: {
          data: {
            accessToken: "mocked-jwt-token",
            refreshToken:
              "eb24050a-5c12-42b7-873b-554471e98d1a.mocked-refresh-token",
          },
        },
      });
    });

    // Mock Agents List API
    await page.route("**/api/v1/agents", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              {
                id: "agent-1",
                name: "Alpha Hunter",
                persona: "HUNTER",
                status: "ACTIVE",
                llmConfig: { model: "claude-4.7-sonnet" },
                skills: ["web_search", "read_file"],
              },
            ],
          }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByLabel(/e-mail/i).fill("operator@example.com");
    await page.getByLabel(/senha/i).fill("securepassword123");
    await page.getByRole("button", { name: /entrar/i }).click();

    await expect(page).toHaveURL(/.*\/agents/);
  });

  test("should display the agents list and navigate to new agent form", async ({
    page,
  }) => {
    // Check if the agents page loaded and shows the mocked agent
    await expect(
      page.getByRole("heading", { name: /agentes de ia/i }),
    ).toBeVisible();
    await expect(page.getByText("Alpha Hunter")).toBeVisible();
    await expect(page.getByText("claude-4.7-sonnet")).toBeVisible();

    // Navigate to new agent
    await page.getByRole("button", { name: /novo agente/i }).click();
    await expect(page).toHaveURL(/.*\/agents\/new/);
    await expect(
      page.getByRole("heading", { name: /criar agente/i }),
    ).toBeVisible();
  });

  test("should allow filling the new agent form including skills and knowledge base", async ({
    page,
  }) => {
    await page.goto("/agents/new");

    // Fill general config
    await page.getByLabel(/nome do agente/i).fill("Support Bot Beta");

    // Select persona
    await page.getByRole("combobox").first().click();
    await page
      .getByRole("option", { name: /qa \(garantia de qualidade\)/i })
      .click();

    // Fill prompt and check token counter
    const promptInput = page.getByPlaceholder(
      /especialista em geração de leads/i,
    );
    await promptInput.fill("You are a helpful assistant.");

    // Check if token counter updates (6 words ~ 8 tokens)
    await expect(page.getByText("~7 tokens")).toBeVisible(); // 5 words * 1.3 = 6.5 (ceil = 7)

    // Select LLM provider (Google) — provider names are not translated
    await page.getByRole("combobox").nth(1).click();
    await page.getByRole("option", { name: "Google Gemini" }).click();

    // Select LLM model — model names are not translated
    await page.getByRole("combobox").nth(2).click();
    await page
      .getByRole("option", { name: "Gemini 3.1 Pro", exact: true })
      .click();

    // Toggle a skill
    await page.getByRole("switch", { name: /busca web/i }).click();

    // Using a fake file input trigger
    await page.locator('input[type="file"]').setInputFiles({
      name: "kb-document.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("mock pdf content"),
    });

    // Confirm the upload started (validates onChange fired) before waiting
    // for the simulated upload to finish — avoids a fixed-timeout race.
    await expect(page.getByText(/validando e enviando/i)).toBeVisible();

    // Check if file appears in list
    await expect(page.getByText("kb-document.pdf")).toBeVisible();

    // Validate the Deploy Agent button is active
    const saveButton = page.getByRole("button", { name: /implantar agente/i });
    await expect(saveButton).not.toBeDisabled();
  });
});
