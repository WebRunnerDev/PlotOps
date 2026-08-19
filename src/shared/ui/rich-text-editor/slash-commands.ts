import type { Editor } from "@tiptap/react";
import type { LucideIcon } from "lucide-react";

import {
    BetweenHorizontalEnd,
    BetweenHorizontalStart,
    BetweenVerticalEnd,
    BetweenVerticalStart,
    CheckSquare,
    ClipboardCopy,
    Code2,
    Copy,
    Heading1,
    Heading2,
    Heading3,
    ImageIcon,
    List,
    ListOrdered,
    Minus,
    Pilcrow,
    Quote,
    SquareMinus,
    Table2,
    Trash2,
} from "lucide-react";

import { pickAndInsertImage } from "@/shared/ui/rich-text-editor/image-upload";
import {
    copyTableColumn,
    copyTableRow,
} from "@/shared/ui/rich-text-editor/table-selection";

export type SlashCommand = {
    icon: LucideIcon;
    id: string;
    keywords: string[];
    run: (editor: Editor) => void;
    titleKey: string;
};

export type SlashCommandContext = {
    inTable?: boolean;
};

const LIST_ITEM_TYPES = ["listItem", "taskItem"] as const;
const LIST_TYPES = ["bulletList", "orderedList", "taskList"] as const;

/** Unwrap list / blockquote wrappers so the selection can become another block type. */
function clearBlockWrappers(editor: Editor) {
    editor.chain().focus().clearNodes().run();

    // Nested / task lists may need an extra lift after clearNodes.
    let guard = 8;
    while (guard > 0) {
        guard -= 1;
        const itemType = LIST_ITEM_TYPES.find((type) => editor.isActive(type));
        if (!itemType) break;
        if (!editor.commands.liftListItem(itemType)) break;
    }
}

function setBlockquoteBlock(editor: Editor) {
    if (editor.isActive("blockquote")) {
        if (unwrapBlockquote(editor)) return;
        editor.chain().focus().toggleBlockquote().run();
        return;
    }

    if (wrapListInBlockquote(editor)) return;

    clearBlockWrappers(editor);
    editor.chain().focus().toggleBlockquote().run();
}

function setCodeBlock(editor: Editor) {
    clearBlockWrappers(editor);
    editor.chain().focus().toggleCodeBlock().run();
}

function setHeadingBlock(editor: Editor, level: 1 | 2 | 3) {
    clearBlockWrappers(editor);
    editor.chain().focus().toggleHeading({ level }).run();
}

function setParagraphBlock(editor: Editor) {
    clearBlockWrappers(editor);
    editor.chain().focus().setParagraph().run();
}

/** Lift the nearest blockquote ancestor, keeping its children (e.g. a list). */
function unwrapBlockquote(editor: Editor): boolean {
    const { state } = editor;
    const { $from } = state.selection;
    const blockquoteType = state.schema.nodes.blockquote;
    if (!blockquoteType) return false;

    for (let depth = $from.depth; depth > 0; depth -= 1) {
        if ($from.node(depth).type !== blockquoteType) continue;

        const pos = $from.before(depth);
        return editor
            .chain()
            .focus()
            .command(({ dispatch, tr }) => {
                const quoteNode = tr.doc.nodeAt(pos);
                if (
                    !quoteNode ||
                    quoteNode.type !== blockquoteType ||
                    !dispatch
                ) {
                    return Boolean(quoteNode);
                }

                tr.replaceWith(
                    pos,
                    pos + quoteNode.nodeSize,
                    quoteNode.content
                );
                return true;
            })
            .run();
    }

    return false;
}

/** Wrap the outermost list around the cursor in a blockquote (keeps list structure). */
function wrapListInBlockquote(editor: Editor): boolean {
    const { state } = editor;
    const { $from } = state.selection;
    const blockquoteType = state.schema.nodes.blockquote;
    if (!blockquoteType) return false;

    for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (
            !LIST_TYPES.includes(node.type.name as (typeof LIST_TYPES)[number])
        ) {
            continue;
        }

        // Already quoted — caller should unwrap instead.
        if ($from.node(depth - 1)?.type === blockquoteType) {
            return false;
        }

        const pos = $from.before(depth);
        return editor
            .chain()
            .focus()
            .command(({ dispatch, tr }) => {
                const listNode = tr.doc.nodeAt(pos);
                if (!listNode || !dispatch) return Boolean(listNode);

                tr.replaceWith(
                    pos,
                    pos + listNode.nodeSize,
                    blockquoteType.create(null, listNode)
                );
                return true;
            })
            .run();
    }

    return false;
}

