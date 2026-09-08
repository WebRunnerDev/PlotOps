export type WatcherCandidate = {
    avatarUrl?: string;
    id: string;
    name: string;
};

/**
 * Team Members who can view the Task and are not already Watchers.
 * Used by the Task drawer manage-Watchers Member picker.
 */
export function eligibleWatcherAddCandidates(input: {
    people: readonly WatcherCandidate[];
    watcherUserIds: readonly string[];
}): WatcherCandidate[] {
    const watching = new Set(input.watcherUserIds);
    return input.people.filter((person) => !watching.has(person.id));
}
