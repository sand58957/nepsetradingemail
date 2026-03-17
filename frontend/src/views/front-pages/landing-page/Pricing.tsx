// React Imports
import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Switch from '@mui/material/Switch'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import InputLabel from '@mui/material/InputLabel'

// Third-party Imports
import classnames from 'classnames'

// Components Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Hook Imports
import { useIntersection } from '@/hooks/useIntersection'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'
import styles from './styles.module.css'

const pricingPlans = [
  {
    title: 'Basic',
    img: '/images/front-pages/landing-page/pricing-basic.png',
    monthlyPay: 5000,
    annualPay: 4000,
    perYearPay: 48000,
    currency: 'NPR',
    features: [
      'Email Marketing (Unlimited)',
      'Telegram Marketing',
      'Contact Management',
      'Campaign Analytics',
      'Email Template Builder',
      'Subscriber Management',
      'Basic Reporting'
    ],
    current: false
  },
  {
    title: 'Premium',
    img: '/images/front-pages/landing-page/pricing-team.png',
    monthlyPay: 7000,
    annualPay: 5500,
    perYearPay: 66000,
    currency: 'NPR',
    features: [
      'Everything in Basic',
      'WhatsApp Marketing',
      'Messenger Marketing',
      'Advanced Analytics Dashboard',
      'Campaign Automation',
      'A/B Testing',
      'Priority Support',
      'Custom Email Templates'
    ],
    current: true
  },
  {
    title: 'Elite',
    img: '/images/front-pages/landing-page/pricing-enterprise.png',
    monthlyPay: 10000,
    annualPay: 8000,
    perYearPay: 96000,
    currency: 'NPR',
    features: [
      'Everything in Premium',
      'Bulk SMS Marketing',
      'API Access & Integration',
      'Dedicated Account Manager',
      'Custom Branding',
      'Advanced Segmentation',
      'Real-time Delivery Reports',
      'Multi-user Team Access'
    ],
    current: false
  }
]

const PricingPlan = () => {
  // Refs
  const skipIntersection = useRef(true)
  const ref = useRef<null | HTMLDivElement>(null)

  // States
  const [pricingPlan, setPricingPlan] = useState<'monthly' | 'annually'>('annually')

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

  const handleChange = (e: ChangeEvent<{ checked: boolean }>) => {
    if (e.target.checked) {
      setPricingPlan('annually')
    } else {
      setPricingPlan('monthly')
    }
  }

  return (
    <section
      id='pricing-plans'
      ref={ref}
      className={classnames(
        'flex flex-col gap-8 lg:gap-12 plb-[100px] bg-backgroundDefault rounded-[60px]',
        styles.sectionStartRadius
      )}
    >
      <div className={classnames('is-full', frontCommonStyles.layoutSpacing)}>
        <div className='flex flex-col gap-y-4 items-center justify-center'>
          <Chip size='small' variant='tonal' color='primary' label='Pricing Plans' />
          <div className='flex flex-col items-center gap-y-1 justify-center flex-wrap'>
            <div className='flex items-center gap-x-2'>
              <Typography color='text.primary' variant='h4' className='text-center'>
                <span className='relative z-[1] font-extrabold'>
                  Tailored pricing plans
                  <img
                    src='/images/front-pages/landing-page/bg-shape.png'
                    alt='bg-shape'
                    className='absolute block-end-0 z-[1] bs-[40%] is-[125%] sm:is-[132%] -inline-start-[10%] sm:inline-start-[-19%] block-start-[17px]'
                  />
                </span>{' '}
                designed for you
              </Typography>
            </div>
            <Typography className='text-center'>
              All plans include powerful digital marketing tools for Nepal.
              <br />
              Choose the best plan to grow your business.
            </Typography>
          </div>
        </div>
        <div className='flex justify-center items-center max-sm:mlb-3 mbe-6'>
          <InputLabel htmlFor='pricing-switch' className='cursor-pointer'>
            Pay Monthly
          </InputLabel>
          <Switch id='pricing-switch' onChange={handleChange} checked={pricingPlan === 'annually'} />
          <InputLabel htmlFor='pricing-switch' className='cursor-pointer'>
            Pay Annually
          </InputLabel>
          <div className='flex gap-x-1 items-start max-sm:hidden mis-2 mbe-5'>
            <img src='/images/front-pages/landing-page/pricing-arrow.png' width='50' />
            <Typography className='font-medium'>Save 25%</Typography>
          </div>
        </div>
        <Grid container spacing={6}>
          {pricingPlans.map((plan, index) => (
            <Grid key={index} size={{ xs: 12, lg: 4 }}>
              <Card className={`${plan.current && 'border-2 border-[var(--mui-palette-primary-main)] shadow-xl'}`}>
                <CardContent className='flex flex-col gap-8 p-8'>
                  <div className='is-full flex flex-col items-center gap-3'>
                    <img src={plan.img} alt={plan.img} height='88' width='86' className='text-center' />
                  </div>
                  <div className='flex flex-col items-center gap-y-[2px] relative'>
                    <Typography className='text-center' variant='h4'>
                      {plan.title}
                    </Typography>
                    <div className='flex items-baseline gap-x-1'>
                      <Typography variant='h4' color='primary.main' className='font-extrabold'>
                        NPR {(pricingPlan === 'monthly' ? plan.monthlyPay : plan.annualPay).toLocaleString()}
                      </Typography>
                      <Typography color='text.disabled' className='font-medium'>
                        /mo
                      </Typography>
                    </div>
                    {pricingPlan === 'annually' && (
                      <Typography color='text.disabled' className='absolute block-start-[100%]'>
                        NPR {plan.perYearPay.toLocaleString()} / year
                      </Typography>
                    )}
                  </div>
                  <div>
                    <div className='flex flex-col gap-3 mbs-3'>
                      {plan.features.map((feature, index) => (
                        <div key={index} className='flex items-center gap-[12px]'>
                          <CustomAvatar color='primary' skin={plan.current ? 'filled' : 'light'} size={20}>
                            <i className='tabler-check text-sm' />
                          </CustomAvatar>
                          <Typography variant='h6'>{feature}</Typography>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button component={Link} href='/front-pages/payment' variant={plan.current ? 'contained' : 'tonal'}>
                    Get Started
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </div>
    </section>
  )
}

export default PricingPlan
