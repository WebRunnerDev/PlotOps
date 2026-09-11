/** Collapsed Description max height (~260px at 16px root). */
export const DESCRIPTION_COLLAPSE_MAX_HEIGHT_REM = 16.25;

export type DescriptionCollapseInput = {
    dirty: boolean;
    expanded: boolean;
    focused: boolean;
    overflows: boolean;
    preferenceEnabled: boolean;
};

export type DescriptionCollapseView = {
    isClamped: boolean;
    showCollapseControl: boolean;
    showExpandControl: boolean;
};

/**
 * Pure view model for Description collapse/expand in the Task drawer.
 * Clamp applies whenever the preference is on and the field is not expanded
 * (short content is unaffected by max-height). Show more only when content
 * overflows. Show less is withheld while dirty or focused.
 */
export function resolveDescriptionCollapseView(
    input: DescriptionCollapseInput
): DescriptionCollapseView {
    if (!input.preferenceEnabled) {
        return {
            isClamped: false,
            showCollapseControl: false,
            showExpandControl: false,
        };
    }

    if (!input.expanded) {
        return {
            isClamped: true,
            showCollapseControl: false,
            showExpandControl: input.overflows,
        };
    }

    return {
        isClamped: false,
        showCollapseControl: input.overflows && !input.dirty && !input.focused,
        showExpandControl: false,
    };
}
