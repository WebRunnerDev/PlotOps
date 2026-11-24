import { useQuery } from "@tanstack/react-query";

import type { FlowRangeDays } from "@/features/flow-reports/model/types";

import { resolveFlowReportsProvider } from "@/features/flow-reports/api/resolve-flow-reports-provider";
import {
    flowRangeStart,
    localIsoDate,
} from "@/features/flow-reports/model/build-cumulative-flow";
import { useIsGuest } from "@/features/guest-mode";

export const flowReportKeys = {
    all: ["flow-reports"] as const,
    board: (input: {
        boardId: string;
        day: string;
        guest: boolean;
        rangeDays: FlowRangeDays;
    }) =>
        [
            ...flowReportKeys.all,
            "board",
            input.boardId,
            input.rangeDays,
            input.day,
            input.guest,
        ] as const,
};

/**
 * Board status history for the report window. Refetched on mount and focus
 * so moves made on the Kanban show up when the viewer comes back; the day in
 * the key re-anchors the window after midnight.
 */
export function useBoardFlowHistory(boardId: string, rangeDays: FlowRangeDays) {
    const guest = useIsGuest();
    const provider = resolveFlowReportsProvider(guest);
    const day = localIsoDate(new Date());

    return useQuery({
        enabled: Boolean(boardId),
        queryFn: () =>
            provider.fetchBoardFlowHistory(
                boardId,
                flowRangeStart(new Date(), rangeDays)
            ),
        queryKey: flowReportKeys.board({ boardId, day, guest, rangeDays }),
        refetchOnMount: "always",
    });
}
