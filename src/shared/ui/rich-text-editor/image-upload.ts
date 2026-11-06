import type { Editor } from "@tiptap/react";

import { Extension } from "@tiptap/core";

export type ImageUploadFunction = (file: File) => Promise<string>;

type ImageUploadStorage = {
    onError?: (error: unknown) => void;
    // Number of uploads currently in flight — used to defer persisting the
    // document (so transient blob URLs never leak into stored content).
    pending: number;
    upload?: ImageUploadFunction;
};

declare module "@tiptap/core" {
    interface Storage {
        imageUpload: ImageUploadStorage;
    }
}

const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|gif|webp)$/i;

const IMAGE_MIME_TYPES = new Set([
    "image/gif",
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
]);

export const ImageUpload = Extension.create({
    addStorage(): ImageUploadStorage {
        return {
            onError: undefined,
            pending: 0,
            upload: undefined,
        };
    },

    name: "imageUpload",
});

export function filterImageFiles(files: File[] | FileList): File[] {
    return [...files].filter((file) => isImageFile(file));
}

export function insertImageFiles(
    editor: Editor,
    files: File[],
    position?: number
) {
    const { onError, upload } = editor.storage.imageUpload;
    if (!upload) {
        onError?.(new Error("uploadUnavailable"));
        return;
    }

    const images = filterImageFiles(files);
    if (images.length === 0) {
        onError?.(new Error("unsupportedType"));
        return;
    }

    let insertAt = typeof position === "number" ? position : null;

    for (const file of images) {
        const uploadId = createUploadId();
        const localSource = URL.createObjectURL(file);
        const attributes = {
            alt: file.name,
            src: localSource,
            uploadId,
            uploading: true,
        };

        // Increment before inserting so the placeholder's blob URL is never
        // flushed to `onChange` while the upload is still running.
        editor.storage.imageUpload.pending += 1;

        if (insertAt === null) {
            editor.chain().focus().setImage(attributes).run();
        } else {
            editor
                .chain()
                .focus()
                .insertContentAt(insertAt, {
                    attrs: attributes,
                    type: "image",
                })
                .run();
            insertAt += 1;
        }

        void uploadImage(editor, file, uploadId, localSource);
    }
}

/** Windows Explorer often leaves `file.type` empty on drag — fall back to extension. */
export function isImageFile(file: File): boolean {
    if (file.type) {
        return IMAGE_MIME_TYPES.has(file.type);
    }

    return IMAGE_EXTENSION_PATTERN.test(file.name);
}

export function pickAndInsertImage(editor: Editor) {
    const input = document.createElement("input");
    input.accept = "image/jpeg,image/png,image/gif,image/webp";
    input.type = "file";
    input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        insertImageFiles(editor, [file]);
    });
    input.click();
}

function createUploadId(): string {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
        return crypto.randomUUID();
    }
    return `upload-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function findImagePos(editor: Editor, uploadId: string): null | number {
    let found: null | number = null;
    editor.state.doc.descendants((node, pos) => {
        if (found !== null) return false;
        if (node.type.name === "image" && node.attrs.uploadId === uploadId) {
            found = pos;
            return false;
        }
        return true;
    });
    return found;
}

function removeImageByUploadId(editor: Editor, uploadId: string) {
    const pos = findImagePos(editor, uploadId);
    if (pos === null) return;

    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;

    editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize));
}

function updateImageByUploadId(
    editor: Editor,
    uploadId: string,
    attributes: Record<string, unknown>
) {
    const pos = findImagePos(editor, uploadId);
    if (pos === null) return;

    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;

    const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        ...attributes,
    });
    editor.view.dispatch(tr);
}

async function uploadImage(
    editor: Editor,
    file: File,
    uploadId: string,
    localSource: string
) {
    const { onError, upload } = editor.storage.imageUpload;

    try {
        const source = await upload!(file);
        editor.storage.imageUpload.pending = Math.max(
            0,
            editor.storage.imageUpload.pending - 1
        );
        updateImageByUploadId(editor, uploadId, {
            src: source,
            uploadId: null,
            uploading: false,
        });
    } catch (error) {
        editor.storage.imageUpload.pending = Math.max(
            0,
            editor.storage.imageUpload.pending - 1
        );
        removeImageByUploadId(editor, uploadId);
        onError?.(error);
    } finally {
        URL.revokeObjectURL(localSource);
    }
}
