import type { FlowReportsProvider } from "@/features/flow-reports/api/flow-reports-provider";

import { guestFlowReportsProvider } from "@/features/flow-reports/api/guest-flow-reports-provider";
import { supabaseFlowReportsProvider } from "@/features/flow-reports/api/supabase-flow-reports-provider";

/** Guest Sessions read the local sandbox — never Supabase. */
export function resolveFlowReportsProvider(
    isGuest: boolean
): FlowReportsProvider {
    return isGuest ? guestFlowReportsProvider : supabaseFlowReportsProvider;
}
