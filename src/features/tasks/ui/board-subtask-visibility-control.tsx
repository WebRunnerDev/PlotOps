import { ListTree } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";

type BoardSubtaskVisibilityControlProperties = {
    hideSubtasks: boolean;
    onChange: (hideSubtasks: boolean) => void;
};

export function BoardSubtaskVisibilityControl({
    hideSubtasks,
    onChange,
}: BoardSubtaskVisibilityControlProperties) {
    const { t } = useTranslation("board");

    return (
        <Button
            aria-label={t("subtasks.hideToggle")}
            aria-pressed={hideSubtasks}
            className={cn(
                "h-7 max-w-full gap-1.5 px-2.5 text-[0.8rem]",
                hideSubtasks && "border-primary/40 bg-primary/5"
            )}
            onClick={() => {
                onChange(!hideSubtasks);
            }}
            size="sm"
            type="button"
            variant="outline"
        >
            <ListTree aria-hidden className="size-3.5" />
            <span className="min-w-0 truncate">
                {hideSubtasks
                    ? t("subtasks.showToggle")
                    : t("subtasks.hideToggle")}
            </span>
        </Button>
    );
}
