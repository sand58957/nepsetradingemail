// React Imports
import { useEffect, useRef } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import { useIntersection } from '@/hooks/useIntersection'

// SVG Imports
import Paper from '@assets/svg/front-pages/landing-page/Paper'
import Check from '@assets/svg/front-pages/landing-page/Check'
import User from '@assets/svg/front-pages/landing-page/User'
import LaptopCharging from '@assets/svg/front-pages/landing-page/LaptopCharging'
import Rocket from '@assets/svg/front-pages/landing-page/Rocket'
import Document from '@assets/svg/front-pages/landing-page/Document'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'

// Data
const feature = [
  {
    icon: <LaptopCharging color='var(--mui-palette-primary-main)' />,
    title: 'Email Marketing',
    description: 'Design beautiful campaigns with drag-and-drop templates, track opens, clicks and deliveries in real-time.'
  },
  {
    icon: <Rocket color='var(--mui-palette-primary-main)' />,
    title: 'Telegram Marketing',
    description: 'Auto-subscribe users via bot, send bulk alerts to NEPSE traders, and manage contacts with group segmentation.'
  },
  {
    icon: <Paper color='var(--mui-palette-primary-main)' />,
    title: 'SMS Campaigns',
    description: 'Reach customers instantly with bulk SMS via Nepal Telecom and Ncell networks with high delivery rates.'
  },
  {
    icon: <Check color='var(--mui-palette-primary-main)' />,
    title: 'API Integration',
    description: 'RESTful APIs for all channels — automate campaign sending, manage contacts, and track analytics programmatically.'
  },
  {
    icon: <User color='var(--mui-palette-primary-main)' />,
    title: 'WhatsApp & Messenger',
    description: 'Engage customers on WhatsApp Business and Facebook Messenger with automated responses and broadcast campaigns.'
  },
  {
    icon: <Document color='var(--mui-palette-primary-main)' />,
    title: 'Analytics & Reporting',
    description: 'Comprehensive dashboards with delivery rates, engagement metrics, and campaign performance across all channels.'
  }
]

const UsefulFeature = () => {
  // Refs
  const skipIntersection = useRef(true)
  const ref = useRef<null | HTMLDivElement>(null)

  // Hooks
  const { updateIntersections } = useIntersection()

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (skipIntersection.current) {
          skipIntersection.current = false

          return
        }

        updateIntersections({ [entry.target.id]: entry.isIntersecting })
      },
      { threshold: 0.35 }
    )

    ref.current && observer.observe(ref.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section id='features' ref={ref} className='bg-backgroundPaper'>
      <div className={classnames('flex flex-col gap-12 pbs-12 pbe-[100px]', frontCommonStyles.layoutSpacing)}>
        <div className='flex flex-col gap-y-4 items-center justify-center'>
          <Chip size='small' variant='tonal' color='primary' label='Marketing Channels' />
          <div className='flex flex-col items-center gap-y-1 justify-center flex-wrap'>
            <div className='flex items-center gap-x-2'>
              <Typography color='text.primary' variant='h4' className='text-center'>
                <span className='relative z-[1] font-extrabold'>
                  5 Powerful Channels
                  <img
                    src='/images/front-pages/landing-page/bg-shape.png'
                    alt='bg-shape'
                    className='absolute block-end-0 z-[1] bs-[40%] is-[125%] sm:is-[132%] -inline-start-[13%] sm:inline-start-[-19%] block-start-[17px]'
                  />
                </span>{' '}
                to grow your business
              </Typography>
            </div>
            <Typography className='text-center'>
              Email, SMS, Telegram, WhatsApp &amp; Messenger — manage all your marketing from one unified platform.
            </Typography>
          </div>
        </div>
        <div>
          <Grid container spacing={6}>
            {feature.map((item, index) => (
              <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={index}>
                <div className='flex flex-col gap-2 justify-center items-center'>
                  {item.icon}
                  <Typography className='mbs-2' variant='h5'>
                    {item.title}
                  </Typography>
                  <Typography className='max-is-[364px] text-center'>{item.description}</Typography>
                </div>
              </Grid>
            ))}
          </Grid>
        </div>
      </div>
    </section>
  )
}

export default UsefulFeature
