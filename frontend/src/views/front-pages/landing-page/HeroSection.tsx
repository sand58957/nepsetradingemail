// React Imports
import { useState, useEffect } from 'react'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { useColorScheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Theme } from '@mui/material/styles'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { SystemMode } from '@core/types'

// Hook Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

// Styles Imports
import styles from './styles.module.css'
import frontCommonStyles from '@views/front-pages/styles.module.css'

const HeroSection = ({ mode }: { mode: SystemMode }) => {
  // States
  const [transform, setTransform] = useState('')

  // Vars
  const dashboardImageLight = '/images/front-pages/landing-page/hero-dashboard-light.png'
  const dashboardImageDark = '/images/front-pages/landing-page/hero-dashboard-dark.png'
  const elementsImageLight = '/images/front-pages/landing-page/hero-elements-light.png'
  const elementsImageDark = '/images/front-pages/landing-page/hero-elements-dark.png'
  const heroSectionBgLight = '/images/front-pages/landing-page/hero-bg-light.png'
  const heroSectionBgDark = '/images/front-pages/landing-page/hero-bg-dark.png'

  // Hooks
  const { mode: muiMode } = useColorScheme()
  const dashboardImage = useImageVariant(mode, dashboardImageLight, dashboardImageDark)
  const elementsImage = useImageVariant(mode, elementsImageLight, elementsImageDark)
  const heroSectionBg = useImageVariant(mode, heroSectionBgLight, heroSectionBgDark)

  const _mode = (muiMode === 'system' ? mode : muiMode) || mode
  const isAboveLgScreen = useMediaQuery((theme: Theme) => theme.breakpoints.up('lg'))

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleMouseMove = (event: MouseEvent) => {
        const rotateX = (window.innerHeight - 2 * event.clientY) / 100
        const rotateY = (window.innerWidth - 2 * event.clientX) / 100

        setTransform(
          `perspective(1200px) rotateX(${rotateX < -40 ? -20 : rotateX}deg) rotateY(${rotateY}deg) scale3d(1,1,1)`
        )
      }

      window.addEventListener('mousemove', handleMouseMove)

      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
      }
    }
  }, [])

  return (
    <section id='home' className='overflow-hidden pbs-[75px] -mbs-[75px] relative'>
      <img
        src={heroSectionBg}
        alt='hero-bg'
        className={classnames('bs-[95%] sm:bs-[85%] md:bs-[80%]', styles.heroSectionBg, {
          [styles.bgLight]: _mode === 'light',
          [styles.bgDark]: _mode === 'dark'
        })}
      />
      <div className={classnames('pbs-[88px] overflow-hidden', frontCommonStyles.layoutSpacing)}>
        <div className='md:max-is-[700px] mbs-0 mbe-7 mli-auto text-center relative'>
          <Typography
            variant='h1'
            className={classnames('font-extrabold sm:text-[42px] text-3xl mbe-4 leading-[48px]', styles.heroText)}
          >
            All in One Digital Marketing Platform in Nepal
          </Typography>
          <Typography className='font-medium mbe-2' color='text.primary'>
            Reach your audience through Email, SMS, Telegram, WhatsApp &amp; Messenger — all from one powerful dashboard.
          </Typography>
          <Typography variant='body2' color='text.secondary' className='md:max-is-[550px] mli-auto'>
            Built for Nepali businesses, NEPSE traders &amp; digital marketers. Manage subscribers, automate campaigns,
            track analytics and grow your reach with credit-based pricing — no monthly subscriptions.
          </Typography>
          <div className='flex mbs-6 items-baseline justify-center relative gap-4'>
            <div className='flex gap-2 absolute inline-start-[0%] block-start-[41%] max-md:hidden'>
              <Typography className='font-medium'>5 Channels</Typography>
              <img src='/images/front-pages/landing-page/join-community-arrow.png' alt='arrow' height='48' width='60' />
            </div>
            <Button
              component={Link}
              size='large'
              href='/en/register'
              variant='contained'
              color='primary'
            >
              Start Free Trial
            </Button>
            <Button
              component={Link}
              size='large'
              href='/front-pages/landing-page#pricing-plans'
              variant='outlined'
              color='primary'
            >
              View Pricing
            </Button>
          </div>
        </div>
      </div>
      {/* Channel badges */}
      <div className={classnames('flex flex-wrap justify-center gap-3 mbs-8 mbe-6', frontCommonStyles.layoutSpacing)}>
        {[
          { icon: 'tabler-mail', label: 'Email', sub: '99.5% Delivery', color: 'var(--mui-palette-primary-main)', bg: 'rgba(var(--mui-palette-primary-mainChannel), 0.12)', border: 'rgba(var(--mui-palette-primary-mainChannel), 0.2)' },
          { icon: 'tabler-message-2', label: 'SMS', sub: 'Bulk Nepal', color: 'var(--mui-palette-success-main)', bg: 'rgba(var(--mui-palette-success-mainChannel), 0.12)', border: 'rgba(var(--mui-palette-success-mainChannel), 0.2)' },
          { icon: 'tabler-brand-whatsapp', label: 'WhatsApp', sub: 'Business API', color: '#28a745', bg: 'rgba(40,167,69,0.12)', border: 'rgba(40,167,69,0.25)' },
          { icon: 'tabler-brand-telegram', label: 'Telegram', sub: 'Bot Marketing', color: '#0088cc', bg: 'rgba(0,136,204,0.12)', border: 'rgba(0,136,204,0.25)' },
          { icon: 'tabler-brand-messenger', label: 'Messenger', sub: 'FB Campaigns', color: '#0084ff', bg: 'rgba(0,132,255,0.12)', border: 'rgba(0,132,255,0.25)' }
        ].map((ch, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(var(--mui-palette-background-paperChannel), 0.9)',
            backdropFilter: 'blur(10px)',
            borderRadius: 12, padding: '10px 16px',
            border: `1px solid ${ch.border}`,
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: ch.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className={ch.icon} style={{ fontSize: 18, color: ch.color }} />
            </div>
            <div>
              <Typography variant='body2' style={{ fontWeight: 600, lineHeight: 1.2 }}>{ch.label}</Typography>
              <Typography variant='caption' color='text.secondary'>{ch.sub}</Typography>
            </div>
          </div>
        ))}
      </div>
      <div
        className={classnames('relative text-center', frontCommonStyles.layoutSpacing)}
        style={{ transform: isAboveLgScreen ? transform : 'none' }}
      >
        <div className='block relative'>
          <img src={dashboardImage} alt='dashboard-image' className={classnames('mli-auto', styles.heroSecDashboard)} style={{ borderRadius: '12px', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }} />
        </div>
      </div>
    </section>
  )
}

export default HeroSection
