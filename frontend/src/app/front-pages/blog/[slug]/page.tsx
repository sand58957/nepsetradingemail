import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import type { BlogPost, BlogAuthor, BlogFAQ } from '@/utils/blogSchema'
import {
  generateArticleSchema,
  generateFAQSchema,
  generateBreadcrumbSchema,
  generateAuthorSchema
} from '@/utils/blogSchema'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://nepalfillings.com/api'
const BASE_URL = 'https://nepalfillings.com'

interface FullPostData {
  post: BlogPost & { author_name?: string; category_name?: string }
  author?: BlogAuthor | null
  tags: any[]
  faqs: BlogFAQ[]
}

interface PostResponse {
  success: boolean
  data: FullPostData
}

async function getPost(slug: string): Promise<FullPostData | null> {
  try {
    const res = await fetch(`${API_URL}/public/blog/posts/${slug}`, {
      next: { revalidate: 60 }
    })

    if (!res.ok) return null

    const json: PostResponse = await res.json()

    return json.success ? json.data : null
  } catch {
    return null
  }
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const data = await getPost(slug)

  if (!data) {
    return { title: 'Post Not Found' }
  }

  const post = data.post
  const title = post.meta_title || post.title
  const description = post.meta_description || post.excerpt
  const imageUrl = post.featured_image_url || `${BASE_URL}/images/front-pages/landing-page/hero-dashboard-dark.png`

  const keywords: string[] = []

  if (post.primary_keyword) keywords.push(post.primary_keyword)
  if (post.secondary_keywords) keywords.push(...post.secondary_keywords)
  if (post.tags) keywords.push(...post.tags)

  return {
    title,
    description,
    keywords: keywords.length > 0 ? keywords : undefined,
    authors: post.author ? [{ name: post.author.name }] : undefined,
    openGraph: {
      title,
      description,
      url: `${BASE_URL}/blog/${post.slug}`,
      siteName: 'Nepal Fillings',
      type: 'article',
      publishedTime: post.published_at,
      modifiedTime: post.updated_at || undefined,
      authors: post.author_name ? [post.author_name] : undefined,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title
        }
      ]
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl]
    },
    alternates: {
      canonical: `/blog/${post.slug}`
    },
    other: {
      'geo.region': 'NP',
      'geo.placename': 'Kathmandu',
      'geo.position': '27.7172;85.3240',
      'ICBM': '27.7172, 85.3240'
    }
  }
}

function extractHeadings(html: string): Array<{ id: string; text: string; level: number }> {
  const headings: Array<{ id: string; text: string; level: number }> = []
  const regex = /<h([2-3])(?:[^>]*id="([^"]*)")?[^>]*>(.*?)<\/h[2-3]>/gi
  let match

  while ((match = regex.exec(html)) !== null) {
    const level = parseInt(match[1])
    const text = match[3].replace(/<[^>]*>/g, '').trim()
    const id = match[2] || text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    headings.push({ id, text, level })
  }

  return headings
}

