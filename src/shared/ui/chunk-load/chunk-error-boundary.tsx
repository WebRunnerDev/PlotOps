import { Component, type ReactNode } from "react";

import { isChunkLoadError } from "@/shared/lib/chunk-load-error";

type ChunkErrorBoundaryProperties = {
    children: ReactNode;
    fallback: ReactNode;
};

type ChunkErrorBoundaryState = {
    error: unknown;
    hasError: boolean;
};

/**
 * Catches a failed lazy `import()` below it and renders `fallback`.
 * Any other error is re-thrown to the next boundary up.
 */
export class ChunkErrorBoundary extends Component<
    ChunkErrorBoundaryProperties,
    ChunkErrorBoundaryState
> {
    state: ChunkErrorBoundaryState = { error: undefined, hasError: false };

    static getDerivedStateFromError(error: unknown): ChunkErrorBoundaryState {
        return { error, hasError: true };
    }

    render() {
        if (!this.state.hasError) return this.props.children;
        if (!isChunkLoadError(this.state.error)) throw this.state.error;
        return this.props.fallback;
    }
}
