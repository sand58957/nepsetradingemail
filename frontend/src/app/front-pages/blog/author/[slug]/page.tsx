import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import type { BlogAuthor } from '@/utils/blogSchema'
import { generateAuthorSchema } from '@/utils/blogSchema'

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
  category?: { id: number; name: string; slug: string }
}

interface AuthorResponse {
  success: boolean
  data: BlogAuthor
}

interface PostsResponse {
  success: boolean
  data: BlogPost[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

async function getAuthor(slug: string): Promise<BlogAuthor | null> {
  try {
    const res = await fetch(`${API_URL}/public/blog/authors/${slug}`, {
      next: { revalidate: 300 }
    })

    if (!res.ok) return null

    const json: AuthorResponse = await res.json()

    return json.success ? json.data : null
  } catch {
    return null
  }
}

async function getAuthorPosts(slug: string, page = 1): Promise<PostsResponse> {
  try {
    const res = await fetch(`${API_URL}/public/blog/authors/${slug}/posts?page=${page}&per_page=12`, {
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
  const author = await getAuthor(slug)

  if (!author) {
    return { title: 'Author Not Found' }
  }

  const title = `${author.name} - Author at Nepal Fillings Blog`
  const description = author.bio || `Read articles by ${author.name} on digital marketing strategies for Nepali businesses.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/blog/author/${author.slug}`,
      siteName: 'Nepal Fillings',
      type: 'profile',
      ...(author.avatar_url
        ? {
            images: [
              {
                url: author.avatar_url.startsWith('http') ? author.avatar_url : `${BASE_URL}${author.avatar_url}`,
                width: 400,
                height: 400,
                alt: author.name
              }
            ]
          }
        : {})
    },
    twitter: {
      card: 'summary',
      title,
      description
    },
    alternates: {
      canonical: `/blog/author/${author.slug}`
    }
  }
}

export default async function AuthorPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ page?: string }>
}) {
  const { slug } = await params
  const resolvedSearchParams = await searchParams
  const currentPage = Number(resolvedSearchParams.page) || 1

  const [author, postsResponse] = await Promise.all([getAuthor(slug), getAuthorPosts(slug, currentPage)])

  if (!author) {
    notFound()
  }

  const posts = postsResponse.data || []
  const totalPages = postsResponse.total_pages || 0
  const totalPosts = postsResponse.total || 0

  const authorSchema = generateAuthorSchema(author, BASE_URL)

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE_URL },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE_URL}/blog` },
      { '@type': 'ListItem', position: 3, name: author.name }
    ]
  }

  return (
    <>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(authorSchema) }} />
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

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
        <span style={{ color: '#64748b' }}>{author.name}</span>
      </nav>

      {/* Author Profile Card */}
      <header
        style={{
          display: 'flex',
          gap: 28,
          alignItems: 'flex-start',
          padding: 32,
          borderRadius: 16,
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          marginBottom: 48
        }}
      >
        {author.avatar_url && (
          <img
            src={author.avatar_url.startsWith('http') ? author.avatar_url : `${BASE_URL}${author.avatar_url}`}
            alt={author.name}
            style={{
              width: 96,
              height: 96,
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
              border: '3px solid #fff',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          />
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: '#1a1a2e', margin: '0 0 8px' }}>{author.name}</h1>
          {author.bio && (
            <p style={{ fontSize: 16, lineHeight: 1.7, color: '#475569', margin: '0 0 16px', maxWidth: 600 }}>
              {author.bio}
            </p>
          )}

          {/* Expertise Tags */}
          {author.expertise && author.expertise.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {author.expertise.map((skill: string) => (
                <span
                  key={skill}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 14,
                    fontSize: 13,
                    fontWeight: 500,
                    backgroundColor: '#ede9fe',
                    color: '#7c3aed'
                  }}
                >
                  {skill}
                </span>
              ))}
            </div>
          )}

          {/* Social Links */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {author.social_links?.twitter && (
              <a
                href={author.social_links?.twitter}
                target='_blank'
                rel='noopener noreferrer'
                style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}
              >
                Twitter
              </a>
            )}
            {author.social_links?.linkedin && (
              <a
                href={author.social_links?.linkedin}
                target='_blank'
                rel='noopener noreferrer'
                style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}
              >
                LinkedIn
              </a>
            )}
            {author.social_links?.facebook && (
              <a
                href={author.social_links?.facebook}
                target='_blank'
                rel='noopener noreferrer'
                style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}
              >
                Facebook
              </a>
            )}
            {author.social_links?.website && (
              <a
                href={author.social_links?.website}
                target='_blank'
                rel='noopener noreferrer'
                style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none', fontWeight: 500 }}
              >
                Website
              </a>
            )}
          </div>

          <p style={{ fontSize: 14, color: '#94a3b8', margin: '12px 0 0' }}>
            {totalPosts} {totalPosts === 1 ? 'article' : 'articles'} published
          </p>
        </div>
      </header>

      {/* Author's Posts */}
      <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1a1a2e', marginBottom: 24 }}>
        Articles by {author.name}
      </h2>

      {posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <p style={{ fontSize: 16, color: '#94a3b8' }}>No articles published yet.</p>
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
                {post.category && (
                  <Link
                    href={`/blog/category/${post.category.slug}`}
                    style={{
                      display: 'inline-block',
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      backgroundColor: '#ede9fe',
                      color: '#7c3aed',
                      textDecoration: 'none',
                      marginBottom: 12
                    }}
                  >
                    {post.category.name}
                  </Link>
                )}
                <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>
                  <Link href={`/blog/${post.slug}`} style={{ color: '#1a1a2e', textDecoration: 'none' }}>
                    {post.title}
                  </Link>
                </h3>
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
              href={`/blog/author/${slug}?page=${currentPage - 1}`}
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
              href={`/blog/author/${slug}?page=${currentPage + 1}`}
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
