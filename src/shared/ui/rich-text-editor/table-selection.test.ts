import { describe, expect, it } from "vitest";

import { serializeTableCellsPlainText } from "@/shared/ui/rich-text-editor/table-selection";

describe("serializeTableCellsPlainText", () => {
    it("joins a column top-to-bottom for vertical copy", () => {
        expect(
            serializeTableCellsPlainText({
                cells: ["Alpha", "Beta", "Gamma"],
                kind: "column",
            })
        ).toBe("Alpha\nBeta\nGamma");
    });

    it("joins a row with tabs", () => {
        expect(
            serializeTableCellsPlainText({
                cells: ["Name", "Status", "Owner"],
                kind: "row",
            })
        ).toBe("Name\tStatus\tOwner");
    });

    it("serializes a rectangular selection as TSV", () => {
        expect(
            serializeTableCellsPlainText({
                cells: ["A1", "B1", "A2", "B2"],
                columnCount: 2,
                kind: "grid",
            })
        ).toBe("A1\tB1\nA2\tB2");
    });
});
