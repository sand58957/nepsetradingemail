// Component Imports
import LandingPageWrapper from '@views/front-pages/landing-page'

// Server Action Imports
import { getServerMode } from '@core/utils/serverHelpers'

// JSON-LD Structured Data for SEO
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Nepal Fillings',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'All-in-one digital marketing platform in Nepal for Email, SMS, WhatsApp, Telegram & Messenger campaigns.',
  url: 'https://nepalfillings.com',
  offers: {
    '@type': 'AggregateOffer',
    priceCurrency: 'NPR',
    // Was 4000-8000 across 3 offers, which matched neither the pricing table nor
    // the FAQ and hid the free tier from the search snippet. The table lists four
    // tiers: Free, Growing Business and Advanced (both priced by subscriber count,
    // topping out at 200,000) and Enterprise, which is quoted on request.
    lowPrice: '0',
    highPrice: '186500',
    offerCount: '4'
  },
  // An aggregateRating of 4.8 from 150 reviews was declared here against a page
  // that shows nine testimonials and no review system. A rating a business
  // publishes about its own product is self-serving and earns no rich result
  // either way, so the markup carried the risk of an unverifiable claim without
  // the benefit. Reinstate it only if it can be tied to real, countable reviews.
  provider: {
    '@type': 'Organization',
    name: 'Marketminds Investment Group Pvt Ltd',
    url: 'https://nepalfillings.com',
    logo: 'https://nepalfillings.com/images/front-pages/landing-page/hero-dashboard-dark.png',
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
        email: 'admin@nepsetrading.com'
      }
    ],
    sameAs: ['https://nepsetrading.com', 'https://nepalfillings.com']
  }
}

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What is Nepal Fillings and how does it help my business?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Nepal Fillings is an all-in-one digital marketing platform built for businesses in Nepal. It enables you to send bulk emails, Telegram messages, SMS, WhatsApp messages, and Facebook Messenger campaigns from a single dashboard.'
      }
    },
    {
      '@type': 'Question',
      name: 'Can I send bulk SMS to customers across Nepal?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes! Nepal Fillings integrates with Nepal Telecom and Ncell networks for high delivery rate bulk SMS across all of Nepal.'
      }
    },
    {
      '@type': 'Question',
      name: 'What payment methods do you accept?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'We accept eSewa, Khalti, ConnectIPS, IME Pay, FonePay, Visa, Mastercard, PayPal, and bank transfers from NMB, Civil Bank, and Laxmi Sunrise Bank.'
      }
    },
    {
      '@type': 'Question',
      name: 'Is Nepal Fillings suitable for small businesses in Nepal?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. You can start free with up to 500 subscribers, and paid plans are priced by the size of your subscriber list, so the cost grows only as your audience does.'
      }
    }
  ]
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
