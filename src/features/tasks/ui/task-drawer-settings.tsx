import { useTranslation } from "react-i18next";

import {
    isTaskDrawerSide,
    TASK_DRAWER_SIDES,
    type TaskDrawerSide,
} from "@/features/tasks/lib/resolve-task-drawer-placement";
import {
    TASK_COPY_METADATA_FIELDS,
    type TaskCopyMetadataField,
    useTaskDrawerPreferencesStore,
} from "@/features/tasks/model/task-drawer-preferences-store";
import { cn } from "@/shared/lib/utils";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";
import { Checkbox } from "@/shared/shadcn/ui/checkbox";
import { Label } from "@/shared/shadcn/ui/label";

export function TaskDrawerSettings() {
    const { t } = useTranslation("common");
    const { t: tBoard } = useTranslation("board");
    const openAfterCreate = useTaskDrawerPreferencesStore(
        (state) => state.openAfterCreate
    );
    const collapseLongDescription = useTaskDrawerPreferencesStore(
        (state) => state.collapseLongDescription
    );
    const drawerSide = useTaskDrawerPreferencesStore(
        (state) => state.drawerSide
    );
    const copyIncludeTaskKey = useTaskDrawerPreferencesStore(
        (state) => state.copyIncludeTaskKey
    );
    const copyIncludeTaskType = useTaskDrawerPreferencesStore(
        (state) => state.copyIncludeTaskType
    );
    const copyMetadataFields = useTaskDrawerPreferencesStore(
        (state) => state.copyMetadataFields
    );
    const setOpenAfterCreate = useTaskDrawerPreferencesStore(
        (state) => state.setOpenAfterCreate
    );
    const setCollapseLongDescription = useTaskDrawerPreferencesStore(
        (state) => state.setCollapseLongDescription
    );
    const setDrawerSide = useTaskDrawerPreferencesStore(
        (state) => state.setDrawerSide
    );
    const setCopyIncludeTaskKey = useTaskDrawerPreferencesStore(
        (state) => state.setCopyIncludeTaskKey
    );
    const setCopyIncludeTaskType = useTaskDrawerPreferencesStore(
        (state) => state.setCopyIncludeTaskType
    );
    const setCopyMetadataField = useTaskDrawerPreferencesStore(
        (state) => state.setCopyMetadataField
    );

    return (
        <Card className="max-w-none rounded-none border border-border bg-card/60 shadow-none ring-1 ring-primary/15 backdrop-blur-sm">
            <CardHeader className="gap-3 border-b border-border/80 pb-4">
                <div className="flex min-w-0 flex-col gap-2">
                    <p className="font-mono text-meta text-primary uppercase tracking-[0.14em]">
                        01
                    </p>
                    <CardTitle>{t("uiSettings.title")}</CardTitle>
                    <div aria-hidden className="h-px w-10 bg-primary/60" />
                    <CardDescription>
                        {t("uiSettings.description")}
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-7 pt-5">
                <div className="flex items-start gap-3">
                    <Checkbox
                        checked={openAfterCreate}
                        className="mt-0.5"
                        id="settings-open-drawer-after-create"
                        onCheckedChange={(checked) => {
                            setOpenAfterCreate(checked === true);
                        }}
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                        <Label
                            className="cursor-pointer leading-snug"
                            htmlFor="settings-open-drawer-after-create"
                        >
                            {t("uiSettings.openAfterCreate")}
                        </Label>
                        <p className="text-meta text-muted-foreground normal-case tracking-normal">
                            {t("uiSettings.openAfterCreateHint")}
                        </p>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <Checkbox
                        checked={collapseLongDescription}
                        className="mt-0.5"
                        id="settings-collapse-long-description"
                        onCheckedChange={(checked) => {
                            setCollapseLongDescription(checked === true);
                        }}
                    />
                    <div className="flex min-w-0 flex-col gap-1">
                        <Label
                            className="cursor-pointer leading-snug"
                            htmlFor="settings-collapse-long-description"
                        >
                            {t("uiSettings.collapseLongDescription")}
                        </Label>
                        <p className="text-meta text-muted-foreground normal-case tracking-normal">
                            {t("uiSettings.collapseLongDescriptionHint")}
                        </p>
                    </div>
                </div>

                <fieldset className="flex min-w-0 flex-col gap-3">
                    <legend className="mb-0 text-ui text-foreground">
                        {t("uiSettings.drawerSide")}
                    </legend>
                    <div
                        aria-label={t("uiSettings.drawerSide")}
                        className="grid grid-cols-3 gap-2 sm:gap-3"
                        role="radiogroup"
                    >
                        {TASK_DRAWER_SIDES.map((side) => {
                            const selected = drawerSide === side;
                            return (
                                <button
                                    aria-checked={selected}
                                    className={cn(
                                        "group relative flex min-w-0 flex-col items-center gap-2.5 border px-2 py-3 transition-[color,background-color,border-color,transform] duration-300 ease-(--ease-out-expo)",
                                        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                        selected
                                            ? "border-primary/50 bg-primary/8 text-foreground shadow-[inset_0_-2px_0_0_var(--primary)]"
                                            : "border-border bg-background/40 text-muted-foreground hover:border-border hover:bg-muted/30 hover:text-foreground"
                                    )}
                                    key={side}
                                    onClick={() => {
                                        if (isTaskDrawerSide(side)) {
                                            setDrawerSide(side);
                                        }
                                    }}
                                    role="radio"
                                    type="button"
                                >
                                    <DrawerSideGlyph
                                        selected={selected}
                                        side={side}
                                    />
                                    <span className="font-mono text-meta uppercase tracking-widest">
                                        {drawerSideLabel(side, t)}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-meta text-muted-foreground normal-case tracking-normal">
                        {t("uiSettings.drawerSideHint")}
                    </p>
                </fieldset>

                <fieldset className="flex min-w-0 flex-col gap-4">
                    <legend className="mb-0 text-ui text-foreground">
                        {t("uiSettings.copyFields")}
                    </legend>
                    <p className="text-meta text-muted-foreground normal-case tracking-normal">
                        {t("uiSettings.copyFieldsHint")}
                    </p>
                    <CopyFieldCheckbox
                        checked={copyIncludeTaskKey}
                        hint={t("uiSettings.copyTaskKeyHint")}
                        id="settings-copy-task-key"
                        label={t("uiSettings.copyTaskKey")}
                        onCheckedChange={setCopyIncludeTaskKey}
                    />
                    <CopyFieldCheckbox
                        checked={copyIncludeTaskType}
                        id="settings-copy-task-type"
                        label={t("uiSettings.copyTaskType")}
                        onCheckedChange={setCopyIncludeTaskType}
                    />
                    <div className="flex min-w-0 flex-col gap-3">
                        <div className="flex min-w-0 flex-col gap-1">
                            <p className="text-ui text-foreground">
                                {t("uiSettings.copyTaskMetadata")}
                            </p>
                            <p className="text-meta text-muted-foreground normal-case tracking-normal">
                                {t("uiSettings.copyTaskMetadataHint")}
                            </p>
                        </div>
                        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                            {TASK_COPY_METADATA_FIELDS.map((field) => (
                                <CopyFieldCheckbox
                                    checked={copyMetadataFields[field]}
                                    id={`settings-copy-meta-${field}`}
                                    key={field}
                                    label={metadataFieldLabel(field, tBoard)}
                                    onCheckedChange={(checked) => {
                                        setCopyMetadataField(field, checked);
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </fieldset>
            </CardContent>
        </Card>
    );
}

function CopyFieldCheckbox({
    checked,
    hint,
    id,
    label,
    onCheckedChange,
}: {
    checked: boolean;
    hint?: string;
    id: string;
    label: string;
    onCheckedChange: (checked: boolean) => void;
}) {
    return (
        <div className="flex items-start gap-3">
            <Checkbox
                checked={checked}
                className="mt-0.5"
                id={id}
                onCheckedChange={(next) => {
                    onCheckedChange(next === true);
                }}
            />
            <div className="flex min-w-0 flex-col gap-1">
                <Label className="cursor-pointer leading-snug" htmlFor={id}>
                    {label}
                </Label>
                {hint ? (
                    <p className="text-meta text-muted-foreground normal-case tracking-normal">
                        {hint}
                    </p>
                ) : undefined}
            </div>
        </div>
    );
}

function DrawerSideGlyph({
    selected,
    side,
}: {
    selected: boolean;
    side: TaskDrawerSide;
}) {
    return (
        <span
            aria-hidden
            className={cn(
                "relative block h-12 w-16 border transition-colors duration-300 ease-(--ease-out-expo)",
                selected ? "border-primary/45" : "border-border"
            )}
        >
            <span
                className={cn(
                    "absolute bg-primary/70 transition-[inset,opacity] duration-300 ease-(--ease-out-expo)",
                    side === "bottom" && "inset-x-1 bottom-1 h-3",
                    side === "left" && "inset-y-1 left-1 w-3.5",
                    side === "right" && "inset-y-1 right-1 w-3.5",
                    selected ? "opacity-100" : "opacity-55"
                )}
            />
        </span>
    );
}

function drawerSideLabel(
    side: TaskDrawerSide,
    t: (key: string) => string
): string {
    if (side === "left") return t("uiSettings.drawerSideLeft");
    if (side === "right") return t("uiSettings.drawerSideRight");
    return t("uiSettings.drawerSideBottom");
}

function metadataFieldLabel(
    field: TaskCopyMetadataField,
    tBoard: (key: string) => string
): string {
    return tBoard(`fields.${field}`);
}
