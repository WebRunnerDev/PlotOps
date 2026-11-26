import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
    checkEdgeSecrets,
    EDGE_SECRET_FEATURES,
    type EdgeSecretFeature,
    parseSecretNames,
} from "./edge-secrets.ts";

const functionsDirectory = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../supabase/functions"
);

const features: EdgeSecretFeature[] = [
    { need: "required", note: "n", secrets: ["A", "B"], title: "Core" },
    { need: "optional", note: "n", secrets: ["C", "D"], title: "Mail" },
];

describe("checkEdgeSecrets", () => {
    it("passes when required secrets are set and an optional feature is off", () => {
        const report = checkEdgeSecrets(["A", "B", "EXTRA"], features);
        expect(report.ok).toBe(true);
        expect(report.lines).toEqual(["ok    Core", "off   Mail — n"]);
    });

    it("fails on a missing required secret and names it", () => {
        const report = checkEdgeSecrets(["A"], features);
        expect(report.ok).toBe(false);
        expect(report.lines[0]).toBe("FAIL  Core: missing B — n");
    });

    it("fails on a half-configured optional feature", () => {
        const report = checkEdgeSecrets(["A", "B", "C"], features);
        expect(report.ok).toBe(false);
        expect(report.lines[1]).toMatch(/^FAIL {2}Mail: partly set, missing D/);
    });

    it("passes when an optional feature is fully set", () => {
        const report = checkEdgeSecrets(["A", "B", "C", "D"], features);
        expect(report.ok).toBe(true);
        expect(report.lines[1]).toBe("ok    Mail");
    });
});

describe("parseSecretNames", () => {
    it("keeps only names from the CLI JSON", () => {
        expect(
            parseSecretNames(
                JSON.stringify([
                    { name: "A", updated_at: "x", value: "digest" },
                    { value: "no-name" },
                    { name: "B", value: "digest" },
                ])
            )
        ).toEqual(["A", "B"]);
    });

    it("rejects output that is not an array", () => {
        expect(() => parseSecretNames("{}")).toThrow(/JSON array/);
    });
});

function functionSources(directory: string): string[] {
    return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(directory, entry.name);
        if (entry.isDirectory()) return functionSources(full);
        return entry.name.endsWith(".ts") && !entry.name.includes(".test.")
            ? [readFileSync(full, "utf8")]
            : [];
    });
}

describe("EDGE_SECRET_FEATURES", () => {
    it("covers every secret an Edge Function reads", () => {
        const read = new Set(
            functionSources(functionsDirectory).flatMap((source) =>
                [
                    ...source.matchAll(
                        /\b(?:env|Deno\.env\.get)\(\s*["']([A-Z][A-Z0-9_]*)["']/g
                    ),
                ].map((match) => match[1]!)
            )
        );
        const listed = new Set(
            EDGE_SECRET_FEATURES.flatMap((feature) => feature.secrets)
        );

        expect(read.size).toBeGreaterThan(0);
        expect([...read].filter((name) => !listed.has(name))).toEqual([]);
    });

    it("lists each secret once", () => {
        const names = EDGE_SECRET_FEATURES.flatMap(
            (feature) => feature.secrets
        );
        expect(new Set(names).size).toBe(names.length);
    });
});
