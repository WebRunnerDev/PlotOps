import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("Description collapse seam", () => {
    it("Task drawer passes collapse preference and dirty into Description", () => {
        const source = readFileSync(
            path.join(dirname, "task-drawer.tsx"),
            "utf8"
        );

        expect(source).toMatch(/collapseLongDescription/);
        expect(source).toMatch(
            /collapseEnabled:\s*\n?\s*collapseLongDescription/
        );
        expect(source).toMatch(/dirty:\s*descriptionDirty/);
    });

    it("DescriptionEditor wraps RichTextEditor in CollapsibleClamp", () => {
        const source = readFileSync(
            path.join(
                dirname,
                "../../custom-fields/ui/task-custom-fields-section.tsx"
            ),
            "utf8"
        );

        expect(source).toMatch(/CollapsibleClamp/);
        expect(source).toMatch(/collapseEnabled/);
        expect(source).toMatch(/descriptionShowMore/);
        expect(source).toMatch(/descriptionShowLess/);
    });
});
