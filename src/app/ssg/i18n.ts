import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import aboutEn from "@/app/locales/about/en.json";
import aboutRu from "@/app/locales/about/ru.json";
import authEn from "@/app/locales/auth/en.json";
import authRu from "@/app/locales/auth/ru.json";
import boardEn from "@/app/locales/board/en.json";
import boardRu from "@/app/locales/board/ru.json";
import commandEn from "@/app/locales/command/en.json";
import commandRu from "@/app/locales/command/ru.json";
import commonEn from "@/app/locales/common/en.json";
import commonRu from "@/app/locales/common/ru.json";
import dashboardEn from "@/app/locales/dashboard/en.json";
import dashboardRu from "@/app/locales/dashboard/ru.json";
import homeEn from "@/app/locales/home/en.json";
import homeRu from "@/app/locales/home/ru.json";
import legalEn from "@/app/locales/legal/en.json";
import legalRu from "@/app/locales/legal/ru.json";

const resources = {
    en: {
        about: aboutEn,
        auth: authEn,
        board: boardEn,
        command: commandEn,
        common: commonEn,
        dashboard: dashboardEn,
        home: homeEn,
        legal: legalEn,
    },
    ru: {
        about: aboutRu,
        auth: authRu,
        board: boardRu,
        command: commandRu,
        common: commonRu,
        dashboard: dashboardRu,
        home: homeRu,
        legal: legalRu,
    },
};

let initialized = false;

/** Fixed-locale i18n for build-time SSG (no LanguageDetector). */
export function initSsgI18n() {
    if (initialized) {
        return i18n;
    }

    void i18n.use(initReactI18next).init({
        debug: false,
        defaultNS: "common",
        fallbackLng: "ru",
        initAsync: false,
        interpolation: {
            escapeValue: false,
        },
        lng: "ru",
        ns: [
            "about",
            "auth",
            "board",
            "command",
            "common",
            "dashboard",
            "home",
            "legal",
        ],
        resources,
    });

    initialized = true;
    return i18n;
}
