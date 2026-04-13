import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/en/login', '/en/register', '/en/dashboards/', '/en/forgot-password']
      },
      // AI/LLM bots - allow blog and public pages for AIO optimization
      {
        userAgent: 'GPTBot',
        allow: ['/blog/', '/front-pages/']
      },
      {
        userAgent: 'Google-Extended',
        allow: ['/blog/', '/front-pages/']
      },
      {
        userAgent: 'ChatGPT-User',
        allow: ['/blog/', '/front-pages/']
      },
      {
        userAgent: 'PerplexityBot',
        allow: ['/blog/', '/front-pages/']
      },
      {
        userAgent: 'ClaudeBot',
        allow: ['/blog/', '/front-pages/']
      },
      {
        userAgent: 'Applebot-Extended',
        allow: ['/blog/', '/front-pages/']
      },
      {
        userAgent: 'anthropic-ai',
        allow: ['/blog/', '/front-pages/']
      }
    ],
    sitemap: [
      'https://nepalfillings.com/sitemap.xml',
      'https://nepalfillings.com/api/public/blog/sitemap.xml'
    ]
  }
}
