export function sprintHeadingId(sprintId: string) {
    return `${sprintSectionId(sprintId)}-title`;
}

export function sprintSectionId(sprintId: string) {
    return `sprint-${sprintId}`;
}
