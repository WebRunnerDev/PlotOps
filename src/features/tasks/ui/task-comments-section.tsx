import { formatDistanceToNow } from "date-fns";
import { enUS, ru } from "date-fns/locale";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { TaskComment } from "@/features/tasks/model/types";

import { useAuth } from "@/features/auth";
import {
    formatProfileDisplayName,
    getUserAvatarUrl,
    getUserDisplayName,
    getUserInitials,
} from "@/features/auth/lib/user-display";
import { GUEST_SEED_ACTOR_ID, isGuest } from "@/features/guest-mode";
import { useProjectAccess } from "@/features/projects/model/use-project-access";
import { useProjectPeople } from "@/features/projects/model/use-project-people";
import { uploadTaskMedia } from "@/features/tasks/api/upload-task-media";
import {
    buildCommentThreads,
    resolveReplyParentId,
} from "@/features/tasks/lib/build-comment-threads";
import { TASK_COMMENT_MAX_LENGTH } from "@/features/tasks/model/constants";
import { useProjectTasks } from "@/features/tasks/model/use-project-tasks";
import {
    useCreateTaskComment,
    useDeleteTaskComment,
    useTaskComments,
    useUpdateTaskComment,
} from "@/features/tasks/model/use-task-comments";
import { useTasksUiStore } from "@/features/tasks/model/use-tasks-ui-store";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/shared/shadcn/ui/avatar";
import { Button } from "@/shared/shadcn/ui/button";
import { Spinner } from "@/shared/shadcn/ui/spinner";
import {
    type MentionCandidate,
    RichTextEditor,
    type TaskMentionCandidate,
} from "@/shared/ui/rich-text-editor";
import {
    isRichTextWithinLimit,
    normalizeEditorContent,
} from "@/shared/ui/rich-text-editor/content";

const COMMENT_HIGHLIGHT_MS = 2400;

type TaskCommentItemProperties = {
    canComment: boolean;
    canDelete: boolean;
    canEdit: boolean;
    comment: TaskComment;
    highlighted: boolean;
    /** Reply rows use a smaller avatar; indent lives on CommentReplies only. */
    isReply?: boolean;
    locale: string;
    mentionCandidates: readonly MentionCandidate[];
    onDelete: () => void;
    onReply?: () => void;
    onSave: (body: string) => Promise<void>;
    onTaskMentionClick?: (taskId: string) => void;
    /** Nested reply thread — keep width via CommentReplies, never extra pl-* per depth. */
    replies?: ReactNode;
    replyComposer?: ReactNode;
    t: (key: string, options?: Record<string, unknown>) => string;
    taskId: string;
    taskMentionCandidates?: readonly TaskMentionCandidate[];
};

