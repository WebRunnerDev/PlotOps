import type {
    GuestActivityEvent,
    GuestProject,
    GuestRepository,
    GuestSandbox,
} from "@/features/guest-mode";
import type { ProjectsProvider } from "@/features/projects/api/projects-provider";
import type {
    Project,
    ProjectRepositoryInput,
} from "@/features/projects/model/types";

// Leaf constants module (types only) — the boards index would form a cycle.
import { DEFAULT_KANBAN_COLUMNS } from "@/features/boards/model/constants";
import {
    getGuestSandbox,
    GUEST_SEED_ACTOR_ID,
    updateGuestSandbox,
} from "@/features/guest-mode";

/** Postgres-shaped unique violation, so the UI shows its duplicate message. */
class GuestUniqueViolationError extends Error {
    readonly code = "23505";
}

function assertRepositoriesFree(
    sandbox: GuestSandbox,
    teamId: string,
    repositories: readonly ProjectRepositoryInput[]
): void {
    const taken = new Set(
        sandbox.projects
            .filter((project) => project.teamId === teamId)
            .flatMap((project) =>
                project.repositories.map((repo) => repo.githubRepoId)
            )
    );
    for (const repository of repositories) {
        // `unique (team_id, github_repo_id)`: one Project per Team per repo.
        if (taken.has(repository.github_repo_id)) {
            throw new GuestUniqueViolationError(
                `${repository.github_full_name} is already linked in this Team`
            );
        }
        taken.add(repository.github_repo_id);
    }
}

/**
 * Mirrors `project_repositories_sync_project_privacy` (#360): private while
 * any linked Repository is.
 */
function hasPrivateRepository(project: GuestProject): boolean {
    return project.repositories.some((repository) => repository.isPrivate);
}

function mapProject(project: GuestProject, ownerId: string): Project {
    const repositories = project.repositories.map((repository) => ({
        github_default_branch: repository.defaultBranch,
        github_full_name: repository.fullName,
        github_html_url: repository.htmlUrl,
        github_repo_id: repository.githubRepoId,
        id: repository.id,
        is_private: repository.isPrivate ?? false,
    }));
    const [first] = repositories;
    return {
        created_at: project.createdAt,
        description: project.description,
        github_default_branch: first?.github_default_branch ?? null,
        github_full_name: first?.github_full_name ?? null,
        github_html_url: first?.github_html_url ?? null,
        github_repo_id: first?.github_repo_id ?? null,
        id: project.id,
        is_private: project.isPrivate,
        name: project.name,
        owner_id: ownerId,
        repositories,
        slug: project.slug,
        team_id: project.teamId,
        updated_at: project.updatedAt,
    };
}

function resolveOwnerId(sandbox: GuestSandbox, teamId: string): string {
    return sandbox.teams.find((team) => team.id === teamId)?.ownerId ?? "";
}

/**
 * Mirrors `boards_sync_repositories`: every Development Board of the Project
 * gets a Base branch row for the new Repository, seeded from its default.
 */
function seedBoardBaseBranches(
    sandbox: GuestSandbox,
    projectId: string,
    repository: GuestRepository
): void {
    for (const board of sandbox.boards) {
        if (board.projectId !== projectId || !board.isDevelopment) continue;
        if (
            board.repositoryBaseBranches.some(
                (entry) => entry.repositoryId === repository.id
            )
        ) {
            continue;
        }
        board.repositoryBaseBranches.push({
            baseBranch: repository.defaultBranch,
            repositoryId: repository.id,
        });
    }
}

function toGuestRepository(input: ProjectRepositoryInput): GuestRepository {
    return {
        defaultBranch: input.github_default_branch.trim() || "main",
        fullName: input.github_full_name,
        githubRepoId: input.github_repo_id,
        htmlUrl:
            input.github_html_url ||
            `https://github.com/${input.github_full_name}`,
        id: crypto.randomUUID(),
        isPrivate: input.is_private,
    };
}

