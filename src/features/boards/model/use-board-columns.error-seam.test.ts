import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readModel(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("useBoardColumns mutation error seam", () => {
    it("toasts onError for add, rename, and delete (not only reorder)", () => {
        const source = readModel("use-board-columns.ts");

        expect(source).toMatch(
            /addColumnMutation[\s\S]*onError:\s*\(\)\s*=>\s*\{[\s\S]*toast\.error/
        );
        expect(source).toMatch(
            /renameColumnMutation[\s\S]*onError:\s*\(\)\s*=>\s*\{[\s\S]*toast\.error/
        );
        expect(source).toMatch(
            /deleteColumnMutation[\s\S]*onError:\s*\(\)\s*=>\s*\{[\s\S]*toast\.error/
        );
        expect(source).toMatch(/Failed to reorder columns/);
    });
});
