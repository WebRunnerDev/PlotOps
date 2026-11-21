import { RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/shadcn/ui/button";

type ChunkLoadFailedProperties = {
    className?: string;
};

/**
 * Shown when part of the app could not be downloaded — usually a new deploy
 * replaced the files this tab expects. Reloading is the only reliable fix;
 * it is left to the person so unsaved input is never discarded silently.
 */
export function ChunkLoadFailed({ className }: ChunkLoadFailedProperties) {
    const { t } = useTranslation("common");

    return (
        <div
            className={cn(
                "flex flex-col items-start gap-2 rounded-lg border border-dashed border-border p-4 text-ui text-muted-foreground",
                className
            )}
            role="alert"
        >
            <p>{t("chunkLoad.failed")}</p>
            <Button
                onClick={() => globalThis.location.reload()}
                size="xs"
                type="button"
                variant="outline"
            >
                <RefreshCw className="size-3.5" />
                {t("chunkLoad.reload")}
            </Button>
        </div>
    );
}
