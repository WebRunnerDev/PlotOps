import Image from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";

import { ImageNodeView } from "@/shared/ui/rich-text-editor/image-node-view";

const IMAGE_ALIGNMENTS = ["left", "center", "right"] as const;

type ImageAlignment = (typeof IMAGE_ALIGNMENTS)[number];

function parsePixelValue(value: null | string): null | number {
    if (!value) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseAlignment(value: null | string): ImageAlignment {
    return IMAGE_ALIGNMENTS.includes(value as ImageAlignment)
        ? (value as ImageAlignment)
        : "left";
}

/**
 * Image node with Jira-like resizing (aspect-ratio locked), an optional
 * border, and an inline upload loader. Backed by a React NodeView.
 */
export const ResizableImage = Image.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            align: {
                default: "left",
                parseHTML: (element) =>
                    parseAlignment(element.getAttribute("data-align")),
                renderHTML: (attributes) =>
                    attributes.align && attributes.align !== "left"
                        ? { "data-align": attributes.align }
                        : {},
            },
            bordered: {
                default: false,
                parseHTML: (element) =>
                    element.getAttribute("data-bordered") === "true",
                renderHTML: (attributes) =>
                    attributes.bordered ? { "data-bordered": "true" } : {},
            },
            height: {
                default: null,
                parseHTML: (element) =>
                    parsePixelValue(element.getAttribute("height")),
                renderHTML: (attributes) =>
                    attributes.height ? { height: attributes.height } : {},
            },
            // Transient upload state — never serialized into stored HTML.
            uploadId: {
                default: null,
                rendered: false,
            },
            uploading: {
                default: false,
                rendered: false,
            },
            width: {
                default: null,
                parseHTML: (element) =>
                    parsePixelValue(element.getAttribute("width")),
                renderHTML: (attributes) =>
                    attributes.width ? { width: attributes.width } : {},
            },
        };
    },

    addNodeView() {
        // Apply the class to the OUTER wrapper element that ReactNodeViewRenderer
        // creates (the node's ProseMirror DOM), not just the inner
        // NodeViewWrapper. Otherwise the outer block still gets the browser's
        // native selection highlight (a full-width bar) when a text selection is
        // dragged across the image, because `user-select: none` never reaches it.
        return ReactNodeViewRenderer(ImageNodeView, {
            className: "rich-text-image-view",
        });
    },
}).configure({
    allowBase64: false,
    HTMLAttributes: {
        class: "rich-text-image",
    },
});
