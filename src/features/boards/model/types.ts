export type BoardColumn = {
    id: string;
    /** Close Sprint pre-checks Tasks in this column as completed. ≤1 per board. */
    isDone: boolean;
    name: string;
};

export type ProjectBoardRecord = {
    allowedHeadPatterns: string[];
    baseBranch: string;
    id: string;
    name: string;
    position: number;
    projectId: string;
};
