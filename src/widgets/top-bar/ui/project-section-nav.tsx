import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import {
    readLastBoardId,
    useProjectBoards,
    writeLastBoardId,
} from "@/features/boards";
import { cn } from "@/shared/lib/utils";
import { buttonVariants } from "@/shared/shadcn/ui/button";
import { resolveSectionNavBoardId } from "@/widgets/top-bar/model/resolve-section-nav-board-id";

type ProjectSection = "backlog" | "board" | "cicd" | "settings";

type ProjectSectionNavProperties = {
    boardId?: string;
    projectId: string;
};

type SectionNavItem = {
    id: ProjectSection;
    label: string;
    labelShort: string;
    params: { boardId: string; projectId: string } | { projectId: string };
    to:
        | "/projects/$projectId/boards/$boardId"
        | "/projects/$projectId/boards/$boardId/backlog"
        | "/projects/$projectId/ci-cd"
        | "/projects/$projectId/settings";
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
    const {
        data: boards = [],
        isError,
        isPending,
    } = useProjectBoards(projectId);

    useEffect(() => {
        if (boardIdFromRoute) {
            writeLastBoardId(projectId, boardIdFromRoute);
        }
    }, [boardIdFromRoute, projectId]);

    const boardId = resolveSectionNavBoardId({
        boardIdFromRoute,
        boards,
        rememberedBoardId: readLastBoardId(projectId) ?? undefined,
        status: isPending ? "pending" : isError ? "error" : "success",
    });
    const active = resolveSection(pathname);

    const items: SectionNavItem[] = [
        ...(boardId
            ? [
                  {
                      id: "board" as const,
                      label: t("nav.board"),
                      labelShort: t("nav.boardShort"),
                      params: { boardId, projectId },
                      to: "/projects/$projectId/boards/$boardId" as const,
                  },
                  {
                      id: "backlog" as const,
                      label: t("nav.backlog"),
                      labelShort: t("nav.backlogShort"),
                      params: { boardId, projectId },
                      to: "/projects/$projectId/boards/$boardId/backlog" as const,
                  },
              ]
            : []),
        {
            id: "cicd",
            label: t("nav.cicd"),
            labelShort: t("nav.cicdShort"),
            params: { projectId },
            to: "/projects/$projectId/ci-cd",
        },
        {
            id: "settings",
            label: t("nav.settings"),
            labelShort: t("nav.settingsShort"),
            params: { projectId },
            to: "/projects/$projectId/settings",
        },
    ];

    return (
        <nav
            aria-label={t("nav.projectSections")}
            // overflow-x-auto + scrollbar-none: scrollable on mobile without
            // showing a native scrollbar; touch-auto enables iOS momentum scroll.
            className="flex min-w-0 max-w-full items-center gap-0.5 overflow-x-auto overflow-y-hidden touch-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
            {items.map((item) => {
                const isActive = active === item.id;
                return (
                    <Link
                        aria-current={isActive ? "page" : undefined}
                        aria-label={item.label}
                        className={cn(
                            buttonVariants({ size: "sm", variant: "ghost" }),
                            "shrink-0 text-muted-foreground",
                            // Inset ring stays inside the button so focus/press
                            // cannot inflate scrollable overflow in the header.
                            "focus-visible:ring-2 focus-visible:ring-inset",
                            "max-sm:px-2",
                            isActive &&
                                "bg-secondary text-secondary-foreground hover:bg-secondary hover:text-secondary-foreground"
                        )}
                        key={item.id}
                        params={item.params}
                        to={item.to}
                    >
                        <span className="xl:hidden">{item.labelShort}</span>
                        <span className="hidden xl:inline">{item.label}</span>
                    </Link>
                );
            })}
        </nav>
    );
}

function resolveSection(pathname: string): null | ProjectSection {
    if (pathname.includes("/ci-cd")) return "cicd";
    if (pathname.includes("/settings")) return "settings";
    if (pathname.includes("/backlog")) return "backlog";
    if (pathname.includes("/boards/")) return "board";
    return null;
}
