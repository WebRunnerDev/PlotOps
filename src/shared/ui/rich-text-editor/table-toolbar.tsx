import type { Editor } from "@tiptap/react";

import {
    BetweenHorizontalEnd,
    BetweenHorizontalStart,
    BetweenVerticalEnd,
    BetweenVerticalStart,
    ClipboardCopy,
    Combine,
    Copy,
    Heading,
    Minus,
    SquareMinus,
    Trash2,
    Ungroup,
} from "lucide-react";
import { type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/shadcn/ui/button";
import { Separator } from "@/shared/shadcn/ui/separator";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/shared/shadcn/ui/tooltip";
import {
    copyTableColumn,
    copyTableRow,
} from "@/shared/ui/rich-text-editor/table-selection";

type TableToolbarProperties = {
    canMerge: boolean;
    canSplit: boolean;
    editor: Editor;
};

export function TableToolbar({
    canMerge,
    canSplit,
    editor,
}: TableToolbarProperties) {
    const { t } = useTranslation("board");

    const copyColumn = () => {
        void copyTableColumn(editor)
            .then((ok) => {
                if (!ok) return;
                toast.success(t("richText.table.copiedColumn"));
            })
            .catch(() => {
                toast.error(t("copyFailed"));
            });
    };

    const copyRow = () => {
        void copyTableRow(editor)
            .then((ok) => {
                if (!ok) return;
                toast.success(t("richText.table.copiedRow"));
            })
            .catch(() => {
                toast.error(t("copyFailed"));
            });
    };

    return (
        <TooltipProvider delay={400}>
            <div
                className="mt-2 flex max-w-full flex-wrap items-center gap-0.5 overflow-x-auto overscroll-x-contain rounded-lg border border-border bg-popover p-1 shadow-sm ring-1 ring-foreground/10"
                onMouseDown={(event) => {
                    event.preventDefault();
                }}
            >
                <ToolButton
                    label={t("richText.table.addRowBefore")}
                    onClick={() => editor.chain().focus().addRowBefore().run()}
                >
                    <BetweenHorizontalStart />
                </ToolButton>
                <ToolButton
                    label={t("richText.table.addRowAfter")}
                    onClick={() => editor.chain().focus().addRowAfter().run()}
                >
                    <BetweenHorizontalEnd />
                </ToolButton>
                <ToolButton
                    label={t("richText.table.deleteRow")}
                    onClick={() => editor.chain().focus().deleteRow().run()}
                >
                    <Minus />
                </ToolButton>
                <Separator className="mx-1 h-5" orientation="vertical" />
                <ToolButton
                    label={t("richText.table.addColumnBefore")}
                    onClick={() =>
                        editor.chain().focus().addColumnBefore().run()
                    }
                >
                    <BetweenVerticalStart />
                </ToolButton>
                <ToolButton
                    label={t("richText.table.addColumnAfter")}
                    onClick={() =>
                        editor.chain().focus().addColumnAfter().run()
                    }
                >
                    <BetweenVerticalEnd />
                </ToolButton>
                <ToolButton
                    label={t("richText.table.deleteColumn")}
                    onClick={() => editor.chain().focus().deleteColumn().run()}
                >
                    <SquareMinus />
                </ToolButton>
                <Separator className="mx-1 h-5" orientation="vertical" />
                <ToolButton
                    label={t("richText.table.copyColumn")}
                    onClick={copyColumn}
                >
                    <Copy />
                </ToolButton>
                <ToolButton
                    label={t("richText.table.copyRow")}
                    onClick={copyRow}
                >
                    <ClipboardCopy />
                </ToolButton>
                <Separator className="mx-1 h-5" orientation="vertical" />
                <ToolButton
                    disabled={!canMerge}
                    label={t("richText.table.mergeCells")}
                    onClick={() => editor.chain().focus().mergeCells().run()}
                >
                    <Combine />
                </ToolButton>
                <ToolButton
                    disabled={!canSplit}
                    label={t("richText.table.splitCell")}
                    onClick={() => editor.chain().focus().splitCell().run()}
                >
                    <Ungroup />
                </ToolButton>
                <ToolButton
                    label={t("richText.table.toggleHeaderRow")}
                    onClick={() =>
                        editor.chain().focus().toggleHeaderRow().run()
                    }
                >
                    <Heading />
                </ToolButton>
                <Separator className="mx-1 h-5" orientation="vertical" />
                <ToolButton
                    label={t("richText.table.deleteTable")}
                    onClick={() => editor.chain().focus().deleteTable().run()}
                >
                    <Trash2 className="text-destructive" />
                </ToolButton>
            </div>
        </TooltipProvider>
    );
}

function ToolButton({
    children,
    disabled,
    label,
    onClick,
}: {
    children: ReactNode;
    disabled?: boolean;
    label: string;
    onClick: () => void;
}) {
    return (
        <Tooltip>
            <TooltipTrigger
                aria-label={label}
                className={cn(
                    buttonVariants({ size: "icon-xs", variant: "ghost" }),
                    disabled && "pointer-events-none opacity-40"
                )}
                disabled={disabled}
                onClick={onClick}
                type="button"
            >
                {children}
            </TooltipTrigger>
            <TooltipContent className="max-w-xs" positionerClassName="z-[80]">
                {label}
            </TooltipContent>
        </Tooltip>
    );
}
