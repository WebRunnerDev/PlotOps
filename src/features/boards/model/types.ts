export type BoardColumn = {
    id: string;
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
