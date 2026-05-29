import { expect, test } from "@playwright/test";

test("home page renders the title", async ({ page }) => {
    await page.goto("/");
    await expect(
        page.getByRole("heading", { name: "Ward Round" }),
    ).toBeVisible();
});
