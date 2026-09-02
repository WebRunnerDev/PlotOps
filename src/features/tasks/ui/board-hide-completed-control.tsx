import { CircleCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";

type BoardHideCompletedControlProperties = {
    hideCompleted: boolean;
    onChange: (hideCompleted: boolean) => void;
};

export function BoardHideCompletedControl({
    hideCompleted,
    onChange,
}: BoardHideCompletedControlProperties) {
    const { t } = useTranslation("board");

    return (
        <Button
            aria-label={t("filters.hideCompleted")}
            aria-pressed={hideCompleted}
            className={cn(
                "h-7 max-w-full gap-1.5 px-2.5 text-[0.8rem]",
                hideCompleted && "border-primary/40 bg-primary/5"
            )}
            onClick={() => {
                onChange(!hideCompleted);
            }}
            size="sm"
            type="button"
            variant="outline"
        >
            <CircleCheck aria-hidden className="size-3.5" />
            <span className="min-w-0 truncate">
                {hideCompleted
                    ? t("filters.showCompleted")
                    : t("filters.hideCompleted")}
            </span>
        </Button>
    );
}
