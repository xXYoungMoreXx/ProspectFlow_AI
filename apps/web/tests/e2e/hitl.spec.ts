import { test, expect, Page } from "@playwright/test";

// Helper to login and set state
async function loginAndSetState(page: Page) {
  await page.goto("/login");

  // Mock refresh to prevent logout loops
  await page.route("**/api/v1/auth/refresh", async (route) => {
    await route.fulfill({
      json: {
        data: {
          accessToken: "mocked-jwt-token",
          refreshToken: "eb24050a-5c12-42b7-873b-554471e98d1a.mocked-refresh",
        },
      },
    });
  });

  // Inject state directly to bypass login screen quickly for these tests
  await page.evaluate(() => {
    localStorage.setItem("agentepro_token", "mocked-jwt-token");
    localStorage.setItem(
      "agentepro_refresh_token",
      "eb24050a-5c12-42b7-873b-554471e98d1a.mocked-refresh",
    );
    localStorage.setItem("agentepro_email", "operator@example.com");
  });
}

test.describe("HITL Approvals Flow", () => {
  test.beforeEach(async ({ page }) => {
    await loginAndSetState(page);
  });

  test("should display empty state when no approvals pending", async ({
    page,
  }) => {
    // Mock empty response
    await page.route("**/api/v1/hitl/pending", async (route) => {
      await route.fulfill({ json: { data: [] } });
    });

    await page.goto("/hitl");

    await expect(page.getByText("Tudo limpo!")).toBeVisible();
    await expect(
      page.getByText("Nenhuma aprovação pendente no momento"),
    ).toBeVisible();
  });

  test("should display pending approvals and handle approval", async ({
    page,
  }) => {
    // Mock response with one pending approval
    await page.route("**/api/v1/hitl/pending", async (route) => {
      await route.fulfill({
        json: {
          data: [
            {
              id: "hitl-123",
              agentId: "agent-456",
              actionType: "SEND_PROPOSAL",
              status: "PENDING",
              payloadPreview: { client: "Acme Corp", price: 5000 },
              createdAt: new Date().toISOString(),
            },
          ],
        },
      });
    });

    await page.goto("/hitl");

    // ACTION_LABELS maps SEND_PROPOSAL → "Enviar Proposta"
    await expect(page.getByText("Enviar Proposta")).toBeVisible();
    await expect(page.getByTestId("hitl-card")).toBeVisible();

    // Setup mock for the approve action
    await page.route("**/api/v1/hitl/hitl-123/approve", async (route) => {
      // Once approved, return empty list for the next pending fetch
      await page.route("**/api/v1/hitl/pending", async (route2) => {
        await route2.fulfill({ json: { data: [] } });
      });

      await route.fulfill({ json: { data: { success: true } } });
    });

    // Click Approve — Portuguese label "Aprovar"
    await page.getByRole("button", { name: /aprovar/i }).click();

    // Should transition to empty state
    await expect(page.getByText("Tudo limpo!")).toBeVisible();
  });

  test("should handle rejection flow with note", async ({ page }) => {
    // Mock response with one pending approval
    await page.route("**/api/v1/hitl/pending", async (route) => {
      await route.fulfill({
        json: {
          data: [
            {
              id: "hitl-789",
              agentId: "agent-456",
              actionType: "SEND_PROPOSAL",
              status: "PENDING",
              createdAt: new Date().toISOString(),
            },
          ],
        },
      });
    });

    await page.goto("/hitl");

    // Setup mock for the reject action
    let capturedNote = "";
    await page.route("**/api/v1/hitl/hitl-789/reject", async (route) => {
      const postData = JSON.parse(route.request().postData() || "{}");
      capturedNote = postData.note;

      // Once rejected, return empty list for the next pending fetch
      await page.route("**/api/v1/hitl/pending", async (route2) => {
        await route2.fulfill({ json: { data: [] } });
      });

      await route.fulfill({ json: { data: { success: true } } });
    });

    // Click Reject button (data-testid="btn-reject", Portuguese text "Rejeitar")
    await page.getByTestId("btn-reject").click();

    // Expect Dialog to be open
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /rejeitar ação/i }),
    ).toBeVisible();

    // Fill the reason (label "Motivo")
    await page.getByLabel(/motivo/i).fill("Price is too low");

    // Confirm rejection — button text is "Confirmar Rejeição"
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /confirmar/i })
      .click();

    // Should transition to empty state
    await expect(page.getByText("Tudo limpo!")).toBeVisible();

    // Verify the note was sent to the API
    expect(capturedNote).toBe("Price is too low");
  });
});
