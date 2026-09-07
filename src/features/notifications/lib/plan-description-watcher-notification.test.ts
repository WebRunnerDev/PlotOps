import { describe, expect, it } from "vitest";

import { planDescriptionWatcherNotification } from "./plan-description-watcher-notification";

describe("planDescriptionWatcherNotification", () => {
    it("plans description_change for Watchers when Description changes", () => {
        expect(
            planDescriptionWatcherNotification({
                nextBody: "<p>Updated</p>",
                previousBody: "<p>Old</p>",
            })
        ).toEqual({
            kind: "description_change",
            metadata: { source: "app" },
        });
    });

    it("excludes new Mentionees so they get mention only", () => {
        expect(
            planDescriptionWatcherNotification({
                mentioneeIds: ["u-mentionee", "u-other"],
                nextBody:
                    '<p>Hi <span data-type="mention" data-id="u-mentionee"></span></p>',
                previousBody: "<p>Hi</p>",
            })
        ).toEqual({
            excludeRecipientIds: ["u-mentionee", "u-other"],
            kind: "description_change",
            metadata: { source: "app" },
        });
    });

    it("plans description_change with no Mentionee excludes when none are new", () => {
        expect(
            planDescriptionWatcherNotification({
                mentioneeIds: [],
                nextBody: "<p>Updated</p>",
                previousBody: "<p>Old</p>",
            })
        ).toEqual({
            kind: "description_change",
            metadata: { source: "app" },
        });
    });

    it("plans nothing when Description body is unchanged", () => {
        expect(
            planDescriptionWatcherNotification({
                mentioneeIds: ["u-mentionee"],
                nextBody: "<p>Same</p>",
                previousBody: "<p>Same</p>",
            })
        ).toBeUndefined();
    });
});
