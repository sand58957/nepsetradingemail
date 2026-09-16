import path from 'path'

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: process.env.BASEPATH,
  output: 'standalone',
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname)
  },

  // Tree-shake / barrel-optimize the heaviest UI deps. Without this, importing
  // a single MUI component drags the entire library into the bundle.
  experimental: {
    optimizePackageImports: [
      '@mui/material',
      '@mui/icons-material',
      '@mui/lab',
      '@iconify/react',
      'lodash',
      'date-fns',
      '@tabler/icons-react'
    ]
  },

  // Image optimization: AVIF/WebP at edge, long browser cache.
  images: {
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 2592000,
    remotePatterns: [
      { protocol: 'https', hostname: 'nepalfillings.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: 'my-pull-zone-name-nepalfilling.b-cdn.net' }
    ]
  },
  rewrites: async () => {
    return [
      {
        source: '/',
        destination: '/front-pages/landing-page'
      },
      {
        source: '/dashboards',
        destination: '/en/dashboards/email-marketing'
      },
      {
        source: '/blog',
        destination: '/front-pages/blog'
      },
      {
        source: '/blog/:path*',
        destination: '/front-pages/blog/:path*'
      },
      {
        source: '/privacy',
        destination: '/front-pages/privacy'
      },
      {
        source: '/terms',
        destination: '/front-pages/terms'
      },
      {
        source: '/pricing',
        destination: '/front-pages/pricing'
      },
      {
        source: '/about',
        destination: '/front-pages/about'
      },
      // Public paths are excluded explicitly, or the catch-all sends them to the dashboard.
      {
        source: '/:path((?!en|fr|ar|front-pages|blog|images|api|favicon.ico|_next|sitemaps|pricing|privacy|terms|help|contact|about).+)+',
        destination: '/en/:path*'
      }
    ]
  },
  redirects: async () => {
    return [
      {
        source: '/front-pages/landing-page',
        destination: '/',
        permanent: true,
        locale: false
      },
      // The clean URLs are canonical; the /front-pages/ copies of the same pages redirect
      // to them. Redirects match only the incoming URL, so the rewrites above don't loop.
      { source: '/front-pages/pricing', destination: '/pricing', permanent: true, locale: false },
      { source: '/front-pages/about', destination: '/about', permanent: true, locale: false },
      { source: '/front-pages/privacy', destination: '/privacy', permanent: true, locale: false },
      { source: '/front-pages/terms', destination: '/terms', permanent: true, locale: false },
      { source: '/front-pages/blog', destination: '/blog', permanent: true, locale: false },
      { source: '/front-pages/blog/:path*', destination: '/blog/:path*', permanent: true, locale: false },
      {
        source: '/dashboards/email-marketing',
        destination: '/dashboards',
        permanent: true,
        locale: false
      },
      {
        source: '/en/dashboards/email-marketing',
        destination: '/dashboards',
        permanent: true,
        locale: false
      },
      {
        source: '/:lang(en|fr|ar)',
        destination: '/:lang/dashboards/email-marketing',
        permanent: false,
        locale: false
      }
    ]
  }
}

export default nextConfig
