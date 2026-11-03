import type { Destination } from "@/shared/lib/destinations";

/** Palette groups in render order (SPEC §4 → Destinations → Group order). */
export type CommandPaletteGroup =
    "actions" | "members" | "navigation" | "projects" | "recent" | "tasks";

/** Translator fixed to one locale and the `command` namespace (keyword keys), e.g. `i18n.getFixedT("en", "command")`. */
export type CommandPaletteLocaleTranslate = (
    key: string,
    options?: { returnObjects: true }
) => unknown;

const GROUP_ORDER: readonly CommandPaletteGroup[] = [
    "navigation",
    "actions",
    "tasks",
    "members",
    "projects",
];

const TASK_KEY_QUERY = /^[a-z][\da-z]*-\d+$/i;

/**
 * Lowercased name, parent and keywords of a Destination in every given
 * locale — search matches both locales regardless of the UI language.
 */
export function destinationSearchTerms(
    destination: Destination,
    translators: readonly CommandPaletteLocaleTranslate[]
): string[] {
    const terms: string[] = [];

    for (const translate of translators) {
        const labels = [
            translate(destination.titleKey),
            "parentKey" in destination
                ? translate(destination.parentKey)
                : undefined,
        ];
        for (const label of labels) {
            if (typeof label === "string") terms.push(label);
        }

        const keywords = translate(destination.keywordsKey, {
            returnObjects: true,
        });
        if (Array.isArray(keywords)) {
            for (const keyword of keywords) {
                if (typeof keyword === "string") terms.push(keyword);
            }
        }
    }

    return terms.map((term) => term.toLowerCase());
}

/** Path subtitle, e.g. “Project settings › Labels · Frontend”; null when it would only repeat the name. */
export function formatDestinationPath(path: {
    parent?: null | string;
    scope?: null | string;
    title: string;
}): null | string {
    if (!path.parent && !path.scope) {
        return null;
    }
    const trail = path.parent ? `${path.parent} › ${path.title}` : path.title;
    return path.scope ? `${trail} · ${path.scope}` : trail;
}

/** A query shaped like a Task key (`PLT-12`). */
export function isTaskKeyQuery(query: string): boolean {
    return TASK_KEY_QUERY.test(query.trim());
}

/**
 * Destinations whose terms contain every word of the query, in registry
 * order. Empty query → all given Destinations.
 */
export function matchDestinations<D extends Destination>(
    destinations: readonly D[],
    query: string,
    termsOf: (destination: D) => readonly string[]
): D[] {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
        return [...destinations];
    }

    return destinations.filter((destination) => {
        const terms = termsOf(destination);
        return words.every((word) => terms.some((term) => term.includes(word)));
    });
}

/**
 * Fixed group order; Recent leads on an empty query only, and a Task-key
 * query lifts Tasks to the top.
 */
export function resolveCommandPaletteGroupOrder(
    query: string
): CommandPaletteGroup[] {
    if (query.trim().length === 0) {
        return ["recent", ...GROUP_ORDER];
    }
    if (!isTaskKeyQuery(query)) {
        return [...GROUP_ORDER];
    }
    return ["tasks", ...GROUP_ORDER.filter((group) => group !== "tasks")];
}
