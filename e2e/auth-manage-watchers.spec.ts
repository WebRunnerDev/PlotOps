import { expect, test } from "@playwright/test";

import {
    addManagedWatcher,
    AUTH_E2E_USERS,
    authE2ESkipReason,
    createAuthBrowserPair,
    disposeAuthBrowserPair,
    isAuthE2EEnabled,
    isWatchingSelf,
    manageWatchersButton,
    openAuthSharedTaskDrawer,
    openManageWatchers,
    removeManagedWatcher,
    setSelfWatch,
    signInAs,
} from "./helpers/auth-harness";

/**
 * #256 — Contributor+ manage Watchers; Viewer self-only.
 * Requires Auth two-user harness (#255): E2E_AUTH=1 + local Supabase seed.
 */
test.describe("Auth manage Watchers + Viewer gate", () => {
    test("Owner adds and removes Viewer as Watcher from manage UI", async ({
        browser,
    }) => {
        test.skip(!isAuthE2EEnabled(), authE2ESkipReason());
        test.setTimeout(180_000);

        const pair = await createAuthBrowserPair(browser);
        const viewer = AUTH_E2E_USERS.b;

        try {
            await signInAs(pair.pageA, "a");
            await openAuthSharedTaskDrawer(pair.pageA);

            await openManageWatchers(pair.pageA);
            await addManagedWatcher(pair.pageA, viewer.displayName, viewer.id);
            await expect(
                pair.pageA.locator(
                    `[data-testid="task-watcher-remove"][data-user-id="${viewer.id}"]`
                )
            ).toBeVisible();

            await removeManagedWatcher(pair.pageA, viewer.id);
            await expect(
                pair.pageA.locator(
                    `[data-testid="task-watcher-remove"][data-user-id="${viewer.id}"]`
                )
            ).toHaveCount(0);
        } finally {
            await disposeAuthBrowserPair(pair);
        }
    });

    test("Viewer has no manage affordance and can Watch/Unwatch self", async ({
        browser,
    }) => {
        test.skip(!isAuthE2EEnabled(), authE2ESkipReason());
        test.setTimeout(180_000);

        const pair = await createAuthBrowserPair(browser);

        try {
            await signInAs(pair.pageB, "b");
            await openAuthSharedTaskDrawer(pair.pageB);

            await expect(manageWatchersButton(pair.pageB)).toHaveCount(0);

            await setSelfWatch(pair.pageB, true);
            expect(await isWatchingSelf(pair.pageB)).toBe(true);
            await expect(
                pair.pageB.getByTestId("task-watch-toggle")
            ).toHaveText(/Unwatch/i);

            await setSelfWatch(pair.pageB, false);
            expect(await isWatchingSelf(pair.pageB)).toBe(false);
            await expect(
                pair.pageB.getByTestId("task-watch-toggle")
            ).toHaveText(/Watch/i);
        } finally {
            await disposeAuthBrowserPair(pair);
        }
    });
});
