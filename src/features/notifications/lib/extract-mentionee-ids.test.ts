import { describe, expect, it } from "vitest";

import { extractMentioneeIds, newMentioneeIds } from "./extract-mentionee-ids";

describe("extractMentioneeIds", () => {
    it("extracts Mentionee ids from structured TipTap Mention nodes", () => {
        expect(
            extractMentioneeIds(
                `<p>Hey <span data-type="mention" data-id="user-1" data-label="Ada">@Ada</span></p>`
            )
        ).toEqual(["user-1"]);
    });

    it("dedupes the same Mentionee mentioned twice in one body", () => {
        expect(
            extractMentioneeIds(
                `<p><span data-type="mention" class="mention" data-id="user-1" data-label="Ada">@Ada</span> and <span data-id="user-1" data-type="mention" data-label="Ada">@Ada</span></p>`
            )
        ).toEqual(["user-1"]);
    });

    it("ignores free-text @Name that is not a structured Mention", () => {
        expect(extractMentioneeIds("<p>Ping @Ada please</p>")).toEqual([]);
    });

    it("returns empty for blank or non-HTML bodies", () => {
        expect(extractMentioneeIds("")).toEqual([]);
        expect(extractMentioneeIds("plain text")).toEqual([]);
    });
});

describe("newMentioneeIds", () => {
    it("returns only Mentionees newly added vs the previous body", () => {
        expect(
            newMentioneeIds(
                `<p><span data-type="mention" data-id="user-1" data-label="Ada">@Ada</span></p>`,
                `<p><span data-type="mention" data-id="user-1" data-label="Ada">@Ada</span> <span data-type="mention" data-id="user-2" data-label="Bob">@Bob</span></p>`
            )
        ).toEqual(["user-2"]);
    });

    it("returns empty when Mentionees are unchanged across an edit", () => {
        const body = `<p><span data-type="mention" data-id="user-1" data-label="Ada">@Ada</span></p>`;
        expect(newMentioneeIds(body, body)).toEqual([]);
    });

    it("treats re-adding a removed Mentionee as new", () => {
        expect(
            newMentioneeIds(
                `<p>no mentions</p>`,
                `<p><span data-type="mention" data-id="user-1" data-label="Ada">@Ada</span></p>`
            )
        ).toEqual(["user-1"]);
    });

    it("does not re-notify when only display label changes for the same Mentionee", () => {
        expect(
            newMentioneeIds(
                `<p><span data-type="mention" data-id="user-1" data-label="Ada">@Ada</span></p>`,
                `<p><span data-type="mention" data-id="user-1" data-label="Ada Lovelace">@Ada Lovelace</span></p>`
            )
        ).toEqual([]);
    });
});
