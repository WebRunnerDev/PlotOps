import { createVerify, generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import {
    buildInstallUrl,
    createAppJwt,
    fetchRepositoryInstallation,
} from "./github-app";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
});

function decodeSegment(segment: string): unknown {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8"));
}

function verifies(jwt: string): boolean {
    const [header, payload, signature] = jwt.split(".");
    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    return verifier.verify(publicKey, Buffer.from(signature!, "base64url"));
}

describe("createAppJwt", () => {
    it.each([
        ["PKCS#1 (as GitHub issues it)", "pkcs1"],
        ["PKCS#8", "pkcs8"],
    ] as const)("signs an RS256 App JWT from a %s key", async (_, type) => {
        const pem = privateKey.export({ format: "pem", type }).toString();

        const jwt = await createAppJwt("12345", pem, 1_000_000);

        expect(decodeSegment(jwt.split(".")[0]!)).toEqual({
            alg: "RS256",
            typ: "JWT",
        });
        expect(decodeSegment(jwt.split(".")[1]!)).toEqual({
            exp: 1_000_540,
            iat: 999_940,
            iss: "12345",
        });
        expect(verifies(jwt)).toBe(true);
    });

    it(String.raw`accepts a key pasted with literal \n sequences`, async () => {
        const pem = privateKey
            .export({ format: "pem", type: "pkcs1" })
            .toString()
            .replaceAll("\n", String.raw`\n`);

        const jwt = await createAppJwt("1", pem, 0);

        expect(verifies(jwt)).toBe(true);
    });
});

describe("fetchRepositoryInstallation", () => {
    it.each([
        [200, "installed"],
        [404, "not_installed"],
        [403, "unknown"],
        [500, "unknown"],
    ] as const)("maps HTTP %i to %s", async (status, expected) => {
        const fetchImpl = vi.fn(
            async () => new Response("{}", { status })
        ) as unknown as typeof fetch;

        await expect(
            fetchRepositoryInstallation("jwt", "acme/web", fetchImpl)
        ).resolves.toBe(expected);
        expect(fetchImpl).toHaveBeenCalledWith(
            "https://api.github.com/repos/acme/web/installation",
            expect.objectContaining({
                headers: expect.objectContaining({
                    Authorization: "Bearer jwt",
                }),
            })
        );
    });

    it("is unknown when the network call throws or the name is malformed", async () => {
        const failing = vi.fn(async () => {
            throw new Error("offline");
        }) as unknown as typeof fetch;

        await expect(
            fetchRepositoryInstallation("jwt", "acme/web", failing)
        ).resolves.toBe("unknown");
        await expect(
            fetchRepositoryInstallation("jwt", "not-a-full-name", failing)
        ).resolves.toBe("unknown");
    });
});

describe("buildInstallUrl", () => {
    it("links to the App's install page and rejects odd slugs", () => {
        expect(buildInstallUrl(" plotops-sync ")).toBe(
            "https://github.com/apps/plotops-sync/installations/new"
        );
        expect(buildInstallUrl("../evil")).toBeNull();
        expect(buildInstallUrl()).toBeNull();
    });
});
