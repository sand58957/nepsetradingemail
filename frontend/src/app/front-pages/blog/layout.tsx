import Script from 'next/script'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Nepal Fillings Blog - Digital Marketing Insights for Nepal',
    template: '%s | Nepal Fillings Blog'
  },
  description:
    'Expert articles on email marketing, SMS campaigns, WhatsApp business, Telegram marketing, and digital growth strategies for Nepali businesses.',
  openGraph: {
    title: 'Nepal Fillings Blog - Digital Marketing Insights for Nepal',
    description:
      'Expert articles on email marketing, SMS campaigns, WhatsApp business, Telegram marketing, and digital growth strategies for Nepali businesses.',
    url: 'https://nepalfillings.com/blog',
    siteName: 'Nepal Fillings',
    locale: 'en_US',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nepal Fillings Blog - Digital Marketing Insights for Nepal',
    description:
      'Expert articles on email marketing, SMS campaigns, WhatsApp business, Telegram marketing, and digital growth strategies for Nepali businesses.'
  },
  alternates: {
    canonical: '/blog'
  }
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
