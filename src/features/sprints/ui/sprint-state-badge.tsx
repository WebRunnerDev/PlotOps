import { useTranslation } from "react-i18next";

import type { Sprint } from "@/features/sprints/model/types";

import { cn } from "@/shared/lib/utils";

export function SprintStateBadge({ state }: { state: Sprint["state"] }) {
    const { t } = useTranslation("board");
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 text-meta",
                state === "active" && "text-primary",
                state === "draft" && "text-muted-foreground",
                state === "closed" && "text-muted-foreground",
                state === "canceled" && "text-warning"
            )}
        >
            <span
                aria-hidden
                className={cn(
                    "size-1.5 shrink-0",
                    state === "active" && "bg-primary",
                    state === "draft" && "bg-muted-foreground/60",
                    state === "closed" && "bg-muted-foreground/40",
                    state === "canceled" && "bg-warning"
                )}
            />
            {t(`sprints.state.${state}`)}
        </span>
    );
}
