import { test, expect, Page } from "@playwright/test";

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Must be called BEFORE any page.goto(), including loginViaUI,
 * so that all mocks are active for the entire test.
 */
async function setupAllMocks(page: Page) {
  // SSE — prevents hanging connections
  await page.route("**/api/events", async (route) => {
    await route.fulfill({
      body: 'event: connected\ndata: {"status":"ok"}\n\n',
      headers: { "Content-Type": "text/event-stream" },
    });
  });

  // Auth — used by loginViaUI
  await page.route("**/api/v1/auth/login", async (route) => {
    await route.fulfill({
      json: {
        data: {
          accessToken: "mocked-jwt-token",
          refreshToken: "550e8400-e29b-41d4-a716-446655440001.mocked",
        },
      },
    });
  });

  // Dashboard data needed after login redirect to /agents
  await page.route("**/api/v1/agents", async (route) => {
    await route.fulfill({ json: { data: [] } });
  });
  await page.route("**/api/v1/hitl/pending", async (route) => {
    await route.fulfill({ json: { data: [] } });
  });
  await page.route("**/api/v1/leads**", async (route) => {
    await route.fulfill({ json: { data: [] } });
  });

  // Settings API
  await page.route("**/api/v1/settings", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fulfill({ json: { data: { saved: true } } });
      return;
    }
    await route.fulfill({
      json: {
        data: [
          {
            key: "llm.openai.enabled",
            category: "llm",
            value: "true",
            isSecret: false,
            isActive: true,
          },
          {
            key: "llm.openai.api_key",
            category: "llm",
            value: "sk-••••",
            isSecret: true,
            isActive: true,
          },
          {
            key: "llm.openai.default_model",
            category: "llm",
            value: "gpt-4o-mini",
            isSecret: false,
            isActive: true,
          },
          {
            key: "messaging.telegram.bot_token",
            category: "messaging",
            value: "••••:••••",
            isSecret: true,
            isActive: true,
          },
          {
            key: "system.hitl.default_timeout_minutes",
            category: "system",
            value: "60",
            isSecret: false,
            isActive: true,
          },
          {
            key: "media.heygen.api_key",
            category: "media",
            value: "••••••••",
            isSecret: true,
            isActive: true,
          },
          {
            key: "media.seedance.default_model",
            category: "media",
            value: "seedance-1.0-pro",
            isSecret: false,
            isActive: true,
          },
          {
            key: "media.remotion.api_key",
            category: "media",
            value: "rmtn-••••••••",
            isSecret: true,
            isActive: true,
          },
        ],
      },
    });
  });

  // Test-connection endpoint
  await page.route("**/api/v1/settings/test-connection", async (route) => {
    await route.fulfill({
      json: { data: { success: true, message: "Connection OK" } },
    });
  });
}

/**
 * Full UI-driven login. Mocks must be registered BEFORE calling this.
 * Waits for /agents redirect to confirm Zustand auth state is set.
 */
