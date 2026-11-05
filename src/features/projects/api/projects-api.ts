import type {
    ConnectProjectGithubPatch,
    CreateProjectInput,
    Project,
    ProjectRepository,
} from "@/features/projects/model/types";

import { ensureUserProfile } from "@/features/auth/api/profile-api";
import { supabase } from "@/shared/api/supabase";

type ProjectRepositoryRow = {
    created_at: string;
    github_default_branch: string;
    github_full_name: string;
    github_html_url: string;
    github_repo_id: number;
    id: string;
};

type ProjectRow = {
    created_at: string;
    description: null | string;
    id: string;
    is_private: boolean;
    name: string;
    repositories?: null | ProjectRepositoryRow[];
    slug: string;
    team?: null | { owner_id: string } | { owner_id: string }[];
    team_id: string;
    updated_at: string;
};

const PROJECT_SELECT = `
  *,
  team:teams!projects_team_id_fkey (
    owner_id
  ),
  repositories:project_repositories (
    id,
    github_repo_id,
    github_full_name,
    github_html_url,
    github_default_branch,
    created_at
  )
`;

/**
 * Link a GitHub repository to a Project (Admin+, ADR 0035). The cap and the
 * Team-wide uniqueness are enforced in Postgres; the first Repository also
 * sets the Project's visibility, as creating a Project from a repo does.
 */
export async function addProjectRepository(
    projectId: string,
    patch: ConnectProjectGithubPatch
) {
    const { is_private: isPrivate, ...repository } = patch;

    const existing = await fetchProject(projectId);
    if (existing.error) return { data: null, error: existing.error };
    if (!existing.data) {
        return {
            data: null,
            error: new Error("Project not found or update not permitted"),
        };
    }

    const { error: insertError } = await supabase
        .from("project_repositories")
        .insert({
            ...repository,
            project_id: projectId,
            // Overwritten from the Project by a trigger; required by the type.
            team_id: existing.data.team_id,
        });
    if (insertError) return { data: null, error: insertError };

    if (existing.data.repositories.length === 0) {
        const { error: updateError } = await supabase
            .from("projects")
            .update({ is_private: isPrivate })
            .eq("id", projectId);
        if (updateError) return { data: null, error: updateError };
    }

    const result = await fetchProject(projectId);
    if (result.error) return { data: null, error: result.error };
    if (!result.data) {
        return { data: null, error: new Error("Project not found") };
    }
    return { data: result.data, error: null };
}

/** Tasks holding a Git link to this Repository (≤1 Git link per Task per Repository). */
export async function countRepositoryGitLinks(repositoryId: string) {
    const { count, error } = await supabase
        .from("task_git_links")
        .select("task_id", { count: "exact", head: true })
        .eq("repository_id", repositoryId);

    if (error) return { data: null, error };
    return { data: count ?? 0, error: null };
}

export async function createProject(input: CreateProjectInput) {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Not authenticated");
    }

    await ensureUserProfile(user);

    const { data: projectId, error } = await supabase.rpc(
        "create_project_with_repositories",
        {
            p_description: input.description ?? undefined,
            p_is_private: input.is_private,
            p_name: input.name,
            p_repositories: input.repositories,
            p_slug: input.slug,
            p_team_id: input.team_id,
        }
    );

    if (error) return { data: null, error };

    const result = await fetchProject(projectId);
    if (result.error) return { data: null, error: result.error };
    if (!result.data) {
        return {
            data: null,
            error: { code: "PGRST116", message: "Created Project not found" },
        };
    }
    return { data: result.data, error: null };
}

export async function deleteProject(projectId: string) {
    const { data, error } = await supabase
        .from("projects")
        .delete()
        .eq("id", projectId)
        .select("id")
        .maybeSingle();

    if (error) return { data: null, error };
    if (!data) {
        return {
            data: null,
            error: new Error("Project not found or delete not permitted"),
        };
    }
    return { data, error: null };
}

export async function fetchProject(projectId: string) {
    // Array read + first row: avoids PostgREST object coercion when 0 rows.
    const result = await supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .eq("id", projectId)
        .limit(1);

    const row = result.data?.[0] as ProjectRow | undefined;

    return {
        ...result,
        data: row ? mapProject(row) : null,
    };
}

export async function fetchProjects() {
    const result = await supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .order("created_at", { ascending: false });

    return {
        ...result,
        data: result.data
            ? result.data.map((row) => mapProject(row as ProjectRow))
            : result.data,
    };
}

export async function fetchProjectsByTeam(teamId: string) {
    const result = await supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .eq("team_id", teamId)
        .order("created_at", { ascending: false });

    return {
        ...result,
        data: result.data
            ? result.data.map((row) => mapProject(row as ProjectRow))
            : result.data,
    };
}

/**
 * Unlink a Repository (Admin+). Its Git links cascade, and a trigger records
 * the loss in each affected Task's activity. Nothing on GitHub is touched.
 */
export async function removeProjectRepository(repositoryId: string) {
    const { data, error } = await supabase
        .from("project_repositories")
        .delete()
        .eq("id", repositoryId)
        .select("id")
        .maybeSingle();

    if (error) return { data: null, error };
    if (!data) {
        return {
            data: null,
            error: new Error("Repository not found or unlink not permitted"),
        };
    }
    return { data, error: null };
}

export function slugifyRepoName(name: string): string {
    const slug = name
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/^-+|-+$/g, "");
    return slug || "repo";
}

function mapProject(row: ProjectRow): Project {
    const team = Array.isArray(row.team) ? row.team[0] : row.team;
    const repositories: ProjectRepository[] = (row.repositories ?? [])
        .toSorted(
            (a, b) =>
                Date.parse(a.created_at) - Date.parse(b.created_at) ||
                a.id.localeCompare(b.id)
        )
        .map((repo) => ({
            github_default_branch: repo.github_default_branch,
            github_full_name: repo.github_full_name,
            github_html_url: repo.github_html_url,
            github_repo_id: repo.github_repo_id,
            id: repo.id,
        }));
    const first = repositories[0];
    return {
        created_at: row.created_at,
        description: row.description,
        github_default_branch: first?.github_default_branch ?? null,
        github_full_name: first?.github_full_name ?? null,
        github_html_url: first?.github_html_url ?? null,
        github_repo_id: first?.github_repo_id ?? null,
        id: row.id,
        is_private: row.is_private,
        name: row.name,
        owner_id: team?.owner_id ?? "",
        repositories,
        slug: row.slug,
        team_id: row.team_id,
        updated_at: row.updated_at,
    };
}

export { type Project } from "@/features/projects/model/types";
