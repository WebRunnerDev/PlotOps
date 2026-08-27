import { describe, expect, it } from "vitest";

import type { ProjectCustomField } from "@/features/custom-fields/model/types";

import {
    countCapCustomFields,
    filterCustomFieldsForTaskType,
    isDescriptionCustomField,
    sortCustomFieldsByPosition,
} from "@/features/custom-fields/model/constants";

const fields: ProjectCustomField[] = [
    {
        appliesTo: ["task", "bug", "feature"],
        id: "desc",
        name: "Description",
        position: 0,
        projectId: "p1",
        systemKey: "description",
    },
    {
        appliesTo: ["bug"],
        id: "repro",
        name: "Steps to reproduce",
        position: 2,
        projectId: "p1",
    },
    {
        appliesTo: ["task", "feature"],
        id: "notes",
        name: "Notes",
        position: 1,
        projectId: "p1",
    },
    {
        appliesTo: ["bug", "feature", "task"],
        id: "impact",
        name: "Impact",
        position: 3,
        projectId: "p1",
    },
];

describe("filterCustomFieldsForTaskType", () => {
    it("keeps only definitions that apply to the Task type", () => {
        expect(
            filterCustomFieldsForTaskType(fields, "bug").map(
                (field) => field.id
            )
        ).toEqual(["desc", "repro", "impact"]);
        expect(
            filterCustomFieldsForTaskType(fields, "task").map(
                (field) => field.id
            )
        ).toEqual(["desc", "notes", "impact"]);
    });
});

describe("sortCustomFieldsByPosition", () => {
    it("orders by position then name", () => {
        expect(
            sortCustomFieldsByPosition(fields).map((field) => field.id)
        ).toEqual(["desc", "notes", "repro", "impact"]);
    });
});

describe("system field helpers", () => {
    it("identifies Description and excludes it from the cap", () => {
        expect(isDescriptionCustomField(fields[0]!)).toBe(true);
        expect(countCapCustomFields(fields)).toBe(3);
    });
});
