import { expect, type Page, test } from "@playwright/test";

import {
    closeTaskDrawer,
    commentComposerEditor,
    enterGuestDemo,
    openSeededTaskDrawer,
} from "./helpers/guest-watch";

/**
 * `vite preview` applies `dist/_headers` (config/vite-security-headers.ts),
 * so these assert what Cloudflare Pages serves. Violations are caught for
 * both enforced and Report-Only CSP via `securitypolicyviolation`.
 */

type Violation = { blockedURI: string; directive: string };

async function collectCspViolations(
    page: Page
): Promise<() => Promise<Violation[]>> {
    // Init scripts run via the browser protocol, unaffected by page CSP.
    await page.addInitScript(() => {
        const store: { blockedURI: string; directive: string }[] = [];
        Object.defineProperty(globalThis, "__cspViolations", { value: store });
        document.addEventListener("securitypolicyviolation", (event) => {
            store.push({
                blockedURI: event.blockedURI,
                directive: event.effectiveDirective,
            });
        });
    });
    return () =>
        page.evaluate(
            () =>
                (globalThis as unknown as { __cspViolations: Violation[] })
                    .__cspViolations
        );
}

test.describe("security headers", () => {
    for (const route of ["/", "/sign-in", "/projects/x/boards/y"]) {
        test(`${route} ships baseline headers and CSP`, async ({ page }) => {
            const response = await page.goto(route);
            expect(response).not.toBeNull();
            const headers = response!.headers();

            expect(headers["strict-transport-security"]).toMatch(/max-age=\d+/);
            expect(headers["x-content-type-options"]).toBe("nosniff");
            expect(headers["x-frame-options"]).toBe("DENY");
            expect(headers["referrer-policy"]).toBe(
                "strict-origin-when-cross-origin"
            );
            expect(headers["permissions-policy"]).toContain("camera=()");

            const csp =
                headers["content-security-policy"] ??
                headers["content-security-policy-report-only"];
            expect(csp).toBeDefined();
            expect(csp).toContain("default-src 'self'");
            expect(csp).toContain("object-src 'none'");
            expect(csp).toContain("frame-ancestors 'none'");
            expect(csp).toMatch(/connect-src [^;]*https:\/\/api\.github\.com/);
            expect(csp).toMatch(/connect-src [^;]*wss?:\/\//);
            expect(csp).not.toContain("__SUPABASE_");
        });
    }
});

test.describe("CSP violations", () => {
    test("login, board, rich-text editor and CI/CD stay clean", async ({
        page,
    }) => {
        const violations = await collectCspViolations(page);

        await page.goto("/");
        await expect(page.getByLabel("Email")).toBeVisible();
        expect(await violations()).toEqual([]);

        await enterGuestDemo(page);
        await openSeededTaskDrawer(page);
        const editor = commentComposerEditor(page);
        await expect(editor).toBeVisible({ timeout: 15_000 });
        await editor.click();
        await editor.fill("CSP smoke");
        expect(await violations()).toEqual([]);

        await closeTaskDrawer(page);
        await page.locator('a[href$="/ci-cd"]').first().click();
        await expect(page).toHaveURL(/\/ci-cd/, { timeout: 15_000 });
        await expect(page.locator("main")).toBeVisible();
        await page.waitForLoadState("networkidle");
        expect(await violations()).toEqual([]);
    });
});
