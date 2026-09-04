"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";

interface ChartLegendHoverContextValue {
    hoveredIndex: null | number;
    setHoveredIndex: (index: null | number) => void;
}

const ChartLegendHoverContext =
    createContext<ChartLegendHoverContextValue | null>(null);

export function ChartLegendHoverProvider({
    children,
    hoveredIndex,
    onHoverChange,
}: {
    children: ReactNode;
    hoveredIndex: null | number;
    onHoverChange: (index: null | number) => void;
}) {
    const value = useMemo(
        () => ({ hoveredIndex, setHoveredIndex: onHoverChange }),
        [hoveredIndex, onHoverChange]
    );

    return (
        <ChartLegendHoverContext.Provider value={value}>
            {children}
        </ChartLegendHoverContext.Provider>
    );
}

export function useChartLegendHover(): ChartLegendHoverContextValue {
    const context = useContext(ChartLegendHoverContext);
    return (
        context ?? {
            hoveredIndex: null,
            setHoveredIndex: () => {
                /* noop outside ChartLegendHoverProvider */
            },
        }
    );
}