function injectHeadingIds(html: string): string {
  return html.replace(/<h([2-3])([^>]*)>(.*?)<\/h([2-3])>/gi, (fullMatch, level, attrs, content, closeLevel) => {
    if (attrs.includes('id=')) return fullMatch

    const text = content.replace(/<[^>]*>/g, '').trim()
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

    return `<h${level} id="${id}"${attrs}>${content}</h${closeLevel}>`
  })
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const postData = await getPost(slug)

  if (!postData) {
    notFound()
  }

  const post = postData.post
  const author = postData.author || null
  const faqs = postData.faqs || []
  const headings = post.content_html ? extractHeadings(post.content_html) : []
  const processedContent = post.content_html ? injectHeadingIds(post.content_html) : ''

  // Generate schemas
  const articleSchema = generateArticleSchema(post as any, author as any, BASE_URL)
  const breadcrumbSchema = generateBreadcrumbSchema(post as any, post.category_name ? { name: post.category_name, slug: '' } as any : undefined, BASE_URL)
  const faqSchema = faqs.length > 0 ? generateFAQSchema(faqs) : null
  const authorSchema = author ? generateAuthorSchema(author, BASE_URL) : null

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      {faqSchema && (
        <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      )}
      {authorSchema && (
        <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(authorSchema) }} />
      )}

      {/* Breadcrumb Navigation */}
      <nav className='blog-breadcrumb' style={{ marginBottom: 24, fontSize: 14, overflowWrap: 'break-word', wordBreak: 'break-word' }}>
        <Link href='/' style={{ color: '#7c3aed', textDecoration: 'none' }}>
          Home
        </Link>
        <span style={{ margin: '0 8px' }}>/</span>
        <Link href='/blog' style={{ color: '#7c3aed', textDecoration: 'none' }}>
          Blog
        </Link>
        {post.category_name && (
          <>
            <span style={{ margin: '0 8px' }}>/</span>
            <span style={{ color: '#7c3aed' }}>
              {post.category_name}
            </span>
          </>
        )}
        <span style={{ margin: '0 8px' }}>/</span>
        <span style={{ color: 'var(--blog-muted)' }}>{post.title}</span>
      </nav>

      <div className='blog-layout'>
        {/* Main Content */}
        <article style={{ flex: 1, minWidth: 0 }}>
          {/* Post Header */}
          <header style={{ marginBottom: 32 }}>
            {post.category_name && (
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 12px',
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  backgroundColor: '#ede9fe',
                  color: '#7c3aed',
                  marginBottom: 16
                }}
              >
                {post.category_name}
              </span>
            )}

            <h1 className='blog-post-title-h1'>
              {post.title}
            </h1>

            {/* Post Meta */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                fontSize: 14,
                color: 'var(--blog-light)',
                flexWrap: 'wrap'
              }}
            >
              {author && (
                <Link
                  href={`/blog/author/${author.slug}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    textDecoration: 'none',
                    color: 'var(--blog-muted)',
                    fontWeight: 500
                  }}
                >
                  {author.avatar_url && (
                    <img
                      src={author.avatar_url}
                      alt={author.name}
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }}
                    />
                  )}
                  {author.name}
                </Link>
              )}
              <time dateTime={post.published_at}>
                {new Date(post.published_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </time>
              {post.reading_time_min && <span>{post.reading_time_min} min read</span>}
            </div>
          </header>

          {/* Featured Image */}
          {post.featured_image_url && (
            <img
              src={post.featured_image_url}
              alt={post.title}
              style={{
                width: '100%',
                height: 'auto',
                borderRadius: 12,
                marginBottom: 32,
                display: 'block'
              }}
            />
          )}

          {/* Quick Answer Box (Answer-First for AEO) */}
          {post.quick_answer && (
            <div className='blog-qa-box'>
              <div className='blog-qa-title' style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 15, fontWeight: 700 }}>
                <span style={{ fontSize: 20 }}>&#10003;</span>
                Quick Answer
              </div>
              <p className='blog-qa-text' style={{ margin: 0, fontSize: 16, lineHeight: 1.7 }}>{post.quick_answer}</p>
            </div>
          )}

          {/* Article Content */}
          <div
            className='blog-content'
            style={{ fontSize: 17, lineHeight: 1.8 }}
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />

          {/* FAQ Section */}
          {faqs.length > 0 && (
            <section style={{ marginTop: 48 }}>
              <h2 style={{ fontSize: 28, fontWeight: 700, color: 'var(--blog-heading)', marginBottom: 24, paddingBottom: 12, borderBottom: '2px solid var(--blog-border)' }}>
                Frequently Asked Questions
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {faqs.map((faq: BlogFAQ, index: number) => (
                  <div
                    key={index}
                    itemScope
                    itemProp='mainEntity'
                    itemType='https://schema.org/Question'
                    className='blog-faq-card'
                  >
                    <h3 itemProp='name' className='blog-faq-q' style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>
                      {faq.question}
                    </h3>
                    <div itemScope itemProp='acceptedAnswer' itemType='https://schema.org/Answer'>
                      <p itemProp='text' className='blog-faq-a' style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div style={{ marginTop: 40, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {post.tags.map((tag: string) => (
                <span
                  key={tag}
                  style={{
                    padding: '4px 12px',
                    borderRadius: 16,
                    fontSize: 13,
                    backgroundColor: 'var(--blog-card)',
                    color: 'var(--blog-muted)',
                    border: '1px solid var(--blog-border)'
                  }}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Author Bio Box */}
          {author && (
            <div
              className='blog-author-box'
              style={{
                marginTop: 48,
                padding: 28,
                borderRadius: 12,
                display: 'flex',
                gap: 20,
                alignItems: 'flex-start'
              }}
            >
              {author.avatar_url && (
                <img
                  src={author.avatar_url}
                  alt={author.name}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0
                  }}
                />
              )}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--blog-light)', textTransform: 'uppercase', marginBottom: 4 }}>
                  Written by
                </div>
                <Link
                  href={`/blog/author/${author.slug}`}
                  style={{ textDecoration: 'none' }}
                >
                  <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--blog-heading)', margin: '0 0 8px' }}>{author.name}</h3>
                </Link>
                {author.bio && (
                  <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--blog-muted)', margin: '0 0 12px' }}>{author.bio}</p>
                )}
                {author.expertise && author.expertise.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                    {author.expertise.map((skill: string) => (
                      <span
                        key={skill}
                        style={{
                          padding: '2px 10px',
                          borderRadius: 12,
                          fontSize: 12,
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
                <div style={{ display: 'flex', gap: 12 }}>
                  {author.social_links?.twitter && (
                    <a href={author.social_links?.twitter} target='_blank' rel='noopener noreferrer' style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none' }}>
                      Twitter
                    </a>
                  )}
                  {author.social_links?.linkedin && (
                    <a href={author.social_links?.linkedin} target='_blank' rel='noopener noreferrer' style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none' }}>
                      LinkedIn
                    </a>
                  )}
                  {author.social_links?.facebook && (
                    <a href={author.social_links?.facebook} target='_blank' rel='noopener noreferrer' style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none' }}>
                      Facebook
                    </a>
                  )}
                  {author.social_links?.website && (
                    <a href={author.social_links?.website} target='_blank' rel='noopener noreferrer' style={{ color: '#7c3aed', fontSize: 14, textDecoration: 'none' }}>
                      Website
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Related Posts - coming soon */}
        </article>

        {/* Table of Contents Sidebar */}
        {headings.length > 3 && (
          <aside
            style={{
              width: 260,
              flexShrink: 0,
              position: 'sticky',
              top: 100,
              alignSelf: 'flex-start',
              display: 'none'
            }}
            // Visible on desktop via media query workaround: parent uses CSS grid
            className='blog-toc-sidebar'
          >
            <nav className='blog-toc'>
              <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Table of Contents
              </h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {headings.map((heading, index) => (
                  <li key={index} style={{ marginBottom: 6 }}>
                    <a
                      href={`#${heading.id}`}
                      style={{ fontSize: 13, lineHeight: 1.5, display: 'block', paddingLeft: heading.level === 3 ? 16 : 0 }}
                    >
                      {heading.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}
      </div>

      {/* Global blog styles with dark/light mode support */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              --blog-text: #334155;
              --blog-heading: #1a1a2e;
              --blog-muted: #64748b;
              --blog-light: #94a3b8;
              --blog-bg: #ffffff;
              --blog-card: #f8fafc;
              --blog-border: #e2e8f0;
              --blog-qa-bg: #f0fdf4;
              --blog-qa-border: #86efac;
              --blog-qa-title: #166534;
              --blog-qa-text: #15803d;
              --blog-faq-bg: #ffffff;
              --blog-toc-bg: #f8fafc;
              --blog-blockquote-bg: #f8fafc;
              --blog-blockquote-text: #475569;
              --blog-th-bg: #f1f5f9;
              --blog-author-bg: #f8fafc;
              --blog-author-text: #1e293b;
            }
            [data-dark], [data-dark=""], [data-mode="dark"], [data-mui-color-scheme="dark"] {
              --blog-text: #cbd5e1;
              --blog-heading: #f1f5f9;
              --blog-muted: #94a3b8;
              --blog-light: #64748b;
              --blog-bg: #0f172a;
              --blog-card: #1e293b;
              --blog-border: #334155;
              --blog-qa-bg: #0a2e1a;
              --blog-qa-border: #166534;
              --blog-qa-title: #4ade80;
              --blog-qa-text: #86efac;
              --blog-faq-bg: #1e293b;
              --blog-toc-bg: #1e293b;
              --blog-blockquote-bg: #1e293b;
              --blog-blockquote-text: #94a3b8;
              --blog-th-bg: #1e293b;
              --blog-author-bg: #1e293b;
              --blog-author-text: #e2e8f0;
            }
            .blog-content { color: var(--blog-text); }
            .blog-content h2 { font-size: 26px; font-weight: 700; color: var(--blog-heading); margin: 40px 0 16px; line-height: 1.3; }
            .blog-content h3 { font-size: 22px; font-weight: 600; color: var(--blog-heading); margin: 32px 0 12px; line-height: 1.3; }
            .blog-content h4 { font-size: 18px; font-weight: 600; color: var(--blog-heading); margin: 24px 0 8px; }
            .blog-content p { margin: 0 0 16px; color: var(--blog-text); }
            .blog-content ul, .blog-content ol { margin: 0 0 16px; padding-left: 24px; color: var(--blog-text); }
            .blog-content li { margin-bottom: 6px; }
            .blog-content strong { color: var(--blog-heading); }
            .blog-content a { color: #7c3aed; text-decoration: underline; }
            .blog-content img { max-width: 100%; height: auto; border-radius: 8px; margin: 16px 0; }
            .blog-content blockquote { margin: 20px 0; padding: 16px 24px; border-left: 4px solid #7c3aed; background: var(--blog-blockquote-bg); border-radius: 0 8px 8px 0; font-style: italic; color: var(--blog-blockquote-text); }
            .blog-content pre { background: #1e293b; color: #e2e8f0; padding: 16px 20px; border-radius: 8px; overflow-x: auto; margin: 16px 0; font-size: 14px; }
            .blog-content code { font-family: 'Fira Code', monospace; font-size: 0.9em; }
            .blog-content table { width: 100%; border-collapse: collapse; margin: 16px 0; }
            .blog-content th, .blog-content td { border: 1px solid var(--blog-border); padding: 10px 14px; text-align: left; font-size: 15px; color: var(--blog-text); }
            .blog-content th { background: var(--blog-th-bg); font-weight: 600; color: var(--blog-heading); }
            .blog-qa-box { background: var(--blog-qa-bg); border: 1px solid var(--blog-qa-border); border-radius: 12px; padding: 24px; margin-bottom: 32px; }
            .blog-qa-title { color: var(--blog-qa-title); }
            .blog-qa-text { color: var(--blog-qa-text); }
            .blog-faq-card { background: var(--blog-faq-bg); border: 1px solid var(--blog-border); border-radius: 10px; padding: 24px; }
            .blog-faq-q { color: var(--blog-heading); }
            .blog-faq-a { color: var(--blog-text); }
            .blog-toc { background: var(--blog-toc-bg); border: 1px solid var(--blog-border); border-radius: 10px; padding: 20px; }
            .blog-toc h4 { color: var(--blog-heading) !important; }
            .blog-toc a { color: var(--blog-muted); text-decoration: none; }
            .blog-toc a:hover { color: #7c3aed; }
            .blog-author-box { background: var(--blog-author-bg); border: 1px solid var(--blog-border); }
            .blog-meta { color: var(--blog-light); }
            .blog-meta a { color: var(--blog-muted); }
            .blog-breadcrumb { color: var(--blog-light); }
            .blog-breadcrumb span { color: var(--blog-muted); }
            .blog-layout { display: flex; gap: 40px; }
            .blog-post-title-h1 { font-size: 36px; font-weight: 800; color: var(--blog-heading); line-height: 1.25; margin: 0 0 16px; }
            @media (min-width: 1024px) { .blog-toc-sidebar { display: block !important; } }
            @media (max-width: 1023px) { .blog-layout { gap: 0; } }
            @media (max-width: 768px) {
              .blog-post-title-h1 { font-size: 24px; line-height: 1.3; }
              .blog-content h2 { font-size: 20px; margin: 28px 0 12px; }
              .blog-content h3 { font-size: 18px; margin: 24px 0 10px; }
              .blog-content pre { padding: 12px; font-size: 12px; }
              .blog-content blockquote { padding: 12px 16px; }
              .blog-content table { font-size: 13px; display: block; overflow-x: auto; }
              .blog-content th, .blog-content td { padding: 8px 10px; font-size: 13px; }
              .blog-qa-box { padding: 16px; }
              .blog-faq-card { padding: 16px; }
            }
            @media (max-width: 480px) {
              .blog-post-title-h1 { font-size: 20px; }
              .blog-content h2 { font-size: 18px; }
              .blog-content h3 { font-size: 16px; }
            }
          `
        }}
      />
    </>
  )
}
