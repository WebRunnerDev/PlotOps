import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { CodeBlockNodeView } from "@/shared/ui/rich-text-editor/code-block-node-view";

/** Code block with syntax highlighting and a copy-to-clipboard control. */
export const CodeBlockWithCopy = CodeBlockLowlight.extend({
    addNodeView() {
        return ReactNodeViewRenderer(CodeBlockNodeView, {
            className: "rich-text-code-block-view",
        });
    },
});
