import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useProjectBoards } from "@/features/boards";
import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/shadcn/ui/button";

type ProjectSection = "backlog" | "board" | "cicd" | "settings";

type ProjectSectionNavProperties = {
    boardId?: string;
    projectId: string;
};

export function ProjectSectionNav({
    boardId: boardIdFromRoute,
    projectId,
}: ProjectSectionNavProperties) {
    const { t } = useTranslation("common");
    const pathname = useRouterState({
        select: (state) =>
            state.resolvedLocation?.pathname ?? state.location.pathname,
    });
    const { data: boards = [] } = useProjectBoards(projectId);

    useEffect(() => {
        if (boardIdFromRoute) {
            writeLastBoardId(projectId, boardIdFromRoute);
        }
    }, [boardIdFromRoute, projectId]);

    const remembered = boardIdFromRoute ?? readLastBoardId(projectId);
    const boardId =
        remembered &&
        (boards.length === 0 || boards.some((board) => board.id === remembered))
            ? remembered
            : boards[0]?.id;
    const active = resolveSection(pathname);

    if (!boardId) return null;

    const items: {
        id: ProjectSection;
        label: string;
        params: { boardId: string; projectId: string } | { projectId: string };
        to:
            | "/projects/$projectId/boards/$boardId/"
            | "/projects/$projectId/boards/$boardId/backlog"
            | "/projects/$projectId/ci-cd"
            | "/projects/$projectId/settings";
    }[] = [
        {
            id: "board",
            label: t("nav.board"),
            params: { boardId, projectId },
            to: "/projects/$projectId/boards/$boardId/",
        },
        {
            id: "backlog",
            label: t("nav.backlog"),
            params: { boardId, projectId },
            to: "/projects/$projectId/boards/$boardId/backlog",
        },
        {
            id: "cicd",
            label: t("nav.cicd"),
            params: { projectId },
            to: "/projects/$projectId/ci-cd",
        },
        {
            id: "settings",
            label: t("nav.settings"),
            params: { projectId },
            to: "/projects/$projectId/settings",
        },
    ];

    return (
        <nav
            aria-label={t("nav.projectSections")}
            className="flex items-center gap-0.5"
        >
            {items.map((item) => {
                const isActive = active === item.id;
                return (
                    <Link
                        aria-current={isActive ? "page" : undefined}
                        className={cn(
                            buttonVariants({ size: "sm", variant: "ghost" }),
                            "text-muted-foreground",
                            isActive &&
                                "bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground"
                        )}
                        key={item.id}
                        params={item.params}
                        to={item.to}
                    >
                        {item.label}
                    </Link>
                );
            })}
        </nav>
    );
}

function lastBoardStorageKey(projectId: string) {
    return `plotops:lastBoard:${projectId}`;
}

function readLastBoardId(projectId: string): string | undefined {
    try {
        return (
            sessionStorage.getItem(lastBoardStorageKey(projectId)) ?? undefined
        );
    } catch {
        return undefined;
    }
}

function resolveSection(pathname: string): null | ProjectSection {
    if (pathname.includes("/ci-cd")) return "cicd";
    if (pathname.includes("/settings")) return "settings";
    if (pathname.includes("/backlog")) return "backlog";
    if (pathname.includes("/boards/")) return "board";
    return null;
}

function writeLastBoardId(projectId: string, boardId: string) {
    try {
        sessionStorage.setItem(lastBoardStorageKey(projectId), boardId);
    } catch {
        // ignore quota / private mode
    }
}
