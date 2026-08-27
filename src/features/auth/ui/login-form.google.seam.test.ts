import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readSource(filename: string) {
    return readFileSync(path.join(dirname, filename), "utf8");
}

describe("auth Google OAuth seam", () => {
    it("LoginForm starts Google OAuth through signInWithGoogle", () => {
        expect(readSource("login-form.tsx")).toMatch(/signInWithGoogle/);
    });

    it("SignUpForm starts Google OAuth through signInWithGoogle", () => {
        expect(readSource("sign-up-form.tsx")).toMatch(/signInWithGoogle/);
    });
});
