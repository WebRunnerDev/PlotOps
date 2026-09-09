import { expect, test } from "@playwright/test";

import {
    authE2ESkipReason,
    isAuthE2EEnabled,
    signInAs,
} from "./helpers/auth-harness";

test.describe("Auth session restore — no sign-in flash", () => {
    test("live session reload never paints #email before /home", async ({
        page,
    }) => {
        test.skip(!isAuthE2EEnabled(), authE2ESkipReason());
        test.setTimeout(120_000);

        await signInAs(page, "a");

        let sawEmailField = false;
        await page.exposeFunction("plotopsSawEmail", () => {
            sawEmailField = true;
        });
        await page.addInitScript(() => {
            const notify = () => {
                if (document.querySelector("#email")) {
                    void (
                        globalThis as unknown as {
                            plotopsSawEmail?: () => void;
                        }
                    ).plotopsSawEmail?.();
                }
            };
            const start = () => {
                new MutationObserver(notify).observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                });
                notify();
            };
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", start, {
                    once: true,
                });
            } else {
                start();
            }
        });

        await page.goto("/", { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(/\/home/, { timeout: 45_000 });

        expect(sawEmailField, "LoginForm #email painted during restore").toBe(
            false
        );
    });
});
