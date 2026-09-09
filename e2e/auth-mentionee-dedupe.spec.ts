import { expect, test } from "@playwright/test";

import {
    AUTH_E2E_USERS,
    authE2ESkipReason,
    clearAuthE2ENotifications,
    closeAuthTaskDrawer,
    createAuthBrowserTrio,
    disposeAuthBrowserTrio,
    expectNoNotificationCopy,
    expectNotificationCopy,
    isAuthE2EEnabled,
    openAuthSharedTaskDrawer,
    postCommentMentioning,
    resetAuthSharedTaskDescription,
    saveDescriptionMentioning,
    setSelfWatch,
    signInAs,
} from "./helpers/auth-harness";

/**
 * #257 — Mentionee dedupe vs Watcher Comment / Description kinds.
 * Requires Auth harness (#255): E2E_AUTH=1 + local Supabase seed (A/B/C).
 *
 * Same Comment/Description save: Mentionee B gets `mention` only; non-Mentionee
 * Watcher C gets `comment` / `description_change`; actor A gets nothing.
 */
test.describe("Auth Mentionee dedupe + Comment Watcher", () => {
    test("Comment create: Mentionee mention only; other Watcher comment; actor none", async ({
        browser,
    }) => {
        test.skip(!isAuthE2EEnabled(), authE2ESkipReason());
        // Fail-fast inbox asserts; sequential Turnstile ×3 is the long pole.
        test.setTimeout(180_000);

        const trio = await createAuthBrowserTrio(browser);
        const mentionee = AUTH_E2E_USERS.b;
        const actorName = AUTH_E2E_USERS.a.displayName;

        try {
            await signInAs(trio.pageA, "a");
            await signInAs(trio.pageB, "b");
            await signInAs(trio.pageC, "c");

            await openAuthSharedTaskDrawer(trio.pageB);
            await setSelfWatch(trio.pageB, true);
            await closeAuthTaskDrawer(trio.pageB);

            await openAuthSharedTaskDrawer(trio.pageC);
            await setSelfWatch(trio.pageC, true);
            await closeAuthTaskDrawer(trio.pageC);

            // Drop setup noise (e.g. Description normalize on Contributor close).
            await clearAuthE2ENotifications();

            await openAuthSharedTaskDrawer(trio.pageA);
            await postCommentMentioning(trio.pageA, mentionee.displayName);
            await closeAuthTaskDrawer(trio.pageA);

            const mentionCopy = new RegExp(
                `${actorName} mentioned you in a Comment|You were mentioned in a Comment`,
                "i"
            );

            await expectNotificationCopy(trio.pageB, mentionCopy);
            await expect(
                trio.pageB
                    .getByTestId("notifications-preview")
                    .getByText("New Comment")
            ).toHaveCount(0);

            await expectNotificationCopy(trio.pageC, "New Comment");
            await expect(
                trio.pageC
                    .getByTestId("notifications-preview")
                    .getByText(mentionCopy)
            ).toHaveCount(0);

            await expectNoNotificationCopy(trio.pageA, "New Comment");
            await expectNoNotificationCopy(trio.pageA, mentionCopy);
        } finally {
            await disposeAuthBrowserTrio(trio);
        }
    });

    test("Description save with Mention: Mentionee mention only; Watcher description_change; actor none", async ({
        browser,
    }) => {
        test.skip(!isAuthE2EEnabled(), authE2ESkipReason());
        // Fail-fast inbox asserts; sequential Turnstile ×3 is the long pole.
        test.setTimeout(180_000);

        const trio = await createAuthBrowserTrio(browser);
        const mentionee = AUTH_E2E_USERS.b;
        const actorName = AUTH_E2E_USERS.a.displayName;

        try {
            await signInAs(trio.pageA, "a");
            await signInAs(trio.pageB, "b");
            await signInAs(trio.pageC, "c");

            // ADR 0014: only *new* Mentionees vs previous body are notified.
            await resetAuthSharedTaskDescription();

            await openAuthSharedTaskDrawer(trio.pageB);
            await setSelfWatch(trio.pageB, true);
            await closeAuthTaskDrawer(trio.pageB);

            await openAuthSharedTaskDrawer(trio.pageC);
            await setSelfWatch(trio.pageC, true);
            await closeAuthTaskDrawer(trio.pageC);

            await clearAuthE2ENotifications();

            await openAuthSharedTaskDrawer(trio.pageA);
            await saveDescriptionMentioning(trio.pageA, mentionee.displayName);
            await closeAuthTaskDrawer(trio.pageA);

            const mentionCopy = new RegExp(
                `${actorName} mentioned you in the Description|You were mentioned in the Description`,
                "i"
            );

            await expectNotificationCopy(trio.pageB, mentionCopy);
            await expect(
                trio.pageB
                    .getByTestId("notifications-preview")
                    .getByText("Description changed")
            ).toHaveCount(0);

            await expectNotificationCopy(trio.pageC, "Description changed");
            await expect(
                trio.pageC
                    .getByTestId("notifications-preview")
                    .getByText(mentionCopy)
            ).toHaveCount(0);

            await expectNoNotificationCopy(trio.pageA, "Description changed");
            await expectNoNotificationCopy(trio.pageA, mentionCopy);
        } finally {
            await disposeAuthBrowserTrio(trio);
        }
    });
});
