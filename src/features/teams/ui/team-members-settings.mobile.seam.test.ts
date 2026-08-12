import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TeamMembersSettings mobile seam", () => {
    it("allows member rows to reflow using flex-wrap", () => {
        const source = readFileSync(
            path.join(dirname, "team-members-settings.tsx"),
            "utf8"
        );

        expect(source).toMatch(
            /flex flex-wrap items-center gap-3 px-3\.5 py-2/
        );
        expect(source).not.toMatch(
            /className="flex items-center gap-3 px-3\.5 py-2"/
        );
    });
});
