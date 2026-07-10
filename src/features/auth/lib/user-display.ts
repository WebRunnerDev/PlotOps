import type { User } from "@supabase/supabase-js";

export function getUserDisplayName(user: User): string {
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

export function getUserInitials(name: string): string {
    const parts = name.trim().split(/[\s_-]+/).filter(Boolean);

    if (parts.length >= 2) {
        return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
    }

    return name.slice(0, 2).toUpperCase();
}
