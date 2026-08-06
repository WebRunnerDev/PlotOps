import { safeGetItem, safeSetItem } from "@/shared/lib/safe-storage";

/** Last Board visited for a Project (localStorage via safe-storage). */
export function readLastBoardId(projectId: string): null | string {
    return safeGetItem("localStorage", lastBoardStorageKey(projectId));
}

export function writeLastBoardId(projectId: string, boardId: string): void {
    safeSetItem("localStorage", lastBoardStorageKey(projectId), boardId);
}

function lastBoardStorageKey(projectId: string): string {
    return `plotops:lastBoard:${projectId}`;
}
