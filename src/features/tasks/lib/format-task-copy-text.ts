import type {
    CustomFieldTaskType,
    ProjectCustomField,
} from "@/features/custom-fields/model/types";

import {
    filterCustomFieldsForTaskType,
    isDescriptionCustomField,
    sortCustomFieldsByPosition,
} from "@/features/custom-fields/model/constants";
import {
    escapeHtml,
    normalizeEditorContent,
    richTextToPlainText,
} from "@/shared/ui/rich-text-editor/content";

export type TaskCopySection = {
    name: string;
    richText?: boolean;
    value: string;
};

/** Ordered clipboard sections for a task (title, description, custom fields). */
export function buildTaskCopySections(input: {
    customFields: ProjectCustomField[];
    description: string;
    descriptionFallbackLabel: string;
    taskType: CustomFieldTaskType;
    title: string;
    titleLabel: string;
    valueByFieldId: ReadonlyMap<string, string>;
}): TaskCopySection[] {
    const sections: TaskCopySection[] = [];

    if (input.title.trim()) {
        sections.push({
            name: input.titleLabel,
            value: input.title,
        });
    }

    const visible = sortCustomFieldsByPosition(
        filterCustomFieldsForTaskType(input.customFields, input.taskType)
    );
    const descriptionField = input.customFields.find((field) =>
        isDescriptionCustomField(field)
    );
    const ordered = visible.length > 0 ? visible : descriptionField ? [] : null;

    if (ordered === null) {
        sections.push({
            name: input.descriptionFallbackLabel,
            richText: true,
            value: input.description,
        });
        return sections;
    }

    for (const field of ordered) {
        if (isDescriptionCustomField(field)) {
            sections.push({
                name: field.name,
                richText: true,
                value: input.description,
            });
            continue;
        }

        sections.push({
            name: field.name,
            value: input.valueByFieldId.get(field.id) ?? "",
        });
    }

    return sections;
}

/** HTML clipboard payload — keeps inline images for rich-text paste targets. */
export function formatTaskCopyHtml(sections: TaskCopySection[]): string {
    return sections
        .map((section) => formatSectionHtml(section))
        .filter((block) => block.length > 0)
        .join("");
}

/** Plain-text clipboard payload for a one-click copy of task fields. */
export function formatTaskCopyText(sections: TaskCopySection[]): string {
    return sections
        .map((section) => formatSectionPlainText(section))
        .filter((block) => block.length > 0)
        .join("\n\n");
}

function formatSectionHtml(section: TaskCopySection): string {
    const name = section.name.trim();
    const body = sectionHtmlBody(section);
    if (!body) return "";
    if (!name) return body;
    return `<p><strong>${escapeHtml(name)}</strong></p>${body}`;
}

function formatSectionPlainText(section: TaskCopySection): string {
    const name = section.name.trim();
    const body = sectionPlainBody(section);
    if (!body) return "";
    if (!name) return body;
    return `${name}\n${body}`;
}

function sectionHtmlBody(section: TaskCopySection): string {
    if (section.richText) {
        return normalizeEditorContent(section.value);
    }
    const trimmed = section.value.trim();
    return trimmed ? `<p>${escapeHtml(trimmed)}</p>` : "";
}

function sectionPlainBody(section: TaskCopySection): string {
    return section.richText
        ? richTextToPlainText(section.value)
        : section.value.trim();
}
