import { describe, expect, it } from "vitest";

import { isMentionHotkey, MENTION_HOTKEY_LABEL } from "./mention-hotkey";

describe("isMentionHotkey", () => {
    it.each([
        {
            event: {
                altKey: false,
                code: "KeyM",
                ctrlKey: true,
                key: "m",
                metaKey: false,
                shiftKey: false,
            },
            expected: true,
            label: "Ctrl+M (English layout)",
        },
        {
            event: {
                altKey: false,
                code: "KeyM",
                ctrlKey: true,
                key: "ь",
                metaKey: false,
                shiftKey: false,
            },
            expected: true,
            label: "Ctrl+Ь (Russian layout, same physical key as M)",
        },
        {
            event: {
                altKey: false,
                code: "KeyM",
                ctrlKey: true,
                key: "Ь",
                metaKey: false,
                shiftKey: false,
            },
            expected: true,
            label: "Ctrl+Ь with Caps Lock",
        },
        {
            event: {
                altKey: false,
                code: "KeyV",
                ctrlKey: true,
                key: "м",
                metaKey: false,
                shiftKey: false,
            },
            expected: false,
            label: "Ctrl+М (Cyrillic em) is Ctrl+V / paste, not mention",
        },
        {
            event: {
                altKey: false,
                code: "KeyM",
                ctrlKey: false,
                key: "m",
                metaKey: true,
                shiftKey: false,
            },
            expected: false,
            label: "Cmd+M is not the mention shortcut",
        },
        {
            event: {
                altKey: false,
                code: "KeyM",
                ctrlKey: true,
                key: "M",
                metaKey: false,
                shiftKey: true,
            },
            expected: false,
            label: "Ctrl+Shift+M is not the mention shortcut",
        },
        {
            event: {
                altKey: false,
                code: "KeyM",
                ctrlKey: false,
                key: "m",
                metaKey: false,
                shiftKey: false,
            },
            expected: false,
            label: "M without modifier",
        },
    ])("$label", ({ event, expected }) => {
        expect(isMentionHotkey(event)).toBe(expected);
    });

    it("documents the layout-independent shortcut label", () => {
        expect(MENTION_HOTKEY_LABEL).toBe("Ctrl+M");
    });
});
