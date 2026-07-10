import { useTranslation } from 'react-i18next'

import { Button } from '@/shared/shadcn/ui/button'

const locales = ['ru', 'en'] as const

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation('common')

  const currentLocale =
    locales.find((locale) => i18n.language.startsWith(locale)) ?? 'ru'

  return (
    <div
      aria-label={t('switcher')}
      className="flex items-center gap-0.5 rounded-lg border border-border p-0.5"
      role="group"
    >
      {locales.map((locale) => (
        <Button
          aria-current={currentLocale === locale}
          aria-label={t(locale)}
          key={locale}
          onClick={() => void i18n.changeLanguage(locale)}
          size="sm"
          type="button"
          variant={currentLocale === locale ? 'default' : 'ghost'}
        >
          {locale.toUpperCase()}
        </Button>
      ))}
    </div>
  )
}
