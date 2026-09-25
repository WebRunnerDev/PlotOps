import { describe, expect, it } from "vitest";

import { isCapExceeded } from "./is-cap-exceeded";

describe("isCapExceeded", () => {
    it("matches a cap trigger error by code", () => {
        expect(isCapExceeded({ code: "P0001", hint: "teams_owned_cap" })).toBe(
            true
        );
    });

    it("matches a specific cap by hint", () => {
        const error = { code: "P0001", hint: "team_projects_cap" };

        expect(isCapExceeded(error, "team_projects_cap")).toBe(true);
        expect(isCapExceeded(error, "teams_owned_cap")).toBe(false);
    });

    it("ignores unrelated Postgres errors", () => {
        expect(isCapExceeded({ code: "23505" })).toBe(false);
        expect(isCapExceeded({ code: "P0001", hint: "some_other_guard" })).toBe(
            false
        );
        expect(isCapExceeded({ code: "P0001" })).toBe(false);
        expect(isCapExceeded(new Error("boom"))).toBe(false);
        expect(isCapExceeded("53400")).toBe(false);
    });
});
