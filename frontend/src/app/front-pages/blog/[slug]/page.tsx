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
          <header className='blog-header'>
            {post.category_name && (
              <span className='blog-category-badge'>{post.category_name}</span>
            )}

            <h1 className='blog-post-title-h1'>{post.title}</h1>

            {/* Post Meta */}
            <div className='blog-post-meta'>
              {author && (
                <Link href={`/blog/author/${author.slug}`} className='blog-author-link'>
                  <span className='blog-avatar-sm'>
                    {author.avatar_url ? (
                      <img src={author.avatar_url} alt={author.name} />
                    ) : (
                      <span className='blog-avatar-initial'>{author.name.charAt(0)}</span>
                    )}
                  </span>
                  {author.name}
                </Link>
              )}
              <span className='blog-meta-divider'>·</span>
              <time dateTime={post.published_at}>
                {new Date(post.published_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </time>
              {post.reading_time_min && (
                <>
                  <span className='blog-meta-divider'>·</span>
                  <span>{post.reading_time_min} min read</span>
                </>
              )}
              {(post.word_count || 0) > 0 && (
                <>
                  <span className='blog-meta-divider'>·</span>
                  <span>{(post.word_count || 0).toLocaleString()} words</span>
                </>
              )}
            </div>
          </header>

          {/* Featured Image */}
          {post.featured_image_url && (
            <figure className='blog-featured-img'>
              <img
                src={post.featured_image_url}
                alt={post.featured_image_alt || post.title}
                loading='eager'
              />
            </figure>
          )}

          {/* Quick Answer Box */}
          {post.quick_answer && (
            <div className='blog-qa-box'>
              <div className='blog-qa-header'>
                <svg width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'><path d='M22 11.08V12a10 10 0 1 1-5.93-9.14'/><polyline points='22 4 12 14.01 9 11.01'/></svg>
                <span>Quick Answer</span>
              </div>
              <p className='blog-qa-text'>{post.quick_answer}</p>
            </div>
          )}

          {/* Article Content */}
          <div
            className='blog-content'
            dangerouslySetInnerHTML={{ __html: processedContent }}
          />

          {/* FAQ Section */}
          {faqs.length > 0 && (
            <section className='blog-faq-section' itemScope itemType='https://schema.org/FAQPage'>
              <div className='blog-faq-header'>
                <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'><circle cx='12' cy='12' r='10'/><path d='M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3'/><line x1='12' y1='17' x2='12.01' y2='17'/></svg>
                <h2>Frequently Asked Questions</h2>
              </div>
              <div className='blog-faq-list'>
                {faqs.map((faq: BlogFAQ, index: number) => (
                  <details key={index} className='blog-faq-item' itemScope itemProp='mainEntity' itemType='https://schema.org/Question'>
                    <summary itemProp='name' className='blog-faq-q'>
                      <span className='blog-faq-num'>{String(index + 1).padStart(2, '0')}</span>
                      {faq.question}
                    </summary>
                    <div itemScope itemProp='acceptedAnswer' itemType='https://schema.org/Answer' className='blog-faq-answer'>
                      <p itemProp='text'>{faq.answer}</p>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          )}

          {/* Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className='blog-tags'>
              {post.tags.map((tag: string) => (
                <span key={tag} className='blog-tag'>#{tag}</span>
              ))}
            </div>
          )}

          {/* Author Bio Box */}
          {author && (
            <div className='blog-author-card'>
              <div className='blog-author-avatar'>
                {author.avatar_url ? (
                  <img src={author.avatar_url} alt={author.name} />
                ) : (
                  <span className='blog-avatar-lg'>{author.name.charAt(0)}</span>
                )}
              </div>
              <div className='blog-author-info'>
                <span className='blog-author-label'>Written by</span>
                <Link href={`/blog/author/${author.slug}`} style={{ textDecoration: 'none' }}>
                  <h3 className='blog-author-name'>{author.name}</h3>
                </Link>
                {author.bio && <p className='blog-author-bio'>{author.bio}</p>}
                {author.expertise && author.expertise.length > 0 && (
                  <div className='blog-author-skills'>
                    {author.expertise.map((skill: string) => (
                      <span key={skill} className='blog-skill-badge'>{skill}</span>
                    ))}
                  </div>
                )}
                <div className='blog-author-socials'>
                  {author.social_links?.twitter && <a href={author.social_links?.twitter} target='_blank' rel='noopener noreferrer'><i className='tabler-brand-x' /></a>}
                  {author.social_links?.linkedin && <a href={author.social_links?.linkedin} target='_blank' rel='noopener noreferrer'><i className='tabler-brand-linkedin' /></a>}
                  {author.social_links?.facebook && <a href={author.social_links?.facebook} target='_blank' rel='noopener noreferrer'><i className='tabler-brand-facebook' /></a>}
                  {author.social_links?.website && <a href={author.social_links?.website} target='_blank' rel='noopener noreferrer'><i className='tabler-world' /></a>}
                </div>
              </div>
            </div>
          )}
        </article>

        {/* Table of Contents Sidebar */}
        {headings.length > 3 && (
          <aside className='blog-toc-sidebar' style={{ width: 260, flexShrink: 0, position: 'sticky', top: 100, alignSelf: 'flex-start', display: 'none' }}>
            <nav className='blog-toc'>
              <h4>On This Page</h4>
              <ul>
                {headings.map((heading, index) => (
                  <li key={index} className={heading.level === 3 ? 'toc-sub' : ''}>
                    <a href={`#${heading.id}`}>{heading.text}</a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}
      </div>

      {/* Blog Styles - Dark/Light Mode */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            :root {
              --blog-text: #374151; --blog-heading: #111827; --blog-muted: #6b7280;
              --blog-light: #9ca3af; --blog-bg: #ffffff; --blog-card: #f9fafb;
              --blog-border: #e5e7eb; --blog-accent: #7c3aed; --blog-accent-light: #ede9fe;
              --blog-qa-bg: #ecfdf5; --blog-qa-border: #6ee7b7; --blog-qa-title: #065f46; --blog-qa-text: #047857;
              --blog-faq-bg: #fafafa; --blog-toc-bg: #f9fafb; --blog-blockquote-bg: #f3f4f6;
              --blog-blockquote-text: #4b5563; --blog-th-bg: #f3f4f6;
              --blog-author-bg: linear-gradient(135deg, #f9fafb, #f3f4f6);
            }
            [data-dark],[data-dark=""],[data-mode="dark"],[data-mui-color-scheme="dark"] {
              --blog-text: #d1d5db; --blog-heading: #f3f4f6; --blog-muted: #9ca3af;
              --blog-light: #6b7280; --blog-bg: #111827; --blog-card: #1f2937;
              --blog-border: #374151; --blog-accent: #a78bfa; --blog-accent-light: rgba(167,139,250,0.15);
              --blog-qa-bg: #064e3b; --blog-qa-border: #065f46; --blog-qa-title: #6ee7b7; --blog-qa-text: #a7f3d0;
              --blog-faq-bg: #1f2937; --blog-toc-bg: #1f2937; --blog-blockquote-bg: #1f2937;
              --blog-blockquote-text: #9ca3af; --blog-th-bg: #1f2937;
              --blog-author-bg: linear-gradient(135deg, #1f2937, #111827);
            }

            /* Layout */
            .blog-layout { display: flex; gap: 48px; }
            @media (max-width: 1023px) { .blog-layout { gap: 0; } }
            @media (min-width: 1024px) { .blog-toc-sidebar { display: block !important; } }

            /* Header */
            .blog-header { margin-bottom: 32px; }
            .blog-category-badge { display: inline-block; padding: 5px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase; background: var(--blog-accent-light); color: var(--blog-accent); margin-bottom: 16px; }
            .blog-post-title-h1 { font-size: 40px; font-weight: 800; color: var(--blog-heading); line-height: 1.2; margin: 0 0 20px; letter-spacing: -0.02em; }

            /* Meta */
            .blog-post-meta { display: flex; align-items: center; gap: 10px; font-size: 14px; color: var(--blog-muted); flex-wrap: wrap; }
            .blog-meta-divider { color: var(--blog-border); font-weight: 300; }
            .blog-author-link { display: flex; align-items: center; gap: 8px; text-decoration: none; color: var(--blog-heading); font-weight: 600; }
            .blog-author-link:hover { color: var(--blog-accent); }
            .blog-avatar-sm { width: 28px; height: 28px; border-radius: 50%; overflow: hidden; flex-shrink: 0; }
            .blog-avatar-sm img { width: 100%; height: 100%; object-fit: cover; }
            .blog-avatar-initial { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--blog-accent), #a78bfa); color: #fff; font-weight: 700; font-size: 13px; border-radius: 50%; }

            /* Featured Image */
            .blog-featured-img { margin: 0 0 40px; border-radius: 16px; overflow: hidden; aspect-ratio: 16/9; }
            .blog-featured-img img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.3s ease; }
            .blog-featured-img:hover img { transform: scale(1.02); }

            /* Content */
            .blog-content { color: var(--blog-text); font-size: 17px; line-height: 1.85; letter-spacing: 0.01em; }
            .blog-content h2 { font-size: 28px; font-weight: 700; color: var(--blog-heading); margin: 48px 0 16px; line-height: 1.3; padding-bottom: 8px; border-bottom: 2px solid var(--blog-border); }
            .blog-content h3 { font-size: 22px; font-weight: 600; color: var(--blog-heading); margin: 36px 0 12px; line-height: 1.3; }
            .blog-content h4 { font-size: 18px; font-weight: 600; color: var(--blog-heading); margin: 28px 0 8px; }
            .blog-content p { margin: 0 0 20px; color: var(--blog-text); }
            .blog-content ul, .blog-content ol { margin: 0 0 20px; padding-left: 28px; color: var(--blog-text); }
            .blog-content li { margin-bottom: 8px; padding-left: 4px; }
            .blog-content strong { color: var(--blog-heading); font-weight: 700; }
            .blog-content a { color: var(--blog-accent); text-decoration: underline; text-underline-offset: 3px; }
            .blog-content a:hover { text-decoration-thickness: 2px; }
            .blog-content img { max-width: 100%; height: auto; border-radius: 12px; margin: 24px 0; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
            .blog-content blockquote { margin: 28px 0; padding: 20px 28px; border-left: 4px solid var(--blog-accent); background: var(--blog-blockquote-bg); border-radius: 0 12px 12px 0; font-style: italic; color: var(--blog-blockquote-text); font-size: 16px; line-height: 1.7; }
            .blog-content pre { background: #0f172a; color: #e2e8f0; padding: 20px 24px; border-radius: 12px; overflow-x: auto; margin: 24px 0; font-size: 14px; border: 1px solid #1e293b; }
            .blog-content code { font-family: 'JetBrains Mono','Fira Code',monospace; font-size: 0.88em; }
            .blog-content table { width: 100%; border-collapse: collapse; margin: 24px 0; border-radius: 8px; overflow: hidden; }
            .blog-content th, .blog-content td { border: 1px solid var(--blog-border); padding: 12px 16px; text-align: left; font-size: 15px; color: var(--blog-text); }
            .blog-content th { background: var(--blog-th-bg); font-weight: 700; color: var(--blog-heading); font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }

            /* Quick Answer Box */
            .blog-qa-box { background: var(--blog-qa-bg); border: 1px solid var(--blog-qa-border); border-radius: 16px; padding: 24px 28px; margin-bottom: 36px; position: relative; overflow: hidden; }
            .blog-qa-box::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #10b981, #34d399, #6ee7b7); }
            .blog-qa-header { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; font-size: 14px; font-weight: 700; color: var(--blog-qa-title); text-transform: uppercase; letter-spacing: 0.5px; }
            .blog-qa-text { margin: 0; font-size: 16px; line-height: 1.75; color: var(--blog-qa-text); }

            /* FAQ Section */
            .blog-faq-section { margin-top: 56px; }
            .blog-faq-header { display: flex; align-items: center; gap: 12px; margin-bottom: 28px; padding-bottom: 16px; border-bottom: 2px solid var(--blog-border); color: var(--blog-heading); }
            .blog-faq-header h2 { font-size: 28px; font-weight: 700; margin: 0; color: var(--blog-heading); border: none; padding: 0; }
            .blog-faq-list { display: flex; flex-direction: column; gap: 12px; }
            .blog-faq-item { background: var(--blog-faq-bg); border: 1px solid var(--blog-border); border-radius: 12px; overflow: hidden; transition: all 0.2s ease; }
            .blog-faq-item[open] { border-color: var(--blog-accent); box-shadow: 0 4px 16px rgba(124,58,237,0.08); }
            .blog-faq-item summary { padding: 18px 24px; font-size: 16px; font-weight: 600; color: var(--blog-heading); cursor: pointer; display: flex; align-items: center; gap: 14px; list-style: none; }
            .blog-faq-item summary::-webkit-details-marker { display: none; }
            .blog-faq-item summary::after { content: '+'; margin-left: auto; font-size: 20px; font-weight: 300; color: var(--blog-muted); transition: transform 0.2s; flex-shrink: 0; }
            .blog-faq-item[open] summary::after { content: '−'; color: var(--blog-accent); }
            .blog-faq-num { font-size: 12px; font-weight: 700; color: var(--blog-accent); background: var(--blog-accent-light); padding: 2px 8px; border-radius: 6px; flex-shrink: 0; }
            .blog-faq-answer { padding: 0 24px 20px; font-size: 15px; line-height: 1.75; color: var(--blog-text); border-top: 1px solid var(--blog-border); margin-top: -2px; padding-top: 16px; }
            .blog-faq-answer p { margin: 0; }

            /* Tags */
            .blog-tags { margin-top: 40px; display: flex; flex-wrap: wrap; gap: 8px; }
            .blog-tag { padding: 5px 14px; border-radius: 20px; font-size: 13px; font-weight: 500; background: var(--blog-card); color: var(--blog-muted); border: 1px solid var(--blog-border); transition: all 0.2s; }
            .blog-tag:hover { border-color: var(--blog-accent); color: var(--blog-accent); }

            /* Author Card */
            .blog-author-card { margin-top: 56px; padding: 32px; border-radius: 20px; display: flex; gap: 24px; align-items: flex-start; background: var(--blog-author-bg); border: 1px solid var(--blog-border); }
            .blog-author-avatar { flex-shrink: 0; }
            .blog-author-avatar img { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 3px solid var(--blog-accent-light); }
            .blog-avatar-lg { width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--blog-accent), #a78bfa); color: #fff; font-weight: 800; font-size: 32px; }
            .blog-author-info { flex: 1; min-width: 0; }
            .blog-author-label { font-size: 11px; font-weight: 700; color: var(--blog-light); text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 4px; }
            .blog-author-name { font-size: 22px; font-weight: 700; color: var(--blog-heading); margin: 0 0 8px; }
            .blog-author-bio { font-size: 14px; line-height: 1.7; color: var(--blog-muted); margin: 0 0 14px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
            .blog-author-skills { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
            .blog-skill-badge { padding: 3px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: var(--blog-accent-light); color: var(--blog-accent); }
            .blog-author-socials { display: flex; gap: 8px; }
            .blog-author-socials a { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--blog-muted); background: var(--blog-card); border: 1px solid var(--blog-border); font-size: 16px; transition: all 0.2s; text-decoration: none; }
            .blog-author-socials a:hover { color: #fff; background: var(--blog-accent); border-color: var(--blog-accent); }

            /* TOC Sidebar */
            .blog-toc { background: var(--blog-toc-bg); border: 1px solid var(--blog-border); border-radius: 16px; padding: 24px; }
            .blog-toc h4 { font-size: 12px; font-weight: 700; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 1px; color: var(--blog-heading) !important; }
            .blog-toc ul { list-style: none; padding: 0; margin: 0; }
            .blog-toc li { margin-bottom: 4px; }
            .blog-toc li.toc-sub { padding-left: 16px; }
            .blog-toc a { font-size: 13px; line-height: 1.6; display: block; padding: 4px 12px; border-radius: 6px; color: var(--blog-muted); text-decoration: none; transition: all 0.15s; border-left: 2px solid transparent; }
            .blog-toc a:hover { color: var(--blog-accent); background: var(--blog-accent-light); border-left-color: var(--blog-accent); }

            /* Breadcrumb */
            .blog-breadcrumb { color: var(--blog-light); }
            .blog-breadcrumb span { color: var(--blog-muted); }

            /* Responsive */
            @media (max-width: 768px) {
              .blog-post-title-h1 { font-size: 26px; line-height: 1.3; }
              .blog-featured-img { border-radius: 12px; margin-bottom: 28px; }
              .blog-content { font-size: 16px; line-height: 1.8; }
              .blog-content h2 { font-size: 22px; margin: 36px 0 12px; }
              .blog-content h3 { font-size: 19px; margin: 28px 0 10px; }
              .blog-content pre { padding: 14px; font-size: 13px; }
              .blog-content blockquote { padding: 16px 20px; }
              .blog-content table { display: block; overflow-x: auto; }
              .blog-content th, .blog-content td { padding: 10px 12px; font-size: 13px; }
              .blog-qa-box { padding: 20px; border-radius: 12px; }
              .blog-faq-item summary { padding: 16px 18px; font-size: 15px; }
              .blog-faq-answer { padding: 0 18px 16px; }
              .blog-author-card { flex-direction: column; align-items: center; text-align: center; padding: 24px; }
              .blog-author-skills { justify-content: center; }
              .blog-author-socials { justify-content: center; }
            }
            @media (max-width: 480px) {
              .blog-post-title-h1 { font-size: 22px; }
              .blog-content h2 { font-size: 20px; }
              .blog-content h3 { font-size: 17px; }
              .blog-faq-item summary { gap: 10px; }
            }
          `
        }}
      />
    </>
  )
}
