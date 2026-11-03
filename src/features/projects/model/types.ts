export type ConnectProjectGithubPatch = ProjectRepositoryInput & {
    is_private: boolean;
};

export type CreateProjectInput = {
    description: null | string;
    is_private: boolean;
    name: string;
    /** Linked in the same transaction (ADR 0034); `[]` for a name-only Project. */
    repositories: ProjectRepositoryInput[];
    slug: string;
    team_id: string;
};

export type GitHubRepo = {
    default_branch: string;
    description: null | string;
    full_name: string;
    html_url: string;
    id: number;
    name: string;
    owner: {
        avatar_url: string;
        login: string;
    };
    private: boolean;
};

export type Project = {
    created_at: string;
    description: null | string;
    /**
     * Single-repo view of `repositories[0]` (null when none). Kept so screens
     * built for one Repository read unchanged until they go per-Repository.
     */
    github_default_branch: null | string;
    github_full_name: null | string;
    github_html_url: null | string;
    github_repo_id: null | number;
    id: string;
    is_private: boolean;
    name: string;
    /** Team Owner id (joined from teams.owner_id; not a projects column). */
    owner_id: string;
    /** Linked GitHub repositories (`project_repositories`), oldest first. */
    repositories: ProjectRepository[];
    slug: string;
    team_id: string;
    updated_at: string;
};

/** A GitHub repository linked to a Project (`project_repositories`). */
export type ProjectRepository = ProjectRepositoryInput & {
    id: string;
};

export type ProjectRepositoryInput = {
    github_default_branch: string;
    github_full_name: string;
    github_html_url: string;
    github_repo_id: number;
};

/** Collaborator from `GET /repos/{owner}/{repo}/collaborators` (+ optional public email). */
export type RepoCollaborator = {
    avatarUrl: string;
    email: null | string;
    id: number;
    login: string;
};
