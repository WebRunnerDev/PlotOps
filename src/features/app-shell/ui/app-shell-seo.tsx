import { useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { useProjectBoards } from "@/features/boards";
import { useProject } from "@/features/projects";
import { useTeam } from "@/features/teams/model/use-team-members";
import {
    appShellPageNeedsBoard,
    appShellPageNeedsProject,
    appShellPageNeedsTeam,
    parseAppShellPath,
} from "@/shared/lib/app-shell-page";
import { buildAppShellSeo } from "@/shared/lib/page-seo-config";
import { usePageSeo } from "@/shared/lib/use-page-seo";

type AppShellSeoProperties = {
    notFound?: boolean;
};

/** Keeps `<title>` in sync with the current app page (board name, section, etc.). */
export function AppShellSeo({ notFound = false }: AppShellSeoProperties) {
    const { t } = useTranslation("common");
    const path = useRouterState({
        select: (state) => state.location.pathname,
    });
    const taskFromSearch = useRouterState({
        select: (state) => readTaskSearchKey(state.location.search),
    });

    const page = notFound
        ? { kind: "not-found" as const }
        : parseAppShellPath(path);

    const projectId = "projectId" in page ? page.projectId : "";
    const boardId = "boardId" in page ? page.boardId : "";
    const teamId = "teamId" in page ? page.teamId : "";

    const { data: project } = useProject(
        appShellPageNeedsProject(page) ? projectId : ""
    );
    const { data: boards } = useProjectBoards(
        appShellPageNeedsBoard(page) ? projectId : ""
    );
    const { data: team } = useTeam(appShellPageNeedsTeam(page) ? teamId : "");

    const boardName = boards?.find((board) => board.id === boardId)?.name;
    const taskKey =
        page.kind === "task"
            ? page.taskKey
            : page.kind === "board"
              ? taskFromSearch
              : undefined;

    usePageSeo(
        buildAppShellSeo(path, {
            entities: {
                boardName,
                projectName: project?.name,
                taskKey,
                teamName: team?.name,
            },
            labels: {
                about: t("seo.about"),
                accountSettings: t("platformSettings"),
                backlog: t("nav.backlog"),
                board: t("nav.board"),
                cicd: t("nav.cicd"),
                completeProfile: t("seo.completeProfile"),
                dashboard: t("seo.dashboard"),
                home: t("nav.home"),
                invite: t("seo.invite"),
                notFound: t("notFound.title"),
                notifications: t("nav.notifications"),
                settings: t("nav.settings"),
            },
            notFound,
        })
    );

    return null;
}

function readTaskSearchKey(search: unknown): string | undefined {
    if (!search || typeof search !== "object" || !("task" in search)) {
        return undefined;
    }
    const task = search.task;
    if (typeof task !== "string") {
        return undefined;
    }
    const trimmed = task.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
