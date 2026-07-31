import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("Command palette local reset seam", () => {
    it("resets query/creating when isOpen becomes false", () => {
        const source = readUi("command-palette.tsx");

        expect(source).toMatch(/resetCommandPaletteLocalState/);
        expect(source).toMatch(
            /useEffect\(\(\)\s*=>\s*\{[\s\S]*if\s*\(isOpen\)\s*return/
        );
        expect(source).toMatch(/setQuery\(reset\.query\)/);
        expect(source).toMatch(/setIsCreating\(reset\.isCreating\)/);
    });
});

describe("Command palette create-task columnsReady seam", () => {
    it("gates create on columnsReady via resolveCreateTaskColumnGate", () => {
        const source = readUi("command-palette.tsx");

        expect(source).toMatch(/columnsReady/);
        expect(source).toMatch(/resolveCreateTaskColumnGate/);
        expect(source).toMatch(/createColumnGate\s*===\s*"loading"/);
        expect(source).toMatch(/command:columnsLoading/);
    });
});
