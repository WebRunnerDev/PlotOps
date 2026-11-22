import { PLOTOPS_VERSION } from "@/shared/config/app-version";

import { latestPublishedVersion } from "./published-entries";
import { WHATS_NEW_ENTRIES } from "./releases";
import { useSeenReleaseStore } from "./seen-release-store";

/** True until this browser opens What's new after the current release. */
export function useHasUnseenRelease(): boolean {
    const lastSeenVersion = useSeenReleaseStore(
        (state) => state.lastSeenVersion
    );
    const latest = latestPublishedVersion(WHATS_NEW_ENTRIES, PLOTOPS_VERSION);

    return latest !== null && latest !== lastSeenVersion;
}
