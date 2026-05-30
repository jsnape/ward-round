import { expect, test } from "@playwright/test";

const num = async (text: string | null): Promise<number> => Number(text ?? "");

test.describe("Ward Round", () => {
    test("renders and beds fill as patients arrive", async ({ page }) => {
        await page.goto("/");
        await expect(
            page.getByRole("heading", { name: "Ward Round" }),
        ).toBeVisible();
        await expect(page.getByTestId("clock")).toBeVisible();
        await page.getByTestId("speed-5").click();
        await expect
            .poll(
                async () =>
                    num(await page.getByTestId("beds-occupied").textContent()),
                { timeout: 20_000 },
            )
            .toBeGreaterThan(0);
    });

    test("treats patients so the score updates", async ({ page }) => {
        await page.goto("/");
        await page.getByTestId("speed-5").click();
        await expect
            .poll(
                async () =>
                    num(
                        await page
                            .getByTestId("patients-treated")
                            .textContent(),
                    ),
                { timeout: 30_000 },
            )
            .toBeGreaterThan(0);
    });

    test("pauses and resumes the clock", async ({ page }) => {
        await page.goto("/");
        await page.getByTestId("speed-5").click();
        await page.getByTestId("pause-toggle").click(); // pause
        const frozen = await page.getByTestId("clock").textContent();
        await page.waitForTimeout(1500);
        expect(await page.getByTestId("clock").textContent()).toBe(frozen);
        await page.getByTestId("pause-toggle").click(); // resume
        await expect
            .poll(
                async () =>
                    (await page.getByTestId("clock").textContent()) !== frozen,
                { timeout: 10_000 },
            )
            .toBe(true);
    });

    test("adds beds live via the dial", async ({ page }) => {
        await page.goto("/");
        await page.getByTestId("pause-toggle").click(); // pause so capacity is stable
        const before = await num(
            await page.getByTestId("beds-capacity").textContent(),
        );
        await page.getByTestId("beds-inc").click();
        await expect(page.getByTestId("beds-capacity")).toHaveText(
            String(before + 1),
        );
    });
});
