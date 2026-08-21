/** DB cap trigger — “A Project may have at most 10 custom field definitions”. */
export function isCustomFieldCapExceeded(error: unknown): boolean {
    if (typeof error !== "object" || error === null) return false;
    const message =
        "message" in error && typeof error.message === "string"
            ? error.message
            : "";
    return (
        message.includes("at most 10 custom field definitions") ||
        ("code" in error &&
            (error as { code?: unknown }).code === "P0001" &&
            message.toLowerCase().includes("custom field"))
    );
}

/** Postgres unique_violation — e.g. custom_field_definitions_project_name_unique. */
export function isUniqueViolation(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "23505"
    );
}
