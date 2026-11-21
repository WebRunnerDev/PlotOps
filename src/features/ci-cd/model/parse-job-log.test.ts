import { describe, expect, it } from "vitest";

import {
    parseAnsi,
    parseJobLog,
    stripAnsi,
} from "@/features/ci-cd/model/parse-job-log";

const ESC = String.fromCodePoint(0x1b);

const log = (...texts: string[]) =>
    texts.map((text, index) => ({
        done: index === texts.length - 1,
        index,
        text,
    }));

describe("parseJobLog", () => {
    it("folds ##[group] … ##[endgroup] into a group and drops the end marker", () => {
        const entries = parseJobLog(
            log(
                "Current runner version: '2.320.0'",
                "##[group]Run npm ci",
                "npm ci",
                "added 812 packages",
                "##[endgroup]",
                "done"
            )
        );

        expect(entries.map((entry) => entry.kind)).toEqual([
            "line",
            "group",
            "line",
        ]);
        const group = entries[1];
        expect(group?.kind === "group" && group.group).toMatchObject({
            closed: true,
            errorCount: 0,
            id: 1,
            lines: [{ index: 2 }, { index: 3 }],
            title: { segments: [{ text: "Run npm ci" }] },
        });
    });

    it("marks workflow-command levels and counts errors inside a group", () => {
        const entries = parseJobLog(
            log(
                "##[group]Run npm test",
                "[command]/usr/bin/npm test",
                "##[warning]Deprecated option",
                "##[error]Process completed with exit code 1."
            )
        );

        const group = entries[0];
        expect(group?.kind).toBe("group");
        if (group?.kind !== "group") return;
        expect(group.group.closed).toBe(false);
        expect(group.group.errorCount).toBe(1);
        expect(group.group.lines.map((line) => line.level)).toEqual([
            "command",
            "warning",
            "error",
        ]);
        expect(group.group.lines[2]?.segments[0]?.text).toBe(
            "Process completed with exit code 1."
        );
    });

    it("closes an open group when the next one starts", () => {
        const entries = parseJobLog(log("##[group]A", "a", "##[group]B", "b"));

        expect(
            entries.map((entry) =>
                entry.kind === "group" ? entry.group.closed : undefined
            )
        ).toEqual([true, false]);
    });
});

describe("parseAnsi", () => {
    it("splits a line into coloured runs and resets on 0", () => {
        expect(
            parseAnsi(`${ESC}[36;1mnpm ci${ESC}[0m ok ${ESC}[91merr${ESC}[39m`)
        ).toEqual([
            { bold: true, dim: false, text: "npm ci", tone: "cyan" },
            { bold: false, dim: false, text: " ok " },
            { bold: false, dim: false, text: "err", tone: "red" },
        ]);
    });

    it("skips extended colour arguments and non-SGR sequences", () => {
        expect(
            parseAnsi(`${ESC}[38;5;196m${ESC}[2Kred${ESC}[32m green`)
        ).toEqual([
            { bold: false, dim: false, text: "red" },
            { bold: false, dim: false, text: " green", tone: "green" },
        ]);
    });
});

describe("stripAnsi", () => {
    it("removes escape sequences and keeps the text", () => {
        expect(stripAnsi(`${ESC}[1m${ESC}[33mwarn${ESC}[0m`)).toBe("warn");
        expect(stripAnsi("plain")).toBe("plain");
    });
});
