import { useSyncExternalStore } from "react";

import {
    safeGetItem,
    safeRemoveItem,
    safeSetItem,
} from "@/shared/lib/safe-storage";

import type { GuestSandbox } from "../model/types";

import { cloneGuestDemoSeed } from "./guest-demo-seed";

/** Synthetic chrome identity for a Guest Session — not a Supabase user. */
export type GuestDisplayIdentity = {
    firstName: string;
    lastName: string;
    username: string;
};

/**
 * Internal sessionStorage key for the Guest Session signal + sandbox.
 * Not part of the public guest-mode contract — do not assert in callers/tests.
 */
const GUEST_SESSION_STORAGE_KEY = "plotops_guest_session";

const SYNTHETIC_GUEST_IDENTITY: GuestDisplayIdentity = {
    firstName: "Demo",
    lastName: "Guest",
    username: "guest",
};

const guestSessionListeners = new Set<() => void>();

type StoredGuestSession = {
    identity: GuestDisplayIdentity;
    sandbox: GuestSandbox;
};

export function getGuestDisplayIdentity(): GuestDisplayIdentity | null {
    return readSession()?.identity ?? null;
}

/** Deep-cloned sandbox for the active Guest Session, or null when not Guest. */
export function getGuestSandbox(): GuestSandbox | null {
    const session = readSession();
    if (!session) {
        return null;
    }
    const sandbox = structuredClone(session.sandbox);
    if (!Array.isArray(sandbox.comments)) {
        sandbox.comments = [];
    }
    if (!Array.isArray(sandbox.taskLinks)) {
        sandbox.taskLinks = [];
    }
    if (!Array.isArray(sandbox.customFieldDefinitions)) {
        sandbox.customFieldDefinitions = [];
    }
    if (!Array.isArray(sandbox.customFieldValues)) {
        sandbox.customFieldValues = [];
    }
    ensureGuestDescriptionFields(sandbox);
    return sandbox;
}

/** True when a Guest Session is active in this browser session. */
export function isGuest(): boolean {
    return readSession() !== null;
}

export function leaveGuestSession(): void {
    safeRemoveItem("sessionStorage", GUEST_SESSION_STORAGE_KEY);
    notifyGuestSessionListeners();
}

/**
 * Reclone the clean seed while staying in Guest Mode.
 * No-op when no Guest Session is active.
 */
export function resetGuestSession(): GuestDisplayIdentity | null {
    if (!isGuest()) {
        return null;
    }
    return persistSession(SYNTHETIC_GUEST_IDENTITY, cloneGuestDemoSeed());
}

export function startGuestSession(): GuestDisplayIdentity {
    return persistSession(SYNTHETIC_GUEST_IDENTITY, cloneGuestDemoSeed());
}

/** Subscribe to Guest Session start / leave / reset / sandbox writes. */
export function subscribeGuestSession(listener: () => void): () => void {
    guestSessionListeners.add(listener);
    return () => {
        guestSessionListeners.delete(listener);
    };
}

/**
 * Read–mutate–write the active Guest sandbox.
 * Throws when no Guest Session is active (fail-closed).
 */
export function updateGuestSandbox(
    mutator: (sandbox: GuestSandbox) => void
): GuestSandbox {
    const sandbox = getGuestSandbox();
    if (!sandbox) {
        throw new Error("No Guest Session");
    }
    mutator(sandbox);
    writeGuestSandbox(sandbox);
    return sandbox;
}

/** React hook — tracks {@link isGuest} across lifecycle mutations. */
export function useIsGuest(): boolean {
    return useSyncExternalStore(subscribeGuestSession, isGuest, () => false);
}

/**
 * Replace the sandbox for the active Guest Session (deep-cloned on write).
 * No-op when no Guest Session is active — fail-closed for non-Guest callers.
 */
export function writeGuestSandbox(sandbox: GuestSandbox): void {
    const session = readSession();
    if (!session) {
        return;
    }
    persistSession(session.identity, structuredClone(sandbox));
}

function ensureGuestDescriptionFields(sandbox: GuestSandbox): void {
    const projectIds = new Set(sandbox.projects.map((project) => project.id));
    for (const projectId of projectIds) {
        const hasDescription = sandbox.customFieldDefinitions.some(
            (field) =>
                field.projectId === projectId &&
                field.systemKey === "description"
        );
        if (hasDescription) continue;

        const namedDescription = sandbox.customFieldDefinitions.find(
            (field) =>
                field.projectId === projectId &&
                !field.systemKey &&
                field.name.toLowerCase() === "description"
        );
        if (namedDescription) {
            namedDescription.systemKey = "description";
            continue;
        }

        for (const field of sandbox.customFieldDefinitions) {
            if (field.projectId === projectId && !field.systemKey) {
                field.position += 1;
            }
        }

        let name = "Description";
        if (
            sandbox.customFieldDefinitions.some(
                (field) =>
                    field.projectId === projectId &&
                    field.name.toLowerCase() === name.toLowerCase()
            )
        ) {
            name = "Task description";
        }

        sandbox.customFieldDefinitions.push({
            appliesTo: ["task", "bug", "feature"],
            id: crypto.randomUUID(),
            name,
            position: 0,
            projectId,
            systemKey: "description",
        });
    }
}

function isGuestSandbox(value: unknown): value is GuestSandbox {
    if (!value || typeof value !== "object") {
        return false;
    }
    const record = value as Record<string, unknown>;
    // Older sessions omit `comments` — treat as empty (migrate on read).
    const commentsOk =
        record.comments === undefined || Array.isArray(record.comments);
    const taskLinksOk =
        record.taskLinks === undefined || Array.isArray(record.taskLinks);
    const customFieldsOk =
        record.customFieldDefinitions === undefined ||
        Array.isArray(record.customFieldDefinitions);
    const customFieldValuesOk =
        record.customFieldValues === undefined ||
        Array.isArray(record.customFieldValues);
    return (
        commentsOk &&
        taskLinksOk &&
        customFieldsOk &&
        customFieldValuesOk &&
        Array.isArray(record.teams) &&
        Array.isArray(record.projects) &&
        Array.isArray(record.boards) &&
        Array.isArray(record.tasks) &&
        Array.isArray(record.sprints) &&
        Array.isArray(record.activity) &&
        Array.isArray(record.notifications) &&
        Array.isArray(record.labels)
    );
}

function isStoredGuestSession(value: unknown): value is StoredGuestSession {
    if (!value || typeof value !== "object") {
        return false;
    }
    const record = value as Record<string, unknown>;
    const identity = record.identity;
    if (!identity || typeof identity !== "object") {
        return false;
    }
    const id = identity as Record<string, unknown>;
    if (
        typeof id.firstName !== "string" ||
        typeof id.lastName !== "string" ||
        typeof id.username !== "string"
    ) {
        return false;
    }
    return isGuestSandbox(record.sandbox);
}

function notifyGuestSessionListeners(): void {
    for (const listener of guestSessionListeners) {
        listener();
    }
}

function persistSession(
    identity: GuestDisplayIdentity,
    sandbox: GuestSandbox
): GuestDisplayIdentity {
    const session: StoredGuestSession = {
        identity: { ...identity },
        sandbox: structuredClone(sandbox),
    };
    safeSetItem(
        "sessionStorage",
        GUEST_SESSION_STORAGE_KEY,
        JSON.stringify(session)
    );
    notifyGuestSessionListeners();
    return session.identity;
}

function readSession(): null | StoredGuestSession {
    const raw = safeGetItem("sessionStorage", GUEST_SESSION_STORAGE_KEY);
    if (!raw) {
        return null;
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isStoredGuestSession(parsed)) {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
}
