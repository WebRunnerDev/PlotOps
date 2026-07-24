import { describe, expect, it } from "vitest";

import { mapActionsStatus } from "@/features/ci-cd/model/map-actions-status";

describe("mapActionsStatus", () => {
    it("maps completed success to success", () => {
        expect(mapActionsStatus("completed", "success")).toBe("success");
    });

    it("maps completed failure and cancelled to failure", () => {
        expect(mapActionsStatus("completed", "failure")).toBe("failure");
        expect(mapActionsStatus("completed", "cancelled")).toBe("failure");
        expect(mapActionsStatus("completed", "timed_out")).toBe("failure");
    });

    it("maps in_progress to running", () => {
        expect(mapActionsStatus("in_progress")).toBe("running");
    });

    it("maps queued / pending / requested to queued", () => {
        expect(mapActionsStatus("queued")).toBe("queued");
        expect(mapActionsStatus("pending")).toBe("queued");
        expect(mapActionsStatus("requested")).toBe("queued");
        expect(mapActionsStatus("waiting")).toBe("queued");
    });
});
