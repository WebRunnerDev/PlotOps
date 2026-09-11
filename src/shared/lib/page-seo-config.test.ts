import { describe, expect, it } from "vitest";

import { PLOTOPS_SITE_NAME, PLOTOPS_SITE_TAGLINE } from "@/shared/config/site";

import { buildAppShellSeo } from "./page-seo-config";

describe("buildAppShellSeo", () => {
    it("uses the default site title, not the sign-in copy", () => {
        const seo = buildAppShellSeo("/home");

        expect(seo.title).toBe(
            `${PLOTOPS_SITE_NAME} — ${PLOTOPS_SITE_TAGLINE}`
        );
        expect(seo.title).not.toMatch(/Войти|Sign in/i);
        expect(seo.noindex).toBe(true);
        expect(seo.path).toBe("/home");
    });

    it("uses the current page label when the app shell passes labels", () => {
        const seo = buildAppShellSeo("/home", {
            labels: {
                about: "About",
                accountSettings: "Platform settings",
                backlog: "Backlog",
                board: "Board",
                cicd: "CI/CD",
                completeProfile: "Complete your profile",
                dashboard: "Dashboard",
                home: "Home",
                invite: "Team invite",
                notFound: "Page not found",
                notifications: "Notifications",
                settings: "Settings",
            },
        });

        expect(seo.title).toBe(`Home — ${PLOTOPS_SITE_NAME}`);
        expect(seo.noindex).toBe(true);
    });
});
