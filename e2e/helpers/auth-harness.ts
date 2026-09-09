import {
    type Browser,
    type BrowserContext,
    expect,
    type Locator,
    type Page,
} from "@playwright/test";
import { execFileSync } from "node:child_process";

/**
 * Auth Playwright harness against local Supabase seed
 * (`supabase/seed-e2e-auth.sql`). Users A (Owner), B (Viewer), C (Contributor).
 * Opt-in via `E2E_AUTH=1` so default Guest CI stays green without Docker Auth.
 *
 * Docs: docs/SUPABASE.md → Auth e2e harness.
 */

export const AUTH_E2E_PROJECT_ID = "c0000000-0000-4000-8000-000000000020";
export const AUTH_E2E_TASK_KEY = "TASK-1";
export const AUTH_E2E_TEAM_ID = "c0000000-0000-4000-8000-000000000010";

export type AuthE2EUserKey = "a" | "b" | "c";

export const AUTH_E2E_USERS = {
    a: {
        displayName: "E2E Alpha",
        email: "e2e-a@plotops.app",
        id: "c0000000-0000-4000-8000-000000000001",
        password: "PlotopsE2eA1",
        role: "owner" as const,
        username: "e2e-a",
    },
    b: {
        displayName: "E2E Bravo",
        email: "e2e-b@plotops.app",
        id: "c0000000-0000-4000-8000-000000000002",
        password: "PlotopsE2eB1",
        role: "viewer" as const,
        username: "e2e-b",
    },
    c: {
        displayName: "E2E Charlie",
        email: "e2e-c@plotops.app",
        id: "c0000000-0000-4000-8000-000000000003",
        password: "PlotopsE2eC1",
        role: "contributor" as const,
        username: "e2e-c",
    },
} as const;

export type AuthBrowserPair = {
    contextA: BrowserContext;
    contextB: BrowserContext;
    pageA: Page;
    pageB: Page;
};

/** A + B + C isolated contexts (Mentionee vs non-Mentionee Watcher). */
export type AuthBrowserTrio = AuthBrowserPair & {
    contextC: BrowserContext;
    pageC: Page;
};

/**
 * Add a Team Member as Watcher via the manage popover combobox.
 * Manage panel must be open. No-ops if they are already listed.
 */
export async function addManagedWatcher(
    page: Page,
    displayName: string,
    userId: string
): Promise<void> {
    const existing = page.locator(
        `[data-testid="task-watcher-remove"][data-user-id="${userId}"]`
    );
    if ((await existing.count()) > 0) {
        return;
    }

    const input = page.getByTestId("task-watchers-add");
    await expect(input).toBeEnabled({ timeout: 10_000 });
    await input.click();
    await input.fill(displayName);
    await page.getByRole("option", { name: displayName }).click();
    await expect(existing).toBeVisible({ timeout: 15_000 });
}

/** TipTap surface inside the root Comment composer. Drawer must be open. */
export function authCommentComposerEditor(page: Page): Locator {
    return page.locator("[data-comment-composer] .ProseMirror").first();
}

/** TipTap surface for the Task Description field. Drawer must be open. */
export function authDescriptionEditor(page: Page): Locator {
    // RichTextEditor puts `id` on the ProseMirror node itself (not a wrapper).
    return page.locator("#task-description");
}

export function authE2ESkipReason(): string {
    return (
        "Auth e2e skipped — set E2E_AUTH=1 with local Supabase " +
        "(npm run db:reset) and app env pointing at 127.0.0.1:54321. " +
        "See docs/SUPABASE.md → Auth e2e harness."
    );
}

/** Wipe Auth e2e users' inbox rows so "newest" assertions are not polluted. */
export async function clearAuthE2ENotifications(): Promise<void> {
    execFileSync(
        "docker",
        [
            "exec",
            "-i",
            "supabase_db_PlotOps",
            "psql",
            "-U",
            "postgres",
            "-c",
            `delete from public.notifications
             where recipient_id in (
               'c0000000-0000-4000-8000-000000000001',
               'c0000000-0000-4000-8000-000000000002',
               'c0000000-0000-4000-8000-000000000003'
             );`,
        ],
        { stdio: "pipe" }
    );
}

