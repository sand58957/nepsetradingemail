import Script from 'next/script'

import type { Metadata } from 'next'

// No canonical, URL or description here: every blog page states its own. This
// layout used to give /blog as the canonical to anything that didn't override it,
// so 404s and broken category pages all claimed to be the blog index.
export const metadata: Metadata = {
  title: { default: 'Nepal Fillings Blog', template: '%s | Nepal Fillings Blog' },
  openGraph: { siteName: 'Nepal Fillings', locale: 'en_US', type: 'website' },
  twitter: { card: 'summary_large_image' }
}

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px 40px' }}>
      {/* AdSense loads only on blog routes (the only pages with ad slots), and
          lazily so it never competes with LCP on the landing/marketing pages. */}
      <Script
        id='adsbygoogle-init'
        async
        strategy='lazyOnload'
        src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7636052892520336'
        crossOrigin='anonymous'
      />
      {children}
    </div>
  )
}
