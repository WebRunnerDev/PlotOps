import type { User } from "@supabase/supabase-js";

import type { Database } from "@/shared/api/database.types";

import {
    parseProfileNameRow,
    parseUserProfile,
    parseUserProfileOrNull,
    type UserProfile,
} from "@/features/auth/api/profile-schema";
import {
    hasGitHubIdentity,
    resolveGitHubProfileFields,
    shouldSyncUsernameFromGitHub,
} from "@/features/auth/lib/resolve-github-profile-fields";
import {
    getUserAvatarUrl,
    getUserUsername,
    githubLoginFromUser,
    profileNamesFromUserMetadata,
} from "@/features/auth/lib/user-display";
import { supabase } from "@/shared/api/supabase";

export type { UserProfile } from "@/features/auth/api/profile-schema";

export type EnsureUserProfileOptions = {
    githubAccessToken?: null | string;
    signal?: AbortSignal;
};
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];

type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];

const PROFILE_SYNC_SELECT =
    "id, first_name, last_name, username, github_login, github_id" as const;

const PROFILE_PUBLIC_SELECT =
    "id, username, avatar_url, first_name, last_name, github_login, github_id" as const;

export async function ensureUserProfile(
    user: User,
    options?: EnsureUserProfileOptions
) {
    const { data: existingRow, error: selectError } = await supabase
        .from("profiles")
        .select(PROFILE_SYNC_SELECT)
        .eq("id", user.id)
        .maybeSingle();

    if (selectError) throw selectError;

    const githubFields = await resolveGitHubProfileFields(
        user,
        options?.githubAccessToken,
        options?.signal
    );
    const linkedToGitHub = hasGitHubIdentity(user);

    if (existingRow) {
        const existingProfile = parseProfileNameRow(existingRow);
        const names = profileNamesFromUserMetadata(user.user_metadata);
        const patch: ProfileUpdate = {};

        if (names.firstName && !existingProfile.first_name) {
            patch.first_name = names.firstName;
        }
        if (names.lastName && !existingProfile.last_name) {
            patch.last_name = names.lastName;
        }

        if (linkedToGitHub && githubFields) {
            if (
                existingProfile.github_login?.toLowerCase() !==
                githubFields.github_login.toLowerCase()
            ) {
                patch.github_login = githubFields.github_login;
            }
            if (
                githubFields.github_id != undefined &&
                existingProfile.github_id !== githubFields.github_id
            ) {
                patch.github_id = githubFields.github_id;
            }
            if (
                shouldSyncUsernameFromGitHub({
                    existingUsername: existingProfile.username,
                    newGitHubLogin: githubFields.github_login,
                    previousGitHubLogin: existingProfile.github_login,
                }) &&
                existingProfile.username?.trim().toLowerCase() !==
                    githubFields.github_login.toLowerCase()
            ) {
                patch.username = githubFields.github_login;
            }
        } else if (linkedToGitHub) {
            const githubLogin = githubLoginFromUser(user);
            if (
                githubLogin &&
                shouldSyncUsernameFromGitHub({
                    existingUsername: existingProfile.username,
                    newGitHubLogin: githubLogin,
                    previousGitHubLogin: existingProfile.github_login,
                }) &&
                existingProfile.username?.trim().toLowerCase() !==
                    githubLogin.toLowerCase()
            ) {
                patch.username = githubLogin;
            }
        } else {
            if (existingProfile.github_login != undefined) {
                patch.github_login = null;
            }
            if (existingProfile.github_id != undefined) {
                patch.github_id = null;
            }
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
    const githubLogin = githubFields?.github_login ?? githubLoginFromUser(user);
    const insertRow: ProfileInsert = {
        avatar_url: getUserAvatarUrl(user),
        first_name: names.firstName || null,
        github_id: githubFields?.github_id ?? null,
        github_login: githubFields?.github_login ?? null,
        id: user.id,
        last_name: names.lastName || null,
        username: githubLogin ?? getUserUsername(user),
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
        .select(PROFILE_PUBLIC_SELECT)
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
        .select(PROFILE_PUBLIC_SELECT)
        .single();

    if (error) throw error;

    const { error: metaError } = await supabase.auth.updateUser({
        data: { first_name, last_name },
    });
    if (metaError) throw metaError;

    return parseUserProfile(data);
}