/** Close the Task drawer so TopBar chrome (bell) is clickable again. */
export async function closeAuthTaskDrawer(page: Page): Promise<void> {
    // Blur editors first so Drawer onOpenChange does not persist a no-op
    // Description normalize as `description_change` for Watchers.
    await page.locator("body").click({ position: { x: 8, y: 8 } });
    await page.waitForTimeout(300);

    for (let attempt = 0; attempt < 3; attempt++) {
        if (!/[?&]task=/i.test(page.url())) break;
        await page.keyboard.press("Escape");
        try {
            await expect(page).not.toHaveURL(/[?&]task=/i, { timeout: 2500 });
            break;
        } catch {
            // Mention popup / nested UI may consume the first Escape.
        }
    }

    if (/[?&]task=/i.test(page.url())) {
        const current = new URL(page.url());
        current.searchParams.delete("task");
        await page.goto(`${current.pathname}${current.search}${current.hash}`, {
            waitUntil: "domcontentloaded",
        });
    }

    await expect(page).not.toHaveURL(/[?&]task=/i, { timeout: 15_000 });
    await expect(page.getByTestId("task-watchers")).toHaveCount(0, {
        timeout: 15_000,
    });
    await expect(page.getByTestId("notifications-bell")).toBeVisible({
        timeout: 45_000,
    });
}

/** Two isolated browser contexts (separate Auth sessions / storage). */
export async function createAuthBrowserPair(
    browser: Browser
): Promise<AuthBrowserPair> {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    return { contextA, contextB, pageA, pageB };
}

/** Three isolated browser contexts for Mentionee dedupe e2e (#257). */
export async function createAuthBrowserTrio(
    browser: Browser
): Promise<AuthBrowserTrio> {
    const pair = await createAuthBrowserPair(browser);
    const contextC = await browser.newContext();
    const pageC = await contextC.newPage();
    return { ...pair, contextC, pageC };
}

export async function disposeAuthBrowserPair(
    pair: AuthBrowserPair
): Promise<void> {
    await pair.contextA.close();
    await pair.contextB.close();
}

export async function disposeAuthBrowserTrio(
    trio: AuthBrowserTrio
): Promise<void> {
    await disposeAuthBrowserPair(trio);
    await trio.contextC.close();
}

/**
 * Assert the newest inbox row matches `copy` and does not match `absent`.
 * Prefer this over whole-preview absence checks when the local DB is dirty.
 */
export async function expectNewestNotificationCopy(
    page: Page,
    copy: RegExp | string,
    absent?: RegExp | string
): Promise<Locator> {
    const preview = await expectNotificationCopy(page, copy);
    const newest = preview.getByRole("listitem").first();
    await expect(newest).toBeVisible({ timeout: 10_000 });
    await expect(newest).toContainText(copy, { timeout: 10_000 });
    if (absent !== undefined) {
        await expect(newest).not.toContainText(absent, { timeout: 5000 });
    }
    return preview;
}

/** Assert preview does not show `copy` after a short poll window. */
export async function expectNoNotificationCopy(
    page: Page,
    copy: RegExp | string
): Promise<void> {
    const preview = await openAuthNotificationsBell(page);
    await expect(preview.getByText(copy)).toHaveCount(0);
}

/**
 * Assert preview eventually shows `copy`.
 * Reopens (and once reloads) so drawer `staleTime` / Realtime races do not
 * leave an empty preview while Postgres already has the row — and fail in
 * ~25s instead of sitting on a single 45s expect.
 */
