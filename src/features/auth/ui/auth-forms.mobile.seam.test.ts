import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function readFormSource(filename: string) {
    return readFileSync(path.join(dirname, filename), "utf8");
}

describe("auth forms mobile seam", () => {
    it("LoginForm stacks fields vertically with full-width prominent submit", () => {
        const source = readFormSource("login-form.tsx");

        expect(source).toMatch(/flex flex-col gap-4/);
        expect(source).toMatch(/className="w-full"/);
        expect(source).toMatch(/size="lg"/);
        expect(source).toMatch(/min-w-0/);
    });

    it("SignUpForm stacks name fields on mobile before sm breakpoint", () => {
        const source = readFormSource("sign-up-form.tsx");

        expect(source).toMatch(/grid-cols-1/);
        expect(source).toMatch(/sm:grid-cols-2/);
        expect(source).toMatch(/className="w-full"/);
        expect(source).toMatch(/size="lg"/);
        expect(source).toMatch(/min-w-0/);
    });

    it("CompleteProfileForm uses full-width prominent save action", () => {
        const source = readFormSource("complete-profile-form.tsx");

        expect(source).toMatch(/flex flex-col gap-4/);
        expect(source).toMatch(/className="w-full"/);
        expect(source).toMatch(/size="lg"/);
        expect(source).toMatch(/min-w-0/);
    });
});
