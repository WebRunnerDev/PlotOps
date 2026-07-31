import { describe, expect, it } from "vitest";

import {
    parseProfileNameRow,
    parseUserProfile,
    parseUserProfileOrNull,
} from "@/features/auth/api/profile-schema";

describe("profile schema boundary", () => {
    it("accepts a profiles row with nullable username and avatar_url", () => {
        const profile = parseUserProfile({
            avatar_url: null,
            first_name: "Ada",
            id: "11111111-1111-4111-8111-111111111111",
            last_name: "Lovelace",
            username: null,
        });

        expect(profile).toEqual({
            avatar_url: null,
            first_name: "Ada",
            id: "11111111-1111-4111-8111-111111111111",
            last_name: "Lovelace",
            username: null,
        });
    });

    it("returns null when the select row is missing", () => {
        expect(parseUserProfileOrNull(null)).toBeNull();
    });

    it("rejects a row that omits nullable columns instead of using null", () => {
        expect(() =>
            parseUserProfile({
                first_name: "Ada",
                id: "11111111-1111-4111-8111-111111111111",
                last_name: "Lovelace",
            })
        ).toThrow();
    });

    it("parses the name-only select used by ensureUserProfile", () => {
        expect(
            parseProfileNameRow({
                first_name: null,
                id: "11111111-1111-4111-8111-111111111111",
                last_name: "Lovelace",
            })
        ).toEqual({
            first_name: null,
            id: "11111111-1111-4111-8111-111111111111",
            last_name: "Lovelace",
        });
    });
});
