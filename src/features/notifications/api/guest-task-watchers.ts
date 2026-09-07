import type { GuestSandbox } from "@/features/guest-mode";
import type { StakePersonIds } from "@/features/notifications/lib/apply-stake-watch-enrollment";
import type { TaskWatcher } from "@/features/notifications/model/types";

import {
    getGuestSandbox,
    GUEST_SEED_ACTOR_ID,
    updateGuestSandbox,
} from "@/features/guest-mode";
import { applyStakeWatchEnrollment } from "@/features/notifications/lib/apply-stake-watch-enrollment";

type GuestWatchersState = {
    isWatching: boolean;
    watchers: TaskWatcher[];
};

/** Apply sticky stake enrollment for one Task inside an open sandbox mutator. */
export function applyGuestStakeWatchEnrollment(input: {
    next: StakePersonIds;
    previous: StakePersonIds;
    sandbox: GuestSandbox;
    taskId: string;
}): void {
    ensureTaskWatchers(input.sandbox);
    const currentIds = input.sandbox
        .taskWatchers!.filter((row) => row.taskId === input.taskId)
        .map((row) => row.userId);
    const nextIds = applyStakeWatchEnrollment({
        next: input.next,
        previous: input.previous,
        watcherIds: currentIds,
    });
    const others = input.sandbox.taskWatchers!.filter(
        (row) => row.taskId !== input.taskId
    );
    input.sandbox.taskWatchers = [
        ...others,
        ...nextIds.map((userId) => ({ taskId: input.taskId, userId })),
    ];
}

/**
 * Guest sticky Watch enrollment (ADR 0028) — sandbox `taskWatchers` rows.
 */
export function fetchGuestTaskWatchers(input: {
    taskId: string;
}): GuestWatchersState {
    const sandbox = getGuestSandbox();
    if (!sandbox) {
        return { isWatching: false, watchers: [] };
    }

    const rows = (sandbox.taskWatchers ?? []).filter(
        (row) => row.taskId === input.taskId
    );
    const watchers = rows.map((row) => toTaskWatcher(sandbox, row.userId));
    return {
        isWatching: rows.some((row) => row.userId === GUEST_SEED_ACTOR_ID),
        watchers,
    };
}

export function setGuestTaskWatch(input: {
    taskId: string;
    watching: boolean;
}): void {
    updateGuestSandbox((sandbox) => {
        ensureTaskWatchers(sandbox);
        const withoutSelf = sandbox.taskWatchers!.filter(
            (row) =>
                !(
                    row.taskId === input.taskId &&
                    row.userId === GUEST_SEED_ACTOR_ID
                )
        );
        sandbox.taskWatchers = input.watching
            ? [
                  ...withoutSelf,
                  { taskId: input.taskId, userId: GUEST_SEED_ACTOR_ID },
              ]
            : withoutSelf;
    });
}

function ensureTaskWatchers(sandbox: GuestSandbox): void {
    if (!Array.isArray(sandbox.taskWatchers)) {
        sandbox.taskWatchers = [];
    }
}

function toTaskWatcher(sandbox: GuestSandbox, userId: string): TaskWatcher {
    const task = sandbox.tasks.find(
        (item) => item.assignee?.id === userId || item.author?.id === userId
    );
    const person =
        task?.assignee?.id === userId
            ? task.assignee
            : task?.author?.id === userId
              ? task.author
              : userId === GUEST_SEED_ACTOR_ID
                ? { id: GUEST_SEED_ACTOR_ID, name: "Demo Guest" }
                : { id: userId, name: "Member" };

    return {
        avatarUrl: null,
        name: person.name,
        userId,
    };
}
