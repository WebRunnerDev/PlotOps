import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("useDeleteProject cache seam", () => {
    it("drops detail queries for the deleted Project instead of refetching them", () => {
        const source = readFileSync(
            path.join(dirname, "use-projects.ts"),
            "utf8"
        );
        const function_ = source.slice(
            source.indexOf("export function useDeleteProject"),
            source.indexOf("export function useProject")
        );

        expect(function_).toMatch(
            /removeQueries\(\s*\{\s*queryKey:\s*projectKeys\.detail\(projectId\)/
        );
        expect(function_).not.toMatch(
            /invalidateQueries\(\s*\{\s*queryKey:\s*projectKeys\.all\s*\}/
        );
    });
});
