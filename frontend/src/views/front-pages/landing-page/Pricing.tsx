// React Imports
import { useEffect, useRef, useState } from 'react'

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
import Slider from '@mui/material/Slider'
import Divider from '@mui/material/Divider'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import { useIntersection } from '@/hooks/useIntersection'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'
import styles from './styles.module.css'

// Subscriber tier pricing in NPR (1 USD ≈ 134 NPR)
const subscriberTiers = [
  { subscribers: 500, label: '500' },
  { subscribers: 1500, label: '1,500' },
  { subscribers: 2500, label: '2,500' },
  { subscribers: 5000, label: '5,000' },
  { subscribers: 10000, label: '10,000' },
  { subscribers: 15000, label: '15,000' },
  { subscribers: 20000, label: '20,000' },
  { subscribers: 30000, label: '30,000' },
  { subscribers: 50000, label: '50,000' },
  { subscribers: 100000, label: '100,000' },
  { subscribers: 150000, label: '150,000' },
  { subscribers: 200000, label: '200,000' }
]

// Monthly price per subscriber tier for each plan (NPR)
const planPricing: Record<string, Record<number, number>> = {
  Advanced: {
    500: 4200, 1500: 5500, 2500: 7500, 5000: 10500,
    10000: 16800, 15000: 26800, 20000: 33600, 30000: 46900,
    50000: 67200, 100000: 107600, 150000: 147000, 200000: 186500
  },
  'Growing Business': {
    500: 1750, 1500: 2350, 2500: 3100, 5000: 4700,
    10000: 8700, 15000: 14700, 20000: 17500, 30000: 25200,
    50000: 37800, 100000: 67200, 150000: 100800, 200000: 134400
  }
}

interface PlanDef {
  title: string
  tagline: string
  badge?: string
  getPrice: (tier: number, annual: boolean) => { display: string; sub?: string }
  buttonText: string
  buttonVariant: 'contained' | 'outlined' | 'tonal'
  highlight: boolean
  features: string[]
  sectionTitle?: string
}

const plans: PlanDef[] = [
  {
    title: 'Enterprise',
    tagline: 'For large organizations with more than 200,000 subscribers.',
    getPrice: () => ({ display: "Let's chat" }),
    buttonText: 'Contact us',
    buttonVariant: 'outlined',
    highlight: false,
    features: [
      'Onboarding consultation and training',
      'Unlimited user seats',
      'Unlimited email sends',
      '24/7 Live chat & email support',
      'Dedicated success manager',
      'Dedicated IP',
      'Deliverability consultation',
      'Account audit and performance improvements'
    ],
    sectionTitle: 'All in Advanced, plus'
  },
  {
    title: 'Advanced',
    tagline: 'Best value for growing businesses with advanced needs.',
    badge: 'Best value',
    getPrice: (tier, annual) => {
      const base = planPricing['Advanced'][tier] || 4200
      const price = annual ? Math.round(base * 0.85) : base

      return {
        display: `NPR ${price.toLocaleString()}`,
        sub: annual ? `NPR ${(price * 12).toLocaleString()} billed yearly` : '/month'
      }
    },
    buttonText: 'Upgrade plan',
    buttonVariant: 'contained',
    highlight: true,
    features: [
      'Unlimited monthly emails',
      'Unlimited user seats',
      '24/7 Live chat & email support',
      'Smart sending',
      'Facebook integration',
      'Custom HTML editor',
      'Promotional pop-ups',
      'Enhanced automations',
      'Preference center',
      'AI writing assistant',
      'Partner discounts',
      '15% off Google Workspace'
    ],
    sectionTitle: 'All in Growing Business, plus'
  },
  {
    title: 'Growing Business',
    tagline: 'For businesses that want more control and flexibility.',
    badge: 'Save up to 15%',
    getPrice: (tier, annual) => {
      const base = planPricing['Growing Business'][tier] || 1750
      const price = annual ? Math.round(base * 0.85) : base

      return {
        display: `NPR ${price.toLocaleString()}`,
        sub: annual ? `NPR ${(price * 12).toLocaleString()} billed yearly` : '/month'
      }
    },
    buttonText: 'Upgrade plan',
    buttonVariant: 'tonal',
    highlight: false,
    features: [
      'Unlimited monthly emails',
      '3 user seats',
      '24/7 Email support',
      'Sell digital products',
      'Unlimited templates',
      'Dynamic emails',
      'Campaign auto-resend',
      'Multivariate testing',
      'Unlimited websites & blogs',
      'Unlimited landing pages',
      'Unsubscribe page builder'
    ],
    sectionTitle: 'All in Free, plus'
  },
  {
    title: 'Free',
    tagline: 'Get started free with up to 500 subscribers.',
    badge: 'Save up to 15%',
    getPrice: () => ({
      display: 'NPR 0',
      sub: 'Maximum 500 subscribers'
    }),
    buttonText: 'Current plan',
    buttonVariant: 'outlined',
    highlight: false,
    features: [
      '12,000 monthly emails',
      '1 user seat',
      'Email support',
      'Email automation builder',
      'Creative assistant',
      'Website builder',
      '10 landing pages',
      'Signup forms & pop-ups',
      'Social posting',
      'Tags',
      'Surveys'
    ],
    sectionTitle: 'Core features'
  }
]

