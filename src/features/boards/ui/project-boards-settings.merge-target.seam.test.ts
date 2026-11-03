import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe("ProjectBoardsSettings merge target", () => {
    it("offers the merge target only with the Development Board fields", () => {
        const source = readFileSync(
            path.join(dirname, "project-boards-settings.tsx"),
            "utf8"
        );

        expect(source).toMatch(
            /showDevelopmentFields \? \(\s*<div[^>]*>\s*<Label\s+htmlFor=\{`board-merge-target-/
        );
        expect(source).toMatch(
            /\.\.\.fromMergeTargetValue\(\s*mergeTarget\s*\)/
        );
        expect(source).toMatch(/value="last_column"/);
        expect(source).toMatch(/value="none"/);
    });

    it("has en and ru strings", () => {
        for (const locale of ["en", "ru"]) {
            const strings = JSON.parse(
                readFileSync(
                    path.join(
                        dirname,
                        `../../../app/locales/board/${locale}.json`
                    ),
                    "utf8"
                )
            ) as { boards: Record<string, string> };

            for (const key of [
                "mergeTarget",
                "mergeTargetHint",
                "mergeTargetLastColumn",
                "mergeTargetLoadFailed",
                "mergeTargetNone",
            ]) {
                expect(strings.boards[key], `${locale}.${key}`).toBeTruthy();
            }
        }
    });
});
