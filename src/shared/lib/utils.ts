import { type ClassValue, clsx } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Custom `@utility text-*` roles from index.css set font-size, so they must
// replace shadcn defaults like `text-base md:text-sm` instead of losing to them.
const twMerge = extendTailwindMerge({
    extend: {
        classGroups: {
            "font-size": [
                {
                    text: [
                        "display",
                        "h1",
                        "h2",
                        "h3",
                        "body",
                        "ui",
                        "code",
                        "meta",
                    ],
                },
            ],
        },
    },
});

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
