import {
    clearCommandPaletteRecent,
    type CommandPaletteRecentOwner,
} from "./recent";

export type CommandPaletteLocalState = {
    query: string;
};

/**
 * Clears the search input when the palette finishes closing.
 * Does not touch in-flight create — `isCreating` clears only in the mutation `finally`.
 * With `recentOwner` (sign out, Leave / Reset demo) also drops that owner's Recent;
 * a plain close keeps it.
 */
export function resetCommandPaletteLocalState(options?: {
    recentOwner?: CommandPaletteRecentOwner;
}): CommandPaletteLocalState {
    if (options?.recentOwner) {
        clearCommandPaletteRecent(options.recentOwner);
    }
    return { query: "" };
}
