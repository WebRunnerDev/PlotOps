export type CommandPaletteLocalState = {
    query: string;
};

/**
 * Clears the search input when the palette finishes closing.
 * Does not touch in-flight create — `isCreating` clears only in the mutation `finally`.
 */
export function resetCommandPaletteLocalState(): CommandPaletteLocalState {
    return { query: "" };
}
