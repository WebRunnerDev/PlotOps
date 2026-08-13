import type { BoardsProvider } from "@/features/boards/api/boards-provider";
import type {
    BoardColumn,
    ProjectBoardRecord,
} from "@/features/boards/model/types";
import type { GuestBoard } from "@/features/guest-mode";

import { DEFAULT_KANBAN_COLUMNS } from "@/features/boards/model/constants";
import { getGuestSandbox, updateGuestSandbox } from "@/features/guest-mode";

function mapBoard(board: GuestBoard): ProjectBoardRecord {
    return {
        allowedHeadPatterns: [...board.allowedHeadPatterns],
        baseBranch: board.baseBranch,
        defaultTaskType: board.defaultTaskType ?? "task",
        id: board.id,
        name: board.name,
        position: board.position,
        projectId: board.projectId,
    };
}

function requireBoard(boardId: string): GuestBoard {
    const sandbox = getGuestSandbox();
    if (!sandbox) {
        throw new Error("No Guest Session");
    }
    const board = sandbox.boards.find((item) => item.id === boardId);
    if (!board) {
        throw new Error("Board not found");
    }
    return board;
}

function sortedColumns(board: GuestBoard): GuestBoard["columns"] {
    return [...board.columns].toSorted((a, b) => a.position - b.position);
}

