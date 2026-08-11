// Removed StrictMode to prevent double rendering in development
import * as Sentry from '@sentry/react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
// Keep responsive overrides after feature styles so the mobile layout owns the cascade.
import './App.css'
import { shouldDropSentryEvent } from './utils/sentryFilters.ts'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    sendDefaultPii: false,
    beforeSend(event) {
      return shouldDropSentryEvent(event) ? null : event
    },
  })
}

createRoot(document.getElementById('root')!).render(
  <App />
)
