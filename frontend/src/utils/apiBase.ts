/**
 * Returns the API base URL appropriate for the current execution context.
 *
 * On the server (SSR / route handlers / generateMetadata / sitemap), prefer the
 * internal Docker network address so calls don't loop out through Cloudflare.
 * In the browser, fall back to the public domain.
 */
export function getApiBase(): string {
  if (typeof window === 'undefined') {
    return (
      process.env.INTERNAL_API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'https://nepalfillings.com/api'
    )
  }
  return process.env.NEXT_PUBLIC_API_URL || 'https://nepalfillings.com/api'
}
