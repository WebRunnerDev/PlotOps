import type { StateCreator } from "zustand";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
    clampSideDrawerWidth,
    DEFAULT_SIDE_DRAWER_WIDTH_PX,
    isTaskDrawerSide,
    type TaskDrawerSide,
} from "@/features/tasks/lib/resolve-task-drawer-placement";
import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

export const TASK_COPY_METADATA_FIELDS = [
    "status",
    "board",
    "priority",
    "estimate",
    "deadline",
    "author",
    "assignee",
    "labels",
    "sprint",
    "subtasks",
    "relatedTasks",
] as const;

export type TaskCopyMetadataField = (typeof TASK_COPY_METADATA_FIELDS)[number];

export type TaskCopyMetadataFields = Record<TaskCopyMetadataField, boolean>;

export const DEFAULT_COPY_METADATA_FIELDS: TaskCopyMetadataFields = {
    assignee: false,
    author: false,
    board: false,
    deadline: false,
    estimate: false,
    labels: false,
    priority: false,
    relatedTasks: false,
    sprint: false,
    status: false,
    subtasks: false,
};

export type TaskDrawerPreferencesState = {
    collapseLongDescription: boolean;
    copyIncludeTaskKey: boolean;
    copyIncludeTaskType: boolean;
    copyMetadataFields: TaskCopyMetadataFields;
    drawerSide: TaskDrawerSide;
    openAfterCreate: boolean;
    setCollapseLongDescription: (collapse: boolean) => void;
    setCopyIncludeTaskKey: (include: boolean) => void;
    setCopyIncludeTaskType: (include: boolean) => void;
    setCopyMetadataField: (
        field: TaskCopyMetadataField,
        include: boolean
    ) => void;
    setDrawerSide: (side: TaskDrawerSide) => void;
    setOpenAfterCreate: (open: boolean) => void;
    setSideDrawerWidthPx: (widthPx: number) => void;
    sideDrawerWidthPx: number;
};

export const createTaskDrawerPreferencesStoreState: StateCreator<
    TaskDrawerPreferencesState,
    [],
    [],
    TaskDrawerPreferencesState
> = (set) => ({
    collapseLongDescription: true,
    copyIncludeTaskKey: false,
    copyIncludeTaskType: false,
    copyMetadataFields: { ...DEFAULT_COPY_METADATA_FIELDS },
    drawerSide: "bottom",
    openAfterCreate: true,
    setCollapseLongDescription: (collapse) =>
        set({ collapseLongDescription: collapse }),
    setCopyIncludeTaskKey: (include) => set({ copyIncludeTaskKey: include }),
    setCopyIncludeTaskType: (include) => set({ copyIncludeTaskType: include }),
    setCopyMetadataField: (field, include) =>
        set((state) => ({
            copyMetadataFields: {
                ...state.copyMetadataFields,
                [field]: include,
            },
        })),
    setDrawerSide: (side) => set({ drawerSide: side }),
    setOpenAfterCreate: (open) => set({ openAfterCreate: open }),
    setSideDrawerWidthPx: (widthPx) =>
        set({ sideDrawerWidthPx: clampSideDrawerWidth(widthPx) }),
    sideDrawerWidthPx: DEFAULT_SIDE_DRAWER_WIDTH_PX,
});

const safeLocalStorage = {
    getItem: (name: string) => safeGetItem("localStorage", name),
    removeItem: (name: string) => {
        safeRemoveItem("localStorage", name);
    },
    setItem: (name: string, value: string) => {
        safeSetItem("localStorage", name, value);
    },
};

function mergeCopyMetadataFields(
    persisted: unknown,
    legacyIncludeAll: unknown
): TaskCopyMetadataFields {
    if (persisted && typeof persisted === "object") {
        const raw = persisted as Partial<Record<string, unknown>>;
        const next = { ...DEFAULT_COPY_METADATA_FIELDS };
        for (const field of TASK_COPY_METADATA_FIELDS) {
            if (typeof raw[field] === "boolean") {
                next[field] = raw[field];
            }
        }
        return next;
    }

    if (legacyIncludeAll === true) {
        return Object.fromEntries(
            TASK_COPY_METADATA_FIELDS.map((field) => [field, true])
        ) as TaskCopyMetadataFields;
    }

    return { ...DEFAULT_COPY_METADATA_FIELDS };
}

function mergeTaskDrawerPreferences(
    persisted: unknown,
    current: TaskDrawerPreferencesState
): TaskDrawerPreferencesState {
    const raw =
        persisted && typeof persisted === "object"
            ? (persisted as Partial<TaskDrawerPreferencesState> & {
                  copyIncludeTaskMetadata?: unknown;
              })
            : {};
    return {
        ...current,
        collapseLongDescription:
            typeof raw.collapseLongDescription === "boolean"
                ? raw.collapseLongDescription
                : current.collapseLongDescription,
        copyIncludeTaskKey:
            typeof raw.copyIncludeTaskKey === "boolean"
                ? raw.copyIncludeTaskKey
                : current.copyIncludeTaskKey,
        copyIncludeTaskType:
            typeof raw.copyIncludeTaskType === "boolean"
                ? raw.copyIncludeTaskType
                : current.copyIncludeTaskType,
        copyMetadataFields: mergeCopyMetadataFields(
            raw.copyMetadataFields,
            raw.copyIncludeTaskMetadata
        ),
        drawerSide: isTaskDrawerSide(raw.drawerSide)
            ? raw.drawerSide
            : current.drawerSide,
        openAfterCreate:
            typeof raw.openAfterCreate === "boolean"
                ? raw.openAfterCreate
                : current.openAfterCreate,
        sideDrawerWidthPx:
            typeof raw.sideDrawerWidthPx === "number"
                ? clampSideDrawerWidth(raw.sideDrawerWidthPx)
                : current.sideDrawerWidthPx,
    };
}

export const useTaskDrawerPreferencesStore =
    create<TaskDrawerPreferencesState>()(
        persist(createTaskDrawerPreferencesStoreState, {
            merge: mergeTaskDrawerPreferences,
            name: "plotops:task-drawer-preferences",
            partialize: (state) => ({
                collapseLongDescription: state.collapseLongDescription,
                copyIncludeTaskKey: state.copyIncludeTaskKey,
                copyIncludeTaskType: state.copyIncludeTaskType,
                copyMetadataFields: state.copyMetadataFields,
                drawerSide: state.drawerSide,
                openAfterCreate: state.openAfterCreate,
                sideDrawerWidthPx: state.sideDrawerWidthPx,
            }),
            storage: createJSONStorage(() => safeLocalStorage),
        })
    );

export { mergeCopyMetadataFields, mergeTaskDrawerPreferences };
