export type Project = {
    created_at: string;
    description: null | string;
    github_default_branch: string;
    github_full_name: string;
    github_html_url: string;
    github_repo_id: number;
    id: string;
    is_private: boolean;
    name: string;
    owner_id: string;
    slug: string;
    updated_at: string;
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

export type CreateProjectInput = {
    description: null | string;
    github_default_branch: string;
    github_full_name: string;
    github_html_url: string;
    github_repo_id: number;
    is_private: boolean;
    name: string;
    slug: string;
};
