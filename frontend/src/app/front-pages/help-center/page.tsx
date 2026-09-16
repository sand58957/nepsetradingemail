// Next Imports
import type { Metadata } from 'next'

// Component Imports
import HelpCenterWrapper from '@views/front-pages/help-center'

// Util Imports
import { pageMetadata } from '@/utils/seo'

// Still the theme's marketplace help centre ("Where Is My Purchase Code?"), so it is
// kept out of search, and nginx sends visitors to the contact section instead.
// Index it again once it holds real Nepal Fillings articles.
export const metadata: Metadata = pageMetadata({
  path: '/front-pages/help-center',
  title: 'Help Center | Nepal Fillings',
  description: 'Set-up help for email, SMS, WhatsApp, Telegram and Messenger campaigns on Nepal Fillings.',
  index: false
})

function HelpCenterPage() {
  return <HelpCenterWrapper />
}

export default HelpCenterPage