export async function expectNotificationCopy(
    page: Page,
    copy: RegExp | string
): Promise<Locator> {
    const deadline = Date.now() + 25_000;
    let attempt = 0;
    let lastError: unknown;

    while (Date.now() < deadline) {
        attempt += 1;
        const previewOpen = page.getByTestId("notifications-preview");
        if (await previewOpen.isVisible().catch(() => false)) {
            await page.keyboard.press("Escape");
            await expect(previewOpen)
                .toBeHidden({ timeout: 3000 })
                .catch(() => {});
        }

        if (attempt === 3) {
            await page.reload({ waitUntil: "domcontentloaded" });
            await expect(page.getByTestId("notifications-bell")).toBeVisible({
                timeout: 30_000,
            });
        }

        const preview = await openAuthNotificationsBell(page);
        const match = preview.getByText(copy).first();
        try {
            await expect(match).toBeVisible({ timeout: 8000 });
            return preview;
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new Error(`Notification copy not visible: ${String(copy)}`);
}

/**
 * Insert a structured `@` Mention into a TipTap editor via the suggestion popup.
 * Editor must already be focused / editable.
 * Prefer Enter over mouse click so Description onBlur does not race the insert.
 */
export async function insertMentionInEditor(
    page: Page,
    editor: Locator,
    mentioneeDisplayName: string
): Promise<void> {
    await editor.click();
    await page.keyboard.type("@", { delay: 30 });
    const popup = page.locator("div.z-70").filter({
        has: page.getByRole("button"),
    });
    await expect(popup.first()).toBeVisible({ timeout: 10_000 });

    const query = mentioneeDisplayName.includes(" ")
        ? (mentioneeDisplayName.split(/\s+/).at(-1) ?? mentioneeDisplayName)
        : mentioneeDisplayName;
    await page.keyboard.type(query, { delay: 40 });

    const option = popup
        .getByRole("button", { exact: true, name: mentioneeDisplayName })
        .first();
    await expect(option).toBeVisible({ timeout: 10_000 });
    // TipTap registers mousedown+preventDefault so the editor keeps focus;
    // a full Playwright click can blur Description before the node inserts.
    await option.dispatchEvent("mousedown");
    await expect(editor.locator('[data-type="mention"]')).toContainText(
        mentioneeDisplayName,
        { timeout: 10_000 }
    );
}

export function isAuthE2EEnabled(): boolean {
    const flag = process.env.E2E_AUTH?.trim().toLowerCase();
    return flag === "1" || flag === "true" || flag === "yes";
}

/** Read whether the self Watch toggle currently shows Watching state. */
export async function isWatchingSelf(page: Page): Promise<boolean> {
    const toggle = page.getByTestId("task-watch-toggle");
    await expect(toggle).toBeVisible();
    return (await toggle.getAttribute("data-watching")) === "true";
}

/** Manage Watchers control — present for Contributor+ only (ADR 0029). */
export function manageWatchersButton(page: Page) {
    return page.getByTestId("task-watchers-manage");
}

/** Open the notifications bell preview drawer. */
export async function openAuthNotificationsBell(page: Page): Promise<Locator> {
    const preview = page.getByTestId("notifications-preview");
    // Already open (e.g. second expectNoNotificationCopy on the same page) —
    // clicking the bell again is blocked by the drawer portal and retries forever.
    if (await preview.isVisible().catch(() => false)) {
        return preview;
    }

    const bell = page.getByTestId("notifications-bell");
    await expect(bell).toBeVisible({ timeout: 30_000 });
    await bell.click();
    await expect(preview).toBeVisible({ timeout: 15_000 });
    return preview;
}

/**
 * Open the seeded shared Task drawer via SPA navigation from `/home`.
 * Avoids full-document deep-links that race the auth gate (`/sign-in` → `/home`).
 * Reuses an already-open board route when possible (Auth trio is expensive).
 */
export async function openAuthSharedTaskDrawer(page: Page): Promise<void> {
    const boardPath = new RegExp(
        `/projects/${AUTH_E2E_PROJECT_ID}/boards/`,
        "i"
    );
    const onBoard = boardPath.test(page.url());

    if (!onBoard) {
        await page.goto("/home");
        await expect(
            page.getByRole("button", { name: /Account menu|Меню аккаунта/i })
        ).toBeVisible({ timeout: 45_000 });
        await expect(page.getByText("E2E Auth Team").first()).toBeVisible({
            timeout: 45_000,
        });

        await page
            .getByRole("button", { name: /All projects|Все проекты/i })
            .click();
        const projectCard = page.getByRole("link", {
            name: /E2E Auth Project/i,
        });
        await expect(projectCard).toBeVisible({ timeout: 30_000 });
        await projectCard.click();

        await expect(page).toHaveURL(boardPath, { timeout: 45_000 });
    }

    if (!/[?&]task=/i.test(page.url())) {
        await page.getByRole("button", { name: AUTH_E2E_TASK_KEY }).click();
    }

    await expect(page).toHaveURL(new RegExp(`task=${AUTH_E2E_TASK_KEY}`, "i"), {
        timeout: 15_000,
    });
    await expect(page.getByTestId("task-watchers")).toBeVisible({
        timeout: 30_000,
    });
    await expect(page.getByTestId("task-watch-toggle")).toBeVisible();
}

export async function openManageWatchers(page: Page): Promise<void> {
    const manage = manageWatchersButton(page);
    await expect(manage).toBeVisible({ timeout: 15_000 });
    await manage.click();
    await expect(page.getByTestId("task-watchers-add")).toBeVisible({
        timeout: 10_000,
    });
}

/**
 * Post a root Comment that Mentions `mentioneeDisplayName`.
 * Returns a unique marker string included in the body for later assertions.
 */
export async function postCommentMentioning(
    page: Page,
    mentioneeDisplayName: string
): Promise<string> {
    const marker = `mention-comment-${Date.now()}`;
    const composer = authCommentComposerEditor(page);
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.click();
    await insertMentionInEditor(page, composer, mentioneeDisplayName);
    await page.keyboard.type(` ${marker}`);
    const mentionFanOut = page.waitForResponse(
        (response) =>
            isRpcResponse(response, "create_notifications_for_mentions"),
        { timeout: 20_000 }
    );
    const watcherFanOut = page.waitForResponse(
        (response) => isRpcResponse(response, "create_task_notifications"),
        { timeout: 20_000 }
    );
    await page.getByRole("button", { name: /Post comment|Отправить/i }).click();
    await expect(
        page.getByText(/Comment posted|Комментарий добавлен/i)
    ).toBeVisible({ timeout: 15_000 });
    await expect(
        page.locator(`[data-comment-id] .ProseMirror`, { hasText: marker })
    ).toBeVisible({ timeout: 15_000 });
    await Promise.all([mentionFanOut, watcherFanOut]);
    return marker;
}

/** Post a plain root Comment (no Mentions). */
export async function postPlainComment(
    page: Page,
    body: string
): Promise<void> {
    const composer = authCommentComposerEditor(page);
    await expect(composer).toBeVisible({ timeout: 15_000 });
    await composer.click();
    await composer.fill(body);
    await page.getByRole("button", { name: /Post comment|Отправить/i }).click();
    await expect(
        page.getByText(/Comment posted|Комментарий добавлен/i)
    ).toBeVisible({ timeout: 15_000 });
    await expect(
        page.locator(`[data-comment-id] .ProseMirror`, { hasText: body })
    ).toBeVisible({ timeout: 15_000 });
}

/** Remove a Watcher from the open manage popover. */
export async function removeManagedWatcher(
    page: Page,
    userId: string
): Promise<void> {
    const button = page.locator(
        `[data-testid="task-watcher-remove"][data-user-id="${userId}"]`
    );
    await expect(button).toBeVisible({ timeout: 10_000 });
    await button.click();
    await expect(button).toHaveCount(0, { timeout: 15_000 });
}

/**
 * Reset shared Task Description to the seed body (no Mentions).
 * ADR 0014 only fans out *new* Mentionees vs previous body — dirty local DB
 * otherwise skips Description mention Notifications on re-runs.
 */
export async function resetAuthSharedTaskDescription(): Promise<void> {
    execFileSync(
        "docker",
        [
            "exec",
            "-i",
            "supabase_db_PlotOps",
            "psql",
            "-U",
            "postgres",
            "-c",
            "update public.tasks set description = '<p>Opened by both User A and User B in separate Playwright contexts.</p>' where id = 'c0000000-0000-4000-8000-000000000030';",
        ],
        { stdio: "pipe" }
    );
}

/**
 * Save Description with an added Mention (and unique marker text).
 * Commits via blur (Task drawer Description onBlur).
 * Caller must ensure the previous persisted body does not already Mention the
 * same Mentionee — ADR 0014 only notifies newly added Mentionees.
 */
export async function saveDescriptionMentioning(
    page: Page,
    mentioneeDisplayName: string
): Promise<string> {
    const marker = `mention-desc-${Date.now()}`;
    const editor = authDescriptionEditor(page);
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await insertMentionInEditor(page, editor, mentioneeDisplayName);
    await page.keyboard.type(` ${marker}`);
    const mentionFanOut = page.waitForResponse(
        (response) =>
            isRpcResponse(response, "create_notifications_for_mentions"),
        { timeout: 20_000 }
    );
    const watcherFanOut = page.waitForResponse(
        (response) => isRpcResponse(response, "create_task_notifications"),
        { timeout: 20_000 }
    );
    await commitDescriptionViaBlur(page, editor, marker);
    await Promise.all([mentionFanOut, watcherFanOut]);
    return marker;
}

/**
 * Change Description body without Mentions (Watcher `description_change`).
 * Waits for the tasks PATCH so a later Mention save sees this as previousBody.
 */
export async function savePlainDescription(
    page: Page,
    body: string
): Promise<void> {
    const editor = authDescriptionEditor(page);
    await expect(editor).toBeVisible({ timeout: 15_000 });
    await editor.click();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
    await page.keyboard.type(body);
    await commitDescriptionViaBlur(page, editor, body);
}

/** Toggle self Watch until `data-watching` matches the desired state. */
export async function setSelfWatch(
    page: Page,
    watching: boolean
): Promise<void> {
    const toggle = page.getByTestId("task-watch-toggle");
    await expect(toggle).toBeVisible({ timeout: 15_000 });
    // Wait for watchers query to settle — early reads of data-watching during
    // loading are always "false" and a premature click is ignored while busy.
    await expect(toggle).toBeEnabled({ timeout: 15_000 });

    const desired = watching ? "true" : "false";
    if ((await toggle.getAttribute("data-watching")) === desired) {
        return;
    }

    const write = page.waitForResponse(
        (response) => {
            if (!response.ok()) return false;
            if (response.request().method() === "GET") return false;
            return /\/rest\/v1\/task_watchers/i.test(response.url());
        },
        { timeout: 15_000 }
    );
    await toggle.click();
    await write;
    await expect(toggle).toHaveAttribute("data-watching", desired, {
        timeout: 15_000,
    });
}

/** Email/password sign-in for a seeded Auth e2e user; lands on `/home`. */
export async function signInAs(
    page: Page,
    user: AuthE2EUserKey
): Promise<void> {
    const credentials = AUTH_E2E_USERS[user];

    await page.goto("/sign-in");
    await expect(page.locator("#email")).toBeVisible({ timeout: 30_000 });

    await page.locator("#email").fill(credentials.email);
    await page.locator("#password").fill(credentials.password);

    const submit = page.locator("form").getByRole("button", {
        name: /^(Sign in|Войти)$/i,
    });
    // Turnstile (always-pass dummy) may take a few seconds before enabling submit.
    await expect(submit).toBeEnabled({ timeout: 60_000 });
    await submit.click();

    await expect(page).toHaveURL(/\/home/, { timeout: 45_000 });
}

/** Blur Description and wait for `update_task_details` RPC to finish. */
async function commitDescriptionViaBlur(
    page: Page,
    editor: Locator,
    expectedText: string
): Promise<void> {
    const save = page.waitForResponse(
        (response) => isRpcResponse(response, "update_task_details"),
        { timeout: 20_000 }
    );
    await editor.blur();
    await save;
    await expect(editor).toContainText(expectedText, { timeout: 15_000 });
}

function isRpcResponse(
    response: {
        ok: () => boolean;
        request: () => { method: () => string };
        url: () => string;
    },
    rpcName: string
): boolean {
    if (!response.ok()) return false;
    if (response.request().method() !== "POST") return false;
    return new RegExp(`/rest/v1/rpc/${rpcName}`, "i").test(response.url());
}
