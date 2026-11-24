import type { FlowHistory } from "@/features/flow-reports/model/types";

/**
 * Status history read for the flow reports. Prefer
 * `resolveFlowReportsProvider(isGuest)` so Guest Sessions read the sandbox.
 */
export type FlowReportsProvider = {
    fetchBoardFlowHistory: (
        boardId: string,
        since: Date
    ) => Promise<FlowHistory>;
};
