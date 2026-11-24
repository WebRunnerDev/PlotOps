import { useTranslation } from "react-i18next";

import {
    isTaskEstimate,
    TASK_ESTIMATE_VALUES,
    type TaskEstimate,
} from "@/features/tasks";
import { cn } from "@/shared/lib/utils";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/shared/shadcn/ui/dropdown-menu";

const NONE = "none";

/**
 * Inline Fibonacci Estimate for a Backlog row (Manager+). Stops pointer and
 * click propagation so picking a value neither opens the Task nor starts a drag.
 */
export function BacklogEstimatePicker({
    estimate,
    onChange,
    taskKey,
}: {
    estimate?: null | number;
    onChange: (next: null | TaskEstimate) => void;
    taskKey: string;
}) {
    const { t } = useTranslation("board");
    const value = isTaskEstimate(estimate) ? String(estimate) : NONE;

    return (
        <div
            className="flex items-center"
            data-no-row-activate
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
        >
            <DropdownMenu>
                <DropdownMenuTrigger
                    aria-label={t("sprints.estimateFor", { key: taskKey })}
                    className={cn(
                        "inline-flex h-7 min-w-8 items-center justify-center border border-transparent px-1.5 text-code tabular-nums transition-colors duration-150 hover:border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-popup-open:border-primary/50",
                        value === NONE && "text-muted-foreground"
                    )}
                >
                    {value === NONE ? "—" : value}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-36">
                    <DropdownMenuRadioGroup
                        onValueChange={(next) => {
                            if (next === value) return;
                            onChange(
                                next === NONE
                                    ? null
                                    : (Number(next) as TaskEstimate)
                            );
                        }}
                        value={value}
                    >
                        {TASK_ESTIMATE_VALUES.map((points) => (
                            <DropdownMenuRadioItem
                                key={points}
                                value={String(points)}
                            >
                                {t("estimate.points", { count: points })}
                            </DropdownMenuRadioItem>
                        ))}
                        <DropdownMenuSeparator />
                        <DropdownMenuRadioItem value={NONE}>
                            {t("estimate.none")}
                        </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