const PricingPlan = () => {
  const skipIntersection = useRef(true)
  const ref = useRef<null | HTMLDivElement>(null)
  const [isAnnual, setIsAnnual] = useState(true)
  const [sliderValue, setSliderValue] = useState(0)

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

  const currentTier = subscriberTiers[sliderValue]
  const subscriberCount = currentTier.subscribers

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
        {/* Header */}
        <div className='flex flex-col gap-y-4 items-center justify-center'>
          <Chip size='small' variant='tonal' color='primary' label='Pricing Plans' />
          <Typography variant='h4' className='text-center font-extrabold'>
            Choose your plan
          </Typography>
          <Typography color='text.secondary' className='text-center max-w-lg'>
            Calculate your price based on your subscriber count. All plans include powerful email marketing tools.
          </Typography>
        </div>

        {/* Subscriber Slider */}
        <div className='flex flex-col items-center gap-4 mbs-6 mbe-4'>
          <div className='flex items-center gap-3'>
            <Typography variant='h5' fontWeight={700} color='primary.main'>
              {currentTier.label}
            </Typography>
            <Typography variant='h6' color='text.secondary'>
              Subscribers
            </Typography>
          </div>
          <div className='is-full max-w-lg px-4'>
            <Slider
              value={sliderValue}
              min={0}
              max={subscriberTiers.length - 1}
              step={1}
              onChange={(_, val) => setSliderValue(val as number)}
              valueLabelDisplay='off'
              marks={[
                { value: 0, label: '500' },
                { value: subscriberTiers.length - 1, label: '200K' }
              ]}
              sx={{
                '& .MuiSlider-track': { height: 8 },
                '& .MuiSlider-rail': { height: 8 },
                '& .MuiSlider-thumb': { width: 22, height: 22 }
              }}
            />
          </div>
          <Typography variant='caption' color='text.secondary'>
            Use the slider above to select your subscriber count
          </Typography>
        </div>

        {/* Billing Toggle */}
        <div className='flex justify-center items-center gap-2 mbe-8'>
          <InputLabel className='cursor-pointer' onClick={() => setIsAnnual(false)}>
            <Typography fontWeight={!isAnnual ? 700 : 400} color={!isAnnual ? 'text.primary' : 'text.secondary'}>
              Pay monthly
            </Typography>
          </InputLabel>
          <Switch checked={isAnnual} onChange={e => setIsAnnual(e.target.checked)} />
          <InputLabel className='cursor-pointer' onClick={() => setIsAnnual(true)}>
            <Typography fontWeight={isAnnual ? 700 : 400} color={isAnnual ? 'text.primary' : 'text.secondary'}>
              Pay yearly (save up to 15%)
            </Typography>
          </InputLabel>
        </div>

        {/* Plan Cards */}
        <Grid container spacing={3}>
          {plans.map((plan, index) => {
            const pricing = plan.getPrice(subscriberCount, isAnnual)

            return (
              <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Card
                  className={plan.highlight ? 'border-2 border-[var(--mui-palette-primary-main)]' : ''}
                  sx={{
                    height: '100%',
                    position: 'relative',
                    boxShadow: plan.highlight ? '0 8px 30px rgba(var(--mui-palette-primary-mainChannel), 0.2)' : undefined
                  }}
                >
                  {plan.badge && (
                    <Chip
                      label={plan.badge}
                      size='small'
                      color={plan.highlight ? 'primary' : 'success'}
                      sx={{
                        position: 'absolute',
                        top: 12,
                        right: 12,
                        fontWeight: 600,
                        fontSize: '0.7rem'
                      }}
                    />
                  )}
                  <CardContent className='flex flex-col gap-5 p-5' sx={{ height: '100%' }}>
                    {/* Plan Name */}
                    <div>
                      <Typography variant='h6' fontWeight={700}>
                        {plan.title}
                      </Typography>
                      <Typography variant='caption' color='text.secondary' sx={{ lineHeight: 1.4, display: 'block', mt: 0.5 }}>
                        {plan.tagline}
                      </Typography>
                    </div>

                    {/* Price */}
                    <div>
                      <Typography variant='h4' fontWeight={800} color={plan.title === 'Free' ? 'success.main' : 'primary.main'}>
                        {pricing.display}
                      </Typography>
                      {pricing.sub && (
                        <Typography variant='caption' color='text.secondary'>
                          {pricing.sub}
                        </Typography>
                      )}
                    </div>

                    {/* CTA Button */}
                    <Button
                      component={Link}
                      href={plan.title === 'Enterprise' ? '/#contact-us' : '/en/register'}
                      variant={plan.buttonVariant as any}
                      color='primary'
                      fullWidth
                      sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px' }}
                    >
                      {plan.buttonText}
                    </Button>

                    <Divider />

                    {/* Features */}
                    <div className='flex flex-col gap-2'>
                      {plan.sectionTitle && (
                        <Typography variant='caption' fontWeight={700} color='text.secondary' sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
                          {plan.sectionTitle}
                        </Typography>
                      )}
                      {plan.features.map((feature, fi) => (
                        <div key={fi} className='flex items-start gap-2'>
                          <i className='tabler-check text-sm text-green-500' style={{ marginTop: 3, flexShrink: 0 }} />
                          <Typography variant='body2' color='text.secondary' sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}>
                            {feature}
                          </Typography>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>

        {/* Note */}
        <Typography variant='caption' color='text.secondary' className='text-center block mbs-6'>
          All prices are in NPR (Nepali Rupees). Annual plans are billed yearly with up to 15% savings.
          Prices may vary based on subscriber count. Contact us for custom enterprise pricing.
        </Typography>
      </div>
    </section>
  )
}

export default PricingPlan
