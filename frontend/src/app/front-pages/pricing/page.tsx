// Next Imports
import type { Metadata } from 'next'

// MUI Imports
import Typography from '@mui/material/Typography'

// Component Imports
import NprPricing from '@views/front-pages/pricing/NprPricing'
import PricingFaqs from '@views/front-pages/pricing/PricingFaqs'

// Util Imports
import { pageMetadata } from '@/utils/seo'

// This route used to render a theme's demo pricing page: a USD form-builder at
// $0/$40/$80 with a 14-day trial, whose buttons led to a card-and-password form.
// It now shows the plans the homepage sells, in NPR.
export const metadata: Metadata = pageMetadata({
  path: '/pricing',
  title: 'Pricing: Nepal Fillings Plans in NPR',
  description:
    'Compare Nepal Fillings plans in NPR. Start free with up to 500 subscribers, then choose Growing Business, Advanced or Enterprise, billed monthly or yearly.'
})

export default function PricingPage() {
  return (
    <div className='bg-backgroundPaper'>
      <div className='pbs-[120px] text-center'>
        <Typography variant='h3' component='h1' className='font-bold'>
          Nepal Fillings pricing
        </Typography>
      </div>
      <NprPricing />
      <PricingFaqs />
    </div>
  )
}
