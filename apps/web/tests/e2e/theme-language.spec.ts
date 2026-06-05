import { test, expect } from "@playwright/test";

test.describe("Theme toggle", () => {
  test("switches to light mode", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");
    const themeBtn = page
      .locator("header")
      .getByRole("button")
      .filter({ has: page.locator("svg") })
      .nth(1);
    await themeBtn.click();
    await page
      .getByRole("menuitem")
      .filter({ hasText: /Claro|Light|Claro/ })
      .first()
      .click();
    await expect(page.locator("html")).not.toHaveClass(/dark/);
  });

  test("switches to dark mode", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");
    const themeBtn = page
      .locator("header")
      .getByRole("button")
      .filter({ has: page.locator("svg") })
      .nth(1);
    await themeBtn.click();
    await page
      .getByRole("menuitem")
      .filter({ hasText: /Escuro|Dark|Oscuro/ })
      .first()
      .click();
    await expect(page.locator("html")).toHaveClass(/dark/);
  });
});

test.describe("Language switch", () => {
  test("switches UI to English", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");
    const langBtn = page
      .locator("header")
      .getByRole("button")
      .filter({ hasText: /^(PT|ES|EN)$/ })
      .first();
    await langBtn.click();
    await page.getByRole("menuitem").filter({ hasText: "English" }).click();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "AI Agents" }),
    ).toBeVisible();
  });

  test("switches UI to Spanish", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");
    const langBtn = page
      .locator("header")
      .getByRole("button")
      .filter({ hasText: /^(PT|ES|EN)$/ })
      .first();
    await langBtn.click();
    await page.getByRole("menuitem").filter({ hasText: "Español" }).click();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "Agentes de IA" }),
    ).toBeVisible();
  });

  test("switches back to Portuguese", async ({ page }) => {
    await page.goto("/agents");
    await page.waitForLoadState("networkidle");
    const langBtn = page
      .locator("header")
      .getByRole("button")
      .filter({ hasText: /^(PT|ES|EN)$/ })
      .first();
    await langBtn.click();
    await page.getByRole("menuitem").filter({ hasText: "Português" }).click();
    await page.waitForLoadState("networkidle");
    await expect(
      page.getByRole("heading", { name: "Agentes de IA" }),
    ).toBeVisible();
  });
});
