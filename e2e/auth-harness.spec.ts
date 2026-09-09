import { expect, test } from "@playwright/test";

import {
    authE2ESkipReason,
    createAuthBrowserPair,
    disposeAuthBrowserPair,
    isAuthE2EEnabled,
    openAuthSharedTaskDrawer,
    signInAs,
} from "./helpers/auth-harness";

test.describe("Auth two-user harness", () => {
    test("both contexts can open the shared Task drawer", async ({
        browser,
    }) => {
        test.skip(!isAuthE2EEnabled(), authE2ESkipReason());
        test.setTimeout(180_000);

        const pair = await createAuthBrowserPair(browser);

        try {
            await signInAs(pair.pageA, "a");
            await signInAs(pair.pageB, "b");

            await openAuthSharedTaskDrawer(pair.pageA);
            await openAuthSharedTaskDrawer(pair.pageB);

            await expect(pair.pageA.getByTestId("task-watchers")).toBeVisible();
            await expect(pair.pageB.getByTestId("task-watchers")).toBeVisible();
            await expect(
                pair.pageA.getByTestId("task-watch-toggle")
            ).toBeVisible();
            await expect(
                pair.pageB.getByTestId("task-watch-toggle")
            ).toBeVisible();
        } finally {
            await disposeAuthBrowserPair(pair);
        }
    });
});
