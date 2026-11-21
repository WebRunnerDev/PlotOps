import { expect, type Page, type Route, test } from "@playwright/test";

import { enterGuestDemo } from "./helpers/guest-watch";

const EDITOR_CHUNK = /\/assets\/rich-text-editor-[^/]+\.js$/;
const DIFF_CHUNK = /\/assets\/pr-diff-dialog-[^/]+\.js$/;
const CICD_CHUNK = /\/assets\/ci-cd-[^/]+\.js$/;

const CHUNK_FAILED_TEXT = "Couldn't load this part of PlotOps";

async function openTask(page: Page, taskKey: string) {
    await page.getByRole("button", { exact: true, name: taskKey }).click();
    await expect(page.getByTestId("task-github-panel")).toBeVisible({
        timeout: 30_000,
    });
}

test.describe("Lazy editor, diff and route chunks", () => {
    test("the landing page does not download the editor; a Task renders it", async ({
        page,
    }) => {
        const editorRequests: string[] = [];
        page.on("request", (request) => {
            if (EDITOR_CHUNK.test(request.url())) {
                editorRequests.push(request.url());
            }
        });

        await page.goto("/");
        await page.waitForLoadState("networkidle");
        expect(editorRequests).toEqual([]);

        await enterGuestDemo(page);
        await openTask(page, "FEAT-1");
        await expect(page.locator(".ProseMirror").first()).toBeVisible({
            timeout: 30_000,
        });
        expect(editorRequests.length).toBeGreaterThan(0);
    });

    test("a failed editor chunk shows a reload prompt; the drawer keeps working", async ({
        page,
    }) => {
        await page.route(EDITOR_CHUNK, (route) => route.abort());

        await enterGuestDemo(page);
        await openTask(page, "FEAT-1");

        const prompt = page
            .getByRole("alert")
            .filter({ hasText: CHUNK_FAILED_TEXT })
            .first();
        await expect(prompt).toBeVisible({ timeout: 15_000 });
        await expect(
            prompt.getByRole("button", { name: "Reload page" })
        ).toBeVisible();
        await expect(page.locator(".ProseMirror")).toHaveCount(0);
    });

    test("the diff dialog frame opens while the viewer chunk is in flight", async ({
        page,
    }) => {
        // Hold the viewer chunk until the frame has been asserted.
        const heldRequests: Route[] = [];
        await page.route(DIFF_CHUNK, (route) => {
            heldRequests.push(route);
        });

        await enterGuestDemo(page);
        await openTask(page, "FEAT-2");
        await page
            .getByTestId("task-github-panel")
            .getByRole("button", { name: "plotops-demo/web actions" })
            .click();
        await page.getByRole("menuitem", { exact: true, name: "Diff" }).click();

        const dialog = page.getByRole("dialog");
        await expect(dialog).toContainText("#43");
        await expect(
            dialog.getByRole("status", { name: "Loading" })
        ).toBeVisible();

        expect(heldRequests.length).toBeGreaterThan(0);
        for (const route of heldRequests) await route.continue();
        await page.unroute(DIFF_CHUNK);
        await expect(
            dialog.getByRole("button", { name: "Split view" })
        ).toBeVisible({ timeout: 15_000 });
    });

    test("a stale route chunk reloads the page once, then shows a reload prompt", async ({
        page,
    }) => {
        await page.route(CICD_CHUNK, (route) => route.abort());
        await enterGuestDemo(page);

        let reloads = 0;
        page.on("load", () => {
            reloads += 1;
        });

        await page
            .getByRole("link", { exact: true, name: "CI/CD" })
            .first()
            .click();

        await expect(
            page.getByRole("alert").filter({ hasText: CHUNK_FAILED_TEXT })
        ).toBeVisible({ timeout: 30_000 });
        expect(reloads).toBe(1);
    });
});
