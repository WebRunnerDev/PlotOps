import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { CustomFieldTaskType } from "@/features/custom-fields/model/types";

import {
    filterCustomFieldsForTaskType,
    sortCustomFieldsByPosition,
} from "@/features/custom-fields/model/constants";
import { useProjectCustomFields } from "@/features/custom-fields/model/use-project-custom-fields";
import { useTaskCustomFieldValues } from "@/features/custom-fields/model/use-task-custom-field-values";
import { Label } from "@/shared/shadcn/ui/label";
import { Textarea } from "@/shared/shadcn/ui/textarea";

const FIELD_LABEL_CLASS = "text-meta text-muted-foreground";
const FIELD_CONTROL_CLASS = "w-full min-h-16 font-mono text-code";

type TaskCustomFieldsSectionProperties = {
    canEdit: boolean;
    projectId: string;
    taskId: string;
    taskType: CustomFieldTaskType;
};

/** Right-column drawer fields filtered by the Task’s current type (ADR 0024). */
export function TaskCustomFieldsSection({
    canEdit,
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

    if (fieldsLoading || visible.length === 0) {
        return;
    }

    return (
        <div className="flex flex-col gap-3">
            <p className={FIELD_LABEL_CLASS}>{t("fields.customFields")}</p>
            {visible.map((field) => (
                <CustomFieldValueInput
                    canEdit={canEdit}
                    fieldId={field.id}
                    key={field.id}
                    label={field.name}
                    onCommit={setCustomFieldValue}
                    savedValue={valueByFieldId.get(field.id) ?? ""}
                />
            ))}
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
            <Textarea
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
        </div>
    );
}
