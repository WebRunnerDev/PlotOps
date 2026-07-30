import type { User } from "@supabase/supabase-js";

export type ProfileNameFields = {
    first_name?: null | string;
    last_name?: null | string;
    username?: null | string;
};

export function formatProfileDisplayName(profile: ProfileNameFields): string {
    const composed = [profile.first_name, profile.last_name]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(" ");

    if (composed) return composed;

    const username = profile.username?.trim();
    if (username) return username;

    return "";
}

export function getUserAvatarUrl(user: User): null | string {
    const metadata = user.user_metadata;

    if (typeof metadata.avatar_url === "string" && metadata.avatar_url) {
        return metadata.avatar_url;
    }

    if (typeof metadata.picture === "string" && metadata.picture) {
        return metadata.picture;
    }

    return null;
}

export function getUserDisplayName(user: User): string {
    const metadata = user.user_metadata;
    const fromNames = formatProfileDisplayName({
        first_name:
            typeof metadata.first_name === "string"
                ? metadata.first_name
                : null,
        last_name:
            typeof metadata.last_name === "string" ? metadata.last_name : null,
    });
    if (fromNames) return fromNames;

    return getUserUsername(user);
}

export function getUserInitials(name: string): string {
    const parts = name
        .trim()
        .split(/[\s_-]+/)
        .filter(Boolean);

    if (parts.length >= 2) {
        return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
}

/** Username/handle for `profiles.username` — never First/Last name. */
export function getUserUsername(user: User): string {
    const metadata = user.user_metadata;

    if (typeof metadata.user_name === "string" && metadata.user_name) {
        return metadata.user_name;
    }

    if (
        typeof metadata.preferred_username === "string" &&
        metadata.preferred_username
    ) {
        return metadata.preferred_username;
    }

    if (typeof metadata.name === "string" && metadata.name) {
        return metadata.name;
    }

    if (user.email) {
        return user.email.split("@")[0] ?? "user";
    }

    return "user";
}

export function isProfileNamesComplete(
    profile: null | ProfileNameFields | undefined
): boolean {
    if (!profile) return false;
    return Boolean(profile.first_name?.trim() && profile.last_name?.trim());
}

/** Split GitHub `user_metadata.name` ("First Last …") for complete-profile prefill. */
export function splitFullName(fullName: string): {
    firstName: string;
    lastName: string;
} {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: "", lastName: "" };
    if (parts.length === 1) return { firstName: parts[0] ?? "", lastName: "" };
    return {
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
    };
}
