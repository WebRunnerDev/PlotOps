import type { User } from "@supabase/supabase-js";

import type { Database } from "@/shared/api/database.types";

import {
    parseProfileNameRow,
    parseUserProfile,
    parseUserProfileOrNull,
    type UserProfile,
} from "@/features/auth/api/profile-schema";
import {
    getUserAvatarUrl,
    getUserUsername,
    isProfileNamesComplete,
    profileNamesFromUserMetadata,
} from "@/features/auth/lib/user-display";
import { supabase } from "@/shared/api/supabase";

export type { UserProfile } from "@/features/auth/api/profile-schema";

type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

export async function ensureUserProfile(user: User) {
    const { data: existingRow, error: selectError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .eq("id", user.id)
        .maybeSingle();

    if (selectError) throw selectError;

    if (existingRow) {
        const existingProfile = parseProfileNameRow(existingRow);
        if (isProfileNamesComplete(existingProfile)) return;

        const names = profileNamesFromUserMetadata(user.user_metadata);
        const patch: ProfileUpdate = {};

        if (names.firstName && !existingProfile.first_name) {
            patch.first_name = names.firstName;
        }
        if (names.lastName && !existingProfile.last_name) {
            patch.last_name = names.lastName;
        }
        if (Object.keys(patch).length === 0) return;

        const { error: patchError } = await supabase
            .from("profiles")
            .update(patch)
            .eq("id", user.id);

        if (patchError) throw patchError;
        return;
    }

    const names = profileNamesFromUserMetadata(user.user_metadata);
    const insertRow: ProfileInsert = {
        avatar_url: getUserAvatarUrl(user),
        first_name: names.firstName || null,
        id: user.id,
        last_name: names.lastName || null,
        username: getUserUsername(user),
    };

    const { error: insertError } = await supabase
        .from("profiles")
        .insert(insertRow);

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
    return parseUserProfileOrNull(data);
}

export async function updateProfileNames(input: {
    firstName: string;
    lastName: string;
    userId: string;
}): Promise<UserProfile> {
    const first_name = input.firstName.trim();
    const last_name = input.lastName.trim();

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!authData.user || authData.user.id !== input.userId) {
        throw new Error("Not authenticated");
    }

    await ensureUserProfile(authData.user);

    // Persist to profiles first so USER_UPDATED → loadProfile cannot race
    // ahead of the table write and wipe AuthProvider profile state to null names.
    const { data, error } = await supabase
        .from("profiles")
        .update({ first_name, last_name } satisfies ProfileUpdate)
        .eq("id", input.userId)
        .select("id, username, avatar_url, first_name, last_name")
        .single();

    if (error) throw error;

    const { error: metaError } = await supabase.auth.updateUser({
        data: { first_name, last_name },
    });
    if (metaError) throw metaError;

    return parseUserProfile(data);
}
