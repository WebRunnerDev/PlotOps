/**
 * Merge complete-profile field values when Auth profile arrives after mount.
 * Keep in-progress typing; only fill empty fields from the latest prefill.
 */
export function mergeCompleteProfilePrefill(
    current: { firstName: string; lastName: string },
    prefill: { firstName: string; lastName: string }
): { firstName: string; lastName: string } {
    return {
        firstName: current.firstName.trim()
            ? current.firstName
            : prefill.firstName,
        lastName: current.lastName.trim() ? current.lastName : prefill.lastName,
    };
}
