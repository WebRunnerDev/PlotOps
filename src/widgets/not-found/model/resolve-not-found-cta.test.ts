import { describe, expect, it } from "vitest";

import { resolveNotFoundCta } from "./resolve-not-found-cta";

describe("resolveNotFoundCta", () => {
    it("sends signed-in and guest sessions home", () => {
        expect(resolveNotFoundCta(true)).toEqual({
            labelKey: "notFound.goHome",
            to: "/home",
        });
    });

    it("sends logged-out users to sign-in", () => {
        expect(resolveNotFoundCta(false)).toEqual({
            labelKey: "notFound.goSignIn",
            to: "/sign-in",
        });
    });
});
