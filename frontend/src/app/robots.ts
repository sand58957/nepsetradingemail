import type { MetadataRoute } from 'next'

// One group for every crawler, AI crawlers included.
//
// A crawler that finds a group naming it follows only that group and ignores `*`.
// There used to be a separate group per AI bot, none of which disallowed /api/, so
// the private API was open to all of them.
//
// /login, /register and /forgot-password are not blocked: they send
// X-Robots-Tag: noindex (see src/proxy.ts), which a crawler can only see on a page
// it may fetch. Removed template pages aren't blocked either, so crawlers can see
// their 410.
const DISALLOW = [
  '/api/',
  '/en/',
  '/fr/',
  '/ar/',
  '/dashboards',
  '/portal',
  '/*?redirectTo=',
  '/*&redirectTo=',
  '/*?callbackUrl='
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/api/public/blog/sitemap.xml'],
        disallow: DISALLOW
      }
    ],
    sitemap: 'https://nepalfillings.com/sitemap.xml'
  }
}
