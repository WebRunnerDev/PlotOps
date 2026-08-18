import { describe, expect, it } from "vitest";

import {
    getUserUsername,
    profileNamesFromUserMetadata,
} from "@/features/auth/lib/user-display";

describe("profileNamesFromUserMetadata", () => {
    it("uses email-signup first_name and last_name", () => {
        expect(
            profileNamesFromUserMetadata({
                first_name: "Ada",
                last_name: "Lovelace",
            })
        ).toEqual({ firstName: "Ada", lastName: "Lovelace" });
    });

    it("uses Google given_name and family_name", () => {
        expect(
            profileNamesFromUserMetadata({
                family_name: "Lovelace",
                given_name: "Ada",
                name: "Ada Lovelace",
            })
        ).toEqual({ firstName: "Ada", lastName: "Lovelace" });
    });

    it("splits GitHub or Google full name when given/family are absent", () => {
        expect(
            profileNamesFromUserMetadata({
                name: "Ada Lovelace",
            })
        ).toEqual({ firstName: "Ada", lastName: "Lovelace" });
    });

    it("returns empty names when metadata has none", () => {
        expect(profileNamesFromUserMetadata({})).toEqual({
            firstName: "",
            lastName: "",
        });
    });
});

describe("getUserUsername", () => {
    it("uses GitHub user_name rather than the full name", () => {
        expect(
            getUserUsername({
                email: "ada@users.noreply.github.com",
                user_metadata: {
                    name: "Ada Lovelace",
                    user_name: "ada",
                },
            })
        ).toBe("ada");
    });

    it("uses the email local-part for Google instead of the full name", () => {
        expect(
            getUserUsername({
                email: "ada@gmail.com",
                user_metadata: {
                    name: "Ada Lovelace",
                    picture: "https://example.com/ada.png",
                },
            })
        ).toBe("ada");
    });
});
