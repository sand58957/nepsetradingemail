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
    500: 4200,
    1500: 5500,
    2500: 7500,
    5000: 10500,
    10000: 16800,
    15000: 26800,
    20000: 33600,
    30000: 46900,
    50000: 67200,
    100000: 107600,
    150000: 147000,
    200000: 186500
  },
  'Growing Business': {
    500: 1750,
    1500: 2350,
    2500: 3100,
    5000: 4700,
    10000: 8700,
    15000: 14700,
    20000: 17500,
    30000: 25200,
    50000: 37800
    // No prices above 50,000: that is the plan's subscriber limit.
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

// Feature lists name only what the product configures for each plan
// (/api/public/plan-limits) and actually has. The previous lists were copied from
// another email tool's pricing page and promised a website builder, an AI writing
// assistant, surveys, social posting, a dedicated IP and "15% off Google
// Workspace", none of which exist here.
const GROWING_BUSINESS_MAX_SUBSCRIBERS = 50000

const plans: PlanDef[] = [
  {
    title: 'Enterprise',
    tagline: 'For large organizations with more than 200,000 subscribers.',
    getPrice: () => ({ display: "Let's chat" }),
    buttonText: 'Contact us',
    buttonVariant: 'outlined',
    highlight: false,
    features: ['More than 200,000 subscribers', 'All five channels', 'Unlimited user seats', 'Pricing agreed with our team'],
    sectionTitle: 'Everything in Advanced, plus'
  },
  {
    title: 'Advanced',
    tagline: 'All five channels, for up to 200,000 subscribers.',
    badge: 'Best value',
    getPrice: (tier, annual) => {
      const base = planPricing['Advanced'][tier] || 4200
      const price = annual ? Math.round(base * 0.85) : base

      return {
        display: `NPR ${price.toLocaleString()}`,
        sub: annual ? `NPR ${(price * 12).toLocaleString()} billed yearly` : '/month'
      }
    },
    // Nobody arriving from search has a plan to upgrade from.
    buttonText: 'Start with Advanced',
    buttonVariant: 'contained',
    highlight: true,
    features: ['Up to 200,000 subscribers', 'Adds SMS and Facebook Messenger', 'Unlimited user seats'],
    sectionTitle: 'Everything in Growing Business, plus'
  },
  {
    title: 'Growing Business',
    tagline: 'Adds WhatsApp, for up to 50,000 subscribers.',
    badge: 'Save up to 15%',
    getPrice: (tier, annual) => {
      // The plan stops at 50,000 subscribers, so there is no Growing Business
      // price for a bigger list; the slider used to invent one up to 200,000.
      if (tier > GROWING_BUSINESS_MAX_SUBSCRIBERS) {
        return { display: 'Up to 50,000', sub: 'subscribers. Choose Advanced for more.' }
      }

      const base = planPricing['Growing Business'][tier] || 1750
      const price = annual ? Math.round(base * 0.85) : base

      return {
        display: `NPR ${price.toLocaleString()}`,
        sub: annual ? `NPR ${(price * 12).toLocaleString()} billed yearly` : '/month'
      }
    },
    // Nobody arriving from search has a plan to upgrade from.
    buttonText: 'Start with Growing Business',
    buttonVariant: 'tonal',
    highlight: false,
    features: ['Up to 50,000 subscribers', 'Unlimited monthly emails', 'Adds WhatsApp campaigns', '3 user seats'],
    sectionTitle: 'Everything in Free, plus'
  },
  {
    title: 'Free',
    tagline: 'Get started free with up to 500 subscribers.',
    // A free plan cannot save you a percentage off itself.
    badge: 'No card required',
    getPrice: () => ({
      display: 'NPR 0',
      sub: 'Maximum 500 subscribers'
    }),
    // "Current plan" told a signed-out visitor they were already on it.
    buttonText: 'Get started free',
    buttonVariant: 'outlined',
    highlight: false,
    features: [
      'Up to 500 subscribers',
      '12,000 emails a month',
      'Email and Telegram campaigns',
      'Email templates and automations',
      '1 user seat'
    ],
    sectionTitle: 'Includes'
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
          <Typography variant='h4' component='h2' className='text-center font-extrabold'>
            Choose your plan
          </Typography>
          <Typography color='text.secondary' className='text-center max-w-lg'>
            Calculate your price based on your subscriber count. Every plan includes email campaigns, templates and
            automations.
          </Typography>
        </div>

        {/* Subscriber Slider */}
        <div className='flex flex-col items-center gap-4 mbs-6 mbe-4'>
          <div className='flex items-center gap-3'>
            <Typography variant='h5' component='span' fontWeight={700} color='primary.main'>
              {currentTier.label}
            </Typography>
            <Typography variant='h6' component='span' color='text.secondary'>
              Subscribers
            </Typography>
          </div>
          <div className='is-full max-w-lg px-4'>
            <Slider
              aria-label='Subscriber count'
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
        <div className='flex flex-wrap justify-center items-center gap-2 mbe-8'>
          {/* whiteSpace/overflow undo InputLabel's nowrap+hidden defaults, which clip the label on narrow phones */}
          <InputLabel
            className='cursor-pointer'
            sx={{ whiteSpace: 'normal', overflow: 'visible' }}
            onClick={() => setIsAnnual(false)}
          >
            <Typography fontWeight={!isAnnual ? 700 : 400} color={!isAnnual ? 'text.primary' : 'text.secondary'}>
              Pay monthly
            </Typography>
          </InputLabel>
          <Switch
            checked={isAnnual}
            onChange={e => setIsAnnual(e.target.checked)}
            slotProps={{ input: { 'aria-label': 'Toggle annual billing' } }}
          />
          <InputLabel
            className='cursor-pointer'
            sx={{ whiteSpace: 'normal', overflow: 'visible' }}
            onClick={() => setIsAnnual(true)}
          >
            <Typography fontWeight={isAnnual ? 700 : 400} color={isAnnual ? 'text.primary' : 'text.secondary'}>
              Pay yearly (save up to 15%)
            </Typography>
          </InputLabel>
        </div>

        {/* Plan Cards — shown cheapest first.
            `plans` is authored most-expensive first so each entry's "All in <tier>,
            plus" line refers to the one after it. Rendered in that order the cards
            read Enterprise → Free: the first thing a visitor meets is "Let's chat",
            the free tier is last, and every feature list points at the card to its
            right. Reversing here fixes the reading order without disturbing how the
            tiers reference each other. */}
        <Grid container spacing={3}>
          {[...plans].reverse().map((plan, index) => {
            const pricing = plan.getPrice(subscriberCount, isAnnual)

            return (
              <Grid key={index} size={{ xs: 12, sm: 6, lg: 3 }}>
                <Card
                  className={plan.highlight ? 'border-2 border-[var(--mui-palette-primary-main)]' : ''}
                  sx={{
                    height: '100%',
                    position: 'relative',
                    boxShadow: plan.highlight
                      ? '0 8px 30px rgba(var(--mui-palette-primary-mainChannel), 0.2)'
                      : undefined
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
                        fontSize: '0.7rem',
                        // The default light label on the success green measured
                        // 2.21:1 at 11.2px, well under the 4.5:1 needed. A literal
                        // near-black is used rather than a theme channel: the
                        // first attempt reached for --mui-mainColorChannels-dark,
                        // which is the dark THEME's main channel (a light colour)
                        // and made it worse at 1.68:1. On this green, #0F0F1A is
                        // 8.60:1.
                        // The primary-coloured "Best value" chip is white on the
                        // brand at 4.26:1; the same shade darker used for buttons
                        // takes it to 4.57.
                        ...(plan.highlight ? { backgroundColor: '#6E63E6' } : { color: '#0F0F1A' })
                      }}
                    />
                  )}
                  <CardContent className='flex flex-col gap-5 p-5' sx={{ height: '100%' }}>
                    {/* Plan Name */}
                    <div>
                      <Typography variant='h6' component='h3' fontWeight={700}>
                        {plan.title}
                      </Typography>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        sx={{ lineHeight: 1.4, display: 'block', mt: 0.5 }}
                      >
                        {plan.tagline}
                      </Typography>
                    </div>

                    {/* Price */}
                    <div>
                      <Typography
                        variant='h4'
                        component='p'
                        fontWeight={800}
                        color={plan.title === 'Free' ? 'success.main' : 'primary.main'}
                      >
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
                      href={plan.title === 'Enterprise' ? '/#contact-us' : '/register'}
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
                        <Typography
                          variant='caption'
                          fontWeight={700}
                          color='text.secondary'
                          sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}
                        >
                          {plan.sectionTitle}
                        </Typography>
                      )}
                      {plan.features.map((feature, fi) => (
                        <div key={fi} className='flex items-start gap-2'>
                          <i className='tabler-check text-sm text-green-500' style={{ marginTop: 3, flexShrink: 0 }} />
                          <Typography
                            variant='body2'
                            color='text.secondary'
                            sx={{ fontSize: '0.8rem', lineHeight: 1.4 }}
                          >
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
          All prices are in NPR (Nepali Rupees). Annual plans are billed yearly with up to 15% savings. Paid plans are
          set up by our team after you sign up, so contact us to upgrade. SMS messages are sent through your own Aakash
          SMS account and paid to Aakash SMS.
        </Typography>
      </div>
    </section>
  )
}

export default PricingPlan
