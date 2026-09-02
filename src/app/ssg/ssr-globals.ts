/**
 * Minimal browser globals for Node SSG — real DOM APIs are unavailable during
 * `renderToString`, but theme/i18n/storage helpers expect them.
 */
if (globalThis.self === undefined) {
    Object.defineProperty(globalThis, "self", {
        configurable: true,
        value: globalThis,
    });
}

const memoryStorage = () => {
    const store = new Map<string, string>();
    return {
        clear: () => {
            store.clear();
        },
        getItem: (key: string) => store.get(key) ?? null,
        key: (index: number) => [...store.keys()][index] ?? null,
        get length() {
            return store.size;
        },
        removeItem: (key: string) => {
            store.delete(key);
        },
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
    };
};

if (globalThis.localStorage === undefined) {
    Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: memoryStorage(),
    });
}

if (globalThis.sessionStorage === undefined) {
    Object.defineProperty(globalThis, "sessionStorage", {
        configurable: true,
        value: memoryStorage(),
    });
}

if (globalThis.document === undefined) {
    const htmlClasses = new Set<string>(["dark"]);
    const headChildren: Element[] = [];

    Object.defineProperty(globalThis, "document", {
        configurable: true,
        value: {
            documentElement: {
                classList: {
                    add: (value: string) => {
                        htmlClasses.add(value);
                    },
                    remove: (value: string) => {
                        htmlClasses.delete(value);
                    },
                    toggle: (value: string, force?: boolean) => {
                        if (force === undefined) {
                            if (htmlClasses.has(value)) {
                                htmlClasses.delete(value);
                            } else {
                                htmlClasses.add(value);
                            }
                            return;
                        }
                        if (force) {
                            htmlClasses.add(value);
                        } else {
                            htmlClasses.delete(value);
                        }
                    },
                },
                dataset: {},
                lang: "ru",
            },
            head: {
                append: (element: Element) => {
                    headChildren.push(element);
                },
                querySelector: (selector: string) => {
                    for (const element of headChildren) {
                        if (element.matches?.(selector)) {
                            return element;
                        }
                    }
                    return null;
                },
            },
            querySelector: () => null,
            title: "",
        },
    });
}
