import type { NotificationKind } from "@/features/notifications/model/types";

import commonEn from "@/app/locales/common/en.json";
import commonRu from "@/app/locales/common/ru.json";

const KIND_PHRASE_KEYS = {
    assignee_change: [
        "assigneeChange",
        "assigneeChangeDetail",
        "assigneeChangeFromDetail",
    ],
    assignment: ["assignment", "assignmentDetail"],
    author_change: [
        "authorChange",
        "authorChangeDetail",
        "authorChangeFromDetail",
    ],
    board_move: ["boardMove", "boardMoveDetail", "boardMoveStatusDetail"],
    deadline_change: [
        "deadlineChange",
        "deadlineChangeClearedDetail",
        "deadlineChangeDetail",
        "deadlineChangeSetDetail",
    ],
    mention: [
        "mention",
        "mentionComment",
        "mentionCommentDetail",
        "mentionDescription",
        "mentionDescriptionDetail",
    ],
    priority_change: ["priorityChange", "priorityChangeDetail"],
    status_change: ["statusChange", "statusChangeDetail"],
} as const satisfies Record<NotificationKind, readonly string[]>;

const PRIORITY_VALUES = ["none", "urgent", "high", "medium", "low"] as const;

/** Extra English stems users type that do not appear in raw `kind` (e.g. assigned vs assignment). */
const KIND_ALIASES: Partial<Record<NotificationKind, readonly string[]>> = {
    assignee_change: ["assignee", "assigned"],
    assignment: ["assigned", "assignee"],
    author_change: ["author"],
    board_move: ["board", "moved"],
    deadline_change: ["deadline", "due"],
    mention: ["mentioned", "mention", "упомянул", "упомянули", "упоминание"],
    priority_change: ["priority"],
    status_change: ["status"],
};

export type NotificationSearchExpansion = {
    extraPatterns: string[];
    matchedKinds: NotificationKind[];
};

/**
 * Maps a user query to notification kinds / metadata tokens using UI copy (en+ru),
 * with typo + Russian case tolerance (prefix stem + small edit distance).
 */
export function expandNotificationSearchQuery(
    rawQuery: string
): NotificationSearchExpansion {
    const needle = rawQuery.trim().toLowerCase();
    if (!needle) {
        return { extraPatterns: [], matchedKinds: [] };
    }

    const matchedKinds = (
        Object.keys(KIND_PHRASE_KEYS) as NotificationKind[]
    ).filter((kind) => kindMatchesQuery(kind, needle));

    const extraPatterns = PRIORITY_VALUES.filter((value) =>
        priorityMatchesQuery(value, needle)
    );

    return { extraPatterns: [...extraPatterns], matchedKinds };
}

export function fuzzyTextMatch(haystack: string, needle: string): boolean {
    if (!needle || !haystack) return false;
    if (haystack.includes(needle)) return true;

    for (const token of tokenize(haystack)) {
        if (tokenIncludesFlexible(token, needle)) {
            return true;
        }
    }

    // Multi-word needle vs full phrase (e.g. "assigned to")
    return tokenIncludesFlexible(haystack.replaceAll(/\s+/g, ""), needle);
}

function kindMatchesQuery(kind: NotificationKind, needle: string): boolean {
    if (fuzzyTextMatch(kind, needle)) {
        return true;
    }

    for (const alias of KIND_ALIASES[kind] ?? []) {
        if (fuzzyTextMatch(alias, needle) || fuzzyTextMatch(needle, alias)) {
            return true;
        }
    }

    for (const key of KIND_PHRASE_KEYS[kind]) {
        for (const phrase of phrasesForKindKey(key)) {
            if (fuzzyTextMatch(phrase, needle)) {
                return true;
            }
        }
    }

    return false;
}

function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
    const current = Array.from({ length: b.length + 1 }, () => 0);

    for (let index = 1; index <= a.length; index += 1) {
        current[0] = index;
        for (let index_ = 1; index_ <= b.length; index_ += 1) {
            const cost = a[index - 1] === b[index_ - 1] ? 0 : 1;
            current[index_] = Math.min(
                previous[index_]! + 1,
                current[index_ - 1]! + 1,
                previous[index_ - 1]! + cost
            );
        }
        for (let index = 0; index <= b.length; index += 1) {
            previous[index] = current[index]!;
        }
    }

    return previous[b.length]!;
}

function maxEditDistance(length: number): number {
    if (length < 4) return 0;
    if (length < 7) return 1;
    if (length < 12) return 2;
    return 3;
}

function phrasesForKindKey(key: string): string[] {
    const phrases: string[] = [];
    for (const locale of [commonEn, commonRu]) {
        const kinds = locale.notifications.kinds as Record<string, string>;
        const raw = kinds[key];
        if (!raw) continue;
        phrases.push(stripI18nPlaceholders(raw).toLowerCase());
    }
    return phrases;
}

function priorityMatchesQuery(
    value: (typeof PRIORITY_VALUES)[number],
    needle: string
): boolean {
    if (fuzzyTextMatch(value, needle)) {
        return true;
    }

    for (const locale of [commonEn, commonRu]) {
        const label = locale.notifications.priority[value]?.toLowerCase();
        if (label && fuzzyTextMatch(label, needle)) {
            return true;
        }
    }

    return false;
}

/** Russian cases often share a long prefix (назначен / назначенного / назначили). */
function sharesStemPrefix(a: string, b: string): boolean {
    const minLength = Math.min(a.length, b.length);
    if (minLength < 4) {
        return false;
    }
    const prefixLength = Math.max(4, Math.ceil(minLength * 0.7));
    return a.slice(0, prefixLength) === b.slice(0, prefixLength);
}

function stripI18nPlaceholders(value: string): string {
    return value
        .replaceAll(/\{\{[^}]+\}\}/g, " ")
        .replaceAll(/\s+/g, " ")
        .trim();
}

function tokenIncludesFlexible(token: string, needle: string): boolean {
    if (token.includes(needle) || needle.includes(token)) {
        // Avoid tiny accidental overlaps ("to", "на")
        if (Math.min(token.length, needle.length) >= 3) {
            return true;
        }
        return token === needle;
    }

    if (sharesStemPrefix(token, needle)) {
        return true;
    }

    const maxDistance = maxEditDistance(Math.max(token.length, needle.length));
    if (maxDistance === 0) {
        return false;
    }

    return levenshtein(token, needle) <= maxDistance;
}

function tokenize(value: string): string[] {
    return value.split(/[^a-zа-яё0-9]+/i).filter(Boolean);
}
