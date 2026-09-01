import { expect, test } from "@playwright/test";

import { PLOTOPS_PUBLIC_PATHS } from "../src/shared/config/site";

function collectPageErrors(page: import("@playwright/test").Page) {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
        errors.push(error.message);
    });
    return errors;
}

test.describe("public routes", () => {
    for (const route of PLOTOPS_PUBLIC_PATHS) {
        test(`${route} renders without runtime errors`, async ({ page }) => {
            const errors = collectPageErrors(page);

            await page.goto(route, { waitUntil: "domcontentloaded" });
            await expect(
                page.locator('html[data-prerender-ready="true"]')
            ).toBeAttached({ timeout: 45_000 });

            expect(errors).toEqual([]);
        });
    }
});

test.describe("auth shell", () => {
    test("landing shows sign-in and try demo actions", async ({ page }) => {
        await page.goto("/");
        await expect(
            page.getByRole("button", { name: /try demo|демо/i })
        ).toBeVisible();
        await expect(page.getByLabel("Email")).toBeVisible();
        await expect(page.locator("#password")).toBeVisible();
    });
});

test.describe("guest demo", () => {
    test("try demo opens the seeded kanban board", async ({ page }) => {
        const errors = collectPageErrors(page);

        await page.goto("/");
        await page.getByRole("button", { name: /try demo|демо/i }).click();

        await expect(page).toHaveURL(/\/projects\/.*\/boards\/.*/, {
            timeout: 30_000,
        });
        await expect(page.getByRole("button", { name: "FEAT-1" })).toBeVisible({
            timeout: 30_000,
        });
        await expect(page.getByText("Seed demo kanban cards")).toBeVisible();

        expect(errors).toEqual([]);
    });
});

test.describe("legal pages", () => {
    test("privacy policy renders markdown content", async ({ page }) => {
        await page.goto("/privacy");
        await expect(page.locator("article")).toBeVisible();
        await expect(page.locator("article h1").first()).toBeVisible();
    });

    test("terms of use renders markdown content", async ({ page }) => {
        await page.goto("/terms");
        await expect(page.locator("article")).toBeVisible();
        await expect(page.locator("article h1").first()).toBeVisible();
    });
});
