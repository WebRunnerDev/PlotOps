import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readUi() {
    return readFileSync(
        path.join(dirname, "project-custom-fields-settings.tsx"),
        "utf8"
    );
}

describe("ProjectCustomFieldsSettings usage guards", () => {
    it("fails closed on usage loading/error before delete", () => {
        const source = readUi();

        expect(source).toMatch(/isError:\s*usageError/);
        expect(source).toMatch(/isLoading:\s*usageLoading/);
        expect(source).toMatch(/usageKnown/);
        expect(source).toMatch(/disabled=\{!usageKnown\}/);
        expect(source).toMatch(/customFieldSettings\.usageLoadFailed/);
        expect(source).toMatch(/customFieldSettings\.transferDuplicate/);
        expect(source).toMatch(/copyCustomFieldToProject/);
        expect(source).not.toMatch(/moveCustomField/);
    });
});
