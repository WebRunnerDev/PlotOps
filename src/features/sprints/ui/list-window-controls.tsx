import { useTranslation } from "react-i18next";

import { Button } from "@/shared/shadcn/ui/button";

type ListWindowControlsProperties = {
    bordered?: boolean;
    hasMore: boolean;
    nextCount: number;
    onLoadMore: () => void;
    onShowAll: () => void;
};

type SelectAllMatchingBannerProperties = {
    onSelectAll: () => void;
    totalCount: number;
    visible: boolean;
};

export function ListWindowControls({
    bordered = true,
    hasMore,
    nextCount,
    onLoadMore,
    onShowAll,
}: ListWindowControlsProperties) {
    const { t } = useTranslation("board");
    if (!hasMore) return null;

    return (
        <div
            className={
                bordered
                    ? "flex flex-wrap items-center gap-2 border-t border-border px-3 py-2"
                    : "flex flex-wrap items-center gap-2 px-1 py-1"
            }
        >
            <Button
                onClick={onLoadMore}
                size="xs"
                type="button"
                variant="outline"
            >
                {t("sprints.loadMore", { count: nextCount })}
            </Button>
            <Button onClick={onShowAll} size="xs" type="button" variant="ghost">
                {t("sprints.showAll")}
            </Button>
        </div>
    );
}

export function SelectAllMatchingBanner({
    onSelectAll,
    totalCount,
    visible,
}: SelectAllMatchingBannerProperties) {
    const { t } = useTranslation("board");
    if (!visible) return null;

    return (
        <div className="border-b border-border bg-muted/40 px-3 py-2">
            <Button
                className="h-auto px-0 py-0 text-ui"
                onClick={onSelectAll}
                size="xs"
                type="button"
                variant="link"
            >
                {t("sprints.selectAllMatching", { count: totalCount })}
            </Button>
        </div>
    );
}
