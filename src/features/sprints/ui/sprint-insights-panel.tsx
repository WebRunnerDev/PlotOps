import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import type { Sprint } from "@/features/sprints/model/types";

import { buildSprintKpis } from "@/features/sprints/model/build-sprint-kpis";

type SprintInsightsPanelProperties = {
    sprints: readonly Sprint[];
    tasks: ReadonlyArray<{ estimate?: null | number; id: string }>;
};

export function SprintInsightsPanel({
    sprints,
    tasks,
}: SprintInsightsPanelProperties) {
    const { t } = useTranslation("board");
    const kpis = useMemo(() => {
        const closedSprints = sprints.filter(
            (sprint) => sprint.state === "closed"
        );
        return buildSprintKpis({ closedSprints, tasks });
    }, [sprints, tasks]);

    return (
        <section className="rounded-md border border-border bg-card">
            <header className="border-b border-border px-3 py-2">
                <h2 className="text-h3">{t("sprints.insightsTitle")}</h2>
                <p className="text-meta text-muted-foreground">
                    {t("sprints.insightsSubtitle", {
                        count: kpis.windowSize,
                    })}
                </p>
            </header>
            <div className="space-y-3 px-3 py-3">
                {kpis.emptyReason ? (
                    <p className="text-ui text-muted-foreground">
                        {t(`sprints.insightsEmpty.${kpis.emptyReason}`)}
                    </p>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="min-w-0 space-y-1">
                            <p className="text-meta text-muted-foreground">
                                {t("sprints.insightsVelocityLabel")}
                            </p>
                            <p className="text-h3 tabular-nums">
                                {kpis.velocity === null
                                    ? "—"
                                    : t(
                                          kpis.metric === "points"
                                              ? "sprints.insightsVelocityPoints"
                                              : "sprints.insightsVelocityCount",
                                          { value: kpis.velocity }
                                      )}
                            </p>
                            <p className="text-meta text-muted-foreground">
                                {t("sprints.insightsSample", {
                                    count: kpis.sampleSize,
                                })}
                            </p>
                        </div>
                        <div className="min-w-0 space-y-1">
                            <p className="text-meta text-muted-foreground">
                                {t("sprints.insightsAccuracyLabel")}
                            </p>
                            <p className="text-h3 tabular-nums">
                                {kpis.commitmentAccuracy === null
                                    ? "—"
                                    : t("sprints.insightsAccuracyValue", {
                                          percent: Math.round(
                                              kpis.commitmentAccuracy * 100
                                          ),
                                      })}
                            </p>
                            <p className="text-meta text-muted-foreground">
                                {t("sprints.insightsAccuracyHint")}
                            </p>
                        </div>
                    </div>
                )}
                {kpis.metric === "count" && !kpis.emptyReason ? (
                    <p className="text-meta text-muted-foreground">
                        {t("sprints.insightsCountFallback")}
                    </p>
                ) : null}
            </div>
        </section>
    );
}
