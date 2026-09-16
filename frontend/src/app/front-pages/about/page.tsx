// Next Imports
import Link from 'next/link'

import type { Metadata } from 'next'

// MUI Imports
import Typography from '@mui/material/Typography'
import Container from '@mui/material/Container'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'

// Util Imports
import { pageMetadata, SITE_URL } from '@/utils/seo'

// The site had no About page (/about was a 404), so nothing on it said plainly who
// runs Nepal Fillings or how the channels really work. Everything here is already
// stated elsewhere on the site or verifiable in the product; nothing is added that
// the business has not published. Registration and PAN numbers belong here once
// the business chooses to publish them.
export const metadata: Metadata = pageMetadata({
  path: '/about',
  title: 'About Nepal Fillings | Who We Are and How It Works',
  description:
    'Nepal Fillings is run by Marketminds Investment Group Pvt Ltd in Koteshwor, Kathmandu. How the email, SMS, WhatsApp, Telegram and Messenger channels work.'
})

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Nepal Fillings',
  legalName: 'Marketminds Investment Group Pvt Ltd',
  url: SITE_URL,
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Koteshwor',
    addressLocality: 'Kathmandu',
    addressCountry: 'NP'
  },
  contactPoint: [
    {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      telephone: '+977-9802348957',
      email: 'admin@nepalfillings.com',
      areaServed: 'NP'
    }
  ]
}

const channels: [string, string][] = [
  ['Email', 'Campaigns, templates and automations for your subscriber lists.'],
  [
    'SMS',
    'Campaigns sent through your own Aakash SMS account. You buy SMS credits from Aakash SMS and connect your auth token and sender ID.'
  ],
  [
    'WhatsApp',
    "Campaigns sent from a WhatsApp number you link by scanning a QR code. This is not Meta's WhatsApp Business API, and WhatsApp can restrict a linked number, so message only people who opted in."
  ],
  ['Telegram', 'Broadcasts to people who subscribe through your own bot.'],
  ['Facebook Messenger', 'Messages to people who have messaged your Facebook Page.']
]

export default function AboutPage() {
  return (
    <Container maxWidth='md' sx={{ pt: 16, pb: 8 }}>
      <script type='application/ld+json' dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }} />
      <Card>
        <CardContent sx={{ p: { xs: 4, md: 8 } }}>
          <Typography variant='h3' component='h1' fontWeight='bold' gutterBottom>
            About Nepal Fillings
          </Typography>
          <Typography variant='body1' paragraph>
            Nepal Fillings is a dashboard for sending email, SMS, WhatsApp, Telegram and Facebook Messenger campaigns to
            customers in Nepal. It is run by <strong>Marketminds Investment Group Pvt Ltd</strong>, based in Koteshwor,
            Kathmandu. The same company also runs{' '}
            <Link href='https://nepsetrading.com' target='_blank' rel='noopener noreferrer'>
              NEPSE Trading
            </Link>
            , a separate stock-market information service.
          </Typography>

          <Divider sx={{ my: 4 }} />

          <Typography variant='h5' component='h2' fontWeight='bold' gutterBottom>
            How each channel works
          </Typography>
          <Box component='ul' sx={{ pl: 3, lineHeight: 1.9 }}>
            {channels.map(([name, text]) => (
              <li key={name}>
                <strong>{name}:</strong> {text}
              </li>
            ))}
          </Box>
          <Typography variant='body1' paragraph>
            Websites and apps can also send SMS, WhatsApp, email and Messenger messages through our REST API. Live API
            sends use prepaid credits, which our team adds to your account.
          </Typography>

          <Divider sx={{ my: 4 }} />

          <Typography variant='h5' component='h2' fontWeight='bold' gutterBottom>
            Plans
          </Typography>
          <Typography variant='body1' paragraph>
            You can start free with up to 500 subscribers. Paid plans are priced in Nepali rupees by subscriber count
            and billed monthly or yearly, and they are set up by our team. See <Link href='/pricing'>pricing</Link>.
          </Typography>

          <Divider sx={{ my: 4 }} />

          <Typography variant='h5' component='h2' fontWeight='bold' gutterBottom>
            Contact
          </Typography>
          <Box component='ul' sx={{ pl: 3, lineHeight: 1.9 }}>
            <li>
              Phone: <a href='tel:+9779802348957'>+977-9802348957</a>
            </li>
            <li>
              Email: <a href='mailto:admin@nepalfillings.com'>admin@nepalfillings.com</a>
            </li>
            <li>Office: Koteshwor, Kathmandu, Nepal (near Rastriya Banijya Bank)</li>
          </Box>
          <Typography variant='body2' color='text.secondary'>
            Read our <Link href='/privacy'>privacy policy</Link> and <Link href='/terms'>terms of service</Link>.
          </Typography>
        </CardContent>
      </Card>
    </Container>
  )
}
