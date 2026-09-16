import type { Metadata } from 'next'

export const SITE_URL = 'https://nepalfillings.com'
export const SITE_NAME = 'Nepal Fillings'
export const BLOG_NAME = 'Nepal Fillings Blog'

export type OgImage = { url: string; width?: number; height?: number; alt: string }

export const DEFAULT_OG_IMAGE: OgImage = {
  url: '/images/front-pages/landing-page/hero-og.jpg',
  width: 1200,
  height: 630,
  alt: 'Nepal Fillings campaign dashboard'
}

export type PageSeo = {
  /** Path relative to metadataBase; it becomes the canonical URL. */
  path: string
  /** Final <title>, emitted as title.absolute so no layout template is appended. */
  title: string
  description: string
  /** false renders noindex, follow. */
  index?: boolean
  image?: OgImage
}

/** Appends ' | brand' only when the whole title still fits in max characters. */
export function withBrand(title: string, brand: string = SITE_NAME, max = 60): string {
  const branded = `${title} | ${brand}`

  return branded.length <= max ? branded : title
}

/**
 * Reads ?page=. 1 when absent; null for anything that isn't a plain positive
 * integer (0, 01, abc, 2.5, or the parameter given twice), which callers turn into
 * a 404 rather than a duplicate of page 1.
 */
export function parsePageParam(raw: string | string[] | undefined): number | null {
  if (raw === undefined) return 1
  if (Array.isArray(raw) || !/^[1-9][0-9]{0,4}$/.test(raw)) return null

  return Number(raw)
}

/** A listing's own URL: page 1 is the bare path, later pages carry ?page=N. */
export function pagedPath(basePath: string, page: number): string {
  return page === 1 ? basePath : `${basePath}?page=${page}`
}

/**
 * Complete metadata for one page.
 *
 * Layout metadata is inherited by every child segment that doesn't override it.
 * The front-pages layout used to set the homepage's canonical, title and
 * description, so pricing, privacy, terms and the help centre all declared
 * themselves copies of the homepage. Each page now states its own.
 */
export function pageMetadata({ path, title, description, index = true, image = DEFAULT_OG_IMAGE }: PageSeo): Metadata {
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: path },
    robots: index
      ? {
          index: true,
          follow: true,
          googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 }
        }
      : { index: false, follow: true, googleBot: { index: false, follow: true } },

    // A child's openGraph/twitter object replaces the parent's, so every field is restated.
    openGraph: { type: 'website', url: path, siteName: SITE_NAME, locale: 'en_US', title, description, images: [image] },
    twitter: { card: 'summary_large_image', title, description, images: [image.url] }
  }
}
