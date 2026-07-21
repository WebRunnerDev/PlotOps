import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
    TaskActivityChange,
    TaskActivityEvent,
    TaskActivityField,
} from "@/features/tasks/model/types";

import {
    useTaskActivity,
} from "@/features/tasks/model/use-task-activity";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/shared/shadcn/ui/avatar";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/shared/shadcn/ui/collapsible";
import { Spinner } from "@/shared/shadcn/ui/spinner";

type TaskActivitySectionProperties = {
    onOpenChange: (open: boolean) => void;
    open: boolean;
    taskId: string;
};

type Translate = (key: string, options?: Record<string, unknown>) => string;

export function TaskActivitySection({
    onOpenChange,
    open,
    taskId,
}: TaskActivitySectionProperties) {
    const { i18n, t } = useTranslation("board");
    const { data: events = [], isFetching, isLoading } = useTaskActivity(
        taskId,
        open,
    );

    const showSpinner = open && (isLoading || (isFetching && events.length === 0));

    return (
        <Collapsible onOpenChange={onOpenChange} open={open}>
            <section className="flex flex-col gap-3">
                <CollapsibleTrigger className="group flex w-full items-center gap-2 text-left">
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-data-panel-open:rotate-90" />
                    <h3 className="text-ui font-medium">{t("activity.title")}</h3>
                    {open && events.length > 0 ? (
                        <span className="text-meta text-muted-foreground">
                            ({events.length})
                        </span>
                    ) : undefined}
                </CollapsibleTrigger>

                <CollapsibleContent>
                    {showSpinner ? (
                        <Spinner className="size-5 text-primary" />
                    ) : (events.length === 0 ? (
                        <p className="text-ui text-muted-foreground">
                            {t("activity.empty")}
                        </p>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {events.map((event) => (
                                <li key={event.id}>
                                    <ActivityEventItem
                                        event={event}
                                        locale={i18n.language}
                                        t={t}
                                    />
                                </li>
                            ))}
                        </ul>
                    ))}
                </CollapsibleContent>
            </section>
        </Collapsible>
    );
}

