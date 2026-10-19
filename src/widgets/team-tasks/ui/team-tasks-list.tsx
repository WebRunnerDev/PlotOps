import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
    type RefObject,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";

import type { TeamTask } from "@/features/tasks";
import type { TeamTasksGroup } from "@/widgets/team-tasks/model/team-tasks-view";

import { cn } from "@/shared/lib/utils";

import { TEAM_TASK_GRID_CLASS, TeamTaskRow } from "./team-task-row";

type ListItem =
    | { group: TeamTasksGroup; id: string; kind: "group" }
    | { id: string; kind: "task"; task: TeamTask };

type TeamTasksListProperties = {
    groups: TeamTasksGroup[];
};

/** One-line desktop row; stacked rows on small screens are measured on mount. */
const ROW_ESTIMATE_PX = 44;

const GROUP_ESTIMATE_PX = 37;

const ROW_OVERSCAN = 12;

/**
 * Grouped Team Tasks rows. Group headers and rows share one flat, window-
 * virtualized list, so a Team with thousands of Tasks stays cheap to scroll.
 */
export function TeamTasksList({ groups }: TeamTasksListProperties) {
    const { t } = useTranslation("board");
    const listReference = useRef<HTMLUListElement>(null);
    const scrollMargin = useWindowScrollMargin(listReference);

    const items = useMemo<ListItem[]>(
        () =>
            groups.flatMap((group) => [
                ...(group.kind === "none"
                    ? []
                    : [
                          {
                              group,
                              id: `group:${group.key}`,
                              kind: "group" as const,
                          },
                      ]),
                ...group.tasks.map((task) => ({
                    id: task.id,
                    kind: "task" as const,
                    task,
                })),
            ]),
        [groups]
    );

    const virtualizer = useWindowVirtualizer({
        count: items.length,
        estimateSize: (index) =>
            items[index]?.kind === "group"
                ? GROUP_ESTIMATE_PX
                : ROW_ESTIMATE_PX,
        getItemKey: (index) => items[index]?.id ?? index,
        overscan: ROW_OVERSCAN,
        scrollMargin,
    });

    return (
        // Own surface: rows on the bare page background blend into it. No
        // bottom border — the last row draws it.
        <div className="flex min-w-0 flex-col border-x border-t border-border bg-card">
            <div
                aria-hidden
                // Template string, not cn(): tailwind-merge would drop
                // `text-meta` as a colour conflicting with the muted text.
                // Sticks under the TopBar (`sm:h-12`) so columns stay labelled.
                className={`hidden border-b border-border bg-muted px-3 py-2 text-meta text-muted-foreground lg:sticky lg:top-12 lg:z-10 ${TEAM_TASK_GRID_CLASS}`}
            >
                <span>{t("teamTasks.columns.task")}</span>
                <span>{t("fields.title")}</span>
                <span>{t("teamTasks.columns.project")}</span>
                <span>{t("fields.board")}</span>
                <span>{t("fields.status")}</span>
                <span>{t("fields.assignee")}</span>
                <span>{t("fields.priority")}</span>
                <span>{t("fields.deadline")}</span>
            </div>

            <ul
                className="relative"
                ref={listReference}
                style={{ height: virtualizer.getTotalSize() }}
            >
                {virtualizer.getVirtualItems().map((row) => {
                    const item = items[row.index];
                    if (!item) return;
                    return (
                        <li
                            className={cn(
                                "absolute inset-x-0 top-0",
                                item.kind === "task" && "border-b border-border"
                            )}
                            data-index={row.index}
                            key={row.key}
                            ref={virtualizer.measureElement}
                            style={{
                                transform: `translateY(${row.start - scrollMargin}px)`,
                            }}
                        >
                            {item.kind === "group" ? (
                                <GroupHeader group={item.group} />
                            ) : (
                                <TeamTaskRow task={item.task} />
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

function GroupHeader({ group }: { group: TeamTasksGroup }) {
    const { t } = useTranslation("board");

    return (
        <div className="flex min-w-0 items-baseline gap-2 border-b border-border bg-muted/60 px-3 py-2 shadow-[inset_3px_0_0_0_var(--primary)]">
            <h2 className="min-w-0 truncate text-ui text-foreground">
                {groupLabel(group, t)}
            </h2>
            <span className="shrink-0 font-mono text-code text-muted-foreground tabular-nums">
                {group.tasks.length}
            </span>
        </div>
    );
}

function groupLabel(group: TeamTasksGroup, t: (key: string) => string): string {
    if (group.label !== undefined) return group.label;
    if (group.kind === "deadline") {
        return t(`filters.deadline.${group.key}`);
    }
    return t("fields.memberNone");
}

/**
 * Document offset of the list top. The window owns the scrollbar here, so the
 * virtualizer needs it to line its window up with rows below the page header.
 */
function useWindowScrollMargin(
    listReference: RefObject<HTMLElement | null>
): number {
    const [scrollMargin, setScrollMargin] = useState(0);

    // Every render: the header and toolbar above the list can change height
    // (wrapping filters, alerts) without resizing the list itself.
    useLayoutEffect(() => {
        const list = listReference.current;
        if (!list) return;
        const next = list.getBoundingClientRect().top + globalThis.scrollY;
        // Only a real shift re-renders — otherwise this effect would loop.
        setScrollMargin((current) =>
            Math.abs(current - next) < 1 ? current : next
        );
    });

    return scrollMargin;
}
