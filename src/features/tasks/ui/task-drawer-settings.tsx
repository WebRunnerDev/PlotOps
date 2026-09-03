import { useTranslation } from "react-i18next";

import {
    isTaskDrawerSide,
    TASK_DRAWER_SIDES,
    type TaskDrawerSide,
} from "@/features/tasks/lib/resolve-task-drawer-placement";
import { useTaskDrawerPreferencesStore } from "@/features/tasks/model/task-drawer-preferences-store";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/shared/shadcn/ui/card";
import { Checkbox } from "@/shared/shadcn/ui/checkbox";
import { Label } from "@/shared/shadcn/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
} from "@/shared/shadcn/ui/select";

export function TaskDrawerSettings() {
    const { t } = useTranslation("common");
    const openAfterCreate = useTaskDrawerPreferencesStore(
        (state) => state.openAfterCreate
    );
    const drawerSide = useTaskDrawerPreferencesStore(
        (state) => state.drawerSide
    );
    const setOpenAfterCreate = useTaskDrawerPreferencesStore(
        (state) => state.setOpenAfterCreate
    );
    const setDrawerSide = useTaskDrawerPreferencesStore(
        (state) => state.setDrawerSide
    );

    return (
        <Card className="max-w-lg">
            <CardHeader>
                <CardTitle>{t("uiSettings.title")}</CardTitle>
                <CardDescription>{t("uiSettings.description")}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
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
                        <p className="text-meta text-muted-foreground">
                            {t("uiSettings.openAfterCreateHint")}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <Label htmlFor="settings-drawer-side">
                        {t("uiSettings.drawerSide")}
                    </Label>
                    <Select
                        onValueChange={(value) => {
                            if (isTaskDrawerSide(value)) {
                                setDrawerSide(value);
                            }
                        }}
                        value={drawerSide}
                    >
                        <SelectTrigger
                            className="w-full max-w-xs"
                            id="settings-drawer-side"
                        >
                            <span>{drawerSideLabel(drawerSide, t)}</span>
                        </SelectTrigger>
                        <SelectContent>
                            {TASK_DRAWER_SIDES.map((side) => (
                                <SelectItem key={side} value={side}>
                                    {drawerSideLabel(side, t)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className="text-meta text-muted-foreground">
                        {t("uiSettings.drawerSideHint")}
                    </p>
                </div>
            </CardContent>
        </Card>
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
