/** i18n key under the `common` namespace for the shared demo account chip. */
export const DEMO_ACCOUNT_BADGE_I18N_KEY = "guest.demoAccount" as const;

/** Whether TopBar / settings should show the Demo account badge. */
export function demoAccountBadgeVisible(isGuest: boolean): boolean {
    return isGuest;
}
