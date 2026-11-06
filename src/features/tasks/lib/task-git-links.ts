import type {
    Task,
    TaskGitLink,
    TaskPullRequest,
} from "@/features/tasks/model/types";

/** What the drawer's "+ Link" menu attaches to a Repository's Git link. */
export type GitLinkAttachKind = "branch" | "pr";

/** Branch / PR change for one Repository's Git link; `null` clears a field. */
export type GitLinkChange = {
    branchName?: null | string;
    pr?: null | TaskPullRequest;
};

/** The part of a Project Repository the Git link UI needs. */
export type GitLinkRepository = {
    fullName: string;
    id: string;
};

/** One Repository row in the drawer: the Repository and its Git link, if any. */
export type RepositoryGitLink = {
    link: TaskGitLink | undefined;
    repository: GitLinkRepository;
};

/** Aggregate PR badge for a Task card (ADR 0035). */
export type TaskPrBadge =
    | {
          entries: TaskGitLink[];
          kind: "aggregate";
          mergedCount: number;
          prCount: number;
          /** Colour of the badge: open wins, then merged when all merged, else closed. */
          state: TaskPullRequest["state"];
      }
    | { kind: "single"; pr: TaskPullRequest };

/**
 * Apply a branch / PR change to the Git link for `repositoryId`. Mirrors
 * `update_task_details`: a Git link left with neither branch nor PR is
 * removed, a new one is appended (Git links are ordered oldest first).
 */
export function applyGitLinkChange(
    links: readonly TaskGitLink[] | undefined,
    repositoryId: string,
    change: GitLinkChange
): TaskGitLink[] {
    const list = links ?? [];
    const index = list.findIndex((link) => link.repositoryId === repositoryId);
    const current: TaskGitLink =
        index === -1 ? { repositoryId } : (list[index] as TaskGitLink);
    const branchName =
        change.branchName === undefined
            ? current.branchName
            : change.branchName?.trim() || undefined;
    const pr = change.pr === undefined ? current.pr : (change.pr ?? undefined);
    const empty = !branchName && !pr;
    const next: TaskGitLink = { branchName, pr, repositoryId };

    if (index === -1) {
        return empty ? [...list] : [...list, next];
    }
    return empty
        ? list.filter((_, position) => position !== index)
        : list.map((link, position) => (position === index ? next : link));
}

/**
 * Optimistic cache fields for a branch / PR change. Updates the Git link of
 * `repositoryId` (or the only Git link when it is omitted) and re-derives the
 * single-repo `branchName` / `pr` view. Returns `{}` when nothing Git changed.
 */
export function applyGitLinkDetails(
    task: Pick<Task, "branchName" | "gitLinks" | "pr">,
    repositoryId: string | undefined,
    change: GitLinkChange
): Partial<Pick<Task, "branchName" | "gitLinks" | "pr">> {
    if (change.branchName === undefined && change.pr === undefined) {
        return {};
    }
    const targetId =
        repositoryId ??
        (task.gitLinks?.length === 1
            ? task.gitLinks[0]?.repositoryId
            : undefined);

    if (!targetId) {
        // Repository unknown client-side (single-repo Project, no Git link yet):
        // patch the single-repo view; the refetch brings the Git link.
        return {
            ...(change.branchName === undefined
                ? {}
                : { branchName: change.branchName ?? undefined }),
            ...(change.pr === undefined ? {} : { pr: change.pr ?? undefined }),
        };
    }

    return gitLinksLegacyView(
        applyGitLinkChange(task.gitLinks, targetId, change)
    );
}

/**
 * The Task as activity diffing should see it for a Git change: `branchName` /
 * `pr` read from the Git link of `repositoryId` rather than `gitLinks[0]`.
 */
export function gitLinkActivityView<
    T extends Pick<Task, "branchName" | "gitLinks" | "pr">,
>(task: T, repositoryId?: string): T {
    if (!repositoryId) return task;
    const link = task.gitLinks?.find(
        (item) => item.repositoryId === repositoryId
    );
    return { ...task, branchName: link?.branchName, pr: link?.pr };
}

/**
 * The change that puts a Repository's Git link back as it was before an
 * unlink — what the "Unlinked · Undo" toast applies. `undefined` (there was
 * no Git link) clears both fields.
 */
