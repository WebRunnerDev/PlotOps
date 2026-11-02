export type SettingsSectionSearch<T extends string> = {
    section?: T;
};

/** `validateSearch` for settings pages: keeps `?section=` only when it names a known section. */
export function parseSettingsSectionSearch<T extends string>(
    search: Record<string, unknown>,
    sections: readonly T[]
): SettingsSectionSearch<T> {
    const section = search.section;
    return typeof section === "string" &&
        (sections as readonly string[]).includes(section)
        ? { section: section as T }
        : {};
}

/** Requested section when visible; otherwise the first visible one (unknown, hidden by access or Guest Mode). */
export function resolveSettingsSection<T extends string>(
    requested: T | undefined,
    visible: readonly T[],
    fallback: T
): T {
    if (requested !== undefined && visible.includes(requested)) {
        return requested;
    }
    return visible[0] ?? fallback;
}
