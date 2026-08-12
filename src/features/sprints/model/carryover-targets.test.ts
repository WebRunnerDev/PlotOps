import { describe, expect, it } from "vitest";

import {
    defaultCarryoverByTaskId,
    incompleteMemberTaskIds,
    resolveCarryoverSprintIds,
    setAllCarryoverTargets,
    summarizeCarryoverByTaskId,
    syncCarryoverByTaskId,
} from "./carryover-targets";

describe("incompleteMemberTaskIds", () => {
    it("returns member ids not marked completed", () => {
        expect(
            incompleteMemberTaskIds(["t1", "t2", "t3"], new Set(["t2"]))
        ).toEqual(["t1", "t3"]);
    });
});

describe("defaultCarryoverByTaskId", () => {
    it("defaults every incomplete task to Backlog", () => {
        expect(defaultCarryoverByTaskId(["t1", "t2"])).toEqual({
            t1: "backlog",
            t2: "backlog",
        });
    });
});

describe("setAllCarryoverTargets", () => {
    it("sets every incomplete task to the same target", () => {
        expect(
            setAllCarryoverTargets({ t1: "backlog", t2: "draft-a" }, "draft-b")
        ).toEqual({
            t1: "draft-b",
            t2: "draft-b",
        });
    });
});

describe("syncCarryoverByTaskId", () => {
    it("adds Backlog defaults for newly incomplete tasks and drops completed ones", () => {
        expect(
            syncCarryoverByTaskId({ t1: "draft-a", t2: "backlog", t3: "new" }, [
                "t1",
                "t4",
            ])
        ).toEqual({
            t1: "draft-a",
            t4: "backlog",
        });
    });
});

describe("resolveCarryoverSprintIds", () => {
    it("maps Backlog to null, Draft ids through, and new to the created draft id", () => {
        expect(
            resolveCarryoverSprintIds(
                {
                    t1: "backlog",
                    t2: "draft-a",
                    t3: "new",
                },
                "created-draft"
            )
        ).toEqual({
            t1: null,
            t2: "draft-a",
            t3: "created-draft",
        });
    });

    it("maps new to null when no draft was created", () => {
        expect(resolveCarryoverSprintIds({ t1: "new" }, null)).toEqual({
            t1: null,
        });
    });
});

describe("summarizeCarryoverByTaskId", () => {
    it("counts Backlog vs Draft carryovers from a closed event map", () => {
        expect(
            summarizeCarryoverByTaskId({
                t1: null,
                t2: "draft-a",
                t3: "draft-b",
            })
        ).toEqual({ backlogCount: 1, draftCount: 2 });
    });

    it("returns null for non-object payloads", () => {
        expect(summarizeCarryoverByTaskId(null)).toBeNull();
        expect(summarizeCarryoverByTaskId([])).toBeNull();
    });
});
