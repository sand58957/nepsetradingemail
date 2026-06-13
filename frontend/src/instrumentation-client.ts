// Client-side error tracking → self-hosted GlitchTip (Sentry-compatible).
// Next.js runs this automatically on the client at startup (instrumentation-client).
// Inert unless NEXT_PUBLIC_GLITCHTIP_DSN is set, so local/dev builds report nothing.
import * as Sentry from '@sentry/browser'

const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,

    // Default integrations capture window.onerror + unhandledrejection.
    // No tracing/replay — this instance is for error capture only.
    tracesSampleRate: 0,

    // Drop noisy errors that aren't actionable (browser extensions, network blips).
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
