import { describe, expect, it } from "vitest";

import type { ProjectCustomField } from "@/features/custom-fields/model/types";

import {
    filterCustomFieldsForTaskType,
    sortCustomFieldsByPosition,
} from "@/features/custom-fields/model/constants";

const fields: ProjectCustomField[] = [
    {
        appliesTo: ["bug"],
        id: "repro",
        name: "Steps to reproduce",
        position: 1,
        projectId: "p1",
    },
    {
        appliesTo: ["task", "feature"],
        id: "notes",
        name: "Notes",
        position: 0,
        projectId: "p1",
    },
    {
        appliesTo: ["bug", "feature", "task"],
        id: "impact",
        name: "Impact",
        position: 2,
        projectId: "p1",
    },
];

describe("filterCustomFieldsForTaskType", () => {
    it("keeps only definitions that apply to the Task type", () => {
        expect(
            filterCustomFieldsForTaskType(fields, "bug").map(
                (field) => field.id
            )
        ).toEqual(["repro", "impact"]);
        expect(
            filterCustomFieldsForTaskType(fields, "task").map(
                (field) => field.id
            )
        ).toEqual(["notes", "impact"]);
    });
});

describe("sortCustomFieldsByPosition", () => {
    it("orders by position then name", () => {
        expect(
            sortCustomFieldsByPosition(fields).map((field) => field.id)
        ).toEqual(["notes", "repro", "impact"]);
    });
});
