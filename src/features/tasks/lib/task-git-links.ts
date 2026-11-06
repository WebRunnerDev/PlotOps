import type {
    Task,
    TaskGitLink,
    TaskPullRequest,
} from "@/features/tasks/model/types";

/** What the drawer's "+ Link" menu attaches as a Git link. */
export type GitLinkAttachKind = "branch" | "pr";

/** Branch / PR change for one Git link; `null` clears a field. */
export type GitLinkChange = {
    branchName?: null | string;
    pr?: null | TaskPullRequest;
};

/** The part of a Project Repository the Git link UI needs. */
export type GitLinkRepository = {
    fullName: string;
    id: string;
};

/**
 * Which Git link a change writes (ADR 0036). A `linkId` the Task does not
 * hold yet adds a Git link with that id, so the optimistic row, the server
 * row and an Undo share it.
 */
export type GitLinkTarget = { linkId: string; repositoryId: string };

/** A linked Git link with its Repository — one drawer row. */
export type LinkedGitLink = {
    link: TaskGitLink;
    repository: GitLinkRepository;
};

/** One Repository and the Task's Git links to it (oldest first). */
export type RepositoryGitLinks = {
    links: TaskGitLink[];
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
 * Apply a branch / PR change to the Git link `target.linkId`. Mirrors
 * `update_task_details`: a Git link left with neither branch nor PR is
 * removed, an unknown id is appended as a new one (oldest first).
 */
export function applyGitLinkChange(
    links: readonly TaskGitLink[] | undefined,
    target: GitLinkTarget,
    change: GitLinkChange
): TaskGitLink[] {
    const list = links ?? [];
    const index = list.findIndex((link) => link.id === target.linkId);
    const current: TaskGitLink =
        index === -1
            ? { id: target.linkId, repositoryId: target.repositoryId }
            : (list[index] as TaskGitLink);
    const branchName =
        change.branchName === undefined
            ? current.branchName
            : change.branchName?.trim() || undefined;
    const pr = change.pr === undefined ? current.pr : (change.pr ?? undefined);
    const empty = !branchName && !pr;
    const next: TaskGitLink = {
        branchName,
        id: current.id,
        pr,
        repositoryId: current.repositoryId,
    };

    if (index === -1) {
        return empty ? [...list] : [...list, next];
    }
    return empty
        ? list.filter((_, position) => position !== index)
        : list.map((link, position) => (position === index ? next : link));
}

/**
 * Optimistic cache fields for a branch / PR change to `target` and the
 * re-derived single-repo `branchName` / `pr` view. Returns `{}` when nothing
 * Git changed.
 */
export function applyGitLinkDetails(
    task: Pick<Task, "branchName" | "gitLinks" | "pr">,
    target: GitLinkTarget | undefined,
    change: GitLinkChange
): Partial<Pick<Task, "branchName" | "gitLinks" | "pr">> {
    if (change.branchName === undefined && change.pr === undefined) {
        return {};
    }

    if (!target) {
        // Git link unknown client-side: patch the single-repo view; the
        // refetch brings the Git link.
        return {
            ...(change.branchName === undefined
                ? {}
                : { branchName: change.branchName ?? undefined }),
            ...(change.pr === undefined ? {} : { pr: change.pr ?? undefined }),
        };
    }

    return gitLinksLegacyView(
        applyGitLinkChange(task.gitLinks, target, change)
    );
}

/**
 * Git link that already holds this branch (`branchName`) or PR (`prNumber`)
 * in the Repository — attaching it again would duplicate it.
 */
export function findGitLink(
    links: readonly TaskGitLink[] | undefined,
    repositoryId: string,
    match: { branchName: string } | { prNumber: number }
): TaskGitLink | undefined {
    return (links ?? []).find(
        (link) =>
            link.repositoryId === repositoryId &&
            ("branchName" in match
                ? link.branchName === match.branchName
                : link.pr?.number === match.prNumber)
    );
}

/**
 * The Task as activity diffing should see it for a Git change: `branchName` /
 * `pr` read from the Git link `linkId` (empty for a new one) rather than
 * `gitLinks[0]`.
 */
export function gitLinkActivityView<
    T extends Pick<Task, "branchName" | "gitLinks" | "pr">,
>(task: T, linkId?: string): T {
    if (!linkId) return task;
    const link = task.gitLinks?.find((item) => item.id === linkId);
    return { ...task, branchName: link?.branchName, pr: link?.pr };
}

/**
 * The change that puts a Git link back as it was before an unlink — what
 * the "Unlinked · Undo" toast applies to the same link id. `undefined` (there
 * was no Git link) clears both fields.
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
): RepositoryGitLinks[] {
    const grouped = groupGitLinksByRepository(repositories, links);
    const linked = grouped.filter((entry) => entry.links.length > 0);
    return linked.length > 0 ? linked : grouped;
}

/**
 * Repositories in Project order, each with the Task's Git links to it.
 * Git links to a Repository the Project no longer holds are dropped.
 */
export function groupGitLinksByRepository(
    repositories: readonly GitLinkRepository[],
    links: readonly TaskGitLink[] | undefined
): RepositoryGitLinks[] {
    return repositories.map((repository) => ({
        links: (links ?? []).filter(
            (link) => link.repositoryId === repository.id
        ),
        repository,
    }));
}

/** Every Git link with its Repository: Project order, then oldest first. */
export function linkedGitLinks(
    repositories: readonly GitLinkRepository[],
    links: readonly TaskGitLink[] | undefined
): LinkedGitLink[] {
    return groupGitLinksByRepository(repositories, links).flatMap(
        ({ links: repositoryLinks, repository }) =>
            repositoryLinks.map((link) => ({ link, repository }))
    );
}

/** Id for a Git link the app is about to add (`update_task_details` keeps it). */
export function newGitLinkId(): string {
    return crypto.randomUUID();
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
 * Where a PR attached from the "+ Link" menu goes (ADR 0036): nowhere when
 * the Task already holds it in that Repository, into the branch-only Git
 * link on its head branch, else a new Git link.
 */
export function planAttachPr(
    links: readonly TaskGitLink[] | undefined,
    repositoryId: string,
    pr: { headRef?: string; number: number }
):
    | { kind: "duplicate"; link: TaskGitLink }
    | { kind: "join"; link: TaskGitLink }
    | { kind: "new" } {
    const duplicate = findGitLink(links, repositoryId, {
        prNumber: pr.number,
    });
    if (duplicate) return { kind: "duplicate", link: duplicate };
    const branchOnly = pr.headRef
        ? (links ?? []).find(
              (link) =>
                  link.repositoryId === repositoryId &&
                  !link.pr &&
                  link.branchName === pr.headRef
          )
        : undefined;
    return branchOnly ? { kind: "join", link: branchOnly } : { kind: "new" };
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
