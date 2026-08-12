import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const inviteSource = readFileSync(
    path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "invite.$token.tsx"
    ),
    "utf8"
);

describe("invite accept page mobile seam", () => {
    it("uses a full-width column shell with prominent stacked actions", () => {
        expect(inviteSource).toMatch(/PublicPageShell/);
        expect(inviteSource).toMatch(/className="w-full"/);
        expect(inviteSource).toMatch(/size="lg"/);
        expect(inviteSource).toMatch(/break-words/);
    });
});
