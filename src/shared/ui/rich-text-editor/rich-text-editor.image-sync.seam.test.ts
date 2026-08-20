import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("rich text editor external content sync seam", () => {
    it("skips setContent while image uploads are pending", () => {
        const source = readFileSync(
            path.join(dirname, "rich-text-editor.tsx"),
            "utf8"
        );

        expect(source).toMatch(/shouldApplyExternalContent/);
        expect(source).toMatch(
            /pendingUploads:\s*editor\.storage\.imageUpload\.pending/
        );
        expect(source).toMatch(/blurWhilePendingReference/);
    });
});
