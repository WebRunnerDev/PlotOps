import type {
    NotificationActor,
    NotificationMetadata,
} from "@/features/notifications/model/types";

import { formatProfileDisplayName } from "@/features/auth/lib/user-display";

type ActorProfileFields = {
    avatarUrl?: null | string;
    firstName?: null | string;
    lastName?: null | string;
    username?: null | string;
};

/**
 * Who caused a Notification, from (in order): the stored `actor_id` + its
 * profile, the Actor snapshot in metadata (Mentions, Guest seed), or the
 * GitHub webhook source. Null when none is known.
 */
export function resolveNotificationActor(input: {
    actorId?: null | string;
    metadata: NotificationMetadata;
    profile?: ActorProfileFields;
}): NotificationActor | null {
    const snapshot = actorSnapshot(input.metadata);

    if (input.actorId) {
        const profileName = formatProfileDisplayName({
            first_name: input.profile?.firstName,
            last_name: input.profile?.lastName,
            username: input.profile?.username,
        });
        const snapshotName =
            snapshot?.id === input.actorId ? snapshot.name : "";
        return {
            avatarUrl: input.profile?.avatarUrl ?? null,
            id: input.actorId,
            kind: "user",
            name: profileName || snapshotName,
        };
    }

    if (snapshot) {
        return {
            avatarUrl: null,
            id: snapshot.id,
            kind: "user",
            name: snapshot.name,
        };
    }

    if ((input.metadata as { source?: unknown }).source === "github_webhook") {
        return { kind: "github" };
    }

    return null;
}

function actorSnapshot(
    metadata: NotificationMetadata
): undefined | { id: string; name: string } {
    const actor = (metadata as { actor?: unknown }).actor;
    if (!actor || typeof actor !== "object") return undefined;
    const { id, name } = actor as { id?: unknown; name?: unknown };
    if (typeof id !== "string" || id === "") return undefined;
    return { id, name: typeof name === "string" ? name.trim() : "" };
}
