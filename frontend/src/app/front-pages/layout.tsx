// MUI Imports
import Button from '@mui/material/Button'
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'

// Third-party Imports
import 'react-perfect-scrollbar/dist/css/styles.css'

// Type Imports
import type { ChildrenType } from '@core/types'

// Context Imports
import { IntersectionProvider } from '@/contexts/intersectionContext'

// Component Imports
import Providers from '@components/Providers'
import BlankLayout from '@layouts/BlankLayout'
import FrontLayout from '@components/layout/front-pages'
import ScrollToTop from '@core/components/scroll-to-top'
import WhatsAppFloat from '@components/layout/front-pages/WhatsAppFloat'

// Util Imports
import { getSystemMode } from '@core/utils/serverHelpers'

// Style Imports
import '@/app/globals.css'

// Generated Icon CSS Imports
import '@assets/iconify-icons/generated-icons.css'

export const metadata = {
  title: 'Nepal Fillings - #1 Digital Marketing Platform in Nepal | Email, SMS, WhatsApp, Telegram & Messenger',
  description:
    'Nepal Fillings is Nepal\'s leading all-in-one digital marketing platform. Send bulk Email, SMS, WhatsApp, Telegram & Messenger campaigns. Credit-based pricing, no monthly fees. Built for Nepali businesses, NEPSE traders & marketers.',
  keywords: [
    'Nepal email marketing',
    'bulk SMS Nepal',
    'WhatsApp marketing Nepal',
    'Telegram marketing Nepal',
    'Messenger marketing Nepal',
    'digital marketing Nepal',
    'Nepal Fillings',
    'NEPSE trading alerts',
    'bulk email Nepal',
    'Nepal marketing platform',
    'Aakash SMS',
    'email campaign Nepal',
    'marketing automation Nepal',
    'Nepal business marketing',
    'Kathmandu digital marketing'
  ],
  authors: [{ name: 'Marketminds Investment Group Pvt Ltd' }],
  creator: 'Nepal Fillings',
  publisher: 'Marketminds Investment Group Pvt Ltd',
  metadataBase: new URL('https://nepalfillings.com'),
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: 'Nepal Fillings - #1 Digital Marketing Platform in Nepal',
    description:
      'Send bulk Email, SMS, WhatsApp, Telegram & Messenger campaigns from one dashboard. Credit-based pricing, no monthly fees. Built for Nepali businesses.',
    url: 'https://nepalfillings.com',
    siteName: 'Nepal Fillings',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/images/front-pages/landing-page/hero-dashboard-dark.png',
        width: 1200,
        height: 630,
        alt: 'Nepal Fillings - Digital Marketing Dashboard'
      }
    ]
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nepal Fillings - #1 Digital Marketing Platform in Nepal',
    description:
      'Send bulk Email, SMS, WhatsApp, Telegram & Messenger campaigns from one dashboard. Built for Nepali businesses.',
    images: ['/images/front-pages/landing-page/hero-dashboard-dark.png']
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large' as const,
      'max-snippet': -1
    }
  },
  // GSC verification is handled by /public/google16932f9bf54e4b87.html — do NOT emit a placeholder meta tag here
}

const Layout = async ({ children }: ChildrenType) => {
  // Vars
  const systemMode = await getSystemMode()

  return (
    <html id='__next' lang='en' suppressHydrationWarning>
      <head>
        <meta name='viewport' content='width=device-width, initial-scale=1' />
        <meta name='theme-color' content='#7c3aed' />
        {/* canonical is emitted per-page via Next.js metadata `alternates.canonical` — do NOT hardcode it here, it produces duplicate <link rel="canonical"> tags */}
        <meta name='geo.region' content='NP' />
        <meta name='geo.placename' content='Kathmandu' />
        <meta name='geo.position' content='27.7172;85.3240' />
        <meta name='ICBM' content='27.7172, 85.3240' />
        <script
          async
          src='https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7636052892520336'
          crossOrigin='anonymous'
        />
      </head>
      <body className='flex is-full min-bs-full flex-auto flex-col'>
        <InitColorSchemeScript attribute='data' defaultMode={systemMode} />
        <Providers direction='ltr'>
          <BlankLayout systemMode={systemMode}>
            <IntersectionProvider>
              <FrontLayout>
                {children}
                <WhatsAppFloat />
                <ScrollToTop className='mui-fixed'>
                  <Button
                    variant='contained'
                    className='is-10 bs-10 rounded-full p-0 min-is-0 flex items-center justify-center'
                  >
                    <i className='tabler-arrow-up' />
                  </Button>
                </ScrollToTop>
              </FrontLayout>
            </IntersectionProvider>
          </BlankLayout>
        </Providers>
      </body>
    </html>
  )
}

export default Layout
