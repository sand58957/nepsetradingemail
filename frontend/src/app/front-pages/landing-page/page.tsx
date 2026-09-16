// Next Imports
import type { Metadata } from 'next'

// Component Imports
import LandingPageWrapper from '@views/front-pages/landing-page'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'

// Data Imports
import { landingFaqs } from '@/data/landingFaqs'

// Util Imports
import { pageMetadata } from '@/utils/seo'

export const metadata: Metadata = pageMetadata({
  path: '/',
  // Was "#1 Digital Marketing Platform in Nepal": a ranking nobody measured.
  title: 'Nepal Fillings – Bulk SMS, Email & WhatsApp Marketing',
  description:
    'Send bulk SMS, email, WhatsApp, Telegram and Messenger campaigns to customers in Nepal from one dashboard. Plans priced in NPR, with a free plan to start.'
})

// JSON-LD Structured Data for SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Nepal Fillings',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: 'Dashboard for sending email, SMS, WhatsApp, Telegram and Messenger campaigns to customers in Nepal.',
  url: 'https://nepalfillings.com',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'NPR',
    // The pricing table's four tiers: Free, Growing Business and Advanced (priced
    // by subscriber count, topping out at 200,000) and Enterprise, quoted on request.
    lowPrice: '0',
    highPrice: '186500',
    offerCount: '4'
  },
  provider: {
    '@type': 'Organization',
    name: 'Marketminds Investment Group Pvt Ltd',
    url: 'https://nepalfillings.com',
    // No logo: the only raster brand mark is a 32px icon, below Google's minimum,
    // and the dashboard screenshot this used to name is not a logo.
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Koteshwor',
      addressLocality: 'Kathmandu',
      addressCountry: 'NP'
    },
    contactPoint: [
      {
        '@type': 'ContactPoint',
        telephone: '+977-9802348957',
        contactType: 'customer service',
        email: 'admin@nepalfillings.com'
      }
    ]
    // sameAs used to list nepsetrading.com, which merged this product with a
    // separate stock-market brand in search and AI answers.
  }
}

// Built from the same list the page renders, so the markup always matches what
// visitors read. Google shows FAQ rich results only for government and health
// sites, so this is for answer engines, not a search feature.
const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: landingFaqs.map(faq => ({
    '@type': 'Question',
    name: faq.question,
    acceptedAnswer: { '@type': 'Answer', text: faq.answer }
  }))
}

const LandingPage = async () => {
  const mode = await getServerMode()

  return (
    <>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <LandingPageWrapper mode={mode} />
    </>
  )
}

export default LandingPage