function toResult<T>(run: () => T): { data: null | T; error: Error | null } {
    try {
        return { data: run(), error: null };
    } catch (error) {
        return {
            data: null,
            error: error instanceof Error ? error : new Error(String(error)),
        };
    }
}

/**
 * Guest Mode Projects adapter — reads/writes the local sandbox; never calls
 * Supabase. Create Project and Repository link / unlink work here, with no
 * Repository cap (ADR 0035); deleting a Project stays blocked.
 */
export const guestProjectsProvider: ProjectsProvider = {
    async addProjectRepository(projectId, patch) {
        return toResult(() => {
            let mapped: null | Project = null;
            updateGuestSandbox((sandbox) => {
                const project = sandbox.projects.find(
                    (item) => item.id === projectId
                );
                if (!project) throw new Error("Project not found");
                assertRepositoriesFree(sandbox, project.teamId, [patch]);
                const repository = toGuestRepository(patch);
                project.repositories.push(repository);
                project.isPrivate = hasPrivateRepository(project);
                project.updatedAt = new Date().toISOString();
                seedBoardBaseBranches(sandbox, projectId, repository);
                mapped = mapProject(
                    project,
                    resolveOwnerId(sandbox, project.teamId)
                );
            });
            return mapped as null | Project;
        });
    },

    async countRepositoryGitLinks(repositoryId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            return { data: null, error: new Error("No Guest Session") };
        }
        const count = sandbox.tasks.filter((task) =>
            task.gitLinks?.some((link) => link.repositoryId === repositoryId)
        ).length;
        return { data: count, error: null };
    },

    async createProject(input) {
        return toResult(() => {
            let mapped: null | Project = null;
            updateGuestSandbox((sandbox) => {
                if (
                    sandbox.projects.some(
                        (project) =>
                            project.teamId === input.team_id &&
                            project.slug === input.slug
                    )
                ) {
                    throw new GuestUniqueViolationError(
                        `Project slug ${input.slug} is taken`
                    );
                }
                assertRepositoriesFree(
                    sandbox,
                    input.team_id,
                    input.repositories
                );
                const now = new Date().toISOString();
                const repositories = input.repositories.map((repository) =>
                    toGuestRepository(repository)
                );
                const project: GuestProject = {
                    createdAt: now,
                    description: input.description,
                    id: crypto.randomUUID(),
                    isPrivate: input.is_private,
                    name: input.name,
                    repositories,
                    slug: input.slug,
                    teamId: input.team_id,
                    updatedAt: now,
                };
                if (repositories.length > 0) {
                    project.isPrivate = hasPrivateRepository(project);
                }
                sandbox.projects.push(project);
                // `projects_create_default_board`; linking Repositories turns
                // it into a Development Board, as the RPC does.
                sandbox.boards.push({
                    allowedHeadPatterns: [],
                    autoAssignToCreator: false,
                    columns: DEFAULT_KANBAN_COLUMNS.map((column, index) => ({
                        id: column.id,
                        isDone: column.isDone,
                        name: column.name,
                        position: index,
                    })),
                    defaultTaskType: "task",
                    id: crypto.randomUUID(),
                    isDevelopment: repositories.length > 0,
                    mergeTargetColumnId: null,
                    mergeTargetMode: "last_column",
                    name: "Board",
                    position: 0,
                    projectId: project.id,
                    repositoryBaseBranches: [],
                });
                for (const repository of repositories) {
                    seedBoardBaseBranches(sandbox, project.id, repository);
                }
                // Same Description field every seeded Project carries.
                sandbox.customFieldDefinitions.push({
                    appliesTo: ["epic", "story", "task", "bug"],
                    id: crypto.randomUUID(),
                    name: "Description",
                    position: 0,
                    projectId: project.id,
                    systemKey: "description",
                });
                mapped = mapProject(
                    project,
                    resolveOwnerId(sandbox, input.team_id) ||
                        GUEST_SEED_ACTOR_ID
                );
            });
            return mapped as null | Project;
        });
    },

    async deleteProject() {
        return {
            data: null,
            error: new Error(
                "Deleting projects is not available in Guest Mode"
            ),
        };
    },

    async fetchProject(projectId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            return { data: null, error: new Error("No Guest Session") };
        }
        const project = sandbox.projects.find((item) => item.id === projectId);
        if (!project) {
            return { data: null, error: new Error("Project not found") };
        }
        return {
            data: mapProject(project, resolveOwnerId(sandbox, project.teamId)),
            error: null,
        };
    },

    async fetchProjects() {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            return { data: null, error: new Error("No Guest Session") };
        }
        const projects = [...sandbox.projects]
            .toSorted(
                (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
            )
            .map((project) =>
                mapProject(project, resolveOwnerId(sandbox, project.teamId))
            );
        return { data: projects, error: null };
    },

    async fetchProjectsByTeam(teamId) {
        const sandbox = getGuestSandbox();
        if (!sandbox) {
            return { data: null, error: new Error("No Guest Session") };
        }
        const ownerId = resolveOwnerId(sandbox, teamId);
        const projects = [...sandbox.projects]
            .filter((project) => project.teamId === teamId)
            .toSorted(
                (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
            )
            .map((project) => mapProject(project, ownerId));
        return { data: projects, error: null };
    },

    async removeProjectRepository(repositoryId) {
        return toResult(() => {
            updateGuestSandbox((sandbox) => {
                const project = sandbox.projects.find((item) =>
                    item.repositories.some((repo) => repo.id === repositoryId)
                );
                if (!project) throw new Error("Repository not found");
                const repository = project.repositories.find(
                    (repo) => repo.id === repositoryId
                )!;
                project.repositories = project.repositories.filter(
                    (repo) => repo.id !== repositoryId
                );
                project.isPrivate = hasPrivateRepository(project);
                project.updatedAt = new Date().toISOString();
                for (const board of sandbox.boards) {
                    board.repositoryBaseBranches =
                        board.repositoryBaseBranches.filter(
                            (entry) => entry.repositoryId !== repositoryId
                        );
                }
                const now = new Date().toISOString();
                for (const task of sandbox.tasks) {
                    const removed = (task.gitLinks ?? []).filter(
                        (item) => item.repositoryId === repositoryId
                    );
                    if (removed.length === 0) continue;
                    task.gitLinks = task.gitLinks!.filter(
                        (item) => item.repositoryId !== repositoryId
                    );
                    if (task.gitLinks.length === 0) delete task.gitLinks;
                    // `project_repositories_log_unlink`: one row per Git link.
                    for (const link of removed) {
                        const changes: GuestActivityEvent["metadata"]["changes"] =
                            [];
                        if (link.branchName) {
                            changes.push({
                                field: "branch",
                                from: link.branchName,
                                to: null,
                            });
                        }
                        if (link.pr) {
                            changes.push({
                                field: "pr",
                                from: link.pr,
                                to: null,
                            });
                        }
                        sandbox.activity.unshift({
                            action: "updated",
                            createdAt: now,
                            id: crypto.randomUUID(),
                            metadata: {
                                changes,
                                reason: "repository_unlinked",
                                repository: repository.fullName,
                            },
                            projectId: project.id,
                            taskId: task.id,
                            user: {
                                id: GUEST_SEED_ACTOR_ID,
                                name: "Demo Guest",
                            },
                        });
                    }
                }
            });
            return { id: repositoryId };
        });
    },

    async renameProject(projectId, name) {
        return toResult(() => {
            const trimmed = name.trim();
            if (!trimmed) throw new Error("Project name is required");
            let mapped: null | Project = null;
            updateGuestSandbox((sandbox) => {
                const project = sandbox.projects.find(
                    (item) => item.id === projectId
                );
                if (!project) throw new Error("Project not found");
                project.name = trimmed;
                project.updatedAt = new Date().toISOString();
                mapped = mapProject(
                    project,
                    resolveOwnerId(sandbox, project.teamId)
                );
            });
            return mapped as null | Project;
        });
    },
};
