import {
    ErrorComponent,
    type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";

import {
    isChunkLoadError,
    newDeployReloader,
} from "@/shared/lib/chunk-load-error";
import { ChunkLoadFailed } from "@/shared/ui/chunk-load";

/**
 * Router-wide error UI. A route chunk that fails to load means this tab
 * predates a deploy: navigating already discards the page, so reload once to
 * pick up the new build. Everything else keeps TanStack's default display.
 */
export function RouteErrorFallback({ error, ...rest }: ErrorComponentProps) {
    const chunkError = isChunkLoadError(error);
    const [reloading, setReloading] = useState(
        () => chunkError && newDeployReloader.canReload()
    );

    useEffect(() => {
        if (reloading && !newDeployReloader.reload()) setReloading(false);
    }, [reloading]);

    if (!chunkError) return <ErrorComponent error={error} {...rest} />;
    if (reloading) return null;

    return (
        <div className="mx-auto flex max-w-md justify-center px-4 py-16">
            <ChunkLoadFailed />
        </div>
    );
}
