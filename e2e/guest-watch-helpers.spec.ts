import { expect, test } from "@playwright/test";

import {
    collectPageErrors,
    enterGuestDemo,
    goToNotificationsFromBell,
    GUEST_SEEDED_TASK_KEY,
    openNotificationsBell,
    openSeededTaskDrawer,
    watchToggle,
} from "./helpers/guest-watch";

test.describe("Guest Watch e2e helpers", () => {
    test("enter Guest demo and land on the seeded board", async ({ page }) => {
        const errors = collectPageErrors(page);

        await enterGuestDemo(page);

        await expect(
            page.getByRole("button", { name: GUEST_SEEDED_TASK_KEY })
        ).toBeVisible();
        await expect(page.getByText("Seed demo kanban cards")).toBeVisible();
        expect(errors).toEqual([]);
    });

    test("open seeded Task drawer and expose Watchers self control", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        await openSeededTaskDrawer(page);

        await expect(page.getByTestId("task-watchers")).toBeVisible();
        await expect(watchToggle(page)).toBeVisible();
        await expect(watchToggle(page)).toHaveAttribute(
            "data-watching",
            /^(true|false)$/
        );
    });

    test("open notifications bell preview and reach /notifications", async ({
        page,
    }) => {
        await enterGuestDemo(page);

        const preview = await openNotificationsBell(page);
        await expect(preview).toBeVisible();
        await expect(page.getByTestId("notifications-view-all")).toBeVisible();

        await page.getByTestId("notifications-view-all").click();
        await expect(page).toHaveURL(/\/notifications/);
        await expect(page.getByTestId("notifications-search")).toBeVisible();
    });

    test("goToNotificationsFromBell reaches inbox from board", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        await goToNotificationsFromBell(page);
        await expect(page.getByTestId("notifications-search")).toBeVisible();
    });
});
