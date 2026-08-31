import { describe, expect, it } from "vitest";

import { meetsPasswordPolicy } from "@/features/auth/lib/password-policy";

describe("meetsPasswordPolicy", () => {
    it("accepts passwords with length, lower, upper, and digit", () => {
        expect(meetsPasswordPolicy("PlotopsDemo1")).toBe(true);
    });

    it("rejects short passwords", () => {
        expect(meetsPasswordPolicy("Ab1")).toBe(false);
    });

    it("rejects passwords missing complexity classes", () => {
        expect(meetsPasswordPolicy("plotopsdemo1")).toBe(false);
        expect(meetsPasswordPolicy("PLOTOPSDEMO1")).toBe(false);
        expect(meetsPasswordPolicy("PlotopsDemo")).toBe(false);
    });
});
