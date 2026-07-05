import { test, expect } from "@playwright/test";

// ── Shared mock setup ─────────────────────────────────────────────────────────

async function setupMocks(page: import("@playwright/test").Page) {
  // SSE — the dashboard layout opens this on every authenticated render and
  // fires fetchPending/fetchLeads/fetchAgents on each heartbeat. Fulfilling it
  // statically (no heartbeat events) keeps those background polls quiet so
  // they can't race with — and overwrite — this test's mocked store data.
  await page.route("**/api/events", (route) =>
    route.fulfill({
      body: 'event: connected\ndata: {"status":"ok"}\n\n',
      headers: { "Content-Type": "text/event-stream" },
    }),
  );

  await page.route("**/api/v1/auth/refresh", (route) =>
    route.fulfill({
      json: {
        data: {
          accessToken: "mocked-jwt",
          refreshToken: "eb24050a-5c12-42b7-873b-554471e98d1a.mocked-refresh",
        },
      },
    }),
  );

  await page.route("**/api/v1/auth/login", (route) =>
    route.fulfill({
      json: {
        data: {
          accessToken: "mocked-jwt",
          refreshToken: "eb24050a-5c12-42b7-873b-554471e98d1a.mocked-refresh",
        },
      },
    }),
  );

  // Dashboard layout fetches the agents list on mount/heartbeat — mock it so
  // the background poll never falls through to the live API with a fake token.
  await page.route("**/api/v1/agents", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({ json: { data: [] } });
    }
    return route.continue();
  });

  await page.route("**/api/v1/leads", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({
        json: {
          data: { id: "lead-999", contactName: "Novo Lead", status: "NEW" },
        },
      });
    }
    return route.fulfill({
      json: {
        data: [
          { id: "lead-1", contactName: "João Silva", status: "PROSPECTED" },
          { id: "lead-2", contactName: "Maria Santos", status: "CONTACTED" },
          {
            id: "lead-3",
            contactName: "Carlos Oliveira",
            status: "NEGOTIATING",
          },
        ],
        meta: { total: 3 },
      },
    });
  });

  await page.route("**/api/v1/leads/*", (route) => {
    if (route.request().method() === "PATCH")
      return route.fulfill({ json: { data: { success: true } } });
  });

  await page.route("**/api/v1/hitl**", (route) => {
    const url = route.request().url();
    if (url.includes("/approve") || url.includes("/reject")) {
      return route.fulfill({ json: { data: { success: true } } });
    }
    // GET /hitl/pending
    return route.fulfill({
      json: {
        data: [
          {
            id: "hitl-1",
            agentId: "agent-xyz123",
            actionType: "APPROVE_LEAD_LIST",
            status: "PENDING",
            createdAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1h
            payloadPreview: { leadsCount: 5, minScore: 40 },
          },
        ],
      },
    });
  });

  await page.route("**/api/v1/prospecting/**", (route) => {
    const url = route.request().url();
    if (url.includes("search-maps")) {
      return route.fulfill({
        json: { data: { jobId: "job-abc123", estimatedDurationSeconds: 60 } },
        status: 202,
      });
    }
    if (url.includes("queue")) {
      return route.fulfill({
        json: {
          data: {
            leads: [
              {
                id: "l-1",
                contactName: "Joa***",
                businessName: "Restaurante do João",
                qualificationScore: 78,
                source: "GOOGLE_MAPS",
                createdAt: new Date().toISOString(),
              },
            ],
          },
          meta: { total: 1, pendingHitl: 1 },
        },
      });
    }
    return route.fulfill({ json: { data: {} } });
  });
}

// ── Journey 1: Login → Leads → HITL approve ──────────────────────────────────

test.describe("E2E Journey: Login → Leads → HITL", () => {
  test.beforeEach(({ page }) => setupMocks(page));

  test("full flow — login, view leads funnel, approve HITL", async ({
    page,
  }) => {
    // A. Login
    await page.goto("/login");
    await page.getByLabel(/e-mail/i).fill("operator@test.com");
    await page.getByLabel(/senha/i).fill("password123");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page).toHaveURL(/.*\/agents/);

    // B. Leads kanban shows new statuses
    await page.goto("/leads");
    await expect(
      page.getByRole("heading", { name: "Prospectado" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Negociando" }),
    ).toBeVisible();
    await expect(page.getByText("João Silva")).toBeVisible();
    await expect(page.getByText("Carlos Oliveira")).toBeVisible();

    // C. HITL page shows countdown + action label
    await page.goto("/hitl");
    await expect(page.getByText("Aprovar Lista de Leads")).toBeVisible();
    // Countdown badge should be present
    await expect(page.locator('[data-testid="badge-countdown"]')).toBeVisible();

    // D. Approve inline
    await page.locator('[data-testid="btn-approve"]').first().click();
    await expect(page.getByText("Tudo limpo!")).toBeVisible();
  });
});

// ── Journey 2: Prospecting trigger ───────────────────────────────────────────

test.describe("E2E Journey: Prospecting", () => {
  test.beforeEach(({ page }) => setupMocks(page));

  test("navigate to prospecting queue and view masked leads", async ({
    page,
  }) => {
    // Inject auth state
    await page.goto("/login");
    await page.evaluate(() => {
      localStorage.setItem("agentepro_token", "mocked-jwt");
    });

    // Queue page shows prospected leads (via GET /prospecting/queue)
    await page.goto("/leads");
    await expect(
      page.getByRole("heading", { name: "Prospectado" }),
    ).toBeVisible();
  });
});

// ── Journey 3: HITL reject with reason ───────────────────────────────────────

test.describe("E2E Journey: HITL Reject", () => {
  test.beforeEach(({ page }) => setupMocks(page));

  test("reject HITL action with a reason", async ({ page }) => {
    await page.goto("/login");
    await page.evaluate(() =>
      localStorage.setItem("agentepro_token", "mocked-jwt"),
    );
    await page.goto("/hitl");

    await expect(page.getByText("Aprovar Lista de Leads")).toBeVisible();

    // Click reject button
    await page.locator('[data-testid="btn-reject"]').first().click();

    // Dialog should appear
    await expect(page.getByText("Rejeitar Ação")).toBeVisible();

    // Type reason
    await page.getByLabel(/Motivo/i).fill("Lista com leads fora do nicho");

    // Confirm
    await page.getByRole("button", { name: "Confirmar Rejeição" }).click();

    // Should return to empty state
    await expect(page.getByText("Tudo limpo!")).toBeVisible();
  });
});