function ActivityEventItem({
    event,
    locale,
    t,
}: {
    event: TaskActivityEvent;
    locale: string;
    t: Translate;
}) {
    const userName = event.user?.name ?? t("members.unknownUser");
    const changes = event.metadata.changes;

    return (
        <article className="flex gap-3 border border-border p-3">
            <Avatar className="size-8 shrink-0 rounded-none">
                {event.user?.avatarUrl ? (
                    <AvatarImage alt="" src={event.user.avatarUrl} />
                ) : undefined}
                <AvatarFallback className="rounded-none text-meta">
                    {initials(userName)}
                </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1 flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-ui font-medium">{userName}</p>
                    <time
                        className="text-meta text-muted-foreground"
                        dateTime={event.createdAt}
                    >
                        {formatTimestamp(event.createdAt, locale)}
                    </time>
                </div>

                {changes.length === 0 ? (
                    <p className="text-ui text-muted-foreground">
                        {t("activity.updated")}
                    </p>
                ) : (
                    <ul className="flex flex-col gap-0.5">
                        {changes.map((change) => (
                            <li
                                className="text-ui text-muted-foreground"
                                key={`${change.field}-${String(change.from)}-${String(change.to)}`}
                            >
                                {formatChangeSummary(change, t)}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </article>
    );
}

function asBoard(value: unknown): null | { name: string } {
    return asNamed(value);
}

function asNamed(value: unknown): null | { name: string } {
    if (!value || typeof value !== "object") return null;
    const name = (value as { name?: unknown }).name;
    return typeof name === "string" ? { name } : null;
}

function asPerson(value: unknown): null | { name: string } {
    return asNamed(value);
}

function asPr(value: unknown): null | { number: number; state: string } {
    if (!value || typeof value !== "object") return null;
    const number = (value as { number?: unknown }).number;
    const state = (value as { state?: unknown }).state;
    if (typeof number !== "number" || typeof state !== "string") return null;
    return { number, state };
}

function asStatus(value: unknown): null | { name: string } {
    return asNamed(value);
}

function asStringList(value: unknown): null | string[] {
    if (!Array.isArray(value)) return null;
    if (!value.every((item) => typeof item === "string")) return null;
    return value;
}

function displayScalar(
    value: unknown,
    emptyLabel: string,
): string {
    if (value === null || value === undefined || value === "") {
        return emptyLabel;
    }
    if (typeof value === "string" || typeof value === "number") {
        return String(value);
    }
    return emptyLabel;
}

function formatChangeSummary(
    change: TaskActivityChange,
    t: Translate,
): string {
    const fieldLabel = t(`activity.fields.${change.field as TaskActivityField}`);
    const none = t("activity.none");

    switch (change.field) {
        case "archived": {
            return change.to
                ? t("activity.change.archived")
                : t("activity.change.restored");
        }
        case "assignee": {
            const from = asPerson(change.from)?.name ?? none;
            const to = asPerson(change.to)?.name ?? none;
            return t("activity.change.fromTo", { field: fieldLabel, from, to });
        }
        case "board": {
            const from = asBoard(change.from)?.name ?? none;
            const to = asBoard(change.to)?.name ?? none;
            return t("activity.change.fromTo", { field: fieldLabel, from, to });
        }
        case "branch": {
            return t("activity.change.fromTo", {
                field: fieldLabel,
                from: displayScalar(change.from, none),
                to: displayScalar(change.to, none),
            });
        }
        case "deadline": {
            return t("activity.change.fromTo", {
                field: fieldLabel,
                from: displayScalar(change.from, none),
                to: displayScalar(change.to, none),
            });
        }
        case "labels": {
            const fromList = asStringList(change.from);
            const toList = asStringList(change.to);
            const from =
                fromList && fromList.length > 0
                    ? fromList.join(", ")
                    : none;
            const to =
                toList && toList.length > 0 ? toList.join(", ") : none;
            return t("activity.change.fromTo", { field: fieldLabel, from, to });
        }
        case "pr": {
            const fromPr = asPr(change.from);
            const toPr = asPr(change.to);
            const from = fromPr
                ? t("prLink", {
                      number: fromPr.number,
                      state: t(`prState.${fromPr.state}`, {
                          defaultValue: fromPr.state,
                      }),
                  })
                : none;
            const to = toPr
                ? t("prLink", {
                      number: toPr.number,
                      state: t(`prState.${toPr.state}`, {
                          defaultValue: toPr.state,
                      }),
                  })
                : none;
            return t("activity.change.fromTo", { field: fieldLabel, from, to });
        }
        case "priority": {
            const from =
                typeof change.from === "string"
                    ? t(`priority.${change.from}`)
                    : none;
            const to =
                typeof change.to === "string"
                    ? t(`priority.${change.to}`)
                    : none;
            return t("activity.change.fromTo", { field: fieldLabel, from, to });
        }
        case "status": {
            const from = asStatus(change.from)?.name ?? none;
            const to = asStatus(change.to)?.name ?? none;
            return t("activity.change.fromTo", { field: fieldLabel, from, to });
        }
        case "title": {
            return t("activity.change.fromTo", {
                field: fieldLabel,
                from: displayScalar(change.from, none),
                to: displayScalar(change.to, none),
            });
        }
        case "type": {
            const from =
                typeof change.from === "string"
                    ? t(`taskType.${change.from}`)
                    : none;
            const to =
                typeof change.to === "string"
                    ? t(`taskType.${change.to}`)
                    : none;
            return t("activity.change.fromTo", { field: fieldLabel, from, to });
        }
        default: {
            return fieldLabel;
        }
    }
}

function formatTimestamp(value: string, locale: string) {
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(new Date(value));
}

function initials(name: string) {
    const parts = name.trim().split(/[\s_-]+/).filter(Boolean);
    if (parts.length >= 2) {
        return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
}
