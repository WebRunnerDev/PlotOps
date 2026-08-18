import type { Editor } from "@tiptap/core";

import { MENTION_DISPLAY_CHAR } from "@/shared/ui/rich-text-editor/mention-candidate";

/** Keyboard shortcut label for mention picker (layout-independent). */
export const MENTION_HOTKEY_LABEL = "Ctrl+M";

type MentionHotkeyEvent = Pick<
    KeyboardEvent,
    "altKey" | "code" | "ctrlKey" | "key" | "metaKey" | "shiftKey"
>;

/** Inserts `@` at the cursor so the TipTap mention suggestion opens. */
export function insertMentionTrigger(editor: Editor): boolean {
    if (!editor.isEditable) {
        return false;
    }

    return editor.chain().focus().insertContent(MENTION_DISPLAY_CHAR).run();
}

/**
 * Physical M key — same position as Ь on Russian ЙЦУКЕН.
 * Do not match Cyrillic «м» (`KeyV`): that is Ctrl+V (paste).
 */
export function isMentionHotkey(event: MentionHotkeyEvent): boolean {
    if (
        event.ctrlKey !== true ||
        event.metaKey === true ||
        event.altKey === true ||
        event.shiftKey === true
    ) {
        return false;
    }

    if (event.code === "KeyM") {
        return true;
    }

    const key = event.key.toLowerCase();
    return key === "m" || key === "ь";
}
