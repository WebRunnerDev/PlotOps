import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

/** Resolved, still-available Recent entry, newest first. */
export type CommandPaletteRecentHit<D, T, P> =
    | { item: D; kind: "destination" }
    | { item: P; kind: "project" }
    | { item: T; kind: "task" };

/** An item picked in the palette, stored with the ids needed to re-check access. */
export type CommandPaletteRecentItem =
    | {
          id: string;
          kind: "destination";
          /** Route params the Destination was opened with. */
          params: Record<string, string>;
      }
    | { kind: "project"; projectId: string }
    | { kind: "task"; projectId: string; taskId: string };

/**
 * Who owns a Recent list: a signed-in user id, or the Guest Session.
 * Lists never cross owners (SPEC §4 → Destinations → Empty query).
 */
export type CommandPaletteRecentOwner =
    { kind: "guest" } | { kind: "user"; userId: string };

export const COMMAND_PALETTE_RECENT_LIMIT = 5;

const STORAGE_PREFIX = "plotops_command_recent";

/** Drops this owner's Recent (sign out, Leave / Reset demo). */
export function clearCommandPaletteRecent(
    owner: CommandPaletteRecentOwner
): void {
    safeRemoveItem("localStorage", commandPaletteRecentStorageKey(owner));
}

/** localStorage key per owner — users and the Guest Session never share one. */
export function commandPaletteRecentStorageKey(
    owner: CommandPaletteRecentOwner
): string {
    return owner.kind === "guest"
        ? `${STORAGE_PREFIX}:guest`
        : `${STORAGE_PREFIX}:user:${owner.userId}`;
}

/** Moves `item` to the front, without duplicates, capped at the limit. */
export function pushCommandPaletteRecent(
    items: readonly CommandPaletteRecentItem[],
    item: CommandPaletteRecentItem
): CommandPaletteRecentItem[] {
    const key = recentItemKey(item);
    return [
        item,
        ...items.filter((existing) => recentItemKey(existing) !== key),
    ].slice(0, COMMAND_PALETTE_RECENT_LIMIT);
}

export function readCommandPaletteRecent(
    owner: CommandPaletteRecentOwner
): CommandPaletteRecentItem[] {
    const raw = safeGetItem(
        "localStorage",
        commandPaletteRecentStorageKey(owner)
    );
    if (!raw) return [];

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter((item) => isRecentItem(item))
            .slice(0, COMMAND_PALETTE_RECENT_LIMIT);
    } catch {
        return [];
    }
}

/** Records a pick and returns the updated list. */
export function recordCommandPaletteRecent(
    owner: CommandPaletteRecentOwner,
    item: CommandPaletteRecentItem
): CommandPaletteRecentItem[] {
    const next = pushCommandPaletteRecent(
        readCommandPaletteRecent(owner),
        item
    );
    safeSetItem(
        "localStorage",
        commandPaletteRecentStorageKey(owner),
        JSON.stringify(next)
    );
    return next;
}

/**
 * Keeps only entries the lookups still resolve — no permission, archived or
 * deleted Task, unavailable Project → hidden. Order is preserved.
 */
export function resolveCommandPaletteRecent<D, T, P>(
    items: readonly CommandPaletteRecentItem[],
    lookup: {
        destination: (
            item: Extract<CommandPaletteRecentItem, { kind: "destination" }>
        ) => D | null;
        project: (
            item: Extract<CommandPaletteRecentItem, { kind: "project" }>
        ) => null | P;
        task: (
            item: Extract<CommandPaletteRecentItem, { kind: "task" }>
        ) => null | T;
    }
): CommandPaletteRecentHit<D, T, P>[] {
    const hits: CommandPaletteRecentHit<D, T, P>[] = [];

    for (const item of items) {
        if (item.kind === "destination") {
            const resolved = lookup.destination(item);
            if (resolved !== null)
                hits.push({ item: resolved, kind: item.kind });
        } else if (item.kind === "task") {
            const resolved = lookup.task(item);
            if (resolved !== null)
                hits.push({ item: resolved, kind: item.kind });
        } else {
            const resolved = lookup.project(item);
            if (resolved !== null)
                hits.push({ item: resolved, kind: item.kind });
        }
    }

    return hits;
}

/** Guest Session wins over a lingering user id; neither → no Recent. */
export function resolveCommandPaletteRecentOwner(
    isGuest: boolean,
    userId: null | string
): CommandPaletteRecentOwner | null {
    if (isGuest) return { kind: "guest" };
    return userId ? { kind: "user", userId } : null;
}

/** Same Destination opened with the same route params. */
export function sameDestinationParameters(
    a: Readonly<Record<string, string>>,
    b: Readonly<Record<string, string>>
): boolean {
    const aKeys = Object.keys(a);
    return (
        aKeys.length === Object.keys(b).length &&
        aKeys.every((key) => a[key] === b[key])
    );
}

function isRecentItem(value: unknown): value is CommandPaletteRecentItem {
    if (!value || typeof value !== "object") return false;
    const record = value as Record<string, unknown>;

    if (record.kind === "destination") {
        const parameters = record.params;
        return (
            typeof record.id === "string" &&
            !!parameters &&
            typeof parameters === "object" &&
            Object.values(parameters).every(
                (parameter) => typeof parameter === "string"
            )
        );
    }
    if (record.kind === "task") {
        return (
            typeof record.taskId === "string" &&
            typeof record.projectId === "string"
        );
    }
    if (record.kind === "project") {
        return typeof record.projectId === "string";
    }
    return false;
}

function recentItemKey(item: CommandPaletteRecentItem): string {
    if (item.kind === "destination") {
        const parameters = Object.keys(item.params)
            .toSorted()
            .map((key) => `${key}=${item.params[key]}`)
            .join("&");
        return `destination:${item.id}?${parameters}`;
    }
    if (item.kind === "task") return `task:${item.taskId}`;
    return `project:${item.projectId}`;
}
