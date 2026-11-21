import { expect, test } from "@playwright/test";

import { enterGuestDemo } from "./helpers/guest-watch";

test.describe("CI/CD runs list", () => {
    // The lists are virtualized against the page's scroller. When the builds
    // are already cached, page and lists mount in one commit — the rows must
    // still render without a reload.
    test("shows run rows after in-app navigation, also on a return visit", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        const nav = (name: string) =>
            page.getByRole("link", { exact: true, name }).first().click();
        const rows = page.locator("ul > li[data-index]");

        await nav("CI/CD");
        await expect(page).toHaveURL(/\/ci-cd/);
        await expect(rows.first()).toBeVisible({ timeout: 15_000 });

        await nav("Board");
        await expect(page).toHaveURL(/\/boards\//);
        await nav("CI/CD");
        await expect(rows.first()).toBeVisible({ timeout: 15_000 });
        await expect(
            page.getByText("feature/FEAT-2-guest-ci-mock").first()
        ).toBeVisible();
    });
});
