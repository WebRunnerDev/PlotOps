import { expect, type Locator, type Page } from "@playwright/test";

/** Default seeded Task key from Guest Mode demo board. */
export const GUEST_SEEDED_TASK_KEY = "FEAT-1";

/** Guest seed actor display name (Assignee / Author picker). */
export const GUEST_DEMO_ACTOR_NAME = "Demo Guest";

/** Close the Task drawer so TopBar chrome (bell) is clickable again. */
export async function closeTaskDrawer(page: Page): Promise<void> {
    const current = new URL(page.url());
    current.searchParams.delete("task");
    await page.goto(`${current.pathname}${current.search}${current.hash}`);
    await expect(page.getByTestId("task-watchers")).toHaveCount(0, {
        timeout: 15_000,
    });
    await expect(
        page.getByRole("button", { name: GUEST_SEEDED_TASK_KEY })
    ).toBeVisible({ timeout: 30_000 });
}

export function collectPageErrors(page: Page): string[] {
    const errors: string[] = [];
    page.on("pageerror", (error) => {
        errors.push(error.message);
    });
    return errors;
}

/** TipTap surface inside the root Comment composer. Drawer must be open. */
export function commentComposerEditor(page: Page): Locator {
    return page.locator("[data-comment-composer] .ProseMirror").first();
}

/**
 * Edit an existing Comment that already shows `body`, then save.
 * Drawer must be open; Comment must be editable by the Guest actor.
 */
export async function editTaskComment(
    page: Page,
    currentBody: string,
    nextBody: string
): Promise<void> {
    const article = page
        .locator("[data-comment-id]")
        .filter({ hasText: currentBody })
        .first();
    await expect(article).toBeVisible({ timeout: 15_000 });
    await article.getByRole("button", { name: /Edit|Редактировать/i }).click();

    const editor = article.locator(".ProseMirror").first();
    await expect(editor).toBeVisible();
    await editor.click();
    await editor.fill(nextBody);
    await article.getByRole("button", { name: /Save|Сохранить/i }).click();
    await expect(
        page.getByText(/Comment updated|Комментарий обновлён/i)
    ).toBeVisible({
        timeout: 15_000,
    });
    await expect(
        page.locator(`[data-comment-id] .ProseMirror`, { hasText: nextBody })
    ).toBeVisible({ timeout: 15_000 });
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

/**
 * Post a root Comment from the Task drawer composer.
 * Returns the posted body text for later edit assertions.
 */
export async function postTaskComment(
    page: Page,
    body: string
): Promise<string> {
    const composer = commentComposerEditor(page);
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.click();
    await composer.fill(body);
    await page.getByRole("button", { name: /Post comment|Отправить/i }).click();
    await expect(
        page.getByText(/Comment posted|Комментарий добавлен/i)
    ).toBeVisible({
        timeout: 15_000,
    });
    await expect(
        page.locator(`[data-comment-id] .ProseMirror`, { hasText: body })
    ).toBeVisible({ timeout: 15_000 });
    return body;
}

/** Toggle self Watch until `data-watching` matches the desired state. */
export async function setSelfWatch(
    page: Page,
    watching: boolean
): Promise<void> {
    const toggle = watchToggle(page);
    await expect(toggle).toBeVisible();

    const desired = watching ? "true" : "false";
    if ((await toggle.getAttribute("data-watching")) === desired) {
        return;
    }

    await toggle.click();
    await expect(toggle).toHaveAttribute("data-watching", desired, {
        timeout: 15_000,
    });
}

/**
 * Set the Task Assignee picker to Unassigned or a named Member.
 * Drawer must already be open.
 */
export async function setTaskAssignee(
    page: Page,
    assigneeName: "Unassigned" | string
): Promise<void> {
    const input = page.locator("#task-assignee");
    await expect(input).toBeVisible();
    await input.click();
    await page.getByRole("option", { name: assigneeName }).click();
    await expect(input).toHaveValue(assigneeName);
}

export function watchToggle(page: Page): Locator {
    return page.getByTestId("task-watch-toggle");
}
