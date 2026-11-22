import releasesJson from "../data/releases.json";

/**
 * The What's new timeline, newest first: every release that shipped notes,
 * plus the stretches of work before 1.0 (no version — tags start at v1.0.0).
 * Written for people who use PlotOps; CHANGELOG.md is the technical record.
 *
 * Do not edit `data/releases.json` to announce a change. Add a file to
 * `upcoming/` in the feature PR instead: on release, the bot moves every
 * upcoming file into a new entry under the new version (see
 * `scripts/whats-new-stamp.mjs` and docs/RELEASING.md).
 */

export type WhatsNewChange = WhatsNewText & {
    kind: WhatsNewChangeKind;
};

export type WhatsNewChangeKind = "fixed" | "improved" | "new";

export type WhatsNewEntry = {
    changes: readonly WhatsNewChange[];
    /** ISO date: the release day, or the last day of a pre-1.0 period. */
    date: string;
    /** ISO date the pre-1.0 period started; absent on releases. */
    from?: string;
    /** URL fragment for deep links, e.g. `/whats-new#v1-1-0`. */
    id: string;
    summary?: WhatsNewText;
    /** Small releases may have none; the page then titles them by version. */
    title?: WhatsNewText;
    /** SemVer without the `v`; null for pre-1.0 periods. */
    version: null | string;
};

export type WhatsNewLocale = "en" | "ru";

export type WhatsNewText = Readonly<Record<WhatsNewLocale, string>>;

/** Shape checked by `whats-new.test.ts`; JSON imports are typed loosely. */
export const WHATS_NEW_ENTRIES = releasesJson as readonly WhatsNewEntry[];
