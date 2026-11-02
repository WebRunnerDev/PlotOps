import { describe, expect, it } from "vitest";

import {
    parseSettingsSectionSearch,
    resolveSettingsSection,
} from "./settings-section";

const PROJECT_SECTIONS = ["boards", "labels", "customFields"] as const;
const PERSONAL_SECTIONS = ["drawer", "profile", "github", "accounts"] as const;

describe("parseSettingsSectionSearch", () => {
    it("keeps a known section", () => {
        expect(
            parseSettingsSectionSearch({ section: "labels" }, PROJECT_SECTIONS)
        ).toEqual({ section: "labels" });
    });

    it("drops unknown or non-string values", () => {
        expect(
            parseSettingsSectionSearch({ section: "danger" }, PROJECT_SECTIONS)
        ).toEqual({});
        expect(
            parseSettingsSectionSearch({ section: 3 }, PROJECT_SECTIONS)
        ).toEqual({});
        expect(parseSettingsSectionSearch({}, PROJECT_SECTIONS)).toEqual({});
    });
});

describe("resolveSettingsSection", () => {
    it("opens Labels for ?section=labels", () => {
        const { section } = parseSettingsSectionSearch(
            { section: "labels" },
            PROJECT_SECTIONS
        );
        expect(
            resolveSettingsSection(section, PROJECT_SECTIONS, "boards")
        ).toBe("labels");
    });

    it("falls back to the first visible section for a guest on ?section=profile", () => {
        const { section } = parseSettingsSectionSearch(
            { section: "profile" },
            PERSONAL_SECTIONS
        );
        expect(resolveSettingsSection(section, ["drawer"], "drawer")).toBe(
            "drawer"
        );
    });

    it("uses the first visible section when none is requested", () => {
        expect(
            resolveSettingsSection(undefined, ["github", "accounts"], "drawer")
        ).toBe("github");
    });

    it("uses the fallback while nothing is visible yet", () => {
        expect(resolveSettingsSection("labels", [], "boards")).toBe("boards");
    });
});
