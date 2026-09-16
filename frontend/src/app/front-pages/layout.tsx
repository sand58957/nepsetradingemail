// Next Imports
import type { Metadata } from 'next'

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
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from '@/utils/seo'

// Style Imports
import '@/app/globals.css'

// Generated Icon CSS Imports
import '@assets/iconify-icons/generated-icons.css'

// Only what every marketing page shares. No canonical, title or description here:
// layout metadata is inherited by each child page that doesn't override it, which
// is how pricing, privacy, terms and the help centre all ended up declaring the
// homepage as their canonical. Pages set their own through pageMetadata().
// GSC verification is handled by /public/google16932f9bf54e4b87.html.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_NAME,
  applicationName: SITE_NAME,
  publisher: 'Marketminds Investment Group Pvt Ltd',
  openGraph: { siteName: SITE_NAME, locale: 'en_US', type: 'website', images: [DEFAULT_OG_IMAGE] },
  twitter: { card: 'summary_large_image' }
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
        {/* No geo.* meta: search engines ignore it, and the coordinates were
            Kathmandu's centre rather than the Koteshwor office. */}
        {/* AdSense moved to the blog layout (the only routes with ad slots) so it
            no longer loads on LCP-sensitive landing/pricing pages. */}
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
                    aria-label='Scroll to top'
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