/** Guest Mode Boards adapter — reads/writes the local sandbox; never calls Supabase. */
export const guestBoardsProvider: BoardsProvider = {
    async boardHasTasks(boardId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            throw new Error("No Guest Session");
        }
        return sandbox.tasks.some((task) => task.boardId === boardId);
    },

    async createBoard(projectId, name, baseBranch) {
        let created: GuestBoard | undefined;

        updateGuestSandbox((sandbox) => {
            const projectBoards = sandbox.boards.filter(
                (board) => board.projectId === projectId
            );
            let maxPosition = -1;
            for (const board of projectBoards) {
                if (board.position > maxPosition) {
                    maxPosition = board.position;
                }
            }

            created = {
                allowedHeadPatterns: [],
                baseBranch: baseBranch.trim() || "main",
                columns: DEFAULT_KANBAN_COLUMNS.map((column, index) => ({
                    id: column.id,
                    isDone: column.isDone,
                    name: column.name,
                    position: index,
                })),
                defaultTaskType: "task",
                id: crypto.randomUUID(),
                name: name.trim() || "Board",
                position: maxPosition + 1,
                projectId,
            };
            sandbox.boards.push(created);
        });

        if (!created) {
            throw new Error("Failed to create board");
        }
        return mapBoard(created);
    },

    async createBoardColumn(_projectId, boardId, name) {
        const id = `col_${crypto.randomUUID().slice(0, 8)}`;

        updateGuestSandbox((sandbox) => {
            const board = sandbox.boards.find((item) => item.id === boardId);
            if (!board) {
                throw new Error("Board not found");
            }
            let maxPosition = -1;
            for (const column of board.columns) {
                if (column.position > maxPosition) {
                    maxPosition = column.position;
                }
            }
            board.columns.push({
                id,
                isDone: false,
                name,
                position: maxPosition + 1,
            });
        });

        return id;
    },

    async deleteBoard(boardId) {
        updateGuestSandbox((sandbox) => {
            const index = sandbox.boards.findIndex(
                (board) => board.id === boardId
            );
            if (index === -1) {
                throw new Error("Board not found");
            }
            sandbox.boards.splice(index, 1);
            sandbox.tasks = sandbox.tasks.filter(
                (task) => task.boardId !== boardId
            );
            sandbox.sprints = sandbox.sprints.filter(
                (sprint) => sprint.boardId !== boardId
            );
        });
    },

    async deleteBoardColumn(boardId, columnId, moveTasksTo) {
        updateGuestSandbox((sandbox) => {
            const board = sandbox.boards.find((item) => item.id === boardId);
            if (!board) {
                throw new Error("Board not found");
            }
            if (board.columns.length <= 1) {
                throw new Error("Cannot delete the last board column");
            }
            if (!board.columns.some((column) => column.id === columnId)) {
                throw new Error("Column not found");
            }
            if (moveTasksTo) {
                if (
                    !board.columns.some((column) => column.id === moveTasksTo)
                ) {
                    throw new Error("Move target column not found");
                }
                for (const task of sandbox.tasks) {
                    if (
                        task.boardId === boardId &&
                        task.status === columnId &&
                        !task.archivedAt
                    ) {
                        task.status = moveTasksTo;
                    }
                }
            }

            board.columns = board.columns.filter(
                (column) => column.id !== columnId
            );
        });
    },

    async fetchBoard(boardId) {
        return mapBoard(requireBoard(boardId));
    },

    async fetchBoardColumnIds(boardId) {
        return sortedColumns(requireBoard(boardId)).map((column) => column.id);
    },

    async fetchBoardColumns(_projectId, boardId) {
        return sortedColumns(requireBoard(boardId)).map(
            (column): BoardColumn => ({
                id: column.id,
                isDone: Boolean(column.isDone),
                name: column.name,
            })
        );
    },

    async fetchBoardColumnSummaries(boardId) {
        return guestBoardsProvider.fetchBoardColumns("", boardId);
    },

    async fetchProjectBoards(projectId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            throw new Error("No Guest Session");
        }
        return [...sandbox.boards]
            .filter((board) => board.projectId === projectId)
            .toSorted((a, b) => a.position - b.position)
            .map((board) => mapBoard(board));
    },

    async renameBoardColumn(boardId, columnId, name) {
        updateGuestSandbox((sandbox) => {
            const board = sandbox.boards.find((item) => item.id === boardId);
            if (!board) {
                throw new Error("Board not found");
            }
            const column = board.columns.find((item) => item.id === columnId);
            if (!column) {
                throw new Error("Column not found");
            }
            column.name = name;
        });
    },

    async reorderBoardColumns(boardId, columnIds) {
        updateGuestSandbox((sandbox) => {
            const board = sandbox.boards.find((item) => item.id === boardId);
            if (!board) {
                throw new Error("Board not found");
            }
            const byId = new Map(
                board.columns.map((column) => [column.id, column])
            );
            if (
                columnIds.length !== board.columns.length ||
                columnIds.some((id) => !byId.has(id))
            ) {
                throw new Error("Invalid column reorder");
            }
            board.columns = columnIds.map((id, index) => ({
                ...byId.get(id)!,
                position: index,
            }));
        });
    },

    async setBoardDoneColumn(boardId, columnId) {
        updateGuestSandbox((sandbox) => {
            const board = sandbox.boards.find((item) => item.id === boardId);
            if (!board) {
                throw new Error("Board not found");
            }
            if (
                columnId !== null &&
                !board.columns.some((column) => column.id === columnId)
            ) {
                throw new Error("Column not found");
            }
            for (const column of board.columns) {
                column.isDone = column.id === columnId;
            }
        });
    },

    async updateBoard(boardId, patch) {
        let updated: GuestBoard | undefined;

        updateGuestSandbox((sandbox) => {
            const board = sandbox.boards.find((item) => item.id === boardId);
            if (!board) {
                throw new Error("Board not found");
            }
            if (patch.name !== undefined) {
                board.name = patch.name;
            }
            if (patch.base_branch !== undefined) {
                board.baseBranch = patch.base_branch;
            }
            if (patch.allowed_head_patterns !== undefined) {
                board.allowedHeadPatterns = [...patch.allowed_head_patterns];
            }
            if (patch.default_task_type !== undefined) {
                board.defaultTaskType = patch.default_task_type;
            }
            if (patch.position !== undefined) {
                board.position = patch.position;
            }
            updated = board;
        });

        if (!updated) {
            throw new Error("Board not found");
        }
        return mapBoard(updated);
    },
};
