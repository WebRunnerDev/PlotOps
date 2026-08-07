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

describe("sprints API atomic close carryover seam", () => {
    it("closes via single close_sprint RPC with per-task carryover map", () => {
        const source = readApi("sprints-api.ts");

        expect(source).toMatch(/rpc\(\s*["']close_sprint["']/);
        expect(source).toMatch(/p_carryover_by_task_id/);
        expect(source).not.toMatch(/p_carryover_sprint_id/);
        expect(source).not.toMatch(
            /for\s*\([^)]*of\s*Object\.(entries|keys)\([^)]*carryover/i
        );
    });
});
