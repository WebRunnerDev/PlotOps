import { expect, type Locator, type Page } from "@playwright/test";

/** Default seeded Task key from Guest Mode demo board. */
export const GUEST_SEEDED_TASK_KEY = "FEAT-1";

export function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
        errors.push(error.message);
    });
    return errors;
}

/** Enter Guest demo and land on the seeded kanban board. */
export async function enterGuestDemo(page: Page): Promise<void> {
    await page.goto("/");
    await page.getByTestId("guest-try-demo").click();

    await expect(page).toHaveURL(/\/projects\/.*\/boards\/.*/, {
        timeout: 30_000,
    });
    await expect(
        page.getByRole("button", { name: GUEST_SEEDED_TASK_KEY })
    ).toBeVisible({ timeout: 30_000 });
}

/** From the bell preview, navigate to the full `/notifications` inbox. */
export async function goToNotificationsFromBell(page: Page): Promise<void> {
    await openNotificationsBell(page);
    await page.getByTestId("notifications-view-all").click();
    await expect(page).toHaveURL(/\/notifications/, { timeout: 15_000 });
    await expect(page.getByTestId("notifications-search")).toBeVisible();
}

/** Read whether the self Watch toggle currently shows Watching state. */
export async function isWatchingSelf(page: Page): Promise<boolean> {
    const toggle = watchToggle(page);
    await expect(toggle).toBeVisible();
    return (await toggle.getAttribute("data-watching")) === "true";
}

/** Open the notifications bell preview drawer. */
export async function openNotificationsBell(page: Page): Promise<Locator> {
    await page.getByTestId("notifications-bell").click();
    const preview = page.getByTestId("notifications-preview");
    await expect(preview).toBeVisible({ timeout: 15_000 });
    return preview;
}

/** Open a seeded Task drawer and wait for Watchers self-control. */
export async function openSeededTaskDrawer(
    page: Page,
    taskKey: string = GUEST_SEEDED_TASK_KEY
): Promise<Locator> {
    await page.getByRole("button", { name: taskKey }).click();

    const watchers = page.getByTestId("task-watchers");
    await expect(watchers).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("task-watch-toggle")).toBeVisible();
    return watchers;
}

export function watchToggle(page: Page): Locator {
    return page.getByTestId("task-watch-toggle");
}
