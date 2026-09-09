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

export type TaskCopyRelatedPeer = {
    direction: "incoming" | "outgoing";
    kind: "blocks" | "relates_to";
    otherKey: string;
    otherTitle: string;
};

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
    includeTaskKey?: boolean;
    includeTaskType?: boolean;
    metadataSections?: TaskCopySection[];
    taskKey?: string;
    taskType: CustomFieldTaskType;
    taskTypeLabel?: string;
    taskTypeSectionName?: string;
    title: string;
    titleLabel: string;
    valueByFieldId: ReadonlyMap<string, string>;
}): TaskCopySection[] {
    const sections: TaskCopySection[] = [];

    const titleValue = formatTaskCopyTitle({
        includeTaskKey: input.includeTaskKey === true,
        taskKey: input.taskKey,
        title: input.title,
    });
    if (titleValue) {
        sections.push({
            name: input.titleLabel,
            value: titleValue,
        });
    }

    if (
        input.includeTaskType === true &&
        input.taskTypeSectionName?.trim() &&
        input.taskTypeLabel?.trim()
    ) {
        sections.push({
            name: input.taskTypeSectionName.trim(),
            value: input.taskTypeLabel.trim(),
        });
    }

    if (input.metadataSections) {
        for (const section of input.metadataSections) {
            if (!section.name.trim() || !section.value.trim()) continue;
            sections.push({
                name: section.name.trim(),
                value: section.value.trim(),
            });
        }
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

/** One clipboard line per linked Task, prefixed with the relation label. */
export function formatTaskCopyRelatedTaskLines(
    peers: ReadonlyArray<TaskCopyRelatedPeer>,
    labels: {
        blockedBy: string;
        blocks: string;
        relatesTo: string;
    }
): string {
    return peers
        .map((peer) => {
            const relation =
                peer.kind === "relates_to"
                    ? labels.relatesTo
                    : peer.direction === "incoming"
                      ? labels.blockedBy
                      : labels.blocks;
            const key = peer.otherKey.trim();
            const title = peer.otherTitle.trim();
            const target = key && title ? `${key} ${title}` : key || title;
            if (!target) return "";
            const prefix = relation.trim();
            return prefix ? `${prefix}: ${target}` : target;
        })
        .filter((line) => line.length > 0)
        .join("\n");
}

/** One clipboard line per Subtask (`KEY Title`). */
export function formatTaskCopySubtaskLines(
    subtasks: ReadonlyArray<{ key: string; title: string }>
): string {
    return subtasks
        .map((subtask) => {
            const key = subtask.key.trim();
            const title = subtask.title.trim();
            if (key && title) return `${key} ${title}`;
            return key || title;
        })
        .filter((line) => line.length > 0)
        .join("\n");
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

function formatTaskCopyTitle(input: {
    includeTaskKey: boolean;
    taskKey?: string;
    title: string;
}): string {
    const title = input.title.trim();
    const key = input.taskKey?.trim() ?? "";
    if (input.includeTaskKey && key) {
        return title ? `${key} ${title}` : key;
    }
    return title;
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
