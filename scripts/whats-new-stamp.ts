/**
 * Release step: turns the What's new notes waiting in
 * `src/features/whats-new/upcoming/*.json` into one entry of
 * `src/features/whats-new/data/releases.json` under the release version, then
 * deletes the upcoming files. Run on the release PR branch by
 * `.github/workflows/release-please.yml`; safe to re-run (same version is
 * replaced, not duplicated).
 *
 *   node scripts/whats-new-stamp.ts <version> <yyyy-mm-dd>
 */
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export type UpcomingNote = {
    changes: UpcomingChange[];
    summary?: Text;
    title?: Text;
};

type ReleaseEntry = {
    changes: UpcomingChange[];
    date: string;
    from?: string;
    id: string;
    summary?: Text;
    title?: Text;
    version: null | string;
};

type Text = { en: string; ru: string };

type UpcomingChange = Text & { kind: "fixed" | "improved" | "new" };

const KINDS = new Set(["fixed", "improved", "new"]);

export function parseUpcomingNote(name: string, raw: string): UpcomingNote {
    const note = JSON.parse(raw) as UpcomingNote;
    const fail = (reason: string) => {
        throw new Error(`upcoming/${name}: ${reason}`);
    };

    if (!Array.isArray(note.changes) || note.changes.length === 0) {
        fail("needs a non-empty `changes` array");
    }
    for (const change of note.changes) {
        if (!KINDS.has(change.kind)) {
            fail(`unknown kind "${change.kind}" (new | improved | fixed)`);
        }
        if (!isText(change)) {
            fail("every change needs non-empty `en` and `ru`");
        }
    }
    for (const key of ["title", "summary"] as const) {
        if (note[key] !== undefined && !isText(note[key])) {
            fail(`\`${key}\` needs non-empty \`en\` and \`ru\``);
        }
    }

    return note;
}

/**
 * Pure core. Notes are merged in file-name order; the first note with a
 * title (and summary) names the release.
 */
export function stampWhatsNew(input: {
    date: string;
    notes: readonly UpcomingNote[];
    releases: readonly ReleaseEntry[];
    version: string;
}): null | ReleaseEntry[] {
    const { date, notes, releases, version } = input;
    if (notes.length === 0) {
        return null;
    }

    const headline = notes.find((note) => note.title);
    // Key order is the order in releases.json: identity first, prose last.
    /* eslint-disable perfectionist/sort-objects */
    const entry: ReleaseEntry = {
        id: `v${version.replaceAll(".", "-")}`,
        version,
        date,
        ...(headline?.title ? { title: headline.title } : {}),
        ...(headline?.summary ? { summary: headline.summary } : {}),
        changes: notes.flatMap((note) => note.changes),
    };
    /* eslint-enable perfectionist/sort-objects */

    return [entry, ...releases.filter((item) => item.version !== version)];
}

function isText(value: unknown): value is Text {
    const text = value as Partial<Text> | undefined;
    return (
        typeof text?.en === "string" &&
        text.en.trim() !== "" &&
        typeof text.ru === "string" &&
        text.ru.trim() !== ""
    );
}

function main(argv: string[]) {
    const [version, date] = argv;
    if (
        !/^\d+\.\d+\.\d+$/.test(version ?? "") ||
        !/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")
    ) {
        throw new Error(
            "usage: node scripts/whats-new-stamp.ts <x.y.z> <yyyy-mm-dd>"
        );
    }

    const root = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        ".."
    );
    const featureDirectory = path.join(root, "src/features/whats-new");
    const upcomingDirectory = path.join(featureDirectory, "upcoming");
    const releasesFile = path.join(featureDirectory, "data/releases.json");

    const names = readdirSync(upcomingDirectory)
        .filter((name) => name.endsWith(".json"))
        .toSorted();
    const notes = names.map((name) =>
        parseUpcomingNote(
            name,
            readFileSync(path.join(upcomingDirectory, name), "utf8")
        )
    );
    const releases = JSON.parse(
        readFileSync(releasesFile, "utf8")
    ) as ReleaseEntry[];

    const stamped = stampWhatsNew({ date, notes, releases, version: version! });
    if (!stamped) {
        console.log(
            `No upcoming What's new notes; v${version} ships without an entry.`
        );
        return;
    }

    writeFileSync(releasesFile, `${JSON.stringify(stamped, undefined, 4)}\n`);
    for (const name of names) {
        rmSync(path.join(upcomingDirectory, name));
    }
    console.log(
        `Stamped ${names.length} upcoming note(s) as v${version} (${date}).`
    );
}

if (
    process.argv[1] &&
    path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
    try {
        main(process.argv.slice(2));
    } catch (error) {
        console.error(error instanceof Error ? error.message : error);
        process.exitCode = 1;
    }
}
