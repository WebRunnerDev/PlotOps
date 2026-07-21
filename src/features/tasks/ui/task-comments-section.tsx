import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { uploadTaskMedia } from "@/features/tasks/api/upload-task-media";
import {
    TASK_COMMENT_MAX_LENGTH,
} from "@/features/tasks/model/constants";
import {
    useCreateTaskComment,
    useDeleteTaskComment,
    useTaskComments,
    useUpdateTaskComment,
} from "@/features/tasks/model/use-task-comments";
import type { TaskComment } from "@/features/tasks/model/types";
import { useAuth } from "@/features/auth";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import {
    isRichTextWithinLimit,
    normalizeEditorContent,
} from "@/shared/ui/rich-text-editor/content";
import { RichTextEditor } from "@/shared/ui/rich-text-editor";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/shared/shadcn/ui/avatar";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type TaskCommentsSectionProperties = {
    projectId: string;
    readOnly?: boolean;
    taskId: string;
};

function initials(name: string) {
    const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}

function formatTimestamp(value: string, locale: string) {
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

type TaskCommentItemProperties = {
    canDelete: boolean;
    canEdit: boolean;
    comment: TaskComment;
    locale: string;
    onDelete: () => void;
    onSave: (body: string) => Promise<void>;
    taskId: string;
    t: (key: string, options?: Record<string, unknown>) => string;
};

function TaskCommentItem({
    canDelete,
    canEdit,
    comment,
    locale,
    onDelete,
    onSave,
    taskId,
    t,
}: TaskCommentItemProperties) {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(comment.body);
    const [isSaving, setIsSaving] = useState(false);

    const authorName = comment.author?.name ?? t("members.unknownUser");
    const edited =
        comment.updatedAt !== comment.createdAt
            ? t("comments.edited")
            : undefined;

    const handleSave = async () => {
        const next = normalizeEditorContent(draft);
        if (!next) {
            toast.error(t("comments.empty"));
            return;
        }
        if (!isRichTextWithinLimit(next, TASK_COMMENT_MAX_LENGTH)) {
            toast.error(t("comments.tooLong"));
            return;
        }
        if (next === comment.body) {
            setIsEditing(false);
            return;
        }

        setIsSaving(true);
        try {
            await onSave(next);
            setIsEditing(false);
            toast.success(t("comments.updated"));
        } catch {
            toast.error(t("comments.updateFailed"));
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <article className="flex flex-col gap-3 border border-border p-3">
            <div className="flex items-start gap-3">
                <Avatar className="size-8 shrink-0 rounded-none">
                    {comment.author?.avatarUrl ? (
                        <AvatarImage alt="" src={comment.author.avatarUrl} />
                    ) : undefined}
                    <AvatarFallback className="rounded-none text-meta">
                        {initials(authorName)}
                    </AvatarFallback>
                </Avatar>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="truncate text-ui font-medium">{authorName}</p>
                        <time
                            className="text-meta text-muted-foreground"
                            dateTime={comment.createdAt}
                        >
                            {formatTimestamp(comment.createdAt, locale)}
                        </time>
                        {edited ? (
                            <span className="text-meta text-muted-foreground">
                                {edited}
                            </span>
                        ) : undefined}
                    </div>
                </div>

                {canEdit || canDelete ? (
                    <div className="flex shrink-0 items-center gap-1">
                        {canEdit && !isEditing ? (
                            <Button
                                aria-label={t("comments.edit")}
                                onClick={() => {
                                    setDraft(comment.body);
                                    setIsEditing(true);
                                }}
                                size="icon-xs"
                                type="button"
                                variant="ghost"
                            >
                                <Pencil />
                            </Button>
                        ) : undefined}
                        {canDelete ? (
                            <Button
                                aria-label={t("comments.delete")}
                                onClick={onDelete}
                                size="icon-xs"
                                type="button"
                                variant="ghost"
                            >
                                <Trash2 />
                            </Button>
                        ) : undefined}
                    </div>
                ) : undefined}
            </div>

            {isEditing ? (
                <div className="flex flex-col gap-2">
                    <RichTextEditor
                        compact
                        id={`comment-edit-${comment.id}`}
                        maxLength={TASK_COMMENT_MAX_LENGTH}
                        onChange={setDraft}
                        onUploadImage={(file) => uploadTaskMedia(file, taskId)}
                        placeholder={t("comments.placeholder")}
                        value={draft}
                    />
                    <div className="flex justify-end gap-2">
                        <Button
                            disabled={isSaving}
                            onClick={() => {
                                setDraft(comment.body);
                                setIsEditing(false);
                            }}
                            type="button"
                            variant="outline"
                        >
                            {t("comments.cancel")}
                        </Button>
                        <Button
                            disabled={
                                isSaving ||
                                !isRichTextWithinLimit(
                                    draft,
                                    TASK_COMMENT_MAX_LENGTH,
                                )
                            }
                            onClick={() => {
                                void handleSave();
                            }}
                            type="button"
                        >
                            {t("comments.save")}
                        </Button>
                    </div>
                </div>
            ) : (
                <RichTextEditor
                    compact
                    id={`comment-view-${comment.id}`}
                    readOnly
                    value={comment.body}
                />
            )}
        </article>
    );
}

export function TaskCommentsSection({
    projectId,
    readOnly = false,
    taskId,
}: TaskCommentsSectionProperties) {
    const { i18n, t } = useTranslation("board");
    const { user } = useAuth();
    const access = useProjectAccess(projectId);
    const { data: comments = [], isLoading } = useTaskComments(taskId);
    const createComment = useCreateTaskComment(taskId, projectId);
    const updateComment = useUpdateTaskComment(taskId);
    const deleteComment = useDeleteTaskComment(taskId);

    const [draft, setDraft] = useState("");

    const canComment = access.canEditTasks && !readOnly;
    const canModerateDelete = access.canDeleteTasks && !readOnly;

    const handleCreate = async () => {
        const next = normalizeEditorContent(draft);
        if (!next) {
            toast.error(t("comments.empty"));
            return;
        }
        if (!isRichTextWithinLimit(next, TASK_COMMENT_MAX_LENGTH)) {
            toast.error(t("comments.tooLong"));
            return;
        }

        try {
            await createComment.mutateAsync(next);
            setDraft("");
            toast.success(t("comments.added"));
        } catch {
            toast.error(t("comments.addFailed"));
        }
    };

    const handleDelete = async (commentId: string) => {
        try {
            await deleteComment.mutateAsync(commentId);
            toast.success(t("comments.deleted"));
        } catch {
            toast.error(t("comments.deleteFailed"));
        }
    };

    return (
        <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-ui font-medium">
                    {t("comments.title", { count: comments.length })}
                </h3>
            </div>

            {isLoading ? (
                <Spinner className="size-5 text-primary" />
            ) : comments.length === 0 ? (
                <p className="text-ui text-muted-foreground">
                    {t("comments.emptyList")}
                </p>
            ) : (
                <ul className="flex flex-col gap-3">
                    {comments.map((comment) => {
                        const isAuthor = comment.author?.id === user?.id;
                        const canEdit =
                            isAuthor && access.canEditTasks && !readOnly;
                        const canDelete =
                            ((isAuthor && access.canEditTasks) ||
                                canModerateDelete) &&
                            !readOnly;

                        return (
                            <li key={comment.id}>
                                <TaskCommentItem
                                    canDelete={canDelete}
                                    canEdit={canEdit}
                                    comment={comment}
                                    locale={i18n.language}
                                    onDelete={() => {
                                        void handleDelete(comment.id);
                                    }}
                                    onSave={async (body) => {
                                        await updateComment.mutateAsync({
                                            body,
                                            commentId: comment.id,
                                        });
                                    }}
                                    taskId={taskId}
                                    t={t}
                                />
                            </li>
                        );
                    })}
                </ul>
            )}

            {canComment ? (
                <div className="flex flex-col gap-2 border border-dashed border-border p-3">
                    <RichTextEditor
                        compact
                        id={`comment-compose-${taskId}`}
                        maxLength={TASK_COMMENT_MAX_LENGTH}
                        onChange={setDraft}
                        onUploadImage={(file) => uploadTaskMedia(file, taskId)}
                        placeholder={t("comments.placeholder")}
                        value={draft}
                    />
                    <div className="flex justify-end">
                        <Button
                            disabled={
                                createComment.isPending ||
                                !normalizeEditorContent(draft) ||
                                !isRichTextWithinLimit(
                                    draft,
                                    TASK_COMMENT_MAX_LENGTH,
                                )
                            }
                            onClick={() => {
                                void handleCreate();
                            }}
                            type="button"
                        >
                            {t("comments.add")}
                        </Button>
                    </div>
                </div>
            ) : undefined}
        </section>
    );
}
