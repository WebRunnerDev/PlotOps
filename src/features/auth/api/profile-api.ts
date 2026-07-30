import type { User } from "@supabase/supabase-js";

import {
    getUserAvatarUrl,
    getUserUsername,
    isProfileNamesComplete,
} from "@/features/auth/lib/user-display";
import { supabase } from "@/shared/api/supabase";

export type UserProfile = {
    avatar_url: null | string;
    first_name: null | string;
    id: string;
    last_name: null | string;
    username: null | string;
};

export async function ensureUserProfile(user: User) {
    const { data: existingProfile, error: selectError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();

    if (selectError) throw selectError;

    if (existingProfile) {
        if (isProfileNamesComplete(existingProfile as UserProfile)) return;

        const first_name = metadataName(user, "first_name");
        const last_name = metadataName(user, "last_name");
        const patch: {
            first_name?: string;
            last_name?: string;
        } = {};

        if (first_name && !(existingProfile as UserProfile).first_name) {
            patch.first_name = first_name;
        }
        if (last_name && !(existingProfile as UserProfile).last_name) {
            patch.last_name = last_name;
        }
        if (Object.keys(patch).length === 0) return;

        const { error: patchError } = await supabase
            .from("profiles")
            .update(patch)
            .eq("id", user.id);

        if (patchError) throw patchError;
        return;
    }

    const { error: insertError } = await supabase.from("profiles").insert({
        avatar_url: getUserAvatarUrl(user),
        first_name: metadataName(user, "first_name"),
        id: user.id,
        last_name: metadataName(user, "last_name"),
        username: getUserUsername(user),
    });

    if (insertError && insertError.code !== "23505") {
        throw insertError;
    }
}

export async function fetchOwnProfile(
    userId: string
): Promise<null | UserProfile> {
    const { data, error } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, first_name, last_name")
        .eq("id", userId)
        .maybeSingle();

    if (error) throw error;
    return data as null | UserProfile;
}

export async function updateProfileNames(input: {
    firstName: string;
    lastName: string;
    userId: string;
}): Promise<UserProfile> {
    const first_name = input.firstName.trim();
    const last_name = input.lastName.trim();

    const { error: metaError } = await supabase.auth.updateUser({
        data: { first_name, last_name },
    });
    if (metaError) throw metaError;

    const { data, error } = await supabase
        .from("profiles")
        .update({ first_name, last_name })
        .eq("id", input.userId)
        .select("id, username, avatar_url, first_name, last_name")
        .single();

    if (error) throw error;
    return data as UserProfile;
}

function metadataName(
    user: User,
    key: "first_name" | "last_name"
): null | string {
    const value = user.user_metadata[key];
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed || null;
}
