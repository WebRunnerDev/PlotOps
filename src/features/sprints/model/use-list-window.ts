import { useEffect, useState } from "react";

import {
    BACKLOG_LIST_PAGE_SIZE,
    initialListWindowCount,
    nextVisibleCount,
} from "@/features/sprints/model/list-window";

export function useListWindow(
    resetKey: string,
    pageSize: number = BACKLOG_LIST_PAGE_SIZE
) {
    const [visibleCount, setVisibleCount] = useState(() =>
        initialListWindowCount(pageSize)
    );

    useEffect(() => {
        setVisibleCount(initialListWindowCount(pageSize));
    }, [pageSize, resetKey]);

    return {
        loadMore: (total: number) => {
            setVisibleCount((current) =>
                nextVisibleCount({
                    current,
                    mode: "more",
                    pageSize,
                    total,
                })
            );
        },
        showAll: (total: number) => {
            setVisibleCount((current) =>
                nextVisibleCount({
                    current,
                    mode: "all",
                    pageSize,
                    total,
                })
            );
        },
        visibleCount,
    };
}
