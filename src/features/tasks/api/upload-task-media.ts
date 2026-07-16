import { supabase } from "@/shared/api/supabase";
import { isImageFile } from "@/shared/ui/rich-text-editor/image-upload";

export const TASK_MEDIA_BUCKET = "task-media";
export const TASK_MEDIA_MAX_BYTES = 5 * 1024 * 1024;

export class TaskMediaUploadError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "TaskMediaUploadError";
    }
}

function extensionForFile(file: File): string {
    const fromName = file.name.split(".").pop()?.toLowerCase();
    if (fromName && /^[a-z0-9]{1,5}$/.test(fromName)) {
        return fromName === "jpeg" ? "jpg" : fromName;
    }

    switch (file.type) {
        case "image/jpeg":
        case "image/jpg": {
            return "jpg";
        }
        case "image/png": {
            return "png";
        }
        case "image/gif": {
            return "gif";
        }
        case "image/webp": {
            return "webp";
        }
        default: {
            return "png";
        }
    }
}

function contentTypeForFile(file: File): string {
    if (file.type && file.type.startsWith("image/")) {
        return file.type === "image/jpg" ? "image/jpeg" : file.type;
    }

    switch (extensionForFile(file)) {
        case "jpg":
        case "jpeg": {
            return "image/jpeg";
        }
        case "gif": {
            return "image/gif";
        }
        case "webp": {
            return "image/webp";
        }
        default: {
            return "image/png";
        }
    }
}

export async function uploadTaskMedia(
    file: File,
    taskId: string,
): Promise<string> {
    if (!isImageFile(file)) {
        throw new TaskMediaUploadError("unsupportedType");
    }

    if (file.size > TASK_MEDIA_MAX_BYTES) {
        throw new TaskMediaUploadError("tooLarge");
    }

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
        throw new TaskMediaUploadError("unauthenticated");
    }

    const contentType = contentTypeForFile(file);
    const path = `${user.id}/${taskId}/${crypto.randomUUID()}.${extensionForFile(file)}`;

    const { error: uploadError } = await supabase.storage
        .from(TASK_MEDIA_BUCKET)
        .upload(path, file, {
            cacheControl: "3600",
            contentType,
            upsert: false,
        });

    if (uploadError) {
        throw new TaskMediaUploadError(uploadError.message);
    }

    const { data } = supabase.storage
        .from(TASK_MEDIA_BUCKET)
        .getPublicUrl(path);

    return data.publicUrl;
}
