import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";

export type ImageUploadFn = (file: File) => Promise<string>;

type ImageUploadStorage = {
    onError?: (error: unknown) => void;
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

export async function insertImageFiles(
    editor: Editor,
    files: File[],
    position?: number,
) {
    const { upload, onError } = editor.storage.imageUpload;
    if (!upload) {
        onError?.(new Error("uploadUnavailable"));
        return;
    }

    const images = filterImageFiles(files);
    if (images.length === 0) {
        onError?.(new Error("unsupportedType"));
        return;
    }

    let insertAt = position;

    for (const file of images) {
        try {
            const src = await upload(file);
            const content = {
                attrs: {
                    alt: file.name,
                    src,
                },
                type: "image" as const,
            };

            if (typeof insertAt === "number") {
                editor
                    .chain()
                    .focus()
                    .insertContentAt(insertAt, content)
                    .run();
                insertAt += 1;
            } else {
                editor.chain().focus().setImage(content.attrs).run();
            }
        } catch (error) {
            onError?.(error);
        }
    }
}

export function pickAndInsertImage(editor: Editor) {
    const input = document.createElement("input");
    input.accept = "image/jpeg,image/png,image/gif,image/webp";
    input.type = "file";
    input.addEventListener("change", () => {
        const file = input.files?.[0];
        if (!file) return;
        void insertImageFiles(editor, [file]);
    });
    input.click();
}
