import type { BuildLogLine } from "@/features/ci-cd/model/types";

/** Foreground colour of an ANSI SGR run, folded to the 8 base hues. */
export type AnsiTone =
    "blue" | "cyan" | "gray" | "green" | "magenta" | "red" | "white" | "yellow";

/** One top-level console row: a plain line or a collapsible group. */
export type LogEntry =
    { group: LogGroup; kind: "group" } | { kind: "line"; line: ParsedLogLine };

/** A GitHub Actions log group (`##[group]` … `##[endgroup]`). */
export type LogGroup = {
    /** False while the group is still open (job running, log cut short). */
    closed: boolean;
    /** Error lines inside — such a group opens expanded. */
    errorCount: number;
    /** Index of the `##[group]` line — stable key across refreshes. */
    id: number;
    lines: ParsedLogLine[];
    title: ParsedLogLine;
};

/** What a workflow command (`##[error]`, `[command]` …) marks a line as. */
export type LogLevel =
    "command" | "debug" | "error" | "notice" | "plain" | "section" | "warning";

export type LogSegment = {
    bold: boolean;
    dim: boolean;
    text: string;
    tone?: AnsiTone;
};

export type ParsedLogLine = {
    index: number;
    level: LogLevel;
    segments: LogSegment[];
};

const ESC = String.fromCodePoint(0x1b);
/** Any CSI sequence; only SGR (`…m`) carries styling, the rest is dropped. */
const CSI_SEQUENCE = new RegExp(String.raw`${ESC}\[([\d;?]*)([A-Za-z])`, "g");
const WORKFLOW_COMMAND =
    /^##\[(command|debug|endgroup|error|group|notice|section|warning)\]/;
const COMMAND_PREFIX = /^\[command\]/;

const BASE_TONES: AnsiTone[] = [
    "gray",
    "red",
    "green",
    "yellow",
    "blue",
    "magenta",
    "cyan",
    "white",
];

/** Split one line into styled runs by its ANSI SGR codes. */
export function parseAnsi(text: string): LogSegment[] {
    const segments: LogSegment[] = [];
    let style: Omit<LogSegment, "text"> = { bold: false, dim: false };
    let cursor = 0;

    const push = (chunk: string) => {
        if (chunk.length === 0) return;
        const last = segments.at(-1);
        if (
            last &&
            last.bold === style.bold &&
            last.dim === style.dim &&
            last.tone === style.tone
        ) {
            last.text += chunk;
            return;
        }
        segments.push({ ...style, text: chunk });
    };

    for (const match of text.matchAll(CSI_SEQUENCE)) {
        push(text.slice(cursor, match.index));
        cursor = match.index + match[0].length;
        if (match[2] === "m") style = applySgr(style, match[1] ?? "");
    }
    push(text.slice(cursor));

    return segments;
}

/** Lines grouped the way GitHub shows them; `##[endgroup]` rows are dropped. */
export function parseJobLog(lines: readonly BuildLogLine[]): LogEntry[] {
    const entries: LogEntry[] = [];
    let open: LogGroup | undefined;

    for (const line of lines) {
        const { kind, rest } = splitWorkflowCommand(line.text);
        if (kind === "endgroup") {
            if (open) open.closed = true;
            open = undefined;
            continue;
        }
        if (kind === "group") {
            if (open) open.closed = true;
            open = {
                closed: false,
                errorCount: 0,
                id: line.index,
                lines: [],
                title: {
                    index: line.index,
                    level: "plain",
                    segments: parseAnsi(rest),
                },
            };
            entries.push({ group: open, kind: "group" });
            continue;
        }

        const parsed: ParsedLogLine = {
            index: line.index,
            level: kind,
            segments: parseAnsi(rest),
        };
        if (open) {
            open.lines.push(parsed);
            if (kind === "error") open.errorCount += 1;
        } else {
            entries.push({ kind: "line", line: parsed });
        }
    }

    return entries;
}

/** The line as plain text — no ANSI colour codes. */
export function stripAnsi(text: string): string {
    return text.replaceAll(CSI_SEQUENCE, "");
}

function applySgr(
    style: Omit<LogSegment, "text">,
    parameters: string
): Omit<LogSegment, "text"> {
    const codes = parameters === "" ? [0] : parameters.split(";").map(Number);
    let next = { ...style };

    for (let index = 0; index < codes.length; index += 1) {
        const code = codes[index] ?? 0;
        if (code >= 30 && code <= 37) {
            next.tone = BASE_TONES[code - 30];
            continue;
        }
        if (code >= 90 && code <= 97) {
            next.tone = code === 90 ? "gray" : BASE_TONES[code - 90];
            continue;
        }
        switch (code) {
            case 0: {
                next = { bold: false, dim: false };
                break;
            }
            case 1: {
                next.bold = true;
                break;
            }
            case 2: {
                next.dim = true;
                break;
            }
            case 22: {
                next.bold = false;
                next.dim = false;
                break;
            }
            case 38:
            case 48: {
                // Extended colour: skip its arguments (5;n or 2;r;g;b).
                index += codes[index + 1] === 5 ? 2 : 4;
                break;
            }
            case 39: {
                next.tone = undefined;
                break;
            }
        }
    }

    return next;
}

function splitWorkflowCommand(text: string): {
    kind: "endgroup" | "group" | LogLevel;
    rest: string;
} {
    const command = WORKFLOW_COMMAND.exec(text);
    if (command) {
        return {
            kind: command[1] as "endgroup" | "group" | LogLevel,
            rest: text.slice(command[0].length),
        };
    }
    const prefix = COMMAND_PREFIX.exec(text);
    if (prefix) {
        return { kind: "command", rest: text.slice(prefix[0].length) };
    }
    return { kind: "plain", rest: text };
}
