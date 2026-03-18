import type { Metadata } from 'next'
import Link from 'next/link'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nepalfillings.com/api'
const BASE_URL = 'https://nepalfillings.com'

interface BlogPost {
  id: number
  title: string
  slug: string
  excerpt: string
  featured_image?: string
  published_at: string
  reading_time?: number
  category?: {
    id: number
    name: string
    slug: string
  }
  author?: {
    id: number
    name: string
    slug: string
    avatar?: string
  }
}

interface PostsResponse {
  success: boolean
  data: BlogPost[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

async function getPublishedPosts(page = 1): Promise<PostsResponse> {
  try {
    const res = await fetch(`${API_URL}/public/blog/posts?page=${page}&per_page=12`, {
      next: { revalidate: 60 }
    })

    if (!res.ok) return { success: false, data: [], total: 0, page: 1, per_page: 12, total_pages: 0 }

    return res.json()
  } catch {
    return { success: false, data: [], total: 0, page: 1, per_page: 12, total_pages: 0 }
  }
}

async function getCategories(): Promise<{ id: number; name: string; slug: string; post_count: number }[]> {
  try {
    const res = await fetch(`${API_URL}/public/blog/categories`, {
      next: { revalidate: 300 }
    })

    if (!res.ok) return []

    const json = await res.json()

    return json.success ? json.data : []
  } catch {
    return []
  }
}

export const metadata: Metadata = {
  title: 'Blog - Digital Marketing Insights for Nepali Businesses',
  description:
    'Expert articles on email marketing, SMS campaigns, WhatsApp business, Telegram marketing, and digital growth strategies for Nepali businesses.',
  alternates: {
    canonical: '/blog'
  }
}

export default async function BlogListingPage({
  searchParams
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const currentPage = Number(params.page) || 1
  const [postsResponse, categories] = await Promise.all([getPublishedPosts(currentPage), getCategories()])

  const posts = postsResponse.data || []
  const totalPages = postsResponse.total_pages || 0

  const blogListSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Nepal Fillings Blog',
    description:
      'Expert articles on email marketing, SMS campaigns, WhatsApp business, Telegram marketing, and digital growth strategies for Nepali businesses.',
    url: `${BASE_URL}/blog`,
    isPartOf: {
      '@type': 'WebSite',
      name: 'Nepal Fillings',
      url: BASE_URL
    }
  }

  return (
    <>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(blogListSchema) }} />

      {/* Blog Header */}
      <header className='blog-list-header'>
        <Link href='/' className='blog-back-link'>
          &larr; Back to Nepal Fillings
        </Link>
        <h1 className='blog-list-title'>Nepal Fillings Blog</h1>
        <p className='blog-list-subtitle'>
          Expert insights on email marketing, SMS campaigns, WhatsApp business, and digital growth strategies for
          Nepali businesses.
        </p>
      </header>

      {/* Category Filters */}
      {categories.length > 0 && (
        <nav className='blog-cat-nav'>
          <Link href='/blog' className='blog-cat-chip blog-cat-chip-active'>
            All Posts
          </Link>
          {categories.map(cat => (
            <Link key={cat.id} href={`/blog/category/${cat.slug}`} className='blog-cat-chip'>
              {cat.name} ({cat.post_count})
            </Link>
          ))}
        </nav>
      )}

      {/* Posts Grid */}
      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <p className='blog-list-empty'>No blog posts published yet. Check back soon!</p>
        </div>
      ) : (
        <div className='blog-posts-grid'>
          {posts.map(post => (
            <article key={post.id} className='blog-post-card'>
              {/* Featured Image */}
              {post.featured_image && (
                <Link href={`/blog/${post.slug}`}>
                  <img
                    src={post.featured_image}
                    alt={post.title}
                    className='blog-post-img'
                  />
                </Link>
              )}

              <div style={{ padding: 24 }}>
                {/* Category Chip */}
                {post.category && (
                  <Link href={`/blog/category/${post.category.slug}`} className='blog-post-cat'>
                    {post.category.name}
                  </Link>
                )}

                {/* Title */}
                <h2 className='blog-post-title'>
                  <Link href={`/blog/${post.slug}`} className='blog-post-title-link'>
                    {post.title}
                  </Link>
                </h2>

                {/* Excerpt */}
                <p className='blog-post-excerpt'>{post.excerpt}</p>

                {/* Meta Row */}
                <div className='blog-post-meta'>
                  {post.author && (
                    <Link href={`/blog/author/${post.author.slug}`} className='blog-post-author'>
                      {post.author.avatar && (
                        <img
                          src={post.author.avatar}
                          alt={post.author.name}
                          style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      )}
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
        <nav className='blog-pagination'>
          {currentPage > 1 && (
            <Link href={`/blog?page=${currentPage - 1}`} className='blog-page-btn'>
              &larr; Previous
            </Link>
          )}
          <span className='blog-page-info'>
            Page {currentPage} of {totalPages}
          </span>
          {currentPage < totalPages && (
            <Link href={`/blog?page=${currentPage + 1}`} className='blog-page-btn blog-page-btn-next'>
              Next &rarr;
            </Link>
          )}
        </nav>
      )}

      {/* Blog Listing Styles - Dark/Light mode aware */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              --bl-text: #334155;
              --bl-heading: #1a1a2e;
              --bl-muted: #64748b;
              --bl-light: #94a3b8;
              --bl-bg: #ffffff;
              --bl-card: #ffffff;
              --bl-card-border: #e2e8f0;
              --bl-card-hover: 0 8px 30px rgba(0,0,0,0.08);
              --bl-cat-bg: #f1f5f9;
              --bl-cat-text: #475569;
              --bl-cat-border: #e2e8f0;
              --bl-cat-active-bg: #7c3aed;
              --bl-cat-active-text: #ffffff;
              --bl-chip-bg: #ede9fe;
              --bl-chip-text: #7c3aed;
              --bl-page-bg: #f1f5f9;
              --bl-page-text: #475569;
              --bl-page-border: #e2e8f0;
            }
            [data-dark], [data-mode="dark"], [data-mui-color-scheme="dark"] {
              --bl-text: #cbd5e1;
              --bl-heading: #f1f5f9;
              --bl-muted: #94a3b8;
              --bl-light: #64748b;
              --bl-bg: #0f172a;
              --bl-card: #1e293b;
              --bl-card-border: #334155;
              --bl-card-hover: 0 8px 30px rgba(0,0,0,0.3);
              --bl-cat-bg: #1e293b;
              --bl-cat-text: #94a3b8;
              --bl-cat-border: #334155;
              --bl-cat-active-bg: #7c3aed;
              --bl-cat-active-text: #ffffff;
              --bl-chip-bg: rgba(124,58,237,0.15);
              --bl-chip-text: #a78bfa;
              --bl-page-bg: #1e293b;
              --bl-page-text: #94a3b8;
              --bl-page-border: #334155;
            }
            .blog-list-header { text-align: center; margin-bottom: 48px; }
            .blog-back-link { color: #7c3aed; text-decoration: none; font-size: 14px; font-weight: 500; }
            .blog-back-link:hover { text-decoration: underline; }
            .blog-list-title { font-size: 40px; font-weight: 800; color: var(--bl-heading); margin: 16px 0 12px; line-height: 1.2; }
            .blog-list-subtitle { font-size: 18px; color: var(--bl-muted); max-width: 640px; margin: 0 auto; line-height: 1.6; }
            .blog-list-empty { font-size: 18px; color: var(--bl-light); }
            .blog-cat-nav { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 40px; }
            .blog-cat-chip { padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 500; text-decoration: none; background-color: var(--bl-cat-bg); color: var(--bl-cat-text); border: 1px solid var(--bl-cat-border); transition: all 0.2s; }
            .blog-cat-chip:hover { background-color: var(--bl-cat-active-bg); color: var(--bl-cat-active-text); border-color: var(--bl-cat-active-bg); }
            .blog-cat-chip-active { background-color: var(--bl-cat-active-bg) !important; color: var(--bl-cat-active-text) !important; border-color: var(--bl-cat-active-bg) !important; }
            .blog-posts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 32px; }
            .blog-post-card { border-radius: 12px; overflow: hidden; border: 1px solid var(--bl-card-border); background-color: var(--bl-card); transition: box-shadow 0.2s ease, transform 0.2s ease; }
            .blog-post-card:hover { box-shadow: var(--bl-card-hover); transform: translateY(-2px); }
            .blog-post-img { width: 100%; height: 200px; object-fit: cover; display: block; }
            .blog-post-cat { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; background-color: var(--bl-chip-bg); color: var(--bl-chip-text); text-decoration: none; margin-bottom: 12px; }
            .blog-post-title { margin: 0 0 8px; font-size: 20px; font-weight: 700; line-height: 1.3; }
            .blog-post-title-link { color: var(--bl-heading); text-decoration: none; }
            .blog-post-title-link:hover { color: #7c3aed; }
            .blog-post-excerpt { font-size: 14px; color: var(--bl-muted); line-height: 1.6; margin: 0 0 16px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
            .blog-post-meta { display: flex; align-items: center; gap: 12px; font-size: 13px; color: var(--bl-light); }
            .blog-post-author { display: flex; align-items: center; gap: 6px; text-decoration: none; color: var(--bl-muted); font-weight: 500; }
            .blog-post-author:hover { color: #7c3aed; }
            .blog-pagination { display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 48px; }
            .blog-page-btn { padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; text-decoration: none; background-color: var(--bl-page-bg); color: var(--bl-page-text); border: 1px solid var(--bl-page-border); }
            .blog-page-btn:hover { background-color: #7c3aed; color: #fff; border-color: #7c3aed; }
            .blog-page-btn-next { background-color: #7c3aed !important; color: #fff !important; border-color: #7c3aed !important; }
            .blog-page-info { font-size: 14px; color: var(--bl-muted); padding: 8px 12px; }
            @media (max-width: 768px) {
              .blog-list-title { font-size: 28px; }
              .blog-list-subtitle { font-size: 15px; }
              .blog-posts-grid { grid-template-columns: 1fr; gap: 20px; }
            }
          `
        }}
      />
    </>
  )
}
