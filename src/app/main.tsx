import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import './styles/index.css'
import './i18n'
import { initTheme } from '@/app/model/theme'
import { AuthProvider } from '@/features/auth'

import { AppRouter } from './app-router'

initTheme()

const rootElement = document.querySelector('#root')

if (!rootElement) {
  throw new Error('Root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  </StrictMode>,
)