export const SLASH_COMMANDS: SlashCommand[] = [
    {
        icon: Pilcrow,
        id: "paragraph",
        keywords: ["text", "paragraph", "p"],
        run: setParagraphBlock,
        titleKey: "richText.slash.paragraph",
    },
    {
        icon: Heading1,
        id: "heading-1",
        keywords: ["h1", "heading", "title"],
        run: (editor) => {
            setHeadingBlock(editor, 1);
        },
        titleKey: "richText.slash.heading1",
    },
    {
        icon: Heading2,
        id: "heading-2",
        keywords: ["h2", "heading", "subtitle"],
        run: (editor) => {
            setHeadingBlock(editor, 2);
        },
        titleKey: "richText.slash.heading2",
    },
    {
        icon: Heading3,
        id: "heading-3",
        keywords: ["h3", "heading"],
        run: (editor) => {
            setHeadingBlock(editor, 3);
        },
        titleKey: "richText.slash.heading3",
    },
    {
        icon: List,
        id: "bullet-list",
        keywords: ["bullet", "list", "unordered"],
        run: (editor) => {
            editor.chain().focus().toggleBulletList().run();
        },
        titleKey: "richText.slash.bulletList",
    },
    {
        icon: ListOrdered,
        id: "ordered-list",
        keywords: ["numbered", "ordered", "list"],
        run: (editor) => {
            editor.chain().focus().toggleOrderedList().run();
        },
        titleKey: "richText.slash.orderedList",
    },
    {
        icon: CheckSquare,
        id: "task-list",
        keywords: ["todo", "task", "checkbox"],
        run: (editor) => {
            editor.chain().focus().toggleTaskList().run();
        },
        titleKey: "richText.slash.taskList",
    },
    {
        icon: Quote,
        id: "quote",
        keywords: ["quote", "blockquote"],
        run: setBlockquoteBlock,
        titleKey: "richText.slash.quote",
    },
    {
        icon: Code2,
        id: "code-block",
        keywords: ["code", "snippet"],
        run: setCodeBlock,
        titleKey: "richText.slash.codeBlock",
    },
    {
        icon: ImageIcon,
        id: "image",
        keywords: ["image", "photo", "picture", "media", "img"],
        run: pickAndInsertImage,
        titleKey: "richText.slash.image",
    },
    {
        icon: Table2,
        id: "table",
        keywords: ["table", "grid", "spreadsheet"],
        run: (editor) => {
            editor
                .chain()
                .focus()
                .insertTable({ cols: 3, rows: 3, withHeaderRow: true })
                .run();
        },
        titleKey: "richText.slash.table",
    },
    {
        icon: BetweenHorizontalStart,
        id: "table-add-row-before",
        keywords: ["table", "row", "insert", "above"],
        run: (editor) => {
            editor.chain().focus().addRowBefore().run();
        },
        titleKey: "richText.table.addRowBefore",
    },
    {
        icon: BetweenHorizontalEnd,
        id: "table-add-row",
        keywords: ["table", "row", "insert", "below"],
        run: (editor) => {
            editor.chain().focus().addRowAfter().run();
        },
        titleKey: "richText.table.addRowAfter",
    },
    {
        icon: Minus,
        id: "table-delete-row",
        keywords: ["table", "row", "delete", "remove"],
        run: (editor) => {
            editor.chain().focus().deleteRow().run();
        },
        titleKey: "richText.table.deleteRow",
    },
    {
        icon: BetweenVerticalStart,
        id: "table-add-column-before",
        keywords: ["table", "column", "insert", "left"],
        run: (editor) => {
            editor.chain().focus().addColumnBefore().run();
        },
        titleKey: "richText.table.addColumnBefore",
    },
    {
        icon: BetweenVerticalEnd,
        id: "table-add-column",
        keywords: ["table", "column", "insert", "right"],
        run: (editor) => {
            editor.chain().focus().addColumnAfter().run();
        },
        titleKey: "richText.table.addColumnAfter",
    },
    {
        icon: SquareMinus,
        id: "table-delete-column",
        keywords: ["table", "column", "delete", "remove"],
        run: (editor) => {
            editor.chain().focus().deleteColumn().run();
        },
        titleKey: "richText.table.deleteColumn",
    },
    {
        icon: Copy,
        id: "table-copy-column",
        keywords: ["table", "column", "copy", "vertical"],
        run: (editor) => {
            void copyTableColumn(editor);
        },
        titleKey: "richText.table.copyColumn",
    },
    {
        icon: ClipboardCopy,
        id: "table-copy-row",
        keywords: ["table", "row", "copy"],
        run: (editor) => {
            void copyTableRow(editor);
        },
        titleKey: "richText.table.copyRow",
    },
    {
        icon: Trash2,
        id: "table-delete",
        keywords: ["table", "delete", "remove"],
        run: (editor) => {
            editor.chain().focus().deleteTable().run();
        },
        titleKey: "richText.table.deleteTable",
    },
    {
        icon: Minus,
        id: "divider",
        keywords: ["divider", "line", "hr"],
        run: (editor) => {
            editor.chain().focus().setHorizontalRule().run();
        },
        titleKey: "richText.slash.divider",
    },
];

export function deleteSlashQuery(editor: Editor, query: string) {
    const { from } = editor.state.selection;
    const deleteFrom = from - query.length - 1;
    if (deleteFrom < 0) return;

    editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run();
}

export function filterSlashCommands(
    query: string,
    context: SlashCommandContext = {}
): SlashCommand[] {
    const inTable = Boolean(context.inTable);
    const normalized = query.trim().toLowerCase();

    return SLASH_COMMANDS.filter((command) => {
        if (command.id === "table" && inTable) return false;
        if (command.id.startsWith("table-") && !inTable) return false;
        if (!normalized) return true;
        if (command.id.includes(normalized)) return true;
        return command.keywords.some((keyword) => keyword.includes(normalized));
    });
}
