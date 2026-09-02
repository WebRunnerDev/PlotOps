/** Mirrors `[auth]` password settings in supabase/config.toml. */
export const MIN_PASSWORD_LENGTH = 8;

export function meetsPasswordPolicy(password: string): boolean {
    if (password.length < MIN_PASSWORD_LENGTH) {
        return false;
    }
    if (!/[a-z]/.test(password)) {
        return false;
    }
    if (!/[A-Z]/.test(password)) {
        return false;
    }
    if (!/\d/.test(password)) {
        return false;
    }
    return true;
}
