import type {
    ConnectProjectGithubPatch,
    CreateProjectInput,
} from "@/features/projects/model/types";

import { ensureUserProfile } from "@/features/auth/api/profile-api";
import { supabase } from "@/shared/api/supabase";

type ProjectRow = {
    created_at: string;
    description: null | string;
    github_default_branch: null | string;
    github_full_name: null | string;
    github_html_url: null | string;
    github_repo_id: null | number;
    id: string;
    is_private: boolean;
    name: string;
    slug: string;
    team?: null | { owner_id: string } | { owner_id: string }[];
    team_id: string;
    updated_at: string;
};

const PROJECT_SELECT = `
  *,
  team:teams!projects_team_id_fkey (
    owner_id
  )
`;

/** Attach a GitHub repo to a name-only Project (`github_repo_id` currently null). */
export async function connectProjectGithub(
    projectId: string,
    patch: ConnectProjectGithubPatch
) {
    const { data, error } = await supabase
        .from("projects")
        .update(patch)
        .eq("id", projectId)
        .is("github_repo_id", null)
        .select(PROJECT_SELECT)
        .maybeSingle();

    if (error) return { data: null, error };
    if (!data) {
        return {
            data: null,
            error: new Error(
                "Project not found, already connected, or update not permitted"
            ),
        };
    }
    return { data: mapProject(data as ProjectRow), error: null };
}

export async function createProject(input: CreateProjectInput) {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Not authenticated");
    }

    await ensureUserProfile(user);

    const result = await supabase
        .from("projects")
        .insert(input)
        .select(PROJECT_SELECT)
        .single();

    return {
        ...result,
        data: result.data ? mapProject(result.data as ProjectRow) : null,
    };
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
    const result = await supabase
        .from("projects")
        .select(PROJECT_SELECT)
        .eq("id", projectId)
        .single();

    return {
        ...result,
        data: result.data ? mapProject(result.data as ProjectRow) : null,
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

export function slugifyRepoName(name: string): string {
    const slug = name
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/^-+|-+$/g, "");
    return slug || "repo";
}

function mapProject(row: ProjectRow) {
    const team = Array.isArray(row.team) ? row.team[0] : row.team;
    return {
        created_at: row.created_at,
        description: row.description,
        github_default_branch: row.github_default_branch,
        github_full_name: row.github_full_name,
        github_html_url: row.github_html_url,
        github_repo_id: row.github_repo_id,
        id: row.id,
        is_private: row.is_private,
        name: row.name,
        owner_id: team?.owner_id ?? "",
        slug: row.slug,
        team_id: row.team_id,
        updated_at: row.updated_at,
    };
}

export { type Project } from "@/features/projects/model/types";
