import { expect, test } from "@playwright/test";

import {
    enterGuestDemo,
    goToNotificationsFromBell,
} from "./helpers/guest-watch";

test.describe("Guest notifications inbox", () => {
    test("opens a Task in place from /notifications, then jumps to its Board", async ({
        page,
    }) => {
        await enterGuestDemo(page);
        await goToNotificationsFromBell(page);

        const row = page
            .getByTestId("notification-item")
            .filter({ hasText: "FEAT-2" })
            .first();
        await row.getByRole("button", { name: /FEAT-2/ }).click();

        // Task Peek: the drawer opens without leaving the inbox.
        const openOnBoard = page.getByTestId("task-peek-open-on-board");
        await expect(openOnBoard).toBeVisible({ timeout: 15_000 });
        await expect(page).toHaveURL(/\/notifications/);
        await expect(page.locator("#task-title")).toHaveValue(
            "Mock CI builds for guest session"
        );

        await openOnBoard.click();
        await expect(page).toHaveURL(/\/projects\/.*\/boards\/.*[?&]task=/, {
            timeout: 15_000,
        });
        await expect(page.locator("#task-title")).toHaveValue(
            "Mock CI builds for guest session",
            { timeout: 15_000 }
        );
        await expect(page.getByTestId("task-peek-open-on-board")).toHaveCount(
            0
        );
    });

    test("toggles a row between read and unread", async ({ page }) => {
        await enterGuestDemo(page);
        await goToNotificationsFromBell(page);

        const items = page.getByTestId("notification-item");
        const row = items.filter({ hasText: "Description changed" });
        await expect(row).toHaveAttribute("data-unread", "true");
        const indexBefore = await items.evaluateAll((nodes) =>
            nodes.findIndex((node) =>
                node.textContent?.includes("Description changed")
            )
        );

        await row.getByRole("button", { name: "Mark as read" }).click();
        await expect(row).not.toHaveAttribute("data-unread", "true");
        // Reading restyles the row in place — it does not move.
        expect(
            await items.evaluateAll((nodes) =>
                nodes.findIndex((node) =>
                    node.textContent?.includes("Description changed")
                )
            )
        ).toBe(indexBefore);

        await row.getByRole("button", { name: "Mark as unread" }).click();
        await expect(row).toHaveAttribute("data-unread", "true");
    });
});
