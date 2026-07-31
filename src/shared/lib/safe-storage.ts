type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export function safeGetItem(
    kind: "localStorage" | "sessionStorage",
    key: string
): null | string {
    try {
        return getStorage(kind)?.getItem(key) ?? null;
    } catch {
        return null;
    }
}

export function safeRemoveItem(
    kind: "localStorage" | "sessionStorage",
    key: string
): void {
    try {
        getStorage(kind)?.removeItem(key);
    } catch {
        // Storage unavailable — no-op.
    }
}

export function safeSetItem(
    kind: "localStorage" | "sessionStorage",
    key: string,
    value: string
): void {
    try {
        getStorage(kind)?.setItem(key, value);
    } catch {
        // Storage unavailable — no-op.
    }
}

function getStorage(
    kind: "localStorage" | "sessionStorage"
): null | StorageLike {
    try {
        const storage = globalThis[kind];
        if (!storage) return null;
        return storage;
    } catch {
        return null;
    }
}
