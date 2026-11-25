"use client";

import { SeriesMarkers, type SeriesMarkersProperties } from "./series-markers";

/**
 * How non-active points are de-emphasised while hovering.
 * - `"opacity"` — fade to `inactiveOpacity` (default)
 * - `"blur"` — fade to `inactiveOpacity` and blur by `inactiveBlur` px
 */
export type ScatterInactiveMode = "blur" | "opacity";

export interface ScatterProperties extends Omit<
    SeriesMarkersProperties,
    "animate"
> {
    /** Whether to animate points in on reveal. Default: true */
    animate?: boolean;
    /** Blur in px for non-active points when `inactiveMode="blur"`. Default: 2 */
    inactiveBlur?: number;
    /** De-emphasis style for non-active points while hovering. Default: "opacity" */
    inactiveMode?: ScatterInactiveMode;
    /** Opacity for non-active points while hovering. Default: 0.3 */
    inactiveOpacity?: number;
    /**
     * Outer ring stroke width in px. Rings are opt-in — set e.g. `2` to draw
     * an offset ring around each point (see `ringGap`). Default: 0
     */
    strokeWidth?: number;
    /** Y-scale group id (Recharts `yAxisId`). Default: `"left"`. */
    yAxisId?: number | string;
}

/** Bklit scatter series: one marker per data row that has a numeric `dataKey`. */
export function Scatter({
    animate = true,
    dataKey,
    enterBlur = 2,
    fadeOnHover = true,
    fill,
    inactiveBlur = 2,
    inactiveMode = "opacity",
    inactiveOpacity = 0.3,
    outlineColor,
    outlineWidth = 0,
    radius = 5,
    ringGap = 2,
    showActiveHighlight = true,
    stroke,
    strokeWidth = 0,
}: ScatterProperties) {
    return (
        <SeriesMarkers
            animate={animate}
            dataKey={dataKey}
            enterBlur={enterBlur}
            fadeOnHover={fadeOnHover}
            fill={fill}
            inactiveBlur={inactiveMode === "blur" ? inactiveBlur : 0}
            inactiveOpacity={inactiveOpacity}
            outlineColor={outlineColor}
            outlineWidth={outlineWidth}
            radius={radius}
            ringGap={ringGap}
            showActiveHighlight={showActiveHighlight}
            stroke={stroke}
            strokeWidth={strokeWidth}
        />
    );
}

Scatter.displayName = "Scatter";

export default Scatter;
