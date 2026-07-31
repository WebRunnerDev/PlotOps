import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readApi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("sprints API atomic assign seam", () => {
    it("assigns and reorders via single assign_tasks_to_sprint RPC", () => {
        const source = readApi("sprints-api.ts");

        expect(source).toMatch(/rpc\(\s*["']assign_tasks_to_sprint["']/);
        expect(source).not.toMatch(
            /Promise\.all\(\s*updates\.map\(\s*\(item\)\s*=>\s*supabase[\s\S]*\.from\(\s*["']tasks["']\s*\)/
        );
    });
});
