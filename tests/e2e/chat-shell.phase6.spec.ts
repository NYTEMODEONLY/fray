import { expect, test, type Page } from "@playwright/test";

const isAdvancedAdminEnabled = () => process.env.VITE_ENABLE_ADVANCED_ADMIN === "true";

const dismissOnboarding = async (page: Page) => {
  const onboarding = page.locator(".onboarding-card");
  if (!(await onboarding.isVisible().catch(() => false))) return;
  await onboarding.getByRole("button", { name: "Next" }).click();
  await onboarding.getByRole("button", { name: "Continue" }).click();
  await onboarding.getByRole("button", { name: "Skip Onboarding" }).click();
};

test.describe("Phase 6 critical chat shell flows", () => {
  test("auth entry, room navigation, send, pagination, panel toggles, and moderation", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Connect to a homeserver")).toBeVisible();

    await page.getByRole("button", { name: "Use Offline Demo" }).click();
    await dismissOnboarding(page);
    await expect(page.getByRole("heading", { name: "welcome" })).toBeVisible();

    await page.getByRole("button", { name: "Synth Club" }).click();
    await expect(page.getByRole("heading", { name: "general" })).toBeVisible();
    await page.getByRole("button", { name: "Fray HQ" }).click();
    await expect(page.getByRole("heading", { name: "welcome" })).toBeVisible();

    const composer = page.locator(".composer textarea");
    await composer.click();
    await composer.fill("phase6 e2e send");
    await composer.press("Enter");
    await expect(page.locator("article.message").filter({ hasText: "phase6 e2e send" })).toBeVisible();

    const messageList = page.locator(".message-list");
    const beforeCount = await page.locator("article.message").count();
    await messageList.evaluate((node) => {
      node.scrollTop = 0;
      node.dispatchEvent(new Event("scroll"));
    });
    await expect.poll(async () => page.locator("article.message").count()).toBeGreaterThan(beforeCount);

    await page.getByRole("button", { name: "Pinned messages" }).click();
    await expect(page.locator(".pinned-panel")).toBeVisible();
    await page.getByRole("button", { name: "Toggle members" }).click();
    await expect(page.locator(".member-list")).toHaveCount(0);
    await page.getByRole("button", { name: "Toggle members" }).click();
    await expect(page.locator(".member-list")).toHaveCount(1);

    const firstMessage = page.locator("article.message").first();
    const beforeDeleteCount = await page.locator("article.message").count();
    await firstMessage.hover();
    const overflowActions = firstMessage.getByRole("button", { name: "Message actions" });
    if ((await overflowActions.count()) > 0) {
      await overflowActions.click();
    }
    await firstMessage.getByRole("button", { name: "Delete" }).click();
    await expect.poll(async () => page.locator("article.message").count()).toBeLessThan(beforeDeleteCount);
  });

  test("command palette shortcuts switch channels and open settings", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Use Offline Demo" }).click();
    await dismissOnboarding(page);
    await expect(page.getByRole("heading", { name: "welcome" })).toBeVisible();

    await page.keyboard.down("Control");
    await page.keyboard.press("KeyK");
    await page.keyboard.up("Control");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();

    const search = page.getByPlaceholder("Search channels, servers, and commands...");
    await search.fill("build-log");
    await page.locator(".command-item", { hasText: "build-log" }).first().click();
    await expect(page.getByRole("heading", { name: "build-log" })).toBeVisible();

    await page.keyboard.down("Control");
    await page.keyboard.press("Comma");
    await page.keyboard.up("Control");
    await expect(page.getByRole("dialog", { name: "User settings" })).toBeVisible();
  });

  test("server settings action respects admin feature flag", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Use Offline Demo" }).click();
    await dismissOnboarding(page);
    await expect(page.getByRole("heading", { name: "welcome" })).toBeVisible();

    await page.keyboard.down("Control");
    await page.keyboard.press("KeyK");
    await page.keyboard.up("Control");
    await expect(page.getByRole("dialog", { name: "Command palette" })).toBeVisible();
    await page.locator(".command-item", { hasText: "Open Server Settings" }).first().click();

    if (!isAdvancedAdminEnabled()) {
      await expect(page.getByText("Admin settings disabled")).toBeVisible();
      await expect(page.getByRole("dialog", { name: "Server settings" })).toHaveCount(0);
      return;
    }

    const settingsDialog = page.getByRole("dialog", { name: "Server settings" });
    await expect(settingsDialog).toBeVisible();

    const nameField = settingsDialog.getByLabel("Server Name");
    await nameField.fill("Fray QA");
    await settingsDialog.getByRole("button", { name: "Save Name" }).click();
    await settingsDialog.getByRole("button", { name: "Save Overview" }).click();
    await expect(settingsDialog.getByRole("heading", { name: "Fray QA" })).toBeVisible();
    await settingsDialog.getByRole("button", { name: "Close" }).click();
    await expect(settingsDialog).toHaveCount(0);
  });
});
