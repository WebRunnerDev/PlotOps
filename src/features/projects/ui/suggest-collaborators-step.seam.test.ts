import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi(name: string) {
    return readFileSync(path.join(dirname, name), "utf8");
}

describe("SuggestCollaboratorsStep empty collaborators seam", () => {
    it("when no GitHub collaborators remain, offers open Team invite link instead of auto-closing", () => {
        const step = readUi("suggest-collaborators-step.tsx");

        expect(step).toMatch(/collaboratorSuggestEmptyDescription/);
        expect(step).toMatch(/collaboratorSuggestCopyOpenLink/);
        expect(step).toMatch(/copyOpenInviteLink/);
        expect(step).not.toMatch(
            /if \(plan\.suggestions\.length === 0\) \{\s*onDoneReference\.current\(\);\s*\}/
        );
    });
});
