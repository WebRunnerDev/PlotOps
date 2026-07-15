import { create } from "zustand";

import type {
    BoardColumn,
    LabelColor,
    ProjectLabel,
    Task,
    TaskStatus,
} from "./types";

import { DEFAULT_KANBAN_COLUMNS, LABEL_COLORS } from "./constants";
import { buildSeedLabels, SEED_LABEL_DEFS } from "./mock-labels";
import { MOCK_TASKS } from "./mock-tasks";

type TaskDetailsUpdate = Partial<Omit<Task, "id" | "status">>;

type TasksState = {
    addColumn: (name?: string) => TaskStatus;
    addLabel: (
        projectId: string,
        name: string,
        color?: LabelColor,
    ) => string | undefined;
    addTask: (task: Task) => void;
    clearSelectedTask: () => void;
    columns: BoardColumn[];
    deleteColumn: (id: TaskStatus, moveTasksTo?: TaskStatus) => boolean;
    ensureProjectLabels: (projectId: string) => void;
    labels: ProjectLabel[];
    renameColumn: (id: TaskStatus, name: string) => boolean;
    reorderColumns: (activeId: TaskStatus, overId: TaskStatus) => void;
    selectedTaskId?: string;
    selectTask: (id: string) => void;
    tasks: Task[];
    toggleTaskLabel: (taskId: string, labelId: string) => void;
    updateTaskDetails: (id: string, details: TaskDetailsUpdate) => void;
    updateTaskStatus: (id: string, status: TaskStatus) => void;
};

function createColumnId(): TaskStatus {
    return `col_${crypto.randomUUID().slice(0, 8)}`;
}

function createLabelId(): string {
    return `lbl_${crypto.randomUUID().slice(0, 8)}`;
}

function isUniqueColumnName(
    columns: BoardColumn[],
    name: string,
    exceptId?: TaskStatus,
): boolean {
    const normalized = name.trim().toLowerCase();
    return !columns.some(
        (column) =>
            column.id !== exceptId &&
            column.name.trim().toLowerCase() === normalized,
    );
}

export const useTasksStore = create<TasksState>((set, get) => ({
    addColumn: (name) => {
        const columns = get().columns;
        const baseName = name?.trim() || "New status";
        let nextName = baseName;
        let suffix = 2;

        while (!isUniqueColumnName(columns, nextName)) {
            nextName = `${baseName} ${suffix}`;
            suffix += 1;
        }

        const id = createColumnId();
        set((state) => ({
            columns: [...state.columns, { id, name: nextName }],
        }));
        return id;
    },

    addLabel: (projectId, name, color) => {
        const trimmed = name.trim();
        if (!trimmed) return;

        const projectLabels = get().labels.filter(
            (label) => label.projectId === projectId,
        );
        const duplicate = projectLabels.some(
            (label) => label.name.toLowerCase() === trimmed.toLowerCase(),
        );
        if (duplicate) return;

        const id = createLabelId();
        const nextColor =
            color ?? LABEL_COLORS[projectLabels.length % LABEL_COLORS.length]!;

        set((state) => ({
            labels: [
                ...state.labels,
                { color: nextColor, id, name: trimmed, projectId },
            ],
        }));
        return id;
    },

    addTask: (task) =>
        set((state) => ({
            tasks: [...state.tasks, task],
        })),

    clearSelectedTask: () => set({ selectedTaskId: undefined }),

    columns: DEFAULT_KANBAN_COLUMNS,

    deleteColumn: (id, moveTasksTo) => {
        const { columns, tasks } = get();
        if (columns.length <= 1) return false;
        if (!columns.some((column) => column.id === id)) return false;

        const hasTasks = tasks.some((task) => task.status === id);
        if (hasTasks) {
            if (!moveTasksTo || moveTasksTo === id) return false;
            if (!columns.some((column) => column.id === moveTasksTo)) {
                return false;
            }
        }

        set((state) => ({
            columns: state.columns.filter((column) => column.id !== id),
            tasks: hasTasks
                ? state.tasks.map((task) =>
                      task.status === id
                          ? { ...task, status: moveTasksTo }
                          : task,
                  )
                : state.tasks,
        }));
        return true;
    },

    ensureProjectLabels: (projectId) => {
        const hasForProject = get().labels.some(
            (label) => label.projectId === projectId,
        );
        if (hasForProject) return;

        const seedIdsTaken = get().labels.some((label) =>
            SEED_LABEL_DEFS.some((seed) => seed.id === label.id),
        );

        if (!seedIdsTaken) {
            set((state) => ({
                labels: [...state.labels, ...buildSeedLabels(projectId)],
            }));
            return;
        }

        set((state) => ({
            labels: [
                ...state.labels,
                ...SEED_LABEL_DEFS.map((seed) => ({
                    color: seed.color,
                    id: createLabelId(),
                    name: seed.name,
                    projectId,
                })),
            ],
        }));
    },

    labels: [],

    renameColumn: (id, name) => {
        const trimmed = name.trim();
        if (!trimmed) return false;

        const { columns } = get();
        if (!columns.some((column) => column.id === id)) return false;
        if (!isUniqueColumnName(columns, trimmed, id)) return false;

        set((state) => ({
            columns: state.columns.map((column) =>
                column.id === id ? { ...column, name: trimmed } : column,
            ),
        }));
        return true;
    },

    reorderColumns: (activeId, overId) => {
        if (activeId === overId) return;

        set((state) => {
            const oldIndex = state.columns.findIndex(
                (column) => column.id === activeId,
            );
            const newIndex = state.columns.findIndex(
                (column) => column.id === overId,
            );
            if (oldIndex === -1 || newIndex === -1) return state;

            const next = [...state.columns];
            const [moved] = next.splice(oldIndex, 1);
            if (!moved) return state;
            next.splice(newIndex, 0, moved);
            return { columns: next };
        });
    },

    selectedTaskId: undefined,

    selectTask: (id) => set({ selectedTaskId: id }),

    tasks: MOCK_TASKS,

    toggleTaskLabel: (taskId, labelId) =>
        set((state) => ({
            tasks: state.tasks.map((task) => {
                if (task.id !== taskId) return task;
                const current = task.labelIds ?? [];
                const next = current.includes(labelId)
                    ? current.filter((id) => id !== labelId)
                    : [...current, labelId];
                return {
                    ...task,
                    labelIds: next.length > 0 ? next : undefined,
                };
            }),
        })),

    updateTaskDetails: (id, details) =>
        set((state) => ({
            tasks: state.tasks.map((task) =>
                task.id === id ? { ...task, ...details } : task,
            ),
        })),

    updateTaskStatus: (id, status) => {
        const columnExists = get().columns.some(
            (column) => column.id === status,
        );
        if (!columnExists) return;

        set((state) => ({
            tasks: state.tasks.map((task) =>
                task.id === id ? { ...task, status } : task,
            ),
        }));
    },
}));
