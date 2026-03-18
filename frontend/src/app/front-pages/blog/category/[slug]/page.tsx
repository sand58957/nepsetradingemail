import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nepalfillings.com/api'
const BASE_URL = 'https://nepalfillings.com'

interface BlogCategory {
  id: number
  name: string
  slug: string
  description?: string
  post_count?: number
}

interface BlogPost {
  id: number
  title: string
  slug: string
  excerpt: string
  featured_image?: string
  published_at: string
  reading_time?: number
  category?: { id: number; name: string; slug: string }
  author?: { id: number; name: string; slug: string; avatar?: string }
}

interface CategoryResponse {
  success: boolean
  data: BlogCategory
}

interface PostsResponse {
  success: boolean
  data: BlogPost[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

async function getCategory(slug: string): Promise<BlogCategory | null> {
  try {
    const res = await fetch(`${API_URL}/public/blog/categories/${slug}`, {
      next: { revalidate: 300 }
    })

    if (!res.ok) return null

    const json: CategoryResponse = await res.json()

    return json.success ? json.data : null
  } catch {
    return null
  }
}

async function getCategoryPosts(slug: string, page = 1): Promise<PostsResponse> {
  try {
    const res = await fetch(`${API_URL}/public/blog/categories/${slug}/posts?page=${page}&per_page=12`, {
      next: { revalidate: 60 }
    })

    if (!res.ok) return { success: false, data: [], total: 0, page: 1, per_page: 12, total_pages: 0 }

    return res.json()
  } catch {
    return { success: false, data: [], total: 0, page: 1, per_page: 12, total_pages: 0 }
  }
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategory(slug)

  if (!category) {
    return { title: 'Category Not Found' }
  }

  const title = `${category.name} - Digital Marketing Articles | Nepal Fillings Blog`
  const description = category.description || `Read expert articles about ${category.name}. Digital marketing insights and strategies for Nepali businesses.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/blog/category/${category.slug}`,
      siteName: 'Nepal Fillings',
      type: 'website'
    },
    twitter: {
      card: 'summary',
      title,
      description
    },
    alternates: {
      canonical: `/blog/category/${category.slug}`
    }
  }
}

export default async function CategoryPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  const currentPage = Number(resolvedSearchParams.page) || 1

  const [category, postsResponse] = await Promise.all([getCategory(slug), getCategoryPosts(slug, currentPage)])

  if (!category) {
    notFound()
  }

  const posts = postsResponse.data || []
  const totalPages = postsResponse.total_pages || 0

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: category.name }
    ]
  }

  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${category.name} - Nepal Fillings Blog`,
    description: category.description || `Articles about ${category.name}`,
    url: `${BASE_URL}/blog/category/${category.slug}`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Nepal Fillings',
      url: BASE_URL
    }
  }

  return (
    <>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }} />

      {/* Breadcrumb */}
      <nav style={{ marginBottom: 24, fontSize: 14, color: '#94a3b8' }}>
        <Link href='/' style={{ color: '#7c3aed', textDecoration: 'none' }}>
          Home
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <Link href='/blog' style={{ color: '#7c3aed', textDecoration: 'none' }}>
          Blog
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <span style={{ color: '#64748b' }}>{category.name}</span>
      </nav>

      {/* Category Header */}
      <header style={{ marginBottom: 40 }}>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: '#1a1a2e', margin: '0 0 12px' }}>{category.name}</h1>
        {category.description && (
          <p style={{ fontSize: 17, color: '#64748b', lineHeight: 1.6, margin: 0, maxWidth: 700 }}>
            {category.description}
          </p>
        )}
        {category.post_count !== undefined && (
          <p style={{ fontSize: 14, color: '#94a3b8', margin: '8px 0 0' }}>
            {category.post_count} {category.post_count === 1 ? 'article' : 'articles'}
          </p>
        )}
      </header>

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p style={{ fontSize: 18, color: '#94a3b8' }}>No articles in this category yet.</p>
          <Link href='/blog' style={{ color: '#7c3aed', textDecoration: 'none', fontWeight: 500 }}>
            &larr; Browse all articles
          </Link>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: 32
          }}
        >
          {posts.map(post => (
            <article
              key={post.id}
              style={{
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid #e2e8f0',
                backgroundColor: '#fff'
              }}
            >
              {post.featured_image && (
                <Link href={`/blog/${post.slug}`}>
                  <img
                    src={post.featured_image}
                    alt={post.title}
                    style={{ width: '100%', height: 200, objectFit: 'cover', display: 'block' }}
                  />
                </Link>
              )}
              <div style={{ padding: 24 }}>
                <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>
                  <Link href={`/blog/${post.slug}`} style={{ color: '#1a1a2e', textDecoration: 'none' }}>
                    {post.title}
                  </Link>
                </h2>
                <p
                  style={{
                    fontSize: 14,
                    color: '#64748b',
                    lineHeight: 1.6,
                    margin: '0 0 16px',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {post.excerpt}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: '#94a3b8' }}>
                  {post.author && (
                    <Link
                      href={`/blog/author/${post.author.slug}`}
                      style={{ textDecoration: 'none', color: '#64748b', fontWeight: 500 }}
                    >
                      {post.author.name}
                    </Link>
                  )}
                  <span>&middot;</span>
                  <time dateTime={post.published_at}>
                    {new Date(post.published_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </time>
                  {post.reading_time && (
                    <>
                      <span>&middot;</span>
                      <span>{post.reading_time} min read</span>
                    </>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <nav style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 48 }}>
          {currentPage > 1 && (
            <Link
              href={`/blog/category/${slug}?page=${currentPage - 1}`}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                backgroundColor: '#f1f5f9',
                color: '#475569',
                border: '1px solid #e2e8f0'
              }}
            >
              &larr; Previous
            </Link>
          )}
          <span style={{ fontSize: 14, color: '#64748b', padding: '8px 12px' }}>
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link
              href={`/blog/category/${slug}?page=${currentPage + 1}`}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 500,
                textDecoration: 'none',
                backgroundColor: '#7c3aed',
                color: '#fff'
              }}
            >
              Next &rarr;
            </Link>
          )}
        </nav>
      )}
    </>
  )
}
