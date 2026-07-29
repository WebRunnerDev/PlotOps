import type { MentionOptions } from "@tiptap/extension-mention";
import type {
    SuggestionKeyDownProps,
    SuggestionProps,
} from "@tiptap/suggestion";

import type { MentionCandidate } from "@/shared/ui/rich-text-editor/mention-candidate";

const POPUP_CLASS =
    "z-70 flex w-72 flex-col gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-md ring-1 ring-foreground/10";

const ROW_CLASS =
    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted";

const ROW_ACTIVE_CLASS = "bg-muted text-foreground ring-1 ring-ring/40";

/**
 * TipTap Suggestion config for `@` Mentionee picker (Owner + Members).
 * Uses Suggestion `mount` for Floating UI positioning.
 */
export function createMentionSuggestion(options: {
    emptyLabel: () => string;
    getCandidates: () => readonly MentionCandidate[];
    isEnabled: () => boolean;
}): MentionOptions<MentionCandidate>["suggestion"] {
    return {
        allow: ({ editor }) => options.isEnabled() && editor.isEditable,
        char: "@",
        items: ({ query }) => filterCandidates(options.getCandidates(), query),
        render: () => {
            let element: HTMLDivElement | null = null;
            let selectedIndex = 0;
            let currentProperties: null | SuggestionProps<
                MentionCandidate,
                MentionCandidate
            > = null;
            let unmount: (() => void) | undefined;

            const refresh = () => {
                if (!element || !currentProperties) return;
                renderRows(
                    element,
                    currentProperties,
                    selectedIndex,
                    options.emptyLabel()
                );
            };

            return {
                onExit: () => {
                    unmount?.();
                    unmount = undefined;
                    element = null;
                    currentProperties = null;
                    selectedIndex = 0;
                },
                onKeyDown: ({ event }: SuggestionKeyDownProps) => {
                    if (!currentProperties) return false;

                    if (event.key === "ArrowDown") {
                        if (currentProperties.items.length === 0) return true;
                        selectedIndex =
                            (selectedIndex + 1) %
                            currentProperties.items.length;
                        refresh();
                        return true;
                    }

                    if (event.key === "ArrowUp") {
                        if (currentProperties.items.length === 0) return true;
                        selectedIndex =
                            (selectedIndex -
                                1 +
                                currentProperties.items.length) %
                            currentProperties.items.length;
                        refresh();
                        return true;
                    }

                    if (event.key === "Enter") {
                        const item = currentProperties.items[selectedIndex];
                        if (item) {
                            currentProperties.command(item);
                        }
                        return true;
                    }

                    if (event.key === "Escape") {
                        return true;
                    }

                    return false;
                },
                onStart: (properties) => {
                    currentProperties = properties;
                    selectedIndex = 0;
                    element = document.createElement("div");
                    element.className = POPUP_CLASS;
                    refresh();
                    unmount = properties.mount(element);
                },
                onUpdate: (properties) => {
                    currentProperties = properties;
                    selectedIndex = Math.min(
                        selectedIndex,
                        Math.max(properties.items.length - 1, 0)
                    );
                    refresh();
                },
            };
        },
    };
}

function filterCandidates(
    candidates: readonly MentionCandidate[],
    query: string
): MentionCandidate[] {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return [...candidates].slice(0, 10);

    return candidates
        .filter((item) => item.label.toLowerCase().includes(normalized))
        .slice(0, 10);
}

function renderRows(
    element: HTMLElement,
    properties: SuggestionProps<MentionCandidate, MentionCandidate>,
    selectedIndex: number,
    emptyLabel: string
) {
    element.replaceChildren();

    if (properties.items.length === 0) {
        const empty = document.createElement("p");
        empty.className = "px-2 py-1.5 text-sm text-muted-foreground";
        empty.textContent = emptyLabel;
        element.append(empty);
        return;
    }

    for (const [index, item] of properties.items.entries()) {
        const button = document.createElement("button");
        button.type = "button";
        button.className =
            index === selectedIndex
                ? `${ROW_CLASS} ${ROW_ACTIVE_CLASS}`
                : ROW_CLASS;
        button.textContent = item.label;
        button.addEventListener("mousedown", (event) => {
            event.preventDefault();
            properties.command(item);
        });
        element.append(button);
    }
}
