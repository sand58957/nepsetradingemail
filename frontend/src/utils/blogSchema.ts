// Blog JSON-LD Schema Generators for SEO
// These functions generate structured data objects for Google rich results

export interface BlogPost {
  id: number
  title: string
  slug: string
  excerpt: string
  content_html: string
  quick_answer?: string
  featured_image_url?: string
  featured_image_alt?: string
  meta_title?: string
  meta_description?: string
  primary_keyword?: string
  secondary_keywords?: string[]
  reading_time_min?: number
  word_count?: number
  published_at: string
  updated_at?: string
  category_name?: string
  author_name?: string
  author?: BlogAuthor
  faqs?: BlogFAQ[]
  tags?: string[]
}

export interface BlogAuthor {
  id: number
  name: string
  slug: string
  bio?: string
  avatar_url?: string
  expertise?: string[]
  social_links?: Record<string, string>
  credentials?: string
}

export interface BlogFAQ {
  question: string
  answer: string
}

export interface BlogCategory {
  id: number
  name: string
  slug: string
  description?: string
  post_count?: number
}

export function generateArticleSchema(
  post: BlogPost,
  author: BlogAuthor | undefined,
  baseUrl: string
) {
  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.meta_title || post.title,
    description: post.meta_description || post.excerpt,
    url: `${baseUrl}/blog/${post.slug}`,
    datePublished: post.published_at,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/blog/${post.slug}`
    },
    publisher: {
      '@type': 'Organization',
      name: 'Nepal Fillings',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/images/front-pages/landing-page/hero-dashboard-dark.png`
      }
    },
    wordCount: post.content_html
      ? post.content_html.replace(/<[^>]*>/g, '').split(/\s+/).length
      : undefined,
    isAccessibleForFree: true
  }

  if (post.updated_at) {
    schema.dateModified = post.updated_at
  }

  if (post.featured_image_url) {
    schema.image = {
      '@type': 'ImageObject',
      url: post.featured_image_url.startsWith('http') ? post.featured_image_url : `${baseUrl}${post.featured_image_url}`
    }
  }

  if (author) {
    schema.author = {
      '@type': 'Person',
      name: author.name,
      url: `${baseUrl}/blog/author/${author.slug}`
    }

    if (author.bio) {
      ;(schema.author as Record<string, unknown>).description = author.bio
    }
  }

  if (post.primary_keyword) {
    schema.keywords = [
      post.primary_keyword,
      ...(post.secondary_keywords || [])
    ].join(', ')
  }

  if (post.category_name) {
    schema.articleSection = post.category_name
  }

  return schema
}

export function generateFAQSchema(faqs: BlogFAQ[]) {
  if (!faqs || faqs.length === 0) return null

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(faq => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer
      }
    }))
  }
}

export function generateBreadcrumbSchema(
  post: BlogPost,
  category: { name: string; slug: string } | undefined,
  baseUrl: string
) {
  const items: Array<{ '@type': string; position: number; name: string; item?: string }> = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: baseUrl
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Blog',
      item: `${baseUrl}/blog`
    }
  ]

  if (category) {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: category.name,
      item: `${baseUrl}/blog/category/${category.slug}`
    })

    items.push({
      '@type': 'ListItem',
      position: 4,
      name: post.title
    })
  } else {
    items.push({
      '@type': 'ListItem',
      position: 3,
      name: post.title
    })
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items
  }
}

export function generateAuthorSchema(author: BlogAuthor, baseUrl: string) {
  const sameAs: string[] = []

  if (author.social_links?.website) sameAs.push(author.social_links?.website)
  if (author.social_links?.twitter) sameAs.push(author.social_links?.twitter)
  if (author.social_links?.linkedin) sameAs.push(author.social_links?.linkedin)
  if (author.social_links?.facebook) sameAs.push(author.social_links?.facebook)

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: author.name,
    url: `${baseUrl}/blog/author/${author.slug}`
  }

  if (author.bio) {
    schema.description = author.bio
  }

  if (author.avatar_url) {
    schema.image = author.avatar_url.startsWith('http') ? author.avatar_url : `${baseUrl}${author.avatar_url}`
  }

  if (author.expertise && author.expertise.length > 0) {
    schema.knowsAbout = author.expertise
  }

  if (sameAs.length > 0) {
    schema.sameAs = sameAs
  }

  schema.worksFor = {
    '@type': 'Organization',
    name: 'Nepal Fillings',
    url: baseUrl
  }

  return schema
}