async function loginViaUI(page: Page) {
  await page.goto("/login");
  await page.getByLabel(/e-mail/i).fill("operator@example.com");
  await page.getByLabel(/senha/i).fill("password123");
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/.*\/agents/, { timeout: 15000 });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Settings Hub", () => {
  test.beforeEach(async ({ page }) => {
    // Mocks FIRST — before any navigation
    await setupAllMocks(page);
    // Login via UI ensures Zustand is hydrated before navigating to /settings
    await loginViaUI(page);
  });

  // ── Navigation ────────────────────────────────────────────────────────────

  test("should load the settings page with all 4 tabs", async ({ page }) => {
    await page.goto("/settings");

    // h2 heading (not the sidebar nav link which is an <a>)
    await expect(
      page.locator("h2").filter({ hasText: /^Configurações$/ }),
    ).toBeVisible();

    // Tab triggers rendered by Shadcn Tabs (pt-BR labels)
    await expect(page.getByRole("tab", { name: /provedores/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /mensagens/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /integra/i })).toBeVisible();
    await expect(page.getByRole("tab", { name: /sistema/i })).toBeVisible();
  });

  // ── AI Providers Tab ──────────────────────────────────────────────────────

  test("should display AI provider cards on the AI tab", async ({ page }) => {
    await page.goto("/settings");

    // Use exact CardTitle text via data-slot attribute for precision
    const title = (name: string) =>
      page.locator('[data-slot="card-title"]', { hasText: name }).first();

    await expect(title("OpenAI")).toBeVisible();
    await expect(title("Anthropic")).toBeVisible();
    await expect(title("Google Gemini")).toBeVisible();
    await expect(title("Groq")).toBeVisible();
    await expect(title("Ollama (Local)")).toBeVisible();
  });

  test("should display video generation provider cards on the AI tab", async ({
    page,
  }) => {
    await page.goto("/settings");

    const title = (name: string) =>
      page.locator('[data-slot="card-title"]', { hasText: name }).first();

    await expect(title("HeyGen")).toBeVisible();
    await expect(title("Higgsfield AI")).toBeVisible();
    await expect(title("Seedance (ByteDance)")).toBeVisible();
    await expect(title("Remotion")).toBeVisible();
  });

  test("should render video provider inputs with correct ids", async ({
    page,
  }) => {
    await page.goto("/settings");

    const heygenInput = page.locator('[id="heygen-key"]');
    await expect(heygenInput).toBeVisible();
    await heygenInput.fill("hg-new-test-key");

    await expect(page.locator('[id="seedance-key"]')).toBeVisible();
    await expect(page.locator('[id="remotion-key"]')).toBeVisible();
    await expect(page.locator('[id="higgsfield-key"]')).toBeVisible();
  });

  test("should show save bar when an API key is edited", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByText(/não salvo/i)).not.toBeVisible();

    const keyInput = page.locator('[id="openai-key"]');
    await keyInput.fill("sk-newkey123456789");

    await expect(page.getByText(/não salvo/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /^salvar$/i })).toBeVisible();
    await expect(
      page.getByRole("button", { name: /descartar/i }),
    ).toBeVisible();
  });

  test("should clear pending changes on Discard", async ({ page }) => {
    await page.goto("/settings");

    const keyInput = page.locator('[id="openai-key"]');
    await keyInput.fill("sk-temporary");
    await expect(page.getByText(/não salvo/i)).toBeVisible();

    await page.getByRole("button", { name: /descartar/i }).click();
    await expect(page.getByText(/não salvo/i)).not.toBeVisible();
  });

  test("should call save API and clear pending on Save", async ({ page }) => {
    let saveCallCount = 0;

    // Listen to requests rather than overriding the beforeEach mock
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/settings") && req.method() === "PUT") {
        saveCallCount++;
      }
    });

    await page.goto("/settings");

    const keyInput = page.locator('[id="openai-key"]');
    await keyInput.fill("sk-finalnewkey");

    await page.getByRole("button", { name: /^salvar$/i }).click();

    // After successful save, pending bar disappears
    await expect(page.getByText(/não salvo/i)).not.toBeVisible({
      timeout: 8000,
    });
    expect(saveCallCount).toBeGreaterThanOrEqual(1);
  });

  // ── Messaging Tab ─────────────────────────────────────────────────────────

  test("should display messaging channel cards", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: /mensagens/i }).click();

    const title = (name: string) =>
      page.locator('[data-slot="card-title"]', { hasText: name }).first();

    await expect(title("WhatsApp")).toBeVisible();
    await expect(title("E-mail")).toBeVisible();
    await expect(title("Telegram")).toBeVisible();
    await expect(page.getByText(/evolution api/i).first()).toBeVisible();
    await expect(page.getByText(/brevo/i).first()).toBeVisible();
  });

  // ── Integrations Tab ──────────────────────────────────────────────────────

  test("should display integrations cards", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: /integra/i }).click({ force: true });
    await page.waitForLoadState("domcontentloaded");

    const title = (name: string) =>
      page.locator('[data-slot="card-title"]', { hasText: name }).first();

    await expect(title("MCP Brasil")).toBeVisible();
    await expect(title("ChromaDB")).toBeVisible();
    await expect(title("Webhooks")).toBeVisible();
  });

  // ── System Tab ────────────────────────────────────────────────────────────

  test("should display system configuration cards", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: /sistema/i }).click();

    const title = (name: string | RegExp) =>
      page.locator('[data-slot="card-title"]', { hasText: name }).first();

    await expect(title("Timeouts de HITL")).toBeVisible();
    await expect(title("Limites de Segurança")).toBeVisible();
    await expect(title(/backup/i)).toBeVisible();
  });

  test("should show export and import buttons on System tab", async ({
    page,
  }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: /sistema/i }).click();

    await expect(
      page.getByRole("button", { name: /exportar json/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /importar json/i }),
    ).toBeVisible();
  });

  test("should display HITL timeout values from store", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("tab", { name: /sistema/i }).click();

    const timeoutInput = page.locator('[id="hitl-timeout"]');
    await expect(timeoutInput).toHaveValue("60");
  });
});
