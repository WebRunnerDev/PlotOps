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
});
