import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { parseUpcomingNote, stampWhatsNew } from "./whats-new-stamp.ts";

const change = (en: string) => ({ en, kind: "new" as const, ru: `ru ${en}` });

const released = [
    {
        changes: [change("old")],
        date: "2026-09-02",
        id: "v1-0-0",
        version: "1.0.0",
    },
];

describe("stampWhatsNew", () => {
    it("returns null when nothing is waiting", () => {
        expect(
            stampWhatsNew({
                date: "2026-11-23",
                notes: [],
                releases: released,
                version: "1.0.1",
            })
        ).toBeNull();
    });

    it("merges every upcoming note into one entry on top", () => {
        const stamped = stampWhatsNew({
            date: "2026-11-23",
            notes: [
                { changes: [change("a")] },
                {
                    changes: [change("b")],
                    summary: { en: "S", ru: "С" },
                    title: { en: "T", ru: "Т" },
                },
            ],
            releases: released,
            version: "1.1.0",
        });

        expect(stamped).toEqual([
            {
                changes: [change("a"), change("b")],
                date: "2026-11-23",
                id: "v1-1-0",
                summary: { en: "S", ru: "С" },
                title: { en: "T", ru: "Т" },
                version: "1.1.0",
            },
            ...released,
        ]);
    });

    it("replaces an entry for the same version instead of duplicating it", () => {
        const stamped = stampWhatsNew({
            date: "2026-11-24",
            notes: [{ changes: [change("again")] }],
            releases: released,
            version: "1.0.0",
        });

        expect(stamped).toHaveLength(1);
        expect(stamped?.[0]?.changes).toEqual([change("again")]);
    });
});

describe("parseUpcomingNote", () => {
    it("accepts a note with bilingual changes", () => {
        const raw = JSON.stringify({ changes: [change("x")] });
        expect(parseUpcomingNote("x.json", raw).changes).toHaveLength(1);
    });

    it("names the file when a translation is missing", () => {
        const raw = JSON.stringify({
            changes: [{ en: "only English", kind: "new", ru: "" }],
        });
        expect(() => parseUpcomingNote("half.json", raw)).toThrow(
            /upcoming\/half\.json/
        );
    });

    it("rejects unknown kinds and empty notes", () => {
        expect(() =>
            parseUpcomingNote(
                "k.json",
                JSON.stringify({ changes: [{ ...change("x"), kind: "added" }] })
            )
        ).toThrow(/unknown kind/);
        expect(() =>
            parseUpcomingNote("e.json", JSON.stringify({ changes: [] }))
        ).toThrow(/non-empty/);
    });
});

describe("upcoming notes in the repo", () => {
    it("are all valid, so the release step cannot fail on them", () => {
        const directory = path.resolve(
            path.dirname(fileURLToPath(import.meta.url)),
            "../src/features/whats-new/upcoming"
        );
        for (const name of readdirSync(directory)) {
            if (name.endsWith(".json")) {
                const raw = readFileSync(path.join(directory, name), "utf8");
                expect(() => parseUpcomingNote(name, raw)).not.toThrow();
            }
        }
    });
});
