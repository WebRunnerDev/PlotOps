/**
 * GitHub App authentication + installation lookups (ADR 0035, "GitHub App
 * status per Repository"). Uses WebCrypto only, so it runs in Deno and Node.
 */

export type InstallationStatus = "installed" | "not_installed" | "unknown";

const GITHUB_API = "https://api.github.com";

/** GitHub rejects App JWTs that live longer than 10 minutes. */
const JWT_TTL_SEC = 9 * 60;
/** Back-date `iat` against clock drift, as GitHub recommends. */
const JWT_CLOCK_SKEW_SEC = 60;

/** `https://github.com/apps/<slug>/installations/new`, or null for a bad slug. */
export function buildInstallUrl(slug?: null | string): null | string {
    const trimmed = slug?.trim() ?? "";
    if (!/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) return null;
    return `https://github.com/apps/${trimmed}/installations/new`;
}

/** RS256 JWT that authenticates as the GitHub App (`iss` = App id). */
export async function createAppJwt(
    appId: string,
    privateKeyPem: string,
    nowSec: number
): Promise<string> {
    const key = await importRsaPrivateKey(privateKeyPem);
    const header = base64UrlJson({ alg: "RS256", typ: "JWT" });
    const payload = base64UrlJson({
        exp: nowSec + JWT_TTL_SEC,
        iat: nowSec - JWT_CLOCK_SKEW_SEC,
        iss: appId,
    });
    const signingInput = `${header}.${payload}`;
    const signature = await crypto.subtle.sign(
        "RSASSA-PKCS1-v1_5",
        key,
        new TextEncoder().encode(signingInput)
    );
    return `${signingInput}.${base64Url(new Uint8Array(signature))}`;
}

/**
 * `GET /app`: proves the App credentials work and yields the slug for the
 * install link. Null when GitHub rejects the JWT — GitHub answers 404 (not
 * 401) to a bad App JWT on the installation endpoint, so a status lookup
 * without this check would report every Repository as not installed.
 */
export async function fetchApp(
    jwt: string,
    fetchImpl: typeof fetch = fetch
): Promise<null | { slug: null | string }> {
    try {
        const response = await fetchImpl(`${GITHUB_API}/app`, {
            headers: githubAppHeaders(jwt),
        });
        if (!response.ok) return null;
        const body = (await response.json()) as { slug?: unknown };
        return { slug: typeof body.slug === "string" ? body.slug : null };
    } catch {
        return null;
    }
}

/**
 * Whether the App is installed on `owner/repo`: 200 → installed, 404 → not
 * installed, anything else (rate limit, outage) → unknown.
 */
export async function fetchRepositoryInstallation(
    jwt: string,
    fullName: string,
    fetchImpl: typeof fetch = fetch
): Promise<InstallationStatus> {
    const [owner, repo, ...rest] = fullName.split("/");
    if (!owner || !repo || rest.length > 0) return "unknown";

    try {
        const response = await fetchImpl(
            `${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/installation`,
            { headers: githubAppHeaders(jwt) }
        );
        if (response.status === 200) return "installed";
        if (response.status === 404) return "not_installed";
        return "unknown";
    } catch {
        return "unknown";
    }
}

/**
 * Imports the App private key. GitHub hands out PKCS#1 (`BEGIN RSA PRIVATE
 * KEY`), which WebCrypto cannot read, so it is wrapped into PKCS#8 first.
 * Literal `\n` sequences (how secrets are often pasted) count as newlines.
 */
export async function importRsaPrivateKey(pem: string): Promise<CryptoKey> {
    const normalized = pem.replaceAll(String.raw`\n`, "\n").trim();
    const pkcs1 = /-----BEGIN RSA PRIVATE KEY-----/.test(normalized);
    const body = normalized
        .replaceAll(/-----(BEGIN|END) [A-Z ]+-----/g, "")
        .replaceAll(/\s+/g, "");
    const der = Uint8Array.from(atob(body), (char) => char.codePointAt(0)!);

    return crypto.subtle.importKey(
        "pkcs8",
        pkcs1 ? wrapPkcs1InPkcs8(der) : der,
        { hash: "SHA-256", name: "RSASSA-PKCS1-v1_5" },
        false,
        ["sign"]
    );
}

function base64Url(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) binary += String.fromCodePoint(byte);
    return btoa(binary)
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll(/=+$/g, "");
}

function base64UrlJson(value: unknown): string {
    return base64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
    const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.byteLength;
    }
    return out;
}

function derLength(length: number): Uint8Array {
    if (length < 0x80) return Uint8Array.of(length);
    const bytes: number[] = [];
    for (let rest = length; rest > 0; rest >>= 8) bytes.unshift(rest & 0xff);
    return Uint8Array.of(0x80 | bytes.length, ...bytes);
}

function githubAppHeaders(jwt: string): Record<string, string> {
    return {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${jwt}`,
        "User-Agent": "PlotOps-github-app-status",
        "X-GitHub-Api-Version": "2022-11-28",
    };
}

/** PrivateKeyInfo { version 0, rsaEncryption, OCTET STRING <pkcs1> }. */
function wrapPkcs1InPkcs8(pkcs1: Uint8Array): Uint8Array {
    const version = Uint8Array.of(0x02, 0x01, 0x00);
    const rsaAlgorithm = Uint8Array.of(
        0x30,
        0x0d,
        0x06,
        0x09,
        0x2a,
        0x86,
        0x48,
        0x86,
        0xf7,
        0x0d,
        0x01,
        0x01,
        0x01,
        0x05,
        0x00
    );
    const privateKey = concatBytes(
        Uint8Array.of(0x04),
        derLength(pkcs1.byteLength),
        pkcs1
    );
    const content = concatBytes(version, rsaAlgorithm, privateKey);
    return concatBytes(
        Uint8Array.of(0x30),
        derLength(content.byteLength),
        content
    );
}
