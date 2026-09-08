import { expect, test } from "@playwright/test";

import {
    closeTaskDrawer,
    editTaskComment,
    enterGuestDemo,
    openNotificationsBell,
    openSeededTaskDrawer,
    postTaskComment,
    setSelfWatch,
    watchToggle,
} from "./helpers/guest-watch";

const COMMENT_KIND_COPY = ["New Comment", "Новый комментарий"];

test.describe("Guest Comment create enrolls Watcher", () => {
    test("Guest who is not watching creates a Comment → Watching", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        await openSeededTaskDrawer(page);

        await setSelfWatch(page, false);
        await expect(watchToggle(page)).toHaveAttribute(
            "data-watching",
            "false"
        );

        const body = `Enroll watch comment ${Date.now()}`;
        await postTaskComment(page, body);

        await expect(watchToggle(page)).toHaveAttribute(
            "data-watching",
            "true",
            { timeout: 15_000 }
        );
        const watchers = page.getByTestId("task-watchers");
        await expect(
            watchers.getByText(/No watchers yet|Пока никого нет/i)
        ).toHaveCount(0);
        // Avatar fallback is first two letters of Demo Guest — listed Watcher.
        await expect(watchers.getByText("DE")).toBeVisible();
    });

    test("Editing a Comment after Unwatch does not re-enroll Watch", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        await openSeededTaskDrawer(page);

        await setSelfWatch(page, false);
        const body = `Edit stickiness comment ${Date.now()}`;
        await postTaskComment(page, body);
        await expect(watchToggle(page)).toHaveAttribute(
            "data-watching",
            "true",
            { timeout: 15_000 }
        );

        await setSelfWatch(page, false);
        await expect(watchToggle(page)).toHaveAttribute(
            "data-watching",
            "false"
        );

        const edited = `${body} (edited)`;
        await editTaskComment(page, body, edited);

        await expect(watchToggle(page)).toHaveAttribute(
            "data-watching",
            "false"
        );
    });

    test("Comment edit adds no Watcher comment Notification for the actor", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        await openSeededTaskDrawer(page);

        await setSelfWatch(page, false);
        const body = `No self-notify comment ${Date.now()}`;
        await postTaskComment(page, body);
        await setSelfWatch(page, false);

        const edited = `${body} (edited)`;
        await editTaskComment(page, body, edited);
        await expect(watchToggle(page)).toHaveAttribute(
            "data-watching",
            "false"
        );
        await closeTaskDrawer(page);

        const preview = await openNotificationsBell(page);
        for (const copy of COMMENT_KIND_COPY) {
            await expect(preview.getByText(copy)).toHaveCount(0);
        }

        await page.getByTestId("notifications-view-all").click();
        await expect(page).toHaveURL(/\/notifications/);
        await expect(page.getByTestId("notifications-search")).toBeVisible();
        for (const copy of COMMENT_KIND_COPY) {
            await expect(page.getByText(copy)).toHaveCount(0);
        }
    });
});
