import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, "../../../..");

function read(relativePath: string) {
    return readFileSync(path.join(root, relativePath), "utf8");
}

describe("account menu About PlotOps seam", () => {
    it("navigates to /about from the account menu for signed-in users and Guests", () => {
        const menu = read("src/widgets/top-bar/ui/user-menu.tsx");

        expect(menu).toMatch(/aboutPlotOps/);
        const guestGateStart = menu.indexOf("{guest ? null :");
        const guestGateEnd = menu.indexOf(")}", guestGateStart);
        expect(guestGateStart).toBeGreaterThan(-1);
        expect(guestGateEnd).toBeGreaterThan(guestGateStart);
        const signedInOnly = menu.slice(guestGateStart, guestGateEnd);
        expect(signedInOnly).toMatch(/to:\s*"\/settings"/);
        expect(signedInOnly).not.toMatch(/to:\s*"\/about"/);
        expect(menu.slice(guestGateEnd)).toMatch(/to:\s*"\/about"/);
    });

    it("keeps About out of the TopBar, command palette, and platform settings", () => {
        const topBar = read("src/widgets/top-bar/ui/top-bar.tsx");
        const palette = read("src/features/command-palette/ui/command-palette.tsx");
        const settings = read("src/routes/(main)/settings.tsx");

        expect(topBar).not.toMatch(/to:\s*"\/about"/);
        expect(palette).not.toMatch(/to:\s*"\/about"/);
        expect(settings).not.toMatch(/to:\s*"\/about"/);
        expect(settings).not.toMatch(/aboutPlotOps/);
    });

    it("has en+ru labels for the menu item", () => {
        const en = read("src/app/locales/common/en.json");
        const ru = read("src/app/locales/common/ru.json");

        expect(en).toMatch(/"aboutPlotOps":\s*"About PlotOps"/);
        expect(ru).toMatch(/"aboutPlotOps":/);
        expect(JSON.parse(ru).aboutPlotOps).toMatch(/PlotOps/);
    });
});
