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
        source: '/:path((?!en|fr|ar|front-pages|blog|images|api|favicon.ico|_next).+)+',
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
