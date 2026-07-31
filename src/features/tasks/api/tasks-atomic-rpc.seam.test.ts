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
