"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { LINE_LOADING_PULSE_EASE } from "./line-loading-timing";
import {
    computeSeriesPathPoints,
    interpolateSeriesPathPoints,
    seriesPathFromPoints,
    type SeriesPathPoint,
    seriesPathTransitionSignature,
} from "./series-path-utils";

export interface UseAnimatedSeriesPathOptions {
    chartPhase: string;
    curve: CurveFactory;
    dataKey: string;
    durationMs: number;
    enabled: boolean;
    innerWidth: number;
    renderData: Record<string, unknown>[];
    xAccessor: (datum: Record<string, unknown>) => Date;
    xScale: (value: Date) => number | undefined;
    yScale: (value: number) => number | undefined;
}

// biome-ignore lint/suspicious/noExplicitAny: d3 curve factory type
type CurveFactory = any;

export function useAnimatedSeriesPath({
    chartPhase,
    curve,
    dataKey,
    durationMs,
    enabled,
    innerWidth,
    renderData,
    xAccessor,
    xScale,
    yScale,
}: UseAnimatedSeriesPathOptions) {
    const reducedMotion = useReducedMotion();
    const [animatedPoints, setAnimatedPoints] = useState<
        null | SeriesPathPoint[]
    >(null);
    const displayedPointsReference = useRef<null | SeriesPathPoint[]>(null);
    const animatingReference = useRef(false);

    const xScaleDomain = useMemo(() => {
        const scaleWithDomain = xScale as { domain?: () => [Date, Date] };
        return scaleWithDomain.domain?.() ?? [new Date(0), new Date(0)];
    }, [xScale]);

    const transitionSignature = useMemo(
        () =>
            seriesPathTransitionSignature({
                dataKey,
                innerWidth,
                renderData,
                xAccessor,
                xDomainMax: xScaleDomain[1]?.getTime?.() ?? 0,
                xDomainMin: xScaleDomain[0]?.getTime?.() ?? 0,
            }),
        [renderData, xAccessor, dataKey, innerWidth, xScaleDomain]
    );

    const targetPoints = useMemo(
        () =>
            computeSeriesPathPoints(
                renderData,
                xAccessor,
                xScale,
                yScale,
                dataKey
            ),
        [renderData, xAccessor, xScale, yScale, dataKey]
    );

    const previousTransitionSignatureReference = useRef(transitionSignature);

    useEffect(() => {
        if (!animatingReference.current) {
            displayedPointsReference.current = targetPoints;
        }
    }, [targetPoints]);

    useEffect(() => {
        const shouldAnimate =
            enabled &&
            !reducedMotion &&
            chartPhase === "ready" &&
            durationMs > 0 &&
            renderData.length > 0;

        if (!shouldAnimate) {
            animatingReference.current = false;
            setAnimatedPoints(null);
            displayedPointsReference.current = targetPoints;
            previousTransitionSignatureReference.current = transitionSignature;
            return;
        }

        if (
            previousTransitionSignatureReference.current === transitionSignature
        ) {
            return;
        }
        previousTransitionSignatureReference.current = transitionSignature;

        const fromPoints = displayedPointsReference.current ?? targetPoints;
        if (fromPoints.length === 0) {
            displayedPointsReference.current = targetPoints;
            return;
        }

        animatingReference.current = true;
        const fromSnapshot = fromPoints;

        const control = animate(0, 1, {
            duration: durationMs / 1000,
            ease: [...LINE_LOADING_PULSE_EASE],
            onComplete: () => {
                animatingReference.current = false;
                displayedPointsReference.current = targetPoints;
                setAnimatedPoints(null);
            },
            onUpdate: (progress) => {
                const currentTarget = computeSeriesPathPoints(
                    renderData,
                    xAccessor,
                    xScale,
                    yScale,
                    dataKey
                );
                const next = interpolateSeriesPathPoints(
                    fromSnapshot,
                    currentTarget,
                    progress
                );
                displayedPointsReference.current = next;
                setAnimatedPoints(next);
            },
        });

        return () => {
            control.stop();
            animatingReference.current = false;
        };
    }, [
        transitionSignature,
        chartPhase,
        durationMs,
        enabled,
        reducedMotion,
        renderData,
        xAccessor,
        xScale,
        yScale,
        dataKey,
        targetPoints,
    ]);

    const activePoints = animatedPoints ?? targetPoints;
    const pathD = useMemo(
        () => seriesPathFromPoints(activePoints, curve),
        [activePoints, curve]
    );

    return {
        isPathAnimating: animatedPoints != undefined,
        pathD,
    };
}
