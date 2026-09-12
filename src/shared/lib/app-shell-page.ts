import { PLOTOPS_SITE_NAME, PLOTOPS_SITE_TAGLINE } from "@/shared/config/site";

export type AppShellPageKind =
    | "about"
    | "backlog"
    | "board"
    | "ci-cd"
    | "complete-profile"
    | "dashboard"
    | "home"
    | "invite"
    | "not-found"
    | "notifications"
    | "project"
    | "project-settings"
    | "settings"
    | "task"
    | "team"
    | "team-settings"
    | "unknown";

export type AppShellSeoEntities = {
    boardName?: string;
    projectName?: string;
    taskKey?: string;
    teamName?: string;
};

export type AppShellSeoLabels = {
    about: string;
    accountSettings: string;
    backlog: string;
    board: string;
    cicd: string;
    completeProfile: string;
    dashboard: string;
    home: string;
    invite: string;
    notFound: string;
    notifications: string;
    settings: string;
};

export type BuildAppShellTitleOptions = {
    entities?: AppShellSeoEntities;
    labels?: AppShellSeoLabels;
    notFound?: boolean;
};

export type ParsedAppShellPage =
    | { boardId: string; kind: "backlog"; projectId: string }
    | { boardId: string; kind: "board"; projectId: string }
    | { kind: "about" }
    | { kind: "ci-cd"; projectId: string }
    | { kind: "complete-profile" }
    | { kind: "dashboard" }
    | { kind: "home" }
    | { kind: "invite" }
    | { kind: "not-found" }
    | { kind: "notifications" }
    | { kind: "project"; projectId: string }
    | { kind: "project-settings"; projectId: string }
    | { kind: "settings" }
    | { kind: "task"; projectId: string; taskKey: string }
    | { kind: "team"; teamId: string }
    | { kind: "team-settings"; teamId: string }
    | { kind: "unknown" };

export function appShellPageNeedsBoard(page: ParsedAppShellPage): boolean {
    return page.kind === "backlog" || page.kind === "board";
}

export function appShellPageNeedsProject(page: ParsedAppShellPage): boolean {
    return (
        page.kind === "ci-cd" ||
        page.kind === "project" ||
        page.kind === "project-settings"
    );
}

export function appShellPageNeedsTeam(page: ParsedAppShellPage): boolean {
    return page.kind === "team" || page.kind === "team-settings";
}

export function formatAppShellDocumentTitle(parts: string[]): string {
    const cleaned = parts.map((part) => part.trim()).filter(Boolean);
    if (cleaned.length === 0) {
        return `${PLOTOPS_SITE_NAME} — ${PLOTOPS_SITE_TAGLINE}`;
    }
    return `${cleaned.join(" · ")} — ${PLOTOPS_SITE_NAME}`;
}

/** Strip trailing slashes except for `/`. */
export function normalizeAppShellPath(pathname: string): string {
    if (pathname === "/") {
        return pathname;
    }
    return pathname.replace(/\/+$/, "") || "/";
}

export function parseAppShellPath(pathname: string): ParsedAppShellPage {
    const path = normalizeAppShellPath(pathname);

    if (path === "/home") return { kind: "home" };
    if (path === "/about") return { kind: "about" };
    if (path === "/settings") return { kind: "settings" };
    if (path === "/notifications") return { kind: "notifications" };
    if (path === "/dashboard") return { kind: "dashboard" };
    if (path === "/complete-profile") return { kind: "complete-profile" };

    let match = /^\/invite\/[^/]+$/.exec(path);
    if (match) return { kind: "invite" };

    match = /^\/teams\/([^/]+)\/settings$/.exec(path);
    if (match?.[1]) {
        return { kind: "team-settings", teamId: match[1] };
    }

    match = /^\/teams\/([^/]+)$/.exec(path);
    if (match?.[1]) {
        return { kind: "team", teamId: match[1] };
    }

    match = /^\/projects\/([^/]+)\/boards\/([^/]+)\/backlog$/.exec(path);
    if (match?.[1] && match[2]) {
        return {
            boardId: match[2],
            kind: "backlog",
            projectId: match[1],
        };
    }

    match = /^\/projects\/([^/]+)\/boards\/([^/]+)$/.exec(path);
    if (match?.[1] && match[2]) {
        return {
            boardId: match[2],
            kind: "board",
            projectId: match[1],
        };
    }

    match = /^\/projects\/([^/]+)\/tasks\/([^/]+)$/.exec(path);
    if (match?.[1] && match[2]) {
        return {
            kind: "task",
            projectId: match[1],
            taskKey: match[2],
        };
    }

    match = /^\/projects\/([^/]+)\/ci-cd$/.exec(path);
    if (match?.[1]) {
        return { kind: "ci-cd", projectId: match[1] };
    }

    match = /^\/projects\/([^/]+)\/settings$/.exec(path);
    if (match?.[1]) {
        return { kind: "project-settings", projectId: match[1] };
    }

    match = /^\/projects\/([^/]+)$/.exec(path);
    if (match?.[1]) {
        return { kind: "project", projectId: match[1] };
    }

    return { kind: "unknown" };
}

export function resolveAppShellDocumentTitle(
    pathname: string,
    options: BuildAppShellTitleOptions = {}
): string {
    if (!options.labels) {
        return formatAppShellDocumentTitle([]);
    }

    const page = options.notFound
        ? { kind: "not-found" as const }
        : parseAppShellPath(pathname);

    return formatAppShellDocumentTitle(
        resolveAppShellTitleParts(page, options.labels, options.entities)
    );
}

export function resolveAppShellTitleParts(
    page: ParsedAppShellPage,
    labels: AppShellSeoLabels,
    entities: AppShellSeoEntities = {}
): string[] {
    switch (page.kind) {
        case "about": {
            return [labels.about];
        }
        case "backlog": {
            return [entities.boardName ?? labels.board, labels.backlog];
        }
        case "board": {
            const board = entities.boardName ?? labels.board;
            return entities.taskKey ? [entities.taskKey, board] : [board];
        }
        case "ci-cd": {
            return [entities.projectName ?? "", labels.cicd];
        }
        case "complete-profile": {
            return [labels.completeProfile];
        }
        case "dashboard": {
            return [labels.dashboard];
        }
        case "home": {
            return [labels.home];
        }
        case "invite": {
            return [labels.invite];
        }
        case "not-found": {
            return [labels.notFound];
        }
        case "notifications": {
            return [labels.notifications];
        }
        case "project": {
            return [entities.projectName ?? labels.board];
        }
        case "project-settings": {
            return [entities.projectName ?? "", labels.settings];
        }
        case "settings": {
            return [labels.accountSettings];
        }
        case "task": {
            return [entities.taskKey ?? page.taskKey];
        }
        case "team": {
            return [entities.teamName ?? labels.home];
        }
        case "team-settings": {
            return [entities.teamName ?? "", labels.settings];
        }
        case "unknown": {
            return [];
        }
    }
}
