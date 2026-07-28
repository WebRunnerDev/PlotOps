import type { MentionSource } from "@/features/notifications/model/types";

import { getUserDisplayName } from "@/features/auth/lib/user-display";
import { createNotificationsForMentions } from "@/features/notifications/api/notifications-api";
import { buildMentionFanOutRequest } from "@/features/notifications/lib/build-mention-fan-out-request";
import { newMentioneeIds } from "@/features/notifications/lib/extract-mentionee-ids";
import { supabase } from "@/shared/api/supabase";

/**
 * After Description/Comment save: fan out always-on Mention Notifications
 * for Mentionees newly added vs the previous body (ADR 0014).
 * Never blocks the primary write; membership/actor checks live in the RPC.
 */
export async function notifyNewMentionsBestEffort(input: {
    commentId?: null | string;
    nextBody: string;
    previousBody: string;
    source: MentionSource;
    taskId: string;
}): Promise<void> {
    const mentioneeIds = newMentioneeIds(input.previousBody, input.nextBody);
    if (mentioneeIds.length === 0) return;

    const {
        data: { user },
    } = await supabase.auth.getUser();
    const actorName = user ? getUserDisplayName(user) : "";

    const request = buildMentionFanOutRequest({
        actorName,
        commentId: input.commentId,
        mentioneeIds,
        source: input.source,
        taskId: input.taskId,
    });
    if (!request) return;

    try {
        await createNotificationsForMentions(request);
    } catch {
        // Best-effort: never block the primary Description/Comment mutation.
    }
}
