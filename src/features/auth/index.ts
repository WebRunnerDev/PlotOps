export { signInWithGitHub } from "./api/auth-api";
export {
    DEMO_ACCOUNT_BADGE_I18N_KEY,
    demoAccountBadgeVisible,
} from "./lib/demo-account-badge";
export { guestActionPolicy } from "./lib/guest-action-policy";
export type { GuestActionPolicy } from "./lib/guest-action-policy";
export { isProfileGateRequired } from "./lib/guest-profile-gate";
export type { ProfileGateInput } from "./lib/guest-profile-gate";
export { AuthProvider } from "./model/auth-provider";
export type { AuthContextValue } from "./model/types";
export { useAuth } from "./model/use-auth";
export { CompleteProfileForm } from "./ui/complete-profile-form";
export { LoginForm } from "./ui/login-form";
export { ProfileSettingsForm } from "./ui/profile-settings-form";
export { SignUpForm } from "./ui/sign-up-form";
