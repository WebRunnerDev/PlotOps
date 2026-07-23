import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import type { ProjectLabel } from "@/features/labels/model/types";

import { getLabelDotProperties } from "@/features/labels/model/constants";
import { useProjectLabels } from "@/features/labels/model/use-project-labels";
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
    disabled?: boolean;
    labels: ProjectLabel[];
    /** Persist Task.`labelIds` — owned by the tasks module. */
    onLabelIdsChange: (labelIds: string[] | undefined) => void;
    projectId: string;
    selectedIds: string[];
};

export function TaskLabelsField({
    disabled = false,
    labels,
    onLabelIdsChange,
    projectId,
    selectedIds,
}: TaskLabelsFieldProperties) {
    const { t } = useTranslation("board");
    const { addLabel } = useProjectLabels(projectId);
    const anchor = useComboboxAnchor();

    const [query, setQuery] = useState("");

    const selectedLabels = useMemo(
        () => labels.filter((label) => selectedIds.includes(label.id)),
        [labels, selectedIds]
    );

    const trimmedQuery = query.trim();
    const canCreate =
        trimmedQuery.length > 0 &&
        !labels.some(
            (label) => label.name.toLowerCase() === trimmedQuery.toLowerCase()
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
        onLabelIdsChange(nextIds.length > 0 ? nextIds : undefined);
    };

    const handleCreate = async (name: string, current: ProjectLabel[]) => {
        const id = await addLabel(name);
        if (!id) {
            toast.error(t("labels.createFailed"));
            return;
        }

        onLabelIdsChange([...current.map((label) => label.id), id]);
        setQuery("");
        toast.success(t("labels.created", { name: name.trim() }));
    };

    const handleValueChange = (next: LabelOption[]) => {
        const create = next.find((option) => isCreateOption(option));
        const real = next.filter(
            (option): option is ProjectLabel => !isCreateOption(option)
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
            disabled={disabled}
            inputValue={query}
            isItemEqualToValue={(a, b) => a.id === b.id}
            items={items}
            itemToStringLabel={(item) =>
                isCreateOption(item) ? query : item.name
            }
            multiple
            onInputValueChange={(value) => {
                if (!disabled) setQuery(value);
            }}
            onValueChange={(value) => {
                if (disabled) return;
                handleValueChange(value ?? []);
            }}
            value={selectedLabels}
        >
            <ComboboxChips ref={anchor}>
                <ComboboxValue>
                    {(values: ProjectLabel[]) => (
                        <Fragment>
                            {values.map((label) => {
                                const dot = getLabelDotProperties(label);
                                return (
                                    <ComboboxChip key={label.id}>
                                        <span
                                            aria-hidden
                                            className={cn(
                                                "size-2 shrink-0 rounded-full",
                                                dot.className
                                            )}
                                            style={dot.style}
                                        />
                                        {label.name}
                                    </ComboboxChip>
                                );
                            })}
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
                                        getLabelDotProperties(item).className
                                    )}
                                    style={getLabelDotProperties(item).style}
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
