/**
 * Monotonic generation token for overlapping async loads.
 * Call `begin()` when starting a load; ignore results unless `isCurrent`.
 */
export function createAsyncGenerationGate() {
    let generation = 0;

    return {
        begin(): number {
            generation += 1;
            return generation;
        },
        isCurrent(token: number): boolean {
            return token === generation;
        },
    };
}
