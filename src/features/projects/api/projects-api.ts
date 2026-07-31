import type { CreateProjectInput } from "@/features/projects/model/types";

import { ensureUserProfile } from "@/features/auth/api/profile-api";
import { supabase } from "@/shared/api/supabase";

export async function createProject(input: CreateProjectInput) {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Not authenticated");
    }

    await ensureUserProfile(user);

    return supabase
        .from("projects")
        .insert({
            ...input,
            owner_id: user.id,
        })
        .select()
        .single();
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
    return supabase.from("projects").select("*").eq("id", projectId).single();
}

export async function fetchProjects() {
    return supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
}

export function slugifyRepoName(name: string): string {
    return name
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/g, "-")
        .replaceAll(/^-+|-+$/g, "");
}

export { type Project } from "@/features/projects/model/types";
