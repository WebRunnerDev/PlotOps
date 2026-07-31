export type CommandPaletteLocalState = {
    isCreating: boolean;
    query: string;
};

/** Cleared input + create spinner when the palette finishes closing. */
export function resetCommandPaletteLocalState(): CommandPaletteLocalState {
    return { isCreating: false, query: "" };
}
