import type { BoardColumn } from "@/features/boards/model/types";

export type DatabaseBoardColumn = {
    board_id: string;
    id: string;
    name: string;
    position: number;
    project_id: string;
};

export function mapDatabaseColumn(row: DatabaseBoardColumn): BoardColumn {
    return {
        id: row.id,
        name: row.name,
    };
}

export function orderColumnsByIds(
    columns: BoardColumn[],
    columnIds: string[]
): BoardColumn[] {
    const byId = new Map(columns.map((column) => [column.id, column] as const));
    return columnIds
        .map((id) => byId.get(id))
        .filter((column): column is BoardColumn => column !== undefined);
}

export function sortColumns(
    columns: BoardColumn[],
    positions: Map<string, number>
) {
    return [...columns].toSorted(
        (left, right) =>
            (positions.get(left.id) ?? 0) - (positions.get(right.id) ?? 0)
    );
}
