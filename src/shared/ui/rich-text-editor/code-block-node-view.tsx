import {
    NodeViewContent,
    type NodeViewProps,
    NodeViewWrapper,
} from "@tiptap/react";
import { Copy } from "lucide-react";
import { type MouseEvent as ReactMouseEvent, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/shadcn/ui/button";
import { copyCodeBlockText } from "@/shared/ui/rich-text-editor/copy-code-block";

export function CodeBlockNodeView({ node }: NodeViewProps) {
    const { t } = useTranslation("board");
    const language =
        typeof node.attrs.language === "string" ? node.attrs.language : null;
    const languageClass = language ? `language-${language}` : undefined;

    const handleCopy = useCallback(
        (event: ReactMouseEvent<HTMLButtonElement>) => {
            event.preventDefault();
            event.stopPropagation();

            void copyCodeBlockText(node.textContent).then((ok) => {
                if (ok) {
                    toast.success(t("richText.codeBlock.copied"));
                    return;
                }
                toast.error(t("copyFailed"));
            });
        },
        [node.textContent, t]
    );

    return (
        <NodeViewWrapper className="group/code rich-text-code-block-view">
            <pre>
                <button
                    aria-label={t("richText.codeBlock.copy")}
                    className={cn(
                        buttonVariants({ size: "icon-xs", variant: "ghost" }),
                        "rich-text-code-copy-button"
                    )}
                    onMouseDown={handleCopy}
                    title={t("richText.codeBlock.copy")}
                    type="button"
                >
                    <Copy className="size-3.5" />
                </button>
                <NodeViewContent<"code"> as="code" className={languageClass} />
            </pre>
        </NodeViewWrapper>
    );
}
