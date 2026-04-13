import type { MetadataRoute } from 'next'

const BASE_URL = 'https://nepalfillings.com'
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nepalfillings.com/api'

async function getBlogPosts(): Promise<Array<{ slug: string; updated_at: string; featured_image_url: string }>> {
  try {
    const res = await fetch(`${API_URL}/public/blog/posts?per_page=1000`, {
      next: { revalidate: 3600 }
    })

    if (!res.ok) return []

    const json = await res.json()

    return (json.data || []).map((p: any) => ({
      slug: p.slug,
      updated_at: p.updated_at || p.published_at,
      featured_image_url: p.featured_image_url || ''
    }))
  } catch {
    return []
  }
}

async function getBlogCategories(): Promise<Array<{ slug: string }>> {
  try {
    const res = await fetch(`${API_URL}/public/blog/categories`, {
      next: { revalidate: 3600 }
    })

    if (!res.ok) return []

    const json = await res.json()

    return (json.data || []).map((c: any) => ({ slug: c.slug }))
  } catch {
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, categories] = await Promise.all([getBlogPosts(), getBlogCategories()])

  // Static pages with clean URLs (no /front-pages/ prefix)
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1.0
    },
    {
      url: `${BASE_URL}/blog`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9
    },
    {
      url: `${BASE_URL}/front-pages/pricing`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8
    },
    {
      url: `${BASE_URL}/front-pages/help-center`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.6
    },
    {
      url: `${BASE_URL}/front-pages/privacy`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3
    },
    {
      url: `${BASE_URL}/front-pages/terms`,
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 0.3
    }
  ]

  // Blog posts
  const blogPages: MetadataRoute.Sitemap = posts.map(post => ({
    url: `${BASE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.updated_at),
    changeFrequency: 'weekly' as const,
    priority: 0.8
  }))

  // Blog categories
  const categoryPages: MetadataRoute.Sitemap = categories.map(cat => ({
    url: `${BASE_URL}/blog/category/${cat.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.6
  }))

  return [...staticPages, ...blogPages, ...categoryPages]
}
