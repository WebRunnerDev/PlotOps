import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";

export type ImageUploadFn = (file: File) => Promise<string>;

type ImageUploadStorage = {
    onError?: (error: unknown) => void;
    // Number of uploads currently in flight — used to defer persisting the
    // document (so transient blob URLs never leak into stored content).
    pending: number;
    upload?: ImageUploadFn;
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
    name: "imageUpload",

    addStorage(): ImageUploadStorage {
        return {
            onError: undefined,
            pending: 0,
            upload: undefined,
        };
    },
});

/** Windows Explorer often leaves `file.type` empty on drag — fall back to extension. */
export function isImageFile(file: File): boolean {
    if (file.type) {
        return IMAGE_MIME_TYPES.has(file.type);
    }

    return IMAGE_EXTENSION_PATTERN.test(file.name);
}

export function filterImageFiles(files: FileList | File[]): File[] {
    return Array.from(files).filter((file) => isImageFile(file));
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

function updateImageByUploadId(
    editor: Editor,
    uploadId: string,
    attrs: Record<string, unknown>,
) {
    const pos = findImagePos(editor, uploadId);
    if (pos === null) return;

    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;

    const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
        ...node.attrs,
        ...attrs,
    });
    editor.view.dispatch(tr);
}

function removeImageByUploadId(editor: Editor, uploadId: string) {
    const pos = findImagePos(editor, uploadId);
    if (pos === null) return;

    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;

    editor.view.dispatch(editor.state.tr.delete(pos, pos + node.nodeSize));
}

async function uploadImage(
    editor: Editor,
    file: File,
    uploadId: string,
    localSrc: string,
) {
    const { onError, upload } = editor.storage.imageUpload;

    try {
        const src = await upload!(file);
        editor.storage.imageUpload.pending = Math.max(
            0,
            editor.storage.imageUpload.pending - 1,
        );
        updateImageByUploadId(editor, uploadId, {
            src,
            uploading: false,
            uploadId: null,
        });
    } catch (error) {
        editor.storage.imageUpload.pending = Math.max(
            0,
            editor.storage.imageUpload.pending - 1,
        );
        removeImageByUploadId(editor, uploadId);
        onError?.(error);
    } finally {
        URL.revokeObjectURL(localSrc);
    }
}

export function insertImageFiles(
    editor: Editor,
    files: File[],
    position?: number,
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
        const localSrc = URL.createObjectURL(file);
        const attrs = {
            alt: file.name,
            src: localSrc,
            uploadId,
            uploading: true,
        };

        // Increment before inserting so the placeholder's blob URL is never
        // flushed to `onChange` while the upload is still running.
        editor.storage.imageUpload.pending += 1;

        if (insertAt !== null) {
            editor.chain().focus().insertContentAt(insertAt, {
                attrs,
                type: "image",
            }).run();
            insertAt += 1;
        } else {
            editor.chain().focus().setImage(attrs).run();
        }

        void uploadImage(editor, file, uploadId, localSrc);
    }
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
