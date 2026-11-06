import { createContext, type ReactNode, useContext, useMemo } from "react";

const TaskRepositoryNamesContext = createContext<ReadonlyMap<string, string>>(
    new Map()
);

/**
 * Repository id → full name for Task cards on a Board, so the aggregate PR
 * badge tooltip can name each Repository without threading props through
 * every column (ADR 0035).
 */
export function TaskRepositoryNamesProvider({
    children,
    repositories,
}: {
    children: ReactNode;
    repositories: readonly { github_full_name: string; id: string }[];
}) {
    const names = useMemo(
        () =>
            new Map(
                repositories.map((repository) => [
                    repository.id,
                    repository.github_full_name,
                ])
            ),
        [repositories]
    );
    return (
        <TaskRepositoryNamesContext.Provider value={names}>
            {children}
        </TaskRepositoryNamesContext.Provider>
    );
}

export function useTaskRepositoryNames(): ReadonlyMap<string, string> {
    return useContext(TaskRepositoryNamesContext);
}
