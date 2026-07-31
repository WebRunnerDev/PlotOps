import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readApi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("tasks API atomic label replace seam", () => {
    it("replaces labels via single replace_task_labels RPC", () => {
        const source = readApi("tasks-api.ts");

        expect(source).toMatch(/rpc\(\s*["']replace_task_labels["']/);
        expect(source).not.toMatch(
            /from\(["']task_labels["']\)[\s\S]*\.delete\(/
        );
    });
});

describe("tasks API atomic persist moves seam", () => {
    it("persists column moves via single persist_task_moves RPC", () => {
        const source = readApi("tasks-api.ts");

        expect(source).toMatch(/rpc\(\s*["']persist_task_moves["']/);
        expect(source).not.toMatch(
            /Promise\.all\(\s*updates\.map\(\s*\(item\)\s*=>\s*supabase[\s\S]*\.from\(\s*["']tasks["']\s*\)/
        );
    });
});

describe("tasks API atomic details + labels seam", () => {
    it("updates task details and labels via single update_task_details RPC", () => {
        const source = readApi("tasks-api.ts");

        expect(source).toMatch(/rpc\(\s*["']update_task_details["']/);
        expect(source).not.toMatch(
            /await updateTaskRecord\([\s\S]*replaceTaskLabels/
        );
    });
});
