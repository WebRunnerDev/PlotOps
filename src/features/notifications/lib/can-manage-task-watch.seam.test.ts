import { describe, expect, it } from "vitest";

import type { ProjectAccessRole } from "@/features/projects/model/access";

import { canManageTaskWatch } from "./can-manage-task-watch";

describe("Manage Watchers authorization", () => {
    it.each([
        "owner",
        "admin",
        "manager",
        "contributor",
    ] as const satisfies ProjectAccessRole[])(
        "%s can add or remove another Member who can view the Task",
        (role) => {
            expect(
                canManageTaskWatch({
                    actorRole: role,
                    actorUserId: "actor-1",
                    targetCanViewTask: true,
                    targetUserId: "viewer-1",
                })
            ).toBe(true);
        }
    );

    it("Viewer cannot add or remove others' Watches", () => {
        expect(
            canManageTaskWatch({
                actorRole: "viewer",
                actorUserId: "viewer-1",
                targetCanViewTask: true,
                targetUserId: "contributor-1",
            })
        ).toBe(false);
    });

    it("rejects a target who cannot view the Task (non-Member)", () => {
        expect(
            canManageTaskWatch({
                actorRole: "contributor",
                actorUserId: "contributor-1",
                targetCanViewTask: false,
                targetUserId: "outsider-1",
            })
        ).toBe(false);
    });

    it.each([
        "owner",
        "admin",
        "manager",
        "contributor",
        "viewer",
    ] as const satisfies ProjectAccessRole[])(
        "%s can Watch or Unwatch themselves when they can view the Task",
        (role) => {
            expect(
                canManageTaskWatch({
                    actorRole: role,
                    actorUserId: "self-1",
                    targetCanViewTask: true,
                    targetUserId: "self-1",
                })
            ).toBe(true);
        }
    );

    it("denies manage when actor has no Role", () => {
        expect(
            canManageTaskWatch({
                actorRole: null,
                actorUserId: "nobody-1",
                targetCanViewTask: true,
                targetUserId: "viewer-1",
            })
        ).toBe(false);
    });
});
