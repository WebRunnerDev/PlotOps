import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("ProjectBoardsSettings Development Board", () => {
    it("toggles is_development and requires Base branch only for Development Boards", () => {
        const source = readFileSync(
            path.join(dirname, "project-boards-settings.tsx"),
            "utf8"
        );
        const en = readFileSync(
            path.join(dirname, "../../../app/locales/board/en.json"),
            "utf8"
        );

        expect(source).toMatch(/boards\.isDevelopment/);
        expect(source).toMatch(/is_development:\s*true/);
        expect(source).toMatch(/is_development:\s*false/);
        expect(source).toMatch(/showDevFields\s*&&\s*!baseBranch\.trim\(\)/);
        expect(en).toMatch(/"isDevelopment"/);
        expect(en).toMatch(/"isDevelopmentHint"/);
    });
});
