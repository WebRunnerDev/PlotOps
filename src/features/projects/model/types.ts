export type CreateProjectInput = {
    description: null | string;
    github_default_branch: null | string;
    github_full_name: null | string;
    github_html_url: null | string;
    github_repo_id: null | number;
    is_private: boolean;
    name: string;
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
    github_default_branch: null | string;
    github_full_name: null | string;
    github_html_url: null | string;
    github_repo_id: null | number;
    id: string;
    is_private: boolean;
    name: string;
    /** Team Owner id (joined from teams.owner_id; not a projects column). */
    owner_id: string;
    slug: string;
    team_id: string;
    updated_at: string;
};
