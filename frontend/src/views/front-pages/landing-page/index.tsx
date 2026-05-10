'use client'

// React Imports
import { useEffect } from 'react'

// Next Imports
import dynamic from 'next/dynamic'

// Type Imports
import type { SystemMode } from '@core/types'

// Component Imports — HeroSection is above-the-fold, eager-load
import HeroSection from './HeroSection'
import { useSettings } from '@core/hooks/useSettings'

// Below-the-fold sections lazy-loaded so they don't bloat the initial JS bundle.
// SSR stays on by default for SEO; only the JS chunk is deferred.
const UsefulFeature = dynamic(() => import('./UsefulFeature'))
const CustomerReviews = dynamic(() => import('./CustomerReviews'))
const OurTeam = dynamic(() => import('./OurTeam'))
const Pricing = dynamic(() => import('./Pricing'))
const ProductStat = dynamic(() => import('./ProductStat'))
const Faqs = dynamic(() => import('./Faqs'))
const GetStarted = dynamic(() => import('./GetStarted'))
const ContactUs = dynamic(() => import('./ContactUs'))

const LandingPageWrapper = ({ mode }: { mode: SystemMode }) => {
  // Hooks
  const { updatePageSettings } = useSettings()

  // For Page specific settings
  useEffect(() => {
    return updatePageSettings({
      skin: 'default'
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className='bg-backgroundPaper'>
      <HeroSection mode={mode} />
      <UsefulFeature />
      <CustomerReviews />
      <OurTeam />
      <Pricing />
      <ProductStat />
      <Faqs />
      <GetStarted mode={mode} />
      <ContactUs />
    </div>
  )
}

export default LandingPageWrapper
