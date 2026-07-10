import type { User } from "@supabase/supabase-js";

import { supabase } from "@/shared/api/supabase";

import {
    getUserAvatarUrl,
    getUserDisplayName,
} from "@/features/auth/lib/user-display";

export async function ensureUserProfile(user: User) {
    const { data: existingProfile, error: selectError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();

    if (selectError) throw selectError;
    if (existingProfile) return;

    const { error: insertError } = await supabase.from("profiles").insert({
        avatar_url: getUserAvatarUrl(user),
        id: user.id,
        username: getUserDisplayName(user),
    });

    if (insertError && insertError.code !== "23505") {
        throw insertError;
    }
}
