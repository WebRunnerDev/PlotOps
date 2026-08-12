/** Serializes async mutations so overlapping callers run strictly in order. */
export function createMutationQueue() {
    let tail: Promise<unknown> = Promise.resolve();

    return {
        enqueue<T>(operation: () => Promise<T>): Promise<T> {
            const next = tail.then(operation, operation);
            tail = next.then(
                () => {},
                () => {}
            );
            return next;
        },
    };
}
