import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("TeamProjectsPage access gating", () => {
    it("treats missing canView as fatal only after access has settled", () => {
        const source = fs.readFileSync(
            path.join(dirname, "team-projects-page.tsx"),
            "utf8"
        );

        // Same pattern as CiCdPage: unsettled caps are canView=false and must
        // not paint the destructive "team load failed" flash before content.
        expect(source).toMatch(/isSettled/);
        expect(source).toMatch(
            /accessError\s*\|\|\s*teamError\s*\|\|\s*!team\s*\|\|\s*\(isSettled\s*&&\s*!canView\)/
        );
    });
});
