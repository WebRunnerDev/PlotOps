import {
    Bell,
    Columns3,
    GitBranch,
    House,
    Info,
    KanbanSquare,
    LayoutDashboard,
    Link2,
    ListTodo,
    type LucideIcon,
    PanelRight,
    PenLine,
    Rocket,
    SlidersHorizontal,
    Tag,
    UserRound,
    Users,
    UsersRound,
} from "lucide-react";

/**
 * Destination registry (SPEC §4 → Destinations, `CONTEXT.md`): every page or
 * settings section a user can go to, declared once. Drives the settings side
 * nav and the Command Palette Navigation group. Danger zone is not a Destination.
 */

export type DestinationAddress = {
    params: Record<string, string>;
    search?: { section: string };
    to: DestinationRoute;
};

/** URL context + Team Role caps for the viewer; callers pass settled caps only. */
export type DestinationContext = {
    boardId: null | string;
    /** Manager+ on the current Project's Team (Project settings sections). */
    canManageBoard: boolean;
    /** Any Team Role on the current Team (Team page, Team Tasks, Team settings). */
    canViewTeam: boolean;
    isGuest: boolean;
    projectId: null | string;
    /** From the URL or the current Project's `team_id`. */
    teamId: null | string;
};

export type DestinationGroup = "global" | "personal" | "project" | "team";

export type DestinationRoute =
    | "/about"
    | "/dashboard"
    | "/home"
    | "/notifications"
    | "/projects/$projectId/boards/$boardId"
    | "/projects/$projectId/boards/$boardId/backlog"
    | "/projects/$projectId/ci-cd"
    | "/projects/$projectId/settings"
    | "/settings"
    | "/teams/$teamId"
    | "/teams/$teamId/settings"
    | "/teams/$teamId/tasks";

type DestinationDefinition = {
    group: DestinationGroup;
    icon: LucideIcon;
    id: string;
    isVisible: (context: DestinationContext) => boolean;
    /** i18n key (`command` namespace) of the keyword list; search uses both locales. */
    keywordsKey: string;
    /** Parent label for the path subtitle, e.g. “Project settings › Labels”. */
    parentKey?: string;
    section?: string;
    /** Namespaced i18n key of the name, shared with the settings side nav. */
    titleKey: string;
    to: DestinationRoute;
};

const always = () => true;
const notGuest = (context: DestinationContext) => !context.isGuest;
const hasBoard = (context: DestinationContext) =>
    Boolean(context.projectId && context.boardId);
const hasProject = (context: DestinationContext) => Boolean(context.projectId);
const canManageProject = (context: DestinationContext) =>
    hasProject(context) && context.canManageBoard;
const canViewTeam = (context: DestinationContext) =>
    Boolean(context.teamId) && context.canViewTeam;

const keywords = (id: string) => `destinations.${id}.keywords`;

