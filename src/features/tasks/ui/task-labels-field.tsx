import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { ProjectLabel } from "@/features/tasks/model/types";

import { LABEL_DOT_CLASS } from "@/features/tasks/model/constants";
import { useTasksStore } from "@/features/tasks/model/use-tasks-store";
import { cn } from "@/shared/lib/utils";
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    ComboboxValue,
    useComboboxAnchor,
} from "@/shared/shadcn/ui/combobox";

const CREATE_ID = "__create_label__";

type CreateLabelOption = ProjectLabel & { isCreate: true };

type LabelOption = CreateLabelOption | ProjectLabel;

type TaskLabelsFieldProperties = {
    labels: ProjectLabel[];
    projectId: string;
    selectedIds: string[];
    taskId: string;
};

export function TaskLabelsField({
    labels,
    projectId,
    selectedIds,
    taskId,
}: TaskLabelsFieldProperties) {
    const { t } = useTranslation("board");
    const addLabel = useTasksStore((state) => state.addLabel);
    const updateTaskDetails = useTasksStore((state) => state.updateTaskDetails);
    const anchor = useComboboxAnchor();

    const [query, setQuery] = useState("");

    const selectedLabels = useMemo(
        () => labels.filter((label) => selectedIds.includes(label.id)),
        [labels, selectedIds],
    );

    const trimmedQuery = query.trim();
    const canCreate =
        trimmedQuery.length > 0 &&
        !labels.some(
            (label) =>
                label.name.toLowerCase() === trimmedQuery.toLowerCase(),
        );

    const createOption: CreateLabelOption | undefined = canCreate
        ? {
              color: "gray",
              id: CREATE_ID,
              isCreate: true,
              name: trimmedQuery,
              projectId,
          }
        : undefined;

    const items: LabelOption[] = createOption
        ? [...labels, createOption]
        : labels;

    const commitSelection = (next: ProjectLabel[]) => {
        const nextIds = next.map((label) => label.id);
        updateTaskDetails(taskId, {
            labelIds: nextIds.length > 0 ? nextIds : undefined,
        });
    };

    const handleCreate = (name: string, current: ProjectLabel[]) => {
        const id = addLabel(projectId, name);
        if (!id) {
            toast.error(t("labels.createFailed"));
            return;
        }

        updateTaskDetails(taskId, {
            labelIds: [...current.map((label) => label.id), id],
        });
        setQuery("");
        toast.success(t("labels.created", { name: name.trim() }));
    };

    const handleValueChange = (next: LabelOption[]) => {
        const create = next.find((option) => isCreateOption(option));
        const real = next.filter(
            (option): option is ProjectLabel => !isCreateOption(option),
        );

        if (create) {
            handleCreate(create.name, real);
            return;
        }

        commitSelection(real);
    };

    return (
        <Combobox
            autoHighlight
            inputValue={query}
            isItemEqualToValue={(a, b) => a.id === b.id}
            items={items}
            itemToStringLabel={(item) =>
                isCreateOption(item) ? query : item.name
            }
            multiple
            onInputValueChange={(value) => setQuery(value)}
            onValueChange={(value) => {
                handleValueChange(value ?? []);
            }}
            value={selectedLabels}
        >
            <ComboboxChips ref={anchor}>
                <ComboboxValue>
                    {(values: ProjectLabel[]) => (
                        <Fragment>
                            {values.map((label) => (
                                <ComboboxChip key={label.id}>
                                    <span
                                        aria-hidden
                                        className={cn(
                                            "size-2 shrink-0 rounded-full",
                                            LABEL_DOT_CLASS[label.color],
                                        )}
                                    />
                                    {label.name}
                                </ComboboxChip>
                            ))}
                            <ComboboxChipsInput
                                placeholder={t("labels.placeholder")}
                            />
                        </Fragment>
                    )}
                </ComboboxValue>
            </ComboboxChips>
            <ComboboxContent anchor={anchor}>
                <ComboboxEmpty>
                    {labels.length === 0
                        ? t("labels.empty")
                        : t("labels.noResults")}
                </ComboboxEmpty>
                <ComboboxList>
                    {(item: LabelOption) =>
                        isCreateOption(item) ? (
                            <ComboboxItem key={item.id} value={item}>
                                {t("labels.createOption", { name: item.name })}
                            </ComboboxItem>
                        ) : (
                            <ComboboxItem key={item.id} value={item}>
                                <span
                                    aria-hidden
                                    className={cn(
                                        "size-2.5 shrink-0 rounded-full",
                                        LABEL_DOT_CLASS[item.color],
                                    )}
                                />
                                {item.name}
                            </ComboboxItem>
                        )
                    }
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    );
}

function isCreateOption(option: LabelOption): option is CreateLabelOption {
    return "isCreate" in option && option.isCreate;
}
