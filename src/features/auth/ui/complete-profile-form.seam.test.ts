import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("CompleteProfileForm late profile prefill seam", () => {
    it("merges profile names that arrive after the form mounts", () => {
        const source = fs.readFileSync(
            path.join(dirname, "complete-profile-form.tsx"),
            "utf8"
        );

        expect(source).toMatch(/mergeCompleteProfilePrefill/);
    });
});
