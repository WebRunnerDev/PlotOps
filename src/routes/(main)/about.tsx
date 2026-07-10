import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

export const Route = createFileRoute('/(main)/about')({
  component: AboutPage,
})

function AboutPage() {
  const { t } = useTranslation('about')

  return (
    <div className="flex flex-col gap-4 py-8">
      <h1>{t('title')}</h1>
      <p className="text-body text-muted-foreground">
        {t('description')}
      </p>
    </div>
  )
}
