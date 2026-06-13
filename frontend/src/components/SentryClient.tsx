'use client'

// Client-side error tracking → self-hosted GlitchTip (Sentry-compatible).
// Mounted in Providers so it loads on every page. Inert unless
// NEXT_PUBLIC_GLITCHTIP_DSN is set (inlined at build time).
import { useEffect } from 'react'

import * as Sentry from '@sentry/browser'

// Module-level guard so it initialises once per page load, not per render.
let started = false

const initSentry = () => {
  if (started) return

  const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN

  if (!dsn) return

  started = true

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0,

    // Drop noise that isn't actionable (extensions, transient network failures).
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',
      'Failed to fetch',
      'NetworkError when attempting to fetch resource',
      'Load failed'
    ]
  })
}

const SentryClient = () => {
  // Initialise during hydration (earliest point), with an effect fallback.
  if (typeof window !== 'undefined') initSentry()
  useEffect(() => {
    initSentry()
  }, [])

  return null
}

export default SentryClient
