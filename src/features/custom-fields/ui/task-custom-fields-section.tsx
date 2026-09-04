import { type RefObject, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import { toast } from "sonner";

import type { CustomFieldTaskType } from "@/features/custom-fields/model/types";
import type {
    MentionCandidate,
    RichTextEditorHandle,
    TaskMentionCandidate,
} from "@/shared/ui/rich-text-editor";

import {
    CUSTOM_FIELD_VALUE_MAX_LENGTH,
    filterCustomFieldsForTaskType,
    isDescriptionCustomField,
    sortCustomFieldsByPosition,
} from "@/features/custom-fields/model/constants";
import { useProjectCustomFields } from "@/features/custom-fields/model/use-project-custom-fields";
import { useTaskCustomFieldValues } from "@/features/custom-fields/model/use-task-custom-field-values";
import { useDeferredMount } from "@/shared/lib/use-deferred-mount";
import { cn } from "@/shared/lib/utils";
import { Label } from "@/shared/shadcn/ui/label";
import { Textarea } from "@/shared/shadcn/ui/textarea";
import { RichTextEditor } from "@/shared/ui/rich-text-editor";

const FIELD_LABEL_CLASS =
    "text-meta font-medium tracking-[0.06em] text-muted-foreground";
const FIELD_CONTROL_CLASS = "w-full min-h-16 font-mono text-code";

type DescriptionFieldProperties = {
    editorReference: RefObject<null | RichTextEditorHandle>;
    maxLength: number;
    mentionCandidates?: MentionCandidate[];
    onBlur: () => void;
    onChange: (value: string) => void;
    onTaskMentionClick?: (taskId: string) => void;
    onUploadImage?: (file: File) => Promise<string>;
    placeholder: string;
    readOnly: boolean;
    taskMentionCandidates?: TaskMentionCandidate[];
    value: string;
};

type TaskCustomFieldsSectionProperties = {
    canEdit: boolean;
    description: DescriptionFieldProperties;
    projectId: string;
    taskId: string;
    taskType: CustomFieldTaskType;
};

/**
 * Left-column drawer fields filtered by Task type and ordered by position.
 * Description is a system definition; body still lives on `tasks.description`.
 */
export function TaskCustomFieldsSection({
    canEdit,
    description,
    projectId,
    taskId,
    taskType,
}: TaskCustomFieldsSectionProperties) {
    const { t } = useTranslation("board");
    const { fields, isLoading: fieldsLoading } =
        useProjectCustomFields(projectId);
    const { setCustomFieldValue, valueByFieldId } =
        useTaskCustomFieldValues(taskId);

    const visible = useMemo(
        () =>
            sortCustomFieldsByPosition(
                filterCustomFieldsForTaskType(fields, taskType)
            ),
        [fields, taskType]
    );

    const descriptionField = useMemo(
        () => fields.find((field) => isDescriptionCustomField(field)),
        [fields]
    );

    if (fieldsLoading) {
        return (
            <DescriptionEditor
                description={description}
                label={descriptionField?.name ?? t("fields.description")}
                taskId={taskId}
            />
        );
    }

    const ordered = visible.length > 0 ? visible : descriptionField ? [] : null;

    if (ordered === null) {
        return (
            <DescriptionEditor
                description={description}
                label={t("fields.description")}
                taskId={taskId}
            />
        );
    }

    if (ordered.length === 0) {
        return;
    }

    return (
        <div className="flex flex-col gap-6">
            {ordered.map((field) =>
                isDescriptionCustomField(field) ? (
                    <DescriptionEditor
                        description={description}
                        key={field.id}
                        label={field.name}
                        taskId={taskId}
                    />
                ) : (
                    <CustomFieldValueInput
                        canEdit={canEdit}
                        fieldId={field.id}
                        key={field.id}
                        label={field.name}
                        onCommit={setCustomFieldValue}
                        savedValue={valueByFieldId.get(field.id) ?? ""}
                    />
                )
            )}
        </div>
    );
}

function CustomFieldValueInput({
    canEdit,
    fieldId,
    label,
    onCommit,
    savedValue,
}: {
    canEdit: boolean;
    fieldId: string;
    label: string;
    onCommit: (fieldId: string, value: string) => Promise<void>;
    savedValue: string;
}) {
    const { t } = useTranslation("board");
    const [draft, setDraft] = useState(savedValue);
    const [dirty, setDirty] = useState(false);
    const isOverLimit = draft.length > CUSTOM_FIELD_VALUE_MAX_LENGTH;

    useEffect(() => {
        if (dirty) return;
        setDraft(savedValue);
    }, [dirty, savedValue]);

    const commit = async () => {
        if (!canEdit || !dirty) return;
        if (draft === savedValue) {
            setDirty(false);
            return;
        }
        if (draft.length > CUSTOM_FIELD_VALUE_MAX_LENGTH) {
            toast.error(t("fields.customFieldTooLong"));
            return;
        }
        try {
            await onCommit(fieldId, draft);
            setDirty(false);
        } catch {
            toast.error(t("fields.customFieldSaveFailed"));
            setDraft(savedValue);
            setDirty(false);
        }
    };

    const inputId = `task-custom-field-${fieldId}`;

    return (
        <div className="flex flex-col gap-1.5">
            <Label className={FIELD_LABEL_CLASS} htmlFor={inputId}>
                {label}
            </Label>
            <div className="group/custom-field flex min-w-0 flex-col">
                <Textarea
                    aria-invalid={isOverLimit || undefined}
                    className={FIELD_CONTROL_CLASS}
                    disabled={!canEdit}
                    id={inputId}
                    onBlur={() => void commit()}
                    onChange={(event) => {
                        setDraft(event.target.value);
                        setDirty(true);
                    }}
                    placeholder={t("fields.customFieldPlaceholder")}
                    readOnly={!canEdit}
                    rows={3}
                    value={draft}
                />
                {canEdit ? (
                    <div className="mt-1 flex items-start justify-between gap-3 px-1 text-[0.6875rem] leading-tight">
                        <p
                            aria-hidden
                            className="pointer-events-none min-w-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-focus-within/custom-field:opacity-100"
                        >
                            {t("fields.customFieldHint")}
                        </p>
                        <p
                            className={cn(
                                "shrink-0 tabular-nums",
                                isOverLimit
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                            )}
                        >
                            {t("richText.length", {
                                current: draft.length.toLocaleString(),
                                max: CUSTOM_FIELD_VALUE_MAX_LENGTH.toLocaleString(),
                            })}
                        </p>
                    </div>
                ) : undefined}
            </div>
        </div>
    );
}

function DescriptionEditor({
    description,
    label,
    taskId,
}: {
    description: DescriptionFieldProperties;
    label: string;
    taskId: string;
}) {
    const editorReady = useDeferredMount(true, taskId);

    return (
        <div className="flex min-w-0 flex-col gap-2">
            <Label
                className={FIELD_LABEL_CLASS}
                htmlFor="task-description"
                id="task-description-label"
            >
                {label}
            </Label>
            {editorReady ? (
                <RichTextEditor
                    id="task-description"
                    maxLength={description.maxLength}
                    mentionCandidates={description.mentionCandidates}
                    onBlur={description.onBlur}
                    onChange={description.onChange}
                    onTaskMentionClick={description.onTaskMentionClick}
                    onUploadImage={description.onUploadImage}
                    placeholder={description.placeholder}
                    readOnly={description.readOnly}
                    ref={description.editorReference}
                    taskMentionCandidates={description.taskMentionCandidates}
                    value={description.value}
                />
            ) : (
                <Skeleton
                    aria-busy="true"
                    aria-hidden="true"
                    className="min-h-32"
                    count={4}
                />
            )}
        </div>
    );
}
