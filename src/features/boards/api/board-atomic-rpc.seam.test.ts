import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readApi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("board columns API atomic seams", () => {
    it("reorders via single reorder_board_columns RPC", () => {
        const source = readApi("board-columns-api.ts");

        expect(source).toMatch(/rpc\(\s*["']reorder_board_columns["']/);
        expect(source).not.toMatch(/Promise\.all\(updates\)/);
    });
});

describe("boards API atomic create seam", () => {
    it("creates board + columns via create_board_with_columns RPC", () => {
        const source = readApi("boards-api.ts");

        expect(source).toMatch(/rpc\(\s*["']create_board_with_columns["']/);
        expect(source).not.toMatch(/DEFAULT_KANBAN_COLUMNS/);
    });
});
