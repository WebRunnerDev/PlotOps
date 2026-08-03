import type { TeamRow } from "@/features/teams/api/team-members-api";

import { ensureUserProfile } from "@/features/auth/api/profile-api";
import { supabase } from "@/shared/api/supabase";

const TEAM_SELECT = "id, name, owner_id, created_at, updated_at";

export async function createTeam(name: string) {
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        throw new Error("Not authenticated");
    }

    await ensureUserProfile(user);

    const result = await supabase
        .from("teams")
        .insert({
            name: name.trim(),
            owner_id: user.id,
        })
        .select(TEAM_SELECT)
        .single();

    return {
        ...result,
        data: result.data as null | TeamRow,
    };
}

export async function fetchTeams() {
    const result = await supabase
        .from("teams")
        .select(TEAM_SELECT)
        .order("created_at", { ascending: false });

    return {
        ...result,
        data: (result.data ?? null) as null | TeamRow[],
    };
}
