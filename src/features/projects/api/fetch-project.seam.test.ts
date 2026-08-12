import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("fetchProject missing-row seam", () => {
    it("uses limit(1) so a deleted Project does not surface PGRST116", () => {
        const source = readFileSync(
            path.join(dirname, "projects-api.ts"),
            "utf8"
        );
        const function_ = source.slice(
            source.indexOf("export async function fetchProject"),
            source.indexOf("export async function fetchProjects")
        );

        expect(function_).toMatch(/\.eq\(\s*["']id["']\s*,\s*projectId\s*\)/);
        expect(function_).toMatch(/\.limit\(\s*1\s*\)/);
        expect(function_).not.toMatch(/\.single\(\)/);
        expect(function_).not.toMatch(/\.maybeSingle\(\)/);
        expect(function_).toMatch(/data\?\.\[0\]/);
    });
});
