import type { MetadataRoute } from 'next'

// Every AI crawler we grant access to. Kept as one list so a new engine is a
// single-line change rather than another copied block.
const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'Google-Extended',
  'PerplexityBot',
  'Perplexity-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'anthropic-ai',
  'Applebot',
  'Applebot-Extended',
  'CCBot',
  'meta-externalagent',
  'FacebookBot',
  'Amazonbot',
  'Bytespider',
  'cohere-ai',
  'DuckAssistBot',
  'MistralAI-User'
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/api/public/blog/sitemap.xml'],
        disallow: ['/api/', '/en/login', '/en/register', '/en/dashboards/', '/en/forgot-password']
      },

      // AI/LLM crawlers. Allowed on public content so the blog can be cited in
      // AI answers; only private dashboard and auth routes are withheld.
      //
      // These are distinct jobs and need listing separately:
      //   GPTBot          - OpenAI training crawler
      //   OAI-SearchBot   - OpenAI *search* crawler, powers ChatGPT search results
      //   ChatGPT-User    - fetches a page when a user asks about it live
      //   Google-Extended - Gemini / AI Overviews grounding
      //   CCBot           - Common Crawl, an input to many open models
      ...AI_CRAWLERS.map(userAgent => ({
        userAgent,
        allow: ['/blog/', '/front-pages/', '/api/public/'],
        disallow: ['/en/login', '/en/register', '/en/dashboards/', '/en/forgot-password']
      }))
    ],
    sitemap: ['https://nepalfillings.com/sitemap.xml', 'https://nepalfillings.com/api/public/blog/sitemap.xml']
  }
}
