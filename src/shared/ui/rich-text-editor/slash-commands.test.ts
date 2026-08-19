import { describe, expect, it } from "vitest";

import { filterSlashCommands } from "@/shared/ui/rich-text-editor/slash-commands";

describe("filterSlashCommands", () => {
    it("offers a table insert outside tables", () => {
        const ids = filterSlashCommands("table").map((command) => command.id);
        expect(ids).toContain("table");
        expect(ids).not.toContain("table-add-row");
        expect(ids).not.toContain("table-delete");
    });

    it("offers row/column/delete commands while the caret is in a table", () => {
        const ids = filterSlashCommands("", { inTable: true }).map(
            (command) => command.id
        );
        expect(ids).not.toContain("table");
        expect(ids).toEqual(
            expect.arrayContaining([
                "table-add-row",
                "table-add-column",
                "table-delete-row",
                "table-delete-column",
                "table-copy-column",
                "table-delete",
            ])
        );
    });
});