export const DESTINATIONS = [
    {
        group: "global",
        icon: House,
        id: "home",
        isVisible: always,
        keywordsKey: keywords("home"),
        titleKey: "common:nav.home",
        to: "/home",
    },
    {
        group: "global",
        icon: LayoutDashboard,
        id: "dashboard",
        isVisible: always,
        keywordsKey: keywords("dashboard"),
        titleKey: "common:seo.dashboard",
        to: "/dashboard",
    },
    {
        group: "global",
        icon: Bell,
        id: "notifications",
        isVisible: always,
        keywordsKey: keywords("notifications"),
        titleKey: "common:nav.notifications",
        to: "/notifications",
    },
    {
        group: "global",
        icon: Info,
        id: "about",
        isVisible: always,
        keywordsKey: keywords("about"),
        titleKey: "common:seo.about",
        to: "/about",
    },
    {
        group: "personal",
        icon: PanelRight,
        id: "settingsDrawer",
        isVisible: always,
        keywordsKey: keywords("settingsDrawer"),
        parentKey: "common:platformSettings",
        section: "drawer",
        titleKey: "common:uiSettings.title",
        to: "/settings",
    },
    {
        group: "personal",
        icon: UserRound,
        id: "settingsProfile",
        isVisible: notGuest,
        keywordsKey: keywords("settingsProfile"),
        parentKey: "common:platformSettings",
        section: "profile",
        titleKey: "auth:settings.profileTitle",
        to: "/settings",
    },
    {
        group: "personal",
        icon: GitBranch,
        id: "settingsGithub",
        isVisible: notGuest,
        keywordsKey: keywords("settingsGithub"),
        parentKey: "common:platformSettings",
        section: "github",
        titleKey: "auth:settings.githubIntegration.title",
        to: "/settings",
    },
    {
        group: "personal",
        icon: Link2,
        id: "settingsAccounts",
        isVisible: notGuest,
        keywordsKey: keywords("settingsAccounts"),
        parentKey: "common:platformSettings",
        section: "accounts",
        titleKey: "auth:settings.connectedAccountsTitle",
        to: "/settings",
    },
    {
        group: "team",
        icon: UsersRound,
        id: "team",
        isVisible: canViewTeam,
        keywordsKey: keywords("team"),
        titleKey: "command:destinations.team.title",
        to: "/teams/$teamId",
    },
    {
        group: "team",
        icon: ListTodo,
        id: "teamTasks",
        isVisible: canViewTeam,
        keywordsKey: keywords("teamTasks"),
        titleKey: "common:seo.teamTasks",
        to: "/teams/$teamId/tasks",
    },
    {
        group: "team",
        icon: PenLine,
        id: "teamSettingsName",
        isVisible: canViewTeam,
        keywordsKey: keywords("teamSettingsName"),
        parentKey: "board:teamSettings.title",
        section: "name",
        titleKey: "board:teamSettings.nameTitle",
        to: "/teams/$teamId/settings",
    },
    {
        group: "team",
        icon: Users,
        id: "teamSettingsMembers",
        isVisible: canViewTeam,
        keywordsKey: keywords("teamSettingsMembers"),
        parentKey: "board:teamSettings.title",
        section: "members",
        titleKey: "board:settings.nav.members",
        to: "/teams/$teamId/settings",
    },
    {
        group: "project",
        icon: KanbanSquare,
        id: "board",
        isVisible: hasBoard,
        keywordsKey: keywords("board"),
        titleKey: "common:nav.board",
        to: "/projects/$projectId/boards/$boardId",
    },
    {
        group: "project",
        icon: ListTodo,
        id: "backlog",
        isVisible: hasBoard,
        keywordsKey: keywords("backlog"),
        titleKey: "common:nav.backlog",
        to: "/projects/$projectId/boards/$boardId/backlog",
    },
    {
        group: "project",
        icon: Rocket,
        id: "cicd",
        isVisible: hasProject,
        keywordsKey: keywords("cicd"),
        titleKey: "common:nav.cicd",
        to: "/projects/$projectId/ci-cd",
    },
    {
        group: "project",
        icon: Columns3,
        id: "projectSettingsBoards",
        isVisible: canManageProject,
        keywordsKey: keywords("projectSettingsBoards"),
        parentKey: "board:settings.nav.projectSettings",
        section: "boards",
        titleKey: "board:settings.nav.boards",
        to: "/projects/$projectId/settings",
    },
    {
        group: "project",
        icon: Tag,
        id: "projectSettingsLabels",
        isVisible: canManageProject,
        keywordsKey: keywords("projectSettingsLabels"),
        parentKey: "board:settings.nav.projectSettings",
        section: "labels",
        titleKey: "board:settings.nav.labels",
        to: "/projects/$projectId/settings",
    },
    {
        group: "project",
        icon: SlidersHorizontal,
        id: "projectSettingsCustomFields",
        isVisible: canManageProject,
        keywordsKey: keywords("projectSettingsCustomFields"),
        parentKey: "board:settings.nav.projectSettings",
        section: "customFields",
        titleKey: "board:settings.nav.customFields",
        to: "/projects/$projectId/settings",
    },
] as const satisfies readonly DestinationDefinition[];

export type Destination = (typeof DESTINATIONS)[number];

export type DestinationId = Destination["id"];

/** Settings pages whose side nav (or `?section=` blocks) come from the registry. */
export type SettingsPageRoute =
    "/projects/$projectId/settings" | "/settings" | "/teams/$teamId/settings";

export type SettingsSectionDestination<R extends SettingsPageRoute> = Extract<
    Destination,
    { section: string }
> & { section: SettingsSectionOf<R>; to: R };

export type SettingsSectionOf<R extends SettingsPageRoute> = Extract<
    Destination,
    { to: R }
>["section"];

/** Canonical address in this context — null when a required id is missing. */
export function resolveDestinationAddress(
    destination: Destination,
    context: DestinationContext
): DestinationAddress | null {
    const parameters: Record<string, string> = {};
    if (destination.to.includes("$projectId")) {
        if (!context.projectId) return null;
        parameters.projectId = context.projectId;
    }
    if (destination.to.includes("$boardId")) {
        if (!context.boardId) return null;
        parameters.boardId = context.boardId;
    }
    if (destination.to.includes("$teamId")) {
        if (!context.teamId) return null;
        parameters.teamId = context.teamId;
    }

    const section: string | undefined =
        "section" in destination ? destination.section : undefined;
    return section === undefined
        ? { params: parameters, to: destination.to }
        : { params: parameters, search: { section }, to: destination.to };
}

/** Destinations of the current context the viewer may open (hidden, not disabled). */
export function resolveVisibleDestinations(
    context: DestinationContext
): Destination[] {
    return DESTINATIONS.filter((destination) => destination.isVisible(context));
}

/** Sections of a settings page visible in this context, in registry order. */
export function resolveVisibleSettingsSections<R extends SettingsPageRoute>(
    route: R,
    context: DestinationContext
): SettingsSectionDestination<R>[] {
    return settingsSectionDestinations(route).filter((destination) =>
        destination.isVisible(context)
    );
}

/** Every section id of a settings page, in registry order (for `validateSearch`). */
export function settingsSectionIds<R extends SettingsPageRoute>(
    route: R
): SettingsSectionOf<R>[] {
    return settingsSectionDestinations(route).map(
        (destination) => destination.section
    );
}

function settingsSectionDestinations<R extends SettingsPageRoute>(
    route: R
): SettingsSectionDestination<R>[] {
    return DESTINATIONS.filter(
        (destination): destination is SettingsSectionDestination<R> =>
            destination.to === route && "section" in destination
    );
}
