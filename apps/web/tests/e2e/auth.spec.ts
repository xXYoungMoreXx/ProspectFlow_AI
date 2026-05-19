import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("should redirect unauthenticated user to login", async ({ page }) => {
    await page.goto("/agents");

    // The middleware or the client layout should redirect to login
    await expect(page).toHaveURL(/.*\/login/);
  });

  test("should show validation errors on empty submission", async ({
    page,
  }) => {
    await page.goto("/login");

    // Click submit without entering credentials
    await page.getByRole("button", { name: /entrar/i }).click();

    // Browser native validation should block it because of 'required' attribute
    // We can test if the input is still focused or invalid
    const emailInput = page.getByLabel(/e-mail/i);
    await expect(emailInput).toBeFocused();
  });

  test("should login successfully with valid credentials", async ({ page }) => {
    // Mock the API response
    await page.route("**/api/v1/auth/login", async (route) => {
      const json = {
        data: {
          accessToken: "mocked-jwt-token",
          refreshToken: "mocked-refresh-token",
        },
      };
      await route.fulfill({ json });
    });

    await page.goto("/login");

    await page.getByLabel(/e-mail/i).fill("operator@example.com");
    await page.getByLabel(/senha/i).fill("securepassword123");

    await page.getByRole("button", { name: /entrar/i }).click();

    // Should redirect to agents dashboard
    await expect(page).toHaveURL(/.*\/agents/);
    await expect(
      page.getByRole("heading", { name: /ai agents/i }),
    ).toBeVisible();

    // Check if the operator email is shown in the UI
    // The dropdown trigger is an Avatar, let's just check the initials
    await expect(page.getByText("OP", { exact: true })).toBeVisible();
  });

  test("should show API errors on invalid credentials", async ({ page }) => {
    // Mock the API response with 401 error
    await page.route("**/api/v1/auth/login", async (route) => {
      const json = {
        errors: [{ code: "UNAUTHORIZED", message: "Credenciais inválidas" }],
      };
      await route.fulfill({ status: 401, json });
    });

    await page.goto("/login");

    await page.getByLabel(/e-mail/i).fill("wrong@example.com");
    await page.getByLabel(/senha/i).fill("wrongpassword");

    await page.getByRole("button", { name: /entrar/i }).click();

    // Should show error message
    await expect(page.getByText("Credenciais inválidas")).toBeVisible();

    // Should stay on login page
    await expect(page).toHaveURL(/.*\/login/);
  });
});
