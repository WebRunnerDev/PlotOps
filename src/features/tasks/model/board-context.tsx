import { createContext, useContext, type ReactNode } from "react";

import { useBoard } from "@/features/tasks/model/use-board";

type BoardContextValue = ReturnType<typeof useBoard>;

const BoardContext = createContext<BoardContextValue | null>(null);

type BoardProviderProperties = {
    children: ReactNode;
    projectId: string;
};

export function BoardProvider({ children, projectId }: BoardProviderProperties) {
    const board = useBoard(projectId);
    return (
        <BoardContext.Provider value={board}>{children}</BoardContext.Provider>
    );
}

export function useBoardContext() {
    const context = useContext(BoardContext);
    if (!context) {
        throw new Error("useBoardContext must be used within BoardProvider");
    }
    return context;
}
