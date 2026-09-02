/** Publishable Turnstile site key — optional locally when CAPTCHA is disabled in GoTrue. */
export function isTurnstileConfigured(): boolean {
    return Boolean(import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim());
}

export function turnstileSiteKey(): string {
    const key = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
    if (!key) {
        throw new Error("VITE_TURNSTILE_SITE_KEY is not configured");
    }
    return key;
}
