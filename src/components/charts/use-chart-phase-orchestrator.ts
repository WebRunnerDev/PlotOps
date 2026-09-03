"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
    type ChartPhase,
    type ChartStatus,
    resolveRestingChartPhase,
} from "./chart-phase";

export interface UseChartPhaseOrchestratorOptions {
    animationDuration: number;
    chartStatus: ChartStatus;
    /** Signature of motion URL state — replays clip reveal in Studio. */
    revealSignature?: string;
    skeletonData: Record<string, unknown>[];
    /** Skip mount/signature enter reveal (static docs previews). */
    skipEnterReveal?: boolean;
    targetData: Record<string, unknown>[];
    yDomainTweenDuration: number;
}

export function useChartPhaseOrchestrator({
    animationDuration,
    chartStatus,
    revealSignature = "",
    skeletonData,
    skipEnterReveal = false,
    targetData,
    yDomainTweenDuration,
}: UseChartPhaseOrchestratorOptions) {
    const [chartPhase, setChartPhase] = useState<ChartPhase>(() =>
        resolveRestingChartPhase(chartStatus)
    );
    const [plotData, setPlotData] = useState<Record<string, unknown>[]>(() =>
        chartStatus === "loading" ? skeletonData : targetData
    );
    const [revealEpoch, setRevealEpoch] = useState(0);
    const [concealEpoch, setConcealEpoch] = useState(0);
    const [isLoaded, setIsLoaded] = useState(() => chartStatus === "ready");
    const previousStatusReference = useRef(chartStatus);
    const phaseReference = useRef(chartPhase);
    phaseReference.current = chartPhase;

    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: status transition branches for animation durations
    useEffect(() => {
        const previousStatus = previousStatusReference.current;
        if (previousStatus === chartStatus) {
            return;
        }
        previousStatusReference.current = chartStatus;

        if (chartStatus === "ready" && previousStatus === "loading") {
            setIsLoaded(false);
            if (animationDuration <= 0) {
                if (yDomainTweenDuration <= 0) {
                    setPlotData(targetData);
                    setChartPhase("revealing");
                } else {
                    setChartPhase("gridTweenReady");
                }
            } else {
                setChartPhase("exiting");
            }
            return;
        }

        if (chartStatus === "loading" && previousStatus === "ready") {
            setIsLoaded(false);
            if (animationDuration <= 0) {
                if (yDomainTweenDuration <= 0) {
                    setPlotData(skeletonData);
                    setChartPhase("loading");
                } else {
                    setChartPhase("gridTweenLoading");
                }
            } else {
                setConcealEpoch((epoch) => epoch + 1);
                setChartPhase("exitingReady");
            }
        }
    }, [
        animationDuration,
        chartStatus,
        skeletonData,
        targetData,
        yDomainTweenDuration,
    ]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: revealSignature replays enter
    useEffect(() => {
        if (skipEnterReveal) {
            return;
        }
        if (chartStatus !== "ready") {
            return;
        }
        if (phaseReference.current !== "ready") {
            return;
        }

        setChartPhase("revealing");
        setIsLoaded(false);
    }, [animationDuration, chartStatus, revealSignature, skipEnterReveal]);

    useEffect(() => {
        switch (chartPhase) {
            case "exiting": {
                setPlotData(skeletonData);
                break;
            }
            case "exitingReady":
            case "gridTweenLoading":
            case "gridTweenReady":
            case "ready":
            case "revealing": {
                setPlotData(targetData);
                break;
            }
            case "loading": {
                if (chartStatus === "loading") {
                    setPlotData(skeletonData);
                }
                break;
            }
            default: {
                break;
            }
        }
    }, [chartPhase, chartStatus, skeletonData, targetData]);

    /** Loading pulse exit finished — tween grid to ready spacing next. */
    const notifyLoadingPulseComplete = useCallback(() => {
        if (phaseReference.current !== "exiting") {
            return;
        }
        setChartPhase("gridTweenReady");
    }, []);

    /** Ready series conceal finished — tween grid to loading spacing next. */
    const notifyRevealConcealComplete = useCallback(() => {
        if (phaseReference.current !== "exitingReady") {
            return;
        }
        setChartPhase("gridTweenLoading");
    }, []);

    /** Grid tween finished — enter the next resting phase. */
    const notifyYDomainTweenComplete = useCallback(() => {
        if (phaseReference.current === "gridTweenLoading") {
            setChartPhase("loading");
            return;
        }
        if (phaseReference.current === "gridTweenReady") {
            setChartPhase("revealing");
        }
    }, []);

    useEffect(() => {
        if (chartPhase !== "revealing") {
            return;
        }

        setRevealEpoch((epoch) => epoch + 1);
        if (animationDuration <= 0) {
            setChartPhase("ready");
            setIsLoaded(true);
            return;
        }

        const timer = globalThis.setTimeout(() => {
            setChartPhase("ready");
            setIsLoaded(true);
        }, animationDuration);
        return () => globalThis.clearTimeout(timer);
    }, [animationDuration, chartPhase]);

    return {
        chartPhase,
        concealEpoch,
        isLoaded,
        notifyLoadingPulseComplete,
        notifyRevealConcealComplete,
        notifyYDomainTweenComplete,
        plotData,
        revealEpoch,
    };
}
