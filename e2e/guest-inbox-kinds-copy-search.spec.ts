import { expect, test } from "@playwright/test";

import {
    enterGuestDemo,
    goToNotificationsFromBell,
    openNotificationsBell,
} from "./helpers/guest-watch";

/** English UI copy for widened Jira-like Watcher kinds (Playwright locale is en-US). */
const JIRA_LIKE_KIND_COPY = [
    "New Comment",
    "Title changed",
    "Description changed",
    "Labels changed",
    "Estimate changed",
    "Sprint changed",
] as const;

test.describe("Guest inbox kinds copy + search", () => {
    test("bell preview shows kind-specific context for a new Watcher kind", async ({
        page,
    }) => {
        await enterGuestDemo(page);

        const preview = await openNotificationsBell(page);
        await expect(preview.getByText("Title changed")).toBeVisible({
            timeout: 15_000,
        });
    });

    test("/notifications lists new kinds with kind-specific copy", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        await goToNotificationsFromBell(page);

        for (const copy of JIRA_LIKE_KIND_COPY) {
            await expect(page.getByText(copy)).toBeVisible({ timeout: 15_000 });
        }
    });

    test("search q matches en and ru aliases for a new kind", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        await goToNotificationsFromBell(page);

        const search = page.getByTestId("notifications-search");
        await search.fill("title");
        await search.press("Enter");

        await expect(page).toHaveURL(/[?&]q=title/);
        await expect(page.getByText("Title changed")).toBeVisible({
            timeout: 15_000,
        });
        await expect(page.getByText("New Comment")).toHaveCount(0);
        await expect(page.getByText("Sprint changed")).toHaveCount(0);

        await search.fill("описание");
        await search.press("Enter");

        await expect(page).toHaveURL(/[?&]q=/);
        await expect(page.getByText("Description changed")).toBeVisible({
            timeout: 15_000,
        });
        await expect(page.getByText("Title changed")).toHaveCount(0);
    });
});
