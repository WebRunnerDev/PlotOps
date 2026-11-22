import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { PLOTOPS_VERSION } from "@/shared/config/app-version";
import { PLOTOPS_PUBLIC_PATHS } from "@/shared/config/site";

import type { WhatsNewEntry } from "./model/releases";

import {
    compareVersions,
    latestPublishedVersion,
    selectPublishedEntries,
} from "./model/published-entries";
import { WHATS_NEW_ENTRIES } from "./model/releases";

const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../.."
);

function entry(version: null | string, date: string): WhatsNewEntry {
    return {
        changes: [],
        date,
        id: version ?? date,
        summary: { en: "s", ru: "s" },
        title: { en: "t", ru: "t" },
        version,
    };
}

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("compareVersions", () => {
    it("orders by major, minor, then patch numerically", () => {
        expect(compareVersions("1.10.0", "1.9.9")).toBeGreaterThan(0);
        expect(compareVersions("1.0.0", "1.0.1")).toBeLessThan(0);
        expect(compareVersions("2.0.0", "2.0.0")).toBe(0);
    });
});

describe("selectPublishedEntries", () => {
    const entries = [
        entry("1.2.0", "2026-12-01"),
        entry("1.1.0", "2026-11-01"),
        entry(null, "2026-08-01"),
    ];

    it("hides releases newer than the running version", () => {
        expect(
            selectPublishedEntries(entries, "1.1.0").map((item) => item.id)
        ).toEqual(["1.1.0", "2026-08-01"]);
        expect(latestPublishedVersion(entries, "1.1.0")).toBe("1.1.0");
    });

    it("keeps pre-1.0 periods when no release is published yet", () => {
        expect(latestPublishedVersion(entries, "0.9.0")).toBeNull();
        expect(selectPublishedEntries(entries, "0.9.0")).toHaveLength(1);
    });
});

describe("What's new content", () => {
    it("has unique ids and runs newest first", () => {
        const ids = WHATS_NEW_ENTRIES.map((item) => item.id);
        expect(new Set(ids).size).toBe(ids.length);

        const dates = WHATS_NEW_ENTRIES.map((item) => item.date);
        expect(dates).toEqual(dates.toSorted().toReversed());
    });

    it("writes every entry in both languages", () => {
        for (const item of WHATS_NEW_ENTRIES) {
            const texts = [item.title, item.summary, ...item.changes].filter(
                (text) => text !== undefined
            );
            for (const text of texts) {
                expect(text.en.trim(), item.id).not.toBe("");
                expect(text.ru.trim(), item.id).not.toBe("");
            }
            expect(item.changes.length, item.id).toBeGreaterThan(0);
        }
    });

    it("uses plain SemVer and a period range only before releases", () => {
        for (const item of WHATS_NEW_ENTRIES) {
            if (item.version === null) {
                expect(item.from, item.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
                expect(item.from! <= item.date, item.id).toBe(true);
            } else {
                expect(item.version).toMatch(/^\d+\.\d+\.\d+$/);
                expect(item.from, item.id).toBeUndefined();
            }
        }
    });
});

describe("release version", () => {
    it("keeps package.json, the release manifest and the app in step", () => {
        const packageVersion = JSON.parse(read("package.json")).version;
        const manifest = JSON.parse(read(".release-please-manifest.json"));

        expect(PLOTOPS_VERSION).toBe(packageVersion);
        expect(manifest["."]).toBe(packageVersion);
    });

    it("never lists a release newer than the running version", () => {
        expect(
            latestPublishedVersion(WHATS_NEW_ENTRIES, "999.0.0") ?? "0.0.0"
        ).toBe(
            latestPublishedVersion(WHATS_NEW_ENTRIES, PLOTOPS_VERSION) ??
                "0.0.0"
        );
    });

    it("lets release-please find the version line in the app", () => {
        expect(read("src/shared/config/app-version.ts")).toMatch(
            /PLOTOPS_VERSION = "\d+\.\d+\.\d+"; \/\/ x-release-please-version/
        );
        expect(read("release-please-config.json")).toMatch(
            /src\/shared\/config\/app-version\.ts/
        );
    });
});

describe("What's new public route", () => {
    it("is prerendered, crawlable and served by Cloudflare", () => {
        expect(PLOTOPS_PUBLIC_PATHS).toContain("/whats-new");
        expect(read("public/robots.txt")).toMatch(/Allow: \/whats-new/);
        expect(read("public/sitemap.xml")).toMatch(
            /<loc>https:\/\/plotops\.webrunner\.dev\/whats-new<\/loc>/
        );
        expect(read("public/_redirects")).toMatch(
            /\/whats-new\s+\/whats-new\/index\.html\s+200/
        );
    });

    it("is linked from the user menu and the About page", () => {
        expect(read("src/widgets/top-bar/ui/user-menu.tsx")).toMatch(
            /to: "\/whats-new"/
        );
        expect(read("src/routes/(main)/about.tsx")).toMatch(/to="\/whats-new"/);
    });
});
