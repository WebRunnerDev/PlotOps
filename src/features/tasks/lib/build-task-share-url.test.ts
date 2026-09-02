import { describe, expect, it } from "vitest";

import { buildTaskShareUrl } from "./build-task-share-url";

describe("buildTaskShareUrl", () => {
    it("builds a short project slug + task key link", () => {
        expect(
            buildTaskShareUrl({
                origin: "https://app.plotops.dev",
                projectSlug: "plotops-demo",
                taskKey: "TASK-103",
            })
        ).toBe("https://app.plotops.dev/projects/plotops-demo/tasks/TASK-103");
    });

    it("encodes unsafe slug and key segments", () => {
        expect(
            buildTaskShareUrl({
                origin: "https://app.plotops.dev",
                projectSlug: "acme/widgets",
                taskKey: "BUG 1",
            })
        ).toBe("https://app.plotops.dev/projects/acme%2Fwidgets/tasks/BUG%201");
    });
});
