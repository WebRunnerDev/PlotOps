import { describe, expect, it } from "vitest";

import { resolveBoardPagePresence } from "./resolve-board-page-presence";

const project = { id: "proj-1" };
const board = { baseBranch: "main", id: "board-1" };

describe("resolveBoardPagePresence", () => {
    it("stays on project loading before project settles", () => {
        expect(
            resolveBoardPagePresence({
                boardId: "board-1",
                boards: [],
                boardsError: false,
                boardsLoading: true,
                project: undefined,
                projectError: false,
                projectLoading: true,
            })
        ).toEqual({ kind: "project-loading" });
    });

    it("reports project error when the project is missing", () => {
        expect(
            resolveBoardPagePresence({
                boardId: "board-1",
                boards: [],
                boardsError: false,
                boardsLoading: false,
                project: null,
                projectError: false,
                projectLoading: false,
            })
        ).toEqual({ kind: "project-error" });
    });

    it("keeps boards loading instead of mounting an unverified board", () => {
        expect(
            resolveBoardPagePresence({
                boardId: "board-1",
                boards: [],
                boardsError: false,
                boardsLoading: true,
                project,
                projectError: false,
                projectLoading: false,
            })
        ).toEqual({ kind: "boards-loading" });
    });

    it("reports boards error when the boards query failed", () => {
        expect(
            resolveBoardPagePresence({
                boardId: "board-1",
                boards: [],
                boardsError: true,
                boardsLoading: false,
                project,
                projectError: false,
                projectLoading: false,
            })
        ).toEqual({ kind: "boards-error" });
    });

    it("reports board-not-found when the id is missing after settle", () => {
        expect(
            resolveBoardPagePresence({
                boardId: "missing",
                boards: [board],
                boardsError: false,
                boardsLoading: false,
                project,
                projectError: false,
                projectLoading: false,
            })
        ).toEqual({ kind: "board-not-found" });
    });

    it("reports ready with the resolved board", () => {
        expect(
            resolveBoardPagePresence({
                boardId: "board-1",
                boards: [board],
                boardsError: false,
                boardsLoading: false,
                project,
                projectError: false,
                projectLoading: false,
            })
        ).toEqual({ currentBoard: board, kind: "ready" });
    });
});
