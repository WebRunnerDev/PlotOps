import { expect, test } from "@playwright/test";

import {
    closeTaskDrawer,
    enterGuestDemo,
    goToNotificationsFromBell,
    GUEST_DEMO_ACTOR_NAME,
    GUEST_SEEDED_TASK_KEY,
    isWatchingSelf,
    openNotificationsBell,
    openSeededTaskDrawer,
    setSelfWatch,
    setTaskAssignee,
    watchToggle,
} from "./helpers/guest-watch";

const SELF_ASSIGNEE_CLEAR_COPY = [
    "You are no longer the assignee",
    "Assignee cleared",
];

test.describe("Guest sticky self Watch + Assignee clear", () => {
    test("Guest can Watch and Unwatch themselves from the drawer", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        await openSeededTaskDrawer(page);

        await setSelfWatch(page, true);
        await expect(watchToggle(page)).toHaveAttribute(
            "data-watching",
            "true"
        );
        await expect(watchToggle(page)).toHaveText(/Unwatch/i);

        await setSelfWatch(page, false);
        await expect(watchToggle(page)).toHaveAttribute(
            "data-watching",
            "false"
        );
        await expect(watchToggle(page)).toHaveText(/Watch/i);
    });

    test("Unwatch sticks while Assignee/Author; unrelated title edit does not re-enroll", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        await openSeededTaskDrawer(page);

        await setSelfWatch(page, true);
        await setSelfWatch(page, false);
        expect(await isWatchingSelf(page)).toBe(false);

        const title = page.locator("#task-title");
        await title.fill("Sticky unwatch title edit");
        await title.blur();
        await expect(title).toHaveValue("Sticky unwatch title edit");

        await expect(watchToggle(page)).toHaveAttribute(
            "data-watching",
            "false"
        );

        // Re-enroll only when Assignee is set onto the guest again.
        await setTaskAssignee(page, "Unassigned");
        await expect(watchToggle(page)).toHaveAttribute(
            "data-watching",
            "false"
        );
        await setTaskAssignee(page, GUEST_DEMO_ACTOR_NAME);
        await expect(watchToggle(page)).toHaveAttribute(
            "data-watching",
            "true",
            { timeout: 15_000 }
        );
    });

    test("Clearing Assignee keeps an existing Watch (sticky)", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        await openSeededTaskDrawer(page);

        await setSelfWatch(page, true);
        await setTaskAssignee(page, "Unassigned");

        await expect(page.locator("#task-assignee")).toHaveValue("Unassigned");
        await expect(watchToggle(page)).toHaveAttribute(
            "data-watching",
            "true"
        );
    });

    test("Actor's own Assignee clear does not add a self Notification", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        await openSeededTaskDrawer(page);

        await setSelfWatch(page, true);
        await setTaskAssignee(page, "Unassigned");
        await closeTaskDrawer(page);

        const preview = await openNotificationsBell(page);
        for (const copy of SELF_ASSIGNEE_CLEAR_COPY) {
            await expect(preview.getByText(copy)).toHaveCount(0);
        }

        await page.getByTestId("notifications-view-all").click();
        await expect(page).toHaveURL(/\/notifications/);
        await expect(page.getByTestId("notifications-search")).toBeVisible();

        for (const copy of SELF_ASSIGNEE_CLEAR_COPY) {
            await expect(page.getByText(copy)).toHaveCount(0);
        }

        // Seeded FEAT-1 rows may still appear; assert no assignee-clear copy.
        await expect(
            page.getByText(GUEST_SEEDED_TASK_KEY).first()
        ).toBeVisible();
    });

    test("helpers remain usable for inbox navigation after sticky clear", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        await openSeededTaskDrawer(page);
        await setSelfWatch(page, true);
        await setTaskAssignee(page, "Unassigned");
        await closeTaskDrawer(page);

        await goToNotificationsFromBell(page);
        await expect(page.getByTestId("notifications-search")).toBeVisible();
    });
});