type TaskCommentsSectionProperties = {
    projectId: string;
    readOnly?: boolean;
    taskId: string;
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * Reply thread rail (YouTube / Jira).
 * Indent once on this wrapper — do not nest extra horizontal padding per depth,
 * or each reply level shrinks the comment body.
 */
export function CommentReplies({ children }: { children: ReactNode }) {
    return (
        <ul
            className="mt-3 flex w-full min-w-0 flex-col gap-3 border-l border-border pl-3 sm:pl-4"
            data-comment-replies=""
        >
            {children}
        </ul>
    );
}

export function TaskCommentsSection({
    projectId,
    readOnly = false,
    taskId,
}: TaskCommentsSectionProperties) {
    const { i18n, t } = useTranslation("board");
    const { profile, user } = useAuth();
    const guest = isGuest();
    const currentUserId = guest ? GUEST_SEED_ACTOR_ID : user?.id;
    const access = useProjectAccess(projectId);
    const people = useProjectPeople(projectId);
    const mentionCandidates = useMemo<MentionCandidate[]>(
        () => people.map((person) => ({ id: person.id, label: person.name })),
        [people]
    );
    const { data: projectTasks = [] } = useProjectTasks(projectId);
    const selectTask = useTasksUiStore((state) => state.selectTask);
    const taskMentionCandidates = useMemo<TaskMentionCandidate[]>(
        () =>
            projectTasks
                .filter((item) => item.id !== taskId)
                .map((item) => ({ id: item.id, label: item.key })),
        [projectTasks, taskId]
    );
    const handleTaskMentionClick = (mentionedTaskId: string) => {
        selectTask(mentionedTaskId);
    };
    const {
        data: comments = [],
        isError,
        isLoading,
        refetch,
    } = useTaskComments(taskId);
    const createComment = useCreateTaskComment(taskId, projectId);
    const updateComment = useUpdateTaskComment(taskId);
    const deleteComment = useDeleteTaskComment(taskId);
    const focusCommentId = useTasksUiStore((state) => state.focusCommentId);
    const clearFocusComment = useTasksUiStore(
        (state) => state.clearFocusComment
    );

    const [draft, setDraft] = useState("");
    const [replyDraft, setReplyDraft] = useState("");
    const [replyingToId, setReplyingToId] = useState<string | undefined>();
    const [highlightedCommentId, setHighlightedCommentId] = useState<
        string | undefined
    >();

    const canComment = access.isSettled && access.canEditTasks && !readOnly;
    const canModerateDelete =
        access.isSettled && access.canDeleteTasks && !readOnly;

    const threads = useMemo(() => buildCommentThreads(comments), [comments]);

    const composerAuthor = useMemo(() => {
        if (guest) {
            return {
                avatarUrl: undefined as string | undefined,
                name: "Demo Guest",
            };
        }
        const name =
            (profile ? formatProfileDisplayName(profile) : "") ||
            (user ? getUserDisplayName(user) : "") ||
            t("members.unknownUser");
        return {
            avatarUrl: user ? (getUserAvatarUrl(user) ?? undefined) : undefined,
            name,
        };
    }, [guest, profile, t, user]);

    useEffect(() => {
        if (!focusCommentId || isLoading) {
            return;
        }

        const target = comments.find(
            (comment) => comment.id === focusCommentId
        );
        // Missing/deleted Comment: still leave Task open; drop focus quietly.
        if (!target) {
            clearFocusComment();
            return;
        }

        setHighlightedCommentId(focusCommentId);
        clearFocusComment();

        const frame = globalThis.requestAnimationFrame(() => {
            document
                .querySelector(
                    `[data-comment-id="${CSS.escape(focusCommentId)}"]`
                )
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        const timer = globalThis.setTimeout(() => {
            setHighlightedCommentId(undefined);
        }, COMMENT_HIGHLIGHT_MS);

        return () => {
            globalThis.cancelAnimationFrame(frame);
            globalThis.clearTimeout(timer);
        };
    }, [clearFocusComment, comments, focusCommentId, isLoading]);

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
            await createComment.mutateAsync({ body: next });
            setDraft("");
            toast.success(t("comments.added"));
        } catch {
            toast.error(t("comments.addFailed"));
        }
    };

    const handleReply = async (replyToId: string) => {
        const next = normalizeEditorContent(replyDraft);
        if (!next) {
            toast.error(t("comments.empty"));
            return;
        }
        if (!isRichTextWithinLimit(next, TASK_COMMENT_MAX_LENGTH)) {
            toast.error(t("comments.tooLong"));
            return;
        }

        const parentId = resolveReplyParentId(comments, replyToId);

        try {
            await createComment.mutateAsync({ body: next, parentId });
            setReplyDraft("");
            setReplyingToId(undefined);
            toast.success(t("comments.replyAdded"));
        } catch {
            toast.error(t("comments.replyFailed"));
        }
    };

    const handleDelete = async (commentId: string) => {
        try {
            await deleteComment.mutateAsync(commentId);
            if (replyingToId === commentId) {
                setReplyingToId(undefined);
                setReplyDraft("");
            }
            toast.success(t("comments.deleted"));
        } catch {
            toast.error(t("comments.deleteFailed"));
        }
    };

    const commentPermissions = (comment: TaskComment) => {
        const isAuthor = comment.author?.id === currentUserId;
        const canEdit =
            access.isSettled && isAuthor && access.canEditTasks && !readOnly;
        const canDelete =
            access.isSettled &&
            ((isAuthor && access.canEditTasks) || canModerateDelete) &&
            !readOnly;
        return { canDelete, canEdit };
    };

    const renderReplyComposer = (replyToId: string) => {
        if (replyingToId !== replyToId) {
            return;
        }
        return (
            <div className="mt-2" data-comment-reply-composer="">
                <CommentComposer
                    authorAvatarUrl={composerAuthor.avatarUrl}
                    authorName={composerAuthor.name}
                    disabled={
                        createComment.isPending ||
                        !normalizeEditorContent(replyDraft) ||
                        !isRichTextWithinLimit(
                            replyDraft,
                            TASK_COMMENT_MAX_LENGTH
                        )
                    }
                    draft={replyDraft}
                    mentionCandidates={mentionCandidates}
                    onCancel={() => {
                        setReplyingToId(undefined);
                        setReplyDraft("");
                    }}
                    onChange={setReplyDraft}
                    onSubmit={() => {
                        void handleReply(replyToId);
                    }}
                    onTaskMentionClick={handleTaskMentionClick}
                    pending={createComment.isPending}
                    placeholder={t("comments.replyPlaceholder")}
                    submitLabel={t("comments.replyAdd")}
                    t={t}
                    taskId={taskId}
                    taskMentionCandidates={
                        canComment ? taskMentionCandidates : undefined
                    }
                />
            </div>
        );
    };

    return (
        <section className="flex flex-col gap-4" data-task-comments="">
            <h3 className="text-meta font-medium tracking-[0.06em] text-muted-foreground">
                {t("comments.title", { count: comments.length })}
            </h3>

            {isLoading ? (
                <Spinner className="size-5 text-primary" />
            ) : isError ? (
                <div className="flex flex-col items-start gap-2">
                    <p className="text-ui text-destructive">
                        {t("comments.loadFailed")}
                    </p>
                    <Button
                        onClick={() => {
                            void refetch();
                        }}
                        size="sm"
                        type="button"
                        variant="outline"
                    >
                        {t("comments.retry")}
                    </Button>
                </div>
            ) : comments.length === 0 ? (
                <p className="text-ui text-muted-foreground">
                    {t("comments.emptyList")}
                </p>
            ) : (
                <ul className="flex flex-col">
                    {threads.map((thread, index) => {
                        const { canDelete, canEdit } = commentPermissions(
                            thread.root
                        );
                        const openReply = canComment
                            ? (commentId: string) => {
                                  setReplyingToId(commentId);
                                  setReplyDraft("");
                              }
                            : undefined;

                        return (
                            <li
                                className={cn(
                                    index > 0 && "border-t border-border pt-4",
                                    "pb-4 last:pb-0"
                                )}
                                key={thread.root.id}
                            >
                                <TaskCommentItem
                                    canComment={canComment}
                                    canDelete={canDelete}
                                    canEdit={canEdit}
                                    comment={thread.root}
                                    highlighted={
                                        highlightedCommentId === thread.root.id
                                    }
                                    locale={i18n.language}
                                    mentionCandidates={mentionCandidates}
                                    onDelete={() => {
                                        void handleDelete(thread.root.id);
                                    }}
                                    onReply={
                                        openReply
                                            ? () => {
                                                  openReply(thread.root.id);
                                              }
                                            : undefined
                                    }
                                    onSave={async (body) => {
                                        await updateComment.mutateAsync({
                                            body,
                                            commentId: thread.root.id,
                                            previousBody: thread.root.body,
                                        });
                                    }}
                                    onTaskMentionClick={handleTaskMentionClick}
                                    replies={
                                        thread.replies.length > 0 ? (
                                            <CommentReplies>
                                                {thread.replies.map((reply) => {
                                                    const perms =
                                                        commentPermissions(
                                                            reply
                                                        );
                                                    return (
                                                        <li key={reply.id}>
                                                            <TaskCommentItem
                                                                canComment={
                                                                    canComment
                                                                }
                                                                canDelete={
                                                                    perms.canDelete
                                                                }
                                                                canEdit={
                                                                    perms.canEdit
                                                                }
                                                                comment={reply}
                                                                highlighted={
                                                                    highlightedCommentId ===
                                                                    reply.id
                                                                }
                                                                isReply
                                                                locale={
                                                                    i18n.language
                                                                }
                                                                mentionCandidates={
                                                                    mentionCandidates
                                                                }
                                                                onDelete={() => {
                                                                    void handleDelete(
                                                                        reply.id
                                                                    );
                                                                }}
                                                                onReply={
                                                                    openReply
                                                                        ? () => {
                                                                              openReply(
                                                                                  reply.id
                                                                              );
                                                                          }
                                                                        : undefined
                                                                }
                                                                onSave={async (
                                                                    body
                                                                ) => {
                                                                    await updateComment.mutateAsync(
                                                                        {
                                                                            body,
                                                                            commentId:
                                                                                reply.id,
                                                                            previousBody:
                                                                                reply.body,
                                                                        }
                                                                    );
                                                                }}
                                                                onTaskMentionClick={
                                                                    handleTaskMentionClick
                                                                }
                                                                replyComposer={renderReplyComposer(
                                                                    reply.id
                                                                )}
                                                                t={t}
                                                                taskId={taskId}
                                                                taskMentionCandidates={
                                                                    taskMentionCandidates
                                                                }
                                                            />
                                                        </li>
                                                    );
                                                })}
                                            </CommentReplies>
                                        ) : undefined
                                    }
                                    replyComposer={renderReplyComposer(
                                        thread.root.id
                                    )}
                                    t={t}
                                    taskId={taskId}
                                    taskMentionCandidates={
                                        taskMentionCandidates
                                    }
                                />
                            </li>
                        );
                    })}
                </ul>
            )}

            {canComment ? (
                <CommentComposer
                    authorAvatarUrl={composerAuthor.avatarUrl}
                    authorName={composerAuthor.name}
                    disabled={
                        createComment.isPending ||
                        !normalizeEditorContent(draft) ||
                        !isRichTextWithinLimit(draft, TASK_COMMENT_MAX_LENGTH)
                    }
                    draft={draft}
                    mentionCandidates={mentionCandidates}
                    onChange={setDraft}
                    onSubmit={() => {
                        void handleCreate();
                    }}
                    onTaskMentionClick={handleTaskMentionClick}
                    pending={createComment.isPending}
                    t={t}
                    taskId={taskId}
                    taskMentionCandidates={taskMentionCandidates}
                />
            ) : undefined}
        </section>
    );
}

function CommentAvatar({
    avatarUrl,
    name,
    size = "md",
}: {
    avatarUrl?: string;
    name: string;
    size?: "md" | "sm";
}) {
    return (
        <Avatar
            className={cn(
                "shrink-0 rounded-none",
                size === "sm" ? "size-7" : "size-8"
            )}
        >
            {avatarUrl ? <AvatarImage alt="" src={avatarUrl} /> : undefined}
            <AvatarFallback className="rounded-none text-meta">
                {getUserInitials(name)}
            </AvatarFallback>
        </Avatar>
    );
}

function CommentComposer({
    authorAvatarUrl,
    authorName,
    disabled,
    draft,
    mentionCandidates,
    onCancel,
    onChange,
    onSubmit,
    onTaskMentionClick,
    pending,
    placeholder,
    submitLabel,
    t,
    taskId,
    taskMentionCandidates,
}: {
    authorAvatarUrl?: string;
    authorName: string;
    disabled: boolean;
    draft: string;
    mentionCandidates: readonly MentionCandidate[];
    onCancel?: () => void;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onTaskMentionClick?: (taskId: string) => void;
    pending: boolean;
    placeholder?: string;
    submitLabel?: string;
    t: Translate;
    taskId: string;
    taskMentionCandidates?: readonly TaskMentionCandidate[];
}) {
    return (
        <div className="flex items-start gap-3" data-comment-composer="">
            <CommentAvatar
                avatarUrl={authorAvatarUrl}
                name={authorName}
                size="md"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-2 border border-border bg-muted/20 p-2.5">
                <RichTextEditor
                    compact
                    id={`comment-compose-${taskId}${onCancel ? `-reply` : ""}`}
                    maxLength={TASK_COMMENT_MAX_LENGTH}
                    mentionCandidates={mentionCandidates}
                    onChange={onChange}
                    onModEnter={() => {
                        if (!disabled && !pending) {
                            onSubmit();
                        }
                    }}
                    onTaskMentionClick={onTaskMentionClick}
                    onUploadImage={(file) => uploadTaskMedia(file, taskId)}
                    placeholder={placeholder ?? t("comments.placeholder")}
                    taskMentionCandidates={taskMentionCandidates}
                    value={draft}
                />
                <div className="flex justify-end gap-2">
                    {onCancel ? (
                        <Button
                            disabled={pending}
                            onClick={onCancel}
                            size="sm"
                            type="button"
                            variant="outline"
                        >
                            {t("comments.cancel")}
                        </Button>
                    ) : undefined}
                    <Button
                        disabled={disabled || pending}
                        onClick={onSubmit}
                        size="sm"
                        type="button"
                    >
                        {submitLabel ?? t("comments.add")}
                    </Button>
                </div>
            </div>
        </div>
    );
}

function formatAbsoluteTimestamp(value: string, locale: string) {
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function formatRelativeTimestamp(value: string, locale: string) {
    const dateFnsLocale = locale.toLowerCase().startsWith("ru") ? ru : enUS;
    return formatDistanceToNow(new Date(value), {
        addSuffix: true,
        locale: dateFnsLocale,
    });
}

function TaskCommentItem({
    canComment,
    canDelete,
    canEdit,
    comment,
    highlighted,
    isReply = false,
    locale,
    mentionCandidates,
    onDelete,
    onReply,
    onSave,
    onTaskMentionClick,
    replies,
    replyComposer,
    t,
    taskId,
    taskMentionCandidates,
}: TaskCommentItemProperties) {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState(comment.body);
    const [isSaving, setIsSaving] = useState(false);

    const authorName = comment.author?.name ?? t("members.unknownUser");
    const edited =
        comment.updatedAt === comment.createdAt
            ? undefined
            : t("comments.edited");
    const absoluteTime = formatAbsoluteTimestamp(comment.createdAt, locale);

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

    const showActions =
        !isEditing && (canEdit || canDelete || (canComment && onReply));

    return (
        <article
            className={cn(
                "flex w-full min-w-0 gap-3 transition-colors",
                highlighted && "bg-primary/5 ring-2 ring-primary/40"
            )}
            data-comment-id={comment.id}
            data-highlighted={highlighted ? "true" : undefined}
        >
            <CommentAvatar
                avatarUrl={comment.author?.avatarUrl}
                name={authorName}
                size={isReply ? "sm" : "md"}
            />

            {/* Content column stays full remaining width; replies nest inside, not beside. */}
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="truncate text-ui font-medium">{authorName}</p>
                    <time
                        className="text-meta text-muted-foreground"
                        dateTime={comment.createdAt}
                        title={absoluteTime}
                    >
                        {formatRelativeTimestamp(comment.createdAt, locale)}
                    </time>
                    {edited ? (
                        <span className="text-meta text-muted-foreground">
                            ({edited})
                        </span>
                    ) : undefined}
                </div>

                {isEditing ? (
                    <div className="flex min-w-0 flex-col gap-2 border border-border bg-muted/20 p-2.5">
                        <RichTextEditor
                            compact
                            id={`comment-edit-${comment.id}`}
                            maxLength={TASK_COMMENT_MAX_LENGTH}
                            mentionCandidates={mentionCandidates}
                            onChange={setDraft}
                            onModEnter={() => {
                                if (
                                    !isSaving &&
                                    isRichTextWithinLimit(
                                        draft,
                                        TASK_COMMENT_MAX_LENGTH
                                    )
                                ) {
                                    void handleSave();
                                }
                            }}
                            onTaskMentionClick={onTaskMentionClick}
                            onUploadImage={(file) =>
                                uploadTaskMedia(file, taskId)
                            }
                            placeholder={t("comments.placeholder")}
                            taskMentionCandidates={taskMentionCandidates}
                            value={draft}
                        />
                        <div className="flex justify-end gap-2">
                            <Button
                                disabled={isSaving}
                                onClick={() => {
                                    setDraft(comment.body);
                                    setIsEditing(false);
                                }}
                                size="sm"
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
                                        TASK_COMMENT_MAX_LENGTH
                                    )
                                }
                                onClick={() => {
                                    void handleSave();
                                }}
                                size="sm"
                                type="button"
                            >
                                {t("comments.save")}
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="min-w-0">
                        <RichTextEditor
                            compact
                            id={`comment-view-${comment.id}`}
                            onTaskMentionClick={onTaskMentionClick}
                            readOnly
                            value={comment.body}
                        />
                    </div>
                )}

                {showActions ? (
                    <div className="flex flex-wrap items-center gap-1">
                        {canComment && onReply ? (
                            <Button
                                className="h-7 px-2 text-meta text-muted-foreground hover:text-foreground"
                                onClick={onReply}
                                size="sm"
                                type="button"
                                variant="ghost"
                            >
                                {t("comments.reply")}
                            </Button>
                        ) : undefined}
                        {canEdit ? (
                            <Button
                                className="h-7 px-2 text-meta text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                    setDraft(comment.body);
                                    setIsEditing(true);
                                }}
                                size="sm"
                                type="button"
                                variant="ghost"
                            >
                                {t("comments.edit")}
                            </Button>
                        ) : undefined}
                        {canDelete ? (
                            <Button
                                className="h-7 px-2 text-meta text-muted-foreground hover:text-destructive"
                                onClick={onDelete}
                                size="sm"
                                type="button"
                                variant="ghost"
                            >
                                {t("comments.delete")}
                            </Button>
                        ) : undefined}
                    </div>
                ) : undefined}

                {replyComposer}
                {replies}
            </div>
        </article>
    );
}
