import {
    getGuestSandbox,
    GUEST_SEED_ACTOR_ID,
    type GuestPerson,
} from "@/features/guest-mode";

export type GuestProjectPerson = {
    avatarUrl?: string;
    id: string;
    name: string;
};

/**
 * Mention / people picker for Guest — distinct assignees & authors in the
 * project sandbox, plus the demo actor. No Supabase profiles.
 */
export function listGuestProjectPeople(
    projectId: string
): GuestProjectPerson[] {
    const sandbox = getGuestSandbox();
    if (!sandbox) {
        return [];
    }

    const byId = new Map<string, GuestProjectPerson>();

    const add = (person: GuestPerson | undefined) => {
        if (!person) return;
        byId.set(person.id, {
            avatarUrl: person.avatarUrl,
            id: person.id,
            name: person.name,
        });
    };

    add({ id: GUEST_SEED_ACTOR_ID, name: "Demo Guest" });

    for (const task of sandbox.tasks) {
        if (task.projectId !== projectId) continue;
        add(task.assignee);
        add(task.author);
    }

    for (const comment of sandbox.comments) {
        if (comment.projectId !== projectId) continue;
        add(comment.author);
    }

    return [...byId.values()].toSorted((left, right) =>
        left.name.localeCompare(right.name)
    );
}
