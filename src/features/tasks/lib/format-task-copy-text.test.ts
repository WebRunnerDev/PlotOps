import { describe, expect, it } from "vitest";

import type { ProjectCustomField } from "@/features/custom-fields/model/types";

import {
    buildTaskCopySections,
    formatTaskCopyHtml,
    formatTaskCopyText,
} from "@/features/tasks/lib/format-task-copy-text";

const descriptionField: ProjectCustomField = {
    appliesTo: ["bug", "feature", "task"],
    id: "field-description",
    name: "Description",
    position: 0,
    projectId: "project-1",
    systemKey: "description",
};

const stepsField: ProjectCustomField = {
    appliesTo: ["bug", "feature", "task"],
    id: "field-steps",
    name: "Steps",
    position: 1,
    projectId: "project-1",
};

describe("buildTaskCopySections", () => {
    it("includes title, description, and custom fields in order", () => {
        const sections = buildTaskCopySections({
            customFields: [descriptionField, stepsField],
            description: "<p>Reset the session cookie.</p>",
            descriptionFallbackLabel: "Description",
            taskType: "bug",
            title: "Fix login",
            titleLabel: "Title",
            valueByFieldId: new Map([["field-steps", "Open app"]]),
        });

        expect(sections).toEqual([
            { name: "Title", value: "Fix login" },
            {
                name: "Description",
                richText: true,
                value: "<p>Reset the session cookie.</p>",
            },
            { name: "Steps", value: "Open app" },
        ]);
    });

    it("falls back to a single description section when no definitions exist", () => {
        const sections = buildTaskCopySections({
            customFields: [],
            description: "<p>Only description.</p>",
            descriptionFallbackLabel: "Description",
            taskType: "task",
            title: "",
            titleLabel: "Title",
            valueByFieldId: new Map(),
        });

        expect(sections).toEqual([
            {
                name: "Description",
                richText: true,
                value: "<p>Only description.</p>",
            },
        ]);
    });
});

describe("formatTaskCopyText", () => {
    it("joins sections with field names and a blank line between blocks", () => {
        expect(
            formatTaskCopyText([
                { name: "Title", value: "Fix login" },
                {
                    name: "Description",
                    richText: true,
                    value: "<p>Reset the session cookie.</p>",
                },
            ])
        ).toBe("Title\nFix login\n\nDescription\nReset the session cookie.");
    });

    it("returns only the title when the description is empty", () => {
        expect(
            formatTaskCopyText([
                { name: "Title", value: "Fix login" },
                {
                    name: "Description",
                    richText: true,
                    value: "<p></p>",
                },
            ])
        ).toBe("Title\nFix login");
    });

    it("uses image placeholders instead of storage urls in plain text", () => {
        const payload = formatTaskCopyText([
            { name: "Title", value: "Bug" },
            {
                name: "Description",
                richText: true,
                value: '<p>See shot</p><img src="https://cdn.example/a.png" alt="shot">',
            },
        ]);

        expect(payload).not.toContain("https://cdn.example/a.png");
        expect(payload).toBe("Title\nBug\n\nDescription\nSee shot\n[shot]");
    });

    it("includes custom field names and values", () => {
        expect(
            formatTaskCopyText([
                { name: "Title", value: "Bug" },
                { name: "Steps", value: "Reproduce on mobile" },
            ])
        ).toBe("Title\nBug\n\nSteps\nReproduce on mobile");
    });
});

describe("formatTaskCopyHtml", () => {
    it("wraps field names and keeps description html with images", () => {
        expect(
            formatTaskCopyHtml([
                { name: "Title", value: "Bug" },
                {
                    name: "Description",
                    richText: true,
                    value: '<p>See shot</p><img src="https://cdn.example/a.png" alt="shot">',
                },
            ])
        ).toBe(
            '<p><strong>Title</strong></p><p>Bug</p><p><strong>Description</strong></p><p>See shot</p><img src="https://cdn.example/a.png" alt="shot">'
        );
    });
});
