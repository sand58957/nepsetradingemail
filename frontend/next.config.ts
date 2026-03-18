import path from 'path'

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: process.env.BASEPATH,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname)
  },
  rewrites: async () => {
    return [
      {
        source: '/blog',
        destination: '/front-pages/blog'
      },
      {
        source: '/blog/:path*',
        destination: '/front-pages/blog/:path*'
      }
    ]
  },
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/front-pages/landing-page',
        permanent: false,
        locale: false
      },
      {
        source: '/dashboards',
        destination: '/en/dashboards/email-marketing',
        permanent: false,
        locale: false
      },
      {
        source: '/:lang(en|fr|ar)',
        destination: '/:lang/dashboards/email-marketing',
        permanent: false,
        locale: false
      },
      {
        source: '/privacy',
        destination: '/front-pages/privacy',
        permanent: true,
        locale: false
      },
      {
        source: '/terms',
        destination: '/front-pages/terms',
        permanent: true,
        locale: false
      },
      {
        source: '/:path((?!en|fr|ar|front-pages|blog|images|api|favicon.ico|privacy|terms|dashboards).*)*',
        destination: '/en/:path*',
        permanent: false,
        locale: false
      }
    ]
  }
}

export default nextConfig
