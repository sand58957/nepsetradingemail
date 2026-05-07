// Next Imports
import { notFound } from 'next/navigation'

/**
 * Catch-all route for unknown paths under /[lang]/*.
 *
 * We call `notFound()` here so Next.js returns a proper HTTP 404 status code
 * (instead of HTTP 200 with the not-found UI, which Google flags as a "soft 404").
 * The UI is rendered by the closest `not-found.tsx` boundary (see ./not-found.tsx
 * one level up at src/app/[lang]/not-found.tsx).
 */
const NotFoundPage = () => {
  notFound()
}

export default NotFoundPage
