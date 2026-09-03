"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import type { ChartPhase } from "./chart-phase";

import { LINE_LOADING_PULSE_EASE } from "./line-loading-timing";
import {
    domainsEqual,
    isYDomainTweenPhase,
    resolveAnimatedYDestinationDomains,
    shouldTweenYDomain,
    type YDomain,
} from "./y-domain-utils";

export interface UseAnimatedYDomainsOptions {
    chartPhase: ChartPhase;
    durationMs: number;
    enabled: boolean;
    onSettled?: () => void;
    skeletonByAxis: Record<string, YDomain>;
    targetByAxis: Record<string, YDomain>;
    /** When true, tweens y-domains on target changes while the chart is in the ready phase (e.g. brush zoom). */
    tweenOnTargetChange?: boolean;
}

export function useAnimatedYDomains({
    chartPhase,
    durationMs,
    enabled,
    onSettled,
    skeletonByAxis,
    targetByAxis,
    tweenOnTargetChange = false,
}: UseAnimatedYDomainsOptions): Record<string, YDomain> {
    const reducedMotion = useReducedMotion();
    const destinationByAxis = resolveAnimatedYDestinationDomains(
        chartPhase,
        skeletonByAxis,
        targetByAxis
    );
    const destinationReference = useRef(destinationByAxis);
    destinationReference.current = destinationByAxis;
    const skeletonReference = useRef(skeletonByAxis);
    skeletonReference.current = skeletonByAxis;
    const targetReference = useRef(targetByAxis);
    targetReference.current = targetByAxis;

    const [animatedByAxis, setAnimatedByAxis] = useState(destinationByAxis);
    const animatedReference = useRef(animatedByAxis);
    const previousPhaseReference = useRef(chartPhase);
    const onSettledReference = useRef(onSettled);
    onSettledReference.current = onSettled;

    useEffect(() => {
        animatedReference.current = animatedByAxis;
    }, [animatedByAxis]);

    useEffect(() => {
        if (previousPhaseReference.current === chartPhase) {
            return;
        }
        previousPhaseReference.current = chartPhase;

        const settle = () => {
            onSettledReference.current?.();
        };

        // Keep grid spacing frozen while the series exits the viewport.
        if (chartPhase === "exiting") {
            snapDomains(
                skeletonReference.current,
                setAnimatedByAxis,
                animatedReference
            );
            return;
        }
        if (chartPhase === "exitingReady") {
            snapDomains(
                targetReference.current,
                setAnimatedByAxis,
                animatedReference
            );
            return;
        }
        if (chartPhase === "loading") {
            snapDomains(
                skeletonReference.current,
                setAnimatedByAxis,
                animatedReference
            );
            return;
        }
        if (chartPhase === "revealing" || chartPhase === "ready") {
            snapDomains(
                targetReference.current,
                setAnimatedByAxis,
                animatedReference
            );
            return;
        }

        if (!isYDomainTweenPhase(chartPhase)) {
            return;
        }

        const control = tweenDomains({
            animatedRef: animatedReference,
            destination: destinationReference.current,
            durationMs,
            enabled,
            onSettled: settle,
            reducedMotion,
            setAnimatedByAxis,
        });

        return () => control?.stop();
    }, [chartPhase, durationMs, enabled, reducedMotion]);

    const targetSignature = JSON.stringify(targetByAxis);
    const previousTargetSignatureReference = useRef(targetSignature);

    useEffect(() => {
        const inLivePhase =
            chartPhase === "ready" || chartPhase === "revealing";

        if (!inLivePhase) {
            previousTargetSignatureReference.current = targetSignature;
            return;
        }

        if (previousTargetSignatureReference.current === targetSignature) {
            return;
        }
        previousTargetSignatureReference.current = targetSignature;

        if (tweenOnTargetChange && chartPhase === "ready") {
            const control = tweenDomains({
                animatedRef: animatedReference,
                destination: targetReference.current,
                durationMs,
                enabled,
                onSettled: () => onSettledReference.current?.(),
                reducedMotion,
                setAnimatedByAxis,
            });

            return () => control?.stop();
        }

        snapDomains(
            targetReference.current,
            setAnimatedByAxis,
            animatedReference
        );
    }, [
        chartPhase,
        durationMs,
        enabled,
        reducedMotion,
        targetSignature,
        tweenOnTargetChange,
    ]);

    return animatedByAxis;
}

function lerpDomain(from: YDomain, to: YDomain, progress: number): YDomain {
    return [
        from[0] + (to[0] - from[0]) * progress,
        from[1] + (to[1] - from[1]) * progress,
    ];
}

function snapDomains(
    domains: Record<string, YDomain>,
    setAnimatedByAxis: (domains: Record<string, YDomain>) => void,
    animatedReference: { current: Record<string, YDomain> }
) {
    if (domainsEqual(animatedReference.current, domains)) {
        return;
    }
    setAnimatedByAxis(domains);
    animatedReference.current = domains;
}

function tweenDomains({
    animatedRef,
    destination,
    durationMs,
    enabled,
    onSettled,
    reducedMotion,
    setAnimatedByAxis,
}: {
    animatedRef: { current: Record<string, YDomain> };
    destination: Record<string, YDomain>;
    durationMs: number;
    enabled: boolean;
    onSettled?: () => void;
    reducedMotion: boolean | null;
    setAnimatedByAxis: (domains: Record<string, YDomain>) => void;
}) {
    if (domainsEqual(animatedRef.current, destination)) {
        onSettled?.();
        return;
    }

    if (!enabled || reducedMotion) {
        snapDomains(destination, setAnimatedByAxis, animatedRef);
        onSettled?.();
        return;
    }

    const axisIds = Object.keys(destination);
    const fromSnapshot = animatedRef.current;

    let needsTween = false;
    for (const axisId of axisIds) {
        const from =
            fromSnapshot[axisId] ??
            destination[axisId] ??
            ([0, 100] as YDomain);
        const to = destination[axisId] ?? from;
        if (shouldTweenYDomain(from, to)) {
            needsTween = true;
            break;
        }
    }

    if (!needsTween) {
        snapDomains(destination, setAnimatedByAxis, animatedRef);
        onSettled?.();
        return;
    }

    const fromByAxis: Record<string, YDomain> = {};
    for (const axisId of axisIds) {
        fromByAxis[axisId] = fromSnapshot[axisId] ??
            destination[axisId] ?? [0, 100];
    }

    const control = animate(0, 1, {
        duration: durationMs / 1000,
        ease: [...LINE_LOADING_PULSE_EASE],
        onComplete: () => {
            snapDomains(destination, setAnimatedByAxis, animatedRef);
            onSettled?.();
        },
        onUpdate: (progress) => {
            const next: Record<string, YDomain> = {};
            for (const axisId of axisIds) {
                const from =
                    fromByAxis[axisId] ??
                    destination[axisId] ??
                    ([0, 100] as YDomain);
                const to = destination[axisId] ?? from;
                next[axisId] = shouldTweenYDomain(from, to)
                    ? lerpDomain(from, to, progress)
                    : to;
            }
            animatedRef.current = next;
            setAnimatedByAxis(next);
        },
    });

    return control;
}
