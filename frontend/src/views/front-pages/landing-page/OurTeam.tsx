// React Imports
import { useEffect, useRef } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'

// Third-party Imports
import classnames from 'classnames'

// Hook Imports
import { useIntersection } from '@/hooks/useIntersection'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'

// Payment Partner Logos - official scraped logos
const partners = [
  { src: '/images/front-pages/landing-page/partners/esewa_official.png', alt: 'eSewa', width: 130 },
  { src: '/images/front-pages/landing-page/partners/khalti_official.png', alt: 'Khalti', width: 120 },
  { src: '/images/front-pages/landing-page/partners/connectips_official.png', alt: 'ConnectIPS', width: 100 },
  { src: '/images/front-pages/landing-page/partners/imepay_official.jpg', alt: 'IME Pay', width: 110 },
  { src: '/images/front-pages/landing-page/partners/fonepay_official.png', alt: 'FonePay', width: 120 },
  { src: '/images/front-pages/landing-page/partners/namastepay_official.png', alt: 'Namaste Pay', width: 70 },
  { src: '/images/front-pages/landing-page/partners/prabhupay_official.png', alt: 'Prabhu Pay', width: 130 },
  { src: '/images/front-pages/landing-page/partners/visa_official.png', alt: 'Visa', width: 100 },
  { src: '/images/front-pages/landing-page/partners/mastercard_official.png', alt: 'Mastercard', width: 80 },
  { src: '/images/front-pages/landing-page/partners/unionpay_official.png', alt: 'UnionPay', width: 110 },
  { src: '/images/front-pages/landing-page/partners/paypal_official.png', alt: 'PayPal', width: 120 },
  { src: '/images/front-pages/landing-page/partners/nmb_official.png', alt: 'NMB Bank', width: 110 },
  { src: '/images/front-pages/landing-page/partners/civilbank_official.jpg', alt: 'Civil Bank', width: 110 },
  { src: '/images/front-pages/landing-page/partners/laxmisunrise_official.png', alt: 'Laxmi Sunrise Bank', width: 130 },
]

const PaymentPartners = () => {
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
    <section
      id='team'
      className='plb-[20px]'
      ref={ref}
      style={{
        background: 'linear-gradient(180deg, #0a0e1a 0%, #121829 50%, #0a0e1a 100%)'
      }}
    >
      <div className={frontCommonStyles.layoutSpacing}>
        <div className='flex flex-col gap-y-4 items-center justify-center'>
          <Chip
            size='small'
            variant='tonal'
            color='primary'
            label='Trusted Payment Partners'
          />
          <div className='flex flex-col items-center gap-y-1 justify-center flex-wrap'>
            <div className='flex items-center gap-x-2'>
              <Typography variant='h4' style={{ color: '#fff' }}>
                <span className='relative z-[1] font-extrabold'>
                  Payment
                  <img
                    src='/images/front-pages/landing-page/bg-shape.png'
                    alt='bg-shape'
                    className='absolute block-end-0 z-[1] bs-[40%] is-[132%] -inline-start-[19%] block-start-[17px]'
                  />
                </span>{' '}
                Partners
              </Typography>
            </div>
            <Typography style={{ color: 'rgba(255,255,255,0.6)' }} className='text-center'>
              Secure and seamless payments through Nepal&apos;s most trusted payment gateways and banks.
            </Typography>
          </div>
        </div>
        <div
          className={classnames(
            'flex flex-wrap items-center justify-center gap-5 pbs-[30px]'
          )}
        >
          {partners.map((partner, index) => (
            <div
              key={index}
              className='flex items-center justify-center'
              style={{
                minWidth: 110,
                height: 60,
                padding: '12px 22px',
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: 14,
                backdropFilter: 'blur(10px)',
                transition: 'all 0.3s ease'
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLDivElement

                el.style.backgroundColor = 'rgba(255, 255, 255, 1)'
                el.style.borderColor = 'rgba(var(--mui-palette-primary-mainChannel), 0.3)'
                el.style.transform = 'translateY(-3px)'
                el.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.3)'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLDivElement

                el.style.backgroundColor = 'rgba(255, 255, 255, 0.95)'
                el.style.borderColor = 'rgba(255, 255, 255, 0.3)'
                el.style.transform = 'translateY(0)'
                el.style.boxShadow = 'none'
              }}
            >
              <img
                src={partner.src}
                alt={partner.alt}
                style={{
                  maxWidth: partner.width,
                  maxHeight: 40,
                  objectFit: 'contain'
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default PaymentPartners