export function gitLinkRestoreChange(previous?: TaskGitLink): GitLinkChange {
    return {
        branchName: previous?.branchName ?? null,
        pr: previous?.pr ?? null,
    };
}

/** Single-repo view of a Task's Git links (`gitLinks[0]`), as the mappers build it. */
export function gitLinksLegacyView(links: readonly TaskGitLink[]): {
    branchName: string | undefined;
    gitLinks: TaskGitLink[] | undefined;
    pr: TaskPullRequest | undefined;
} {
    const first = links[0];
    return {
        branchName: first?.branchName,
        gitLinks: links.length > 0 ? [...links] : undefined,
        pr: first?.pr,
    };
}

/**
 * Repositories whose Git data (branch commits, smart commits) the drawer
 * loads: those with a Git link, or every Repository while the Task has none —
 * smart commits by Task key can land in any of them.
 */
export function gitTabRepositories(
    repositories: readonly GitLinkRepository[],
    links?: readonly TaskGitLink[]
): RepositoryGitLink[] {
    const grouped = groupGitLinksByRepository(repositories, links);
    const linked = grouped.filter((entry) => entry.link !== undefined);
    return linked.length > 0 ? linked : grouped;
}

/**
 * Repositories in Project order, each with the Task's Git link when it has
 * one. Git links to a Repository the Project no longer holds are dropped.
 */
export function groupGitLinksByRepository(
    repositories: readonly GitLinkRepository[],
    links: readonly TaskGitLink[] | undefined
): RepositoryGitLink[] {
    return repositories.map((repository) => ({
        link: links?.find((link) => link.repositoryId === repository.id),
        repository,
    }));
}

/**
 * Default Repository for Create branch / PR: the last one this viewer chose
 * on this Board when it is still offered, else the first offered one.
 */
export function pickDefaultRepositoryId(
    options: readonly GitLinkRepository[],
    lastChosenId?: string
): string | undefined {
    if (lastChosenId && options.some((option) => option.id === lastChosenId)) {
        return lastChosenId;
    }
    return options[0]?.id;
}

/**
 * Repositories a branch / PR can be attached to from the "+ Link" menu:
 * those whose Git link has no such field yet (no Git link counts too).
 * Replacing a linked branch / PR is an explicit unlink first.
 */
export function repositoriesAcceptingGitLink(
    repositories: readonly GitLinkRepository[],
    links: readonly TaskGitLink[] | undefined,
    kind: GitLinkAttachKind
): GitLinkRepository[] {
    return groupGitLinksByRepository(repositories, links)
        .filter(({ link }) =>
            kind === "branch" ? !link?.branchName : !link?.pr
        )
        .map(({ repository }) => repository);
}

/** Repositories the Task has no Git link for yet — the only ones Create branch / PR offers. */
export function repositoriesWithoutGitLink(
    repositories: readonly GitLinkRepository[],
    links?: readonly TaskGitLink[]
): GitLinkRepository[] {
    const linked = new Set((links ?? []).map((link) => link.repositoryId));
    return repositories.filter((repository) => !linked.has(repository.id));
}

/**
 * Card PR badge. A Task with at most one Git link keeps the single-PR badge;
 * several Git links collapse into one "2 PR · 1 merged" badge. No badge when
 * no Git link has a PR.
 */
export function taskPrBadge(
    task: Pick<Task, "gitLinks" | "pr">
): TaskPrBadge | undefined {
    const links = task.gitLinks ?? [];
    if (links.length <= 1) {
        const pr = links[0]?.pr ?? task.pr;
        return pr ? { kind: "single", pr } : undefined;
    }

    const prs = links.flatMap((link) => (link.pr ? [link.pr] : []));
    if (prs.length === 0) return undefined;

    const mergedCount = prs.filter((pr) => pr.state === "merged").length;
    const state: TaskPullRequest["state"] = prs.some(
        (pr) => pr.state === "open"
    )
        ? "open"
        : mergedCount === prs.length
          ? "merged"
          : "closed";

    return {
        entries: [...links],
        kind: "aggregate",
        mergedCount,
        prCount: prs.length,
        state,
    };
}
