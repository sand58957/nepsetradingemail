import path from 'path'

import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  basePath: process.env.BASEPATH,
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname)
  },
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/front-pages/landing-page',
        permanent: true,
        locale: false
      },
      {
        source: '/:lang(en|fr|ar)',
        destination: '/:lang/dashboards/email-marketing',
        permanent: true,
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
        source: '/:path((?!en|fr|ar|front-pages|images|api|favicon.ico|privacy|terms).*)*',
        destination: '/en/:path*',
        permanent: true,
        locale: false
      }
    ]
  }
}

export default nextConfig
