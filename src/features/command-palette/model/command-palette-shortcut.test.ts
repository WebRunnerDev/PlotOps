import { describe, expect, it } from "vitest";

import { isCommandPaletteShortcut } from "./command-palette-shortcut";

describe("isCommandPaletteShortcut", () => {
    it.each([
        {
            event: {
                code: "KeyK",
                ctrlKey: true,
                key: "k",
                metaKey: false,
            },
            expected: true,
            label: "Ctrl+K (English layout)",
        },
        {
            event: {
                code: "KeyK",
                ctrlKey: true,
                key: "л",
                metaKey: false,
            },
            expected: true,
            label: "Ctrl+Л (Russian layout, same physical key)",
        },
        {
            event: {
                code: "KeyK",
                ctrlKey: false,
                key: "k",
                metaKey: true,
            },
            expected: true,
            label: "Cmd+K on macOS",
        },
        {
            event: {
                code: "KeyL",
                ctrlKey: true,
                key: "l",
                metaKey: false,
            },
            expected: false,
            label: "Ctrl+L is not the palette shortcut",
        },
        {
            event: {
                code: "KeyK",
                ctrlKey: false,
                key: "k",
                metaKey: false,
            },
            expected: false,
            label: "K without modifier",
        },
    ])("$label", ({ event, expected }) => {
        expect(isCommandPaletteShortcut(event)).toBe(expected);
    });
});
