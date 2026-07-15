import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import aboutEn from './locales/about/en.json'
import aboutRu from './locales/about/ru.json'
import authEn from './locales/auth/en.json'
import authRu from './locales/auth/ru.json'
import boardEn from './locales/board/en.json'
import boardRu from './locales/board/ru.json'
import commonEn from './locales/common/en.json'
import commonRu from './locales/common/ru.json'
import dashboardEn from './locales/dashboard/en.json'
import dashboardRu from './locales/dashboard/ru.json'
import homeEn from './locales/home/en.json'
import homeRu from './locales/home/ru.json'

const resources = {
  en: {
    about: aboutEn,
    auth: authEn,
    board: boardEn,
    common: commonEn,
    dashboard: dashboardEn,
    home: homeEn,
  },
  ru: {
    about: aboutRu,
    auth: authRu,
    board: boardRu,
    common: commonRu,
    dashboard: dashboardRu,
    home: homeRu,
  },
}

const namespaces = ['about', 'auth', 'board', 'common', 'dashboard', 'home'] as const

function syncDocumentLanguage(language: string) {
  const locale = language.startsWith('en') ? 'en' : 'ru'
  document.documentElement.lang = locale
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    debug: false,
    defaultNS: 'common',
    fallbackLng: 'ru',
    interpolation: {
      escapeValue: false,
    },
    ns: [...namespaces],
    resources,
  })

i18n.on('languageChanged', syncDocumentLanguage)
syncDocumentLanguage(i18n.language)

export default i18n
