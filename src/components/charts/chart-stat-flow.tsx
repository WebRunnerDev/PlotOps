"use client";

import NumberFlow from "@number-flow/react";
import { type ReactNode, useEffect, useMemo, useState } from "react";

import { cn } from "@/shared/lib/utils";

/** Subset of `Intl.NumberFormatOptions` supported by NumberFlow */
export interface ChartStatFlowFormat {
    compactDisplay?: "long" | "short";
    currency?: string;
    currencyDisplay?: "code" | "name" | "narrowSymbol" | "symbol";
    maximumFractionDigits?: number;
    maximumSignificantDigits?: number;
    minimumFractionDigits?: number;
    minimumIntegerDigits?: number;
    minimumSignificantDigits?: number;
    notation?: "compact" | "standard";
    style?: "currency" | "decimal" | "percent";
    unit?: string;
    unitDisplay?: "long" | "narrow" | "short";
}

export const defaultChartStatFlowFormat: ChartStatFlowFormat = {
    maximumFractionDigits: 0,
    notation: "standard",
};

export interface ChartStatFlowProperties {
    formatOptions?: ChartStatFlowFormat;
    icon?: ReactNode;
    label: string;
    labelClassName?: string;
    prefix?: string;
    suffix?: string;
    value: number;
    valueClassName?: string;
}

/**
 * Shared value + label stack using NumberFlow (same layout as pie / ring centers).
 * Parent should provide flex alignment and sizing when needed.
 */
export function ChartStatFlow({
    formatOptions = defaultChartStatFlowFormat,
    icon,
    label,
    labelClassName = "text-xs",
    prefix,
    suffix,
    value,
    valueClassName = "text-2xl font-bold",
}: ChartStatFlowProperties) {
    const numberFlowReady = useNumberFlowElementReady();
    const staticValue = useMemo(
        () => formatStatValue(value, formatOptions, prefix, suffix),
        [value, formatOptions, prefix, suffix]
    );

    return (
        <>
            {icon ? (
                <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
                    {icon}
                </div>
            ) : null}
            <span
                className={cn("text-foreground tabular-nums", valueClassName)}
            >
                {numberFlowReady ? (
                    <NumberFlow
                        format={formatOptions}
                        isolate
                        prefix={prefix}
                        suffix={suffix}
                        value={value}
                        willChange
                    />
                ) : (
                    staticValue
                )}
            </span>
            <span className={cn("mt-0.5 text-chart-label", labelClassName)}>
                {label}
            </span>
        </>
    );
}

function formatStatValue(
    value: number,
    formatOptions: ChartStatFlowFormat,
    prefix?: string,
    suffix?: string
): string {
    const formatted = new Intl.NumberFormat(undefined, formatOptions).format(
        value
    );
    return `${prefix ?? ""}${formatted}${suffix ?? ""}`;
}

function useNumberFlowElementReady(): boolean {
    const [ready, setReady] = useState(
        () =>
            typeof customElements !== "undefined" &&
            Boolean(customElements.get("number-flow-react"))
    );

    useEffect(() => {
        if (ready) {
            return;
        }
        let cancelled = false;
        customElements.whenDefined("number-flow-react").then(() => {
            if (!cancelled) {
                setReady(true);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [ready]);

    return ready;
}

ChartStatFlow.displayName = "ChartStatFlow";
