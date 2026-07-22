import type { ProjectLabel } from "@/features/tasks/model/types";

import { getLabelChipProperties } from "@/features/tasks/model/constants";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/shadcn/ui/badge";

type TaskLabelChipsProperties = {
    className?: string;
    labels: ProjectLabel[];
    max?: number;
};

export function TaskLabelChips({
    className,
    labels,
    max = 3,
}: TaskLabelChipsProperties) {
    if (labels.length === 0) return;

    const visible = labels.slice(0, max);
    const hidden = labels.length - visible.length;

    return (
        <div className={cn("flex flex-wrap items-center gap-1", className)}>
            {visible.map((label) => {
                const chip = getLabelChipProperties(label);
                return (
                    <Badge
                        className={cn(
                            "border-0 font-mono text-[0.625rem] font-medium tracking-wide uppercase ring-1",
                            chip.className
                        )}
                        key={label.id}
                        style={chip.style}
                        variant="secondary"
                    >
                        {label.name}
                    </Badge>
                );
            })}
            {hidden > 0 ? (
                <span className="text-meta text-muted-foreground">
                    +{hidden}
                </span>
            ) : undefined}
        </div>
    );
}
