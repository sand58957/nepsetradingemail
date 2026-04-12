'use client'

import { useState, useEffect } from 'react'

import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Rating from '@mui/material/Rating'

import { useKeenSlider } from 'keen-slider/react'
import classnames from 'classnames'

import CustomIconButton from '@core/components/mui/IconButton'
import AppKeenSlider from '@/libs/styles/AppKeenSlider'
import frontCommonStyles from '@views/front-pages/styles.module.css'
import styles from './styles.module.css'

const data = [
  {
    desc: 'Nepal Fillings has completely transformed our email marketing. We can now reach thousands of customers across Nepal with a single campaign. The delivery rates are outstanding!',
    logo: '/images/front-pages/landing-page/reviews/daraz_official.png',
    company: 'Daraz',
    rating: 5,
    name: 'Rajesh Sharma',
    position: 'Marketing Head, Daraz Nepal'
  },
  {
    desc: 'The Telegram marketing feature is a game-changer for our food delivery alerts. Our customers love getting instant notifications about offers and deals directly on Telegram.',
    logo: '/images/front-pages/landing-page/reviews/foodmandu_official.png',
    company: 'Foodmandu',
    rating: 5,
    name: 'Srijana Thapa',
    position: 'CEO, Foodmandu'
  },
  {
    desc: 'We switched from manual WhatsApp messaging to Nepal Fillings and our engagement rate doubled. The bulk SMS feature helps us reach customers even in remote areas of Nepal.',
    logo: '/images/front-pages/landing-page/reviews/bhojdeal_official.png',
    company: 'Bhoj Deal',
    rating: 5,
    name: 'Ankit Paudel',
    position: 'Founder, Bhoj Deal'
  },
  {
    desc: 'As a beauty brand, visual email campaigns are essential. Nepal Fillings makes it easy to design stunning emails. Our sales increased by 40% after using their platform.',
    logo: '/images/front-pages/landing-page/reviews/foreveryng_official.svg',
    company: 'Foreveryng',
    rating: 5,
    name: 'Priya Karki',
    position: 'Digital Manager, Foreveryng'
  },
  {
    desc: 'Nepal Fillings helped us streamline our admission notifications. We send bulk SMS and email updates to thousands of students. Reliable and affordable for educational institutions.',
    logo: '/images/front-pages/landing-page/reviews/ioe_official.png',
    company: 'IOE Pulchowk',
    rating: 5,
    name: 'Dr. Ram Prasad',
    position: 'Admin, IOE Pulchowk'
  },
  {
    desc: 'We use Nepal Fillings for flight booking confirmations, delay notifications, and promotional campaigns. The WhatsApp integration improved our customer satisfaction significantly.',
    logo: '/images/front-pages/landing-page/reviews/nepalair_official.png',
    company: 'Nepal Airlines',
    rating: 4,
    name: 'Captain Binod KC',
    position: 'Marketing, Nepal Airlines'
  },
  {
    desc: 'Nepal Fillings has been instrumental in our policyholder communication. Automated SMS and email reminders have reduced our lapse rate by 35%. A must-have for insurance companies!',
    logo: '/images/front-pages/landing-page/reviews/nepallife_official.png',
    company: 'Nepal Life Insurance',
    rating: 5,
    name: 'Hari Bahadur KC',
    position: 'IT Director, Nepal Life Insurance'
  },
  {
    desc: 'As a global brand operating in Nepal, we needed a reliable local platform for customer engagement. Nepal Fillings delivers professional email campaigns with excellent analytics.',
    logo: '/images/front-pages/landing-page/reviews/metlife_official.png',
    company: 'MetLife Nepal',
    rating: 5,
    name: 'Anil Joshi',
    position: 'Digital Lead, MetLife Nepal'
  },
  {
    desc: 'Bulk SMS campaigns for festival greetings and new product launches have become effortless. The Telegram bot feature helps us share insurance tips with our subscriber community.',
    logo: '/images/front-pages/landing-page/reviews/asianlife_official.png',
    company: 'Asian Life Insurance',
    rating: 4,
    name: 'Binita Rana',
    position: 'VP Marketing, Asian Life'
  }
]

const logos = [
  { src: '/images/front-pages/landing-page/reviews/daraz_official.png', alt: 'Daraz' },
  { src: '/images/front-pages/landing-page/reviews/foodmandu_official.png', alt: 'Foodmandu' },
  { src: '/images/front-pages/landing-page/reviews/bhojdeal_official.png', alt: 'Bhoj Deal' },
  { src: '/images/front-pages/landing-page/reviews/foreveryng_official.svg', alt: 'Foreveryng' },
  { src: '/images/front-pages/landing-page/reviews/ioe_official.png', alt: 'IOE Pulchowk' },
  { src: '/images/front-pages/landing-page/reviews/nepalair_official.png', alt: 'Nepal Airlines' },
  { src: '/images/front-pages/landing-page/reviews/nepallife_official.png', alt: 'Nepal Life' },
  { src: '/images/front-pages/landing-page/reviews/asianlife_official.png', alt: 'Asian Life' }
]

const CustomerReviews = () => {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 300)

    return () => clearTimeout(timer)
  }, [])

  const [sliderRef, instanceRef] = useKeenSlider<HTMLDivElement>(
    {
      loop: true,
      slides: { perView: 3, spacing: 20 },
      slideChanged(s) {
        setCurrentSlide(s.track.details.rel)
      },
      breakpoints: {
        '(max-width: 1200px)': { slides: { perView: 2, spacing: 16 } },
        '(max-width: 768px)': { slides: { perView: 1, spacing: 12, origin: 'center' as const } }
      }
    },
    [
      slider => {
        let timeout: ReturnType<typeof setTimeout>

        function nextTimeout() {
          clearTimeout(timeout)
          timeout = setTimeout(() => slider.next(), 4000)
        }

        slider.on('created', nextTimeout)
        slider.on('dragStarted', () => clearTimeout(timeout))
        slider.on('animationEnded', nextTimeout)
        slider.on('updated', nextTimeout)
      }
    ]
  )

  return (
    <section className={classnames('plb-[80px] bg-backgroundDefault', styles.sectionStartRadius)}>
      <div className={classnames('is-full', frontCommonStyles.layoutSpacing)}>
        {/* Header */}
        <div
          className='flex flex-col items-center text-center gap-4 mbe-12'
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <Chip label='Testimonials' variant='tonal' color='primary' size='small' />
          <Typography variant='h3' className='font-extrabold'>
            Trusted by Leading{' '}
            <span style={{ color: 'var(--mui-palette-primary-main)' }}>Nepali Brands</span>
          </Typography>
          <Typography color='text.secondary' sx={{ maxWidth: 560 }}>
            See how businesses across Nepal are growing with our digital marketing platform
          </Typography>
        </div>

        {/* Slider */}
        <div
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(40px)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s'
          }}
        >
          <AppKeenSlider>
            <div ref={sliderRef} className='keen-slider'>
              {data.map((item, index) => (
                <div key={index} className='keen-slider__slide' style={{ padding: '8px 0' }}>
                  <div
                    style={{
                      position: 'relative',
                      borderRadius: 20,
                      padding: '32px 28px',
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 20,
                      background: 'var(--mui-palette-background-paper)',
                      border: '1px solid',
                      borderColor: currentSlide === index
                        ? 'var(--mui-palette-primary-main)'
                        : 'var(--mui-palette-divider)',
                      boxShadow: currentSlide === index
                        ? '0 12px 40px rgba(var(--mui-palette-primary-mainChannel), 0.15)'
                        : '0 4px 20px rgba(0,0,0,0.06)',
                      transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                      transform: currentSlide === index ? 'scale(1.02)' : 'scale(1)',
                      overflow: 'hidden'
                    }}
                  >
                    {/* Decorative gradient */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 4,
                        background: currentSlide === index
                          ? 'linear-gradient(90deg, var(--mui-palette-primary-main), #7c3aed, #a855f7)'
                          : 'transparent',
                        transition: 'background 0.4s ease'
                      }}
                    />

                    {/* Quote icon */}
                    <div style={{ position: 'absolute', top: 20, right: 24, opacity: 0.06, fontSize: 80, lineHeight: 1 }}>
                      <i className='tabler-quote' />
                    </div>

                    {/* Company logo */}
                    <div style={{ height: 36, display: 'flex', alignItems: 'center' }}>
                      <img
                        src={item.logo}
                        alt={item.company}
                        style={{ height: 32, maxWidth: 130, objectFit: 'contain' }}
                      />
                    </div>

                    {/* Review text */}
                    <Typography
                      variant='body2'
                      color='text.secondary'
                      sx={{
                        lineHeight: 1.7,
                        flex: 1,
                        fontSize: '0.9rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 5,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      &ldquo;{item.desc}&rdquo;
                    </Typography>

                    {/* Rating */}
                    <Rating
                      value={item.rating}
                      readOnly
                      size='small'
                      sx={{
                        '& .MuiRating-iconFilled': { color: '#facc15' },
                        '& .MuiRating-iconEmpty': { color: 'rgba(var(--mui-palette-text-primaryChannel), 0.15)' }
                      }}
                    />

                    {/* Author */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: '50%',
                          background: 'linear-gradient(135deg, var(--mui-palette-primary-main), #7c3aed)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontWeight: 700,
                          fontSize: 16,
                          flexShrink: 0
                        }}
                      >
                        {item.name.charAt(0)}
                      </div>
                      <div>
                        <Typography variant='subtitle2' fontWeight={700} sx={{ lineHeight: 1.3 }}>
                          {item.name}
                        </Typography>
                        <Typography variant='caption' color='text.secondary' sx={{ lineHeight: 1.3 }}>
                          {item.position}
                        </Typography>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </AppKeenSlider>

          {/* Controls */}
          <div className='flex items-center justify-center gap-4 mbs-8'>
            <CustomIconButton
              color='primary'
              variant='tonal'
              onClick={() => instanceRef.current?.prev()}
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                transition: 'all 0.2s',
                '&:hover': { transform: 'translateX(-2px)' }
              }}
            >
              <i className='tabler-arrow-left text-xl' />
            </CustomIconButton>

            {/* Dots */}
            <div className='flex items-center gap-1.5'>
              {data.map((_, i) => (
                <div
                  key={i}
                  onClick={() => instanceRef.current?.moveToIdx(i)}
                  style={{
                    width: currentSlide === i ? 28 : 8,
                    height: 8,
                    borderRadius: 4,
                    background: currentSlide === i
                      ? 'var(--mui-palette-primary-main)'
                      : 'var(--mui-palette-action-disabled)',
                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </div>

            <CustomIconButton
              color='primary'
              variant='tonal'
              onClick={() => instanceRef.current?.next()}
              sx={{
                width: 44,
                height: 44,
                borderRadius: '12px',
                transition: 'all 0.2s',
                '&:hover': { transform: 'translateX(2px)' }
              }}
            >
              <i className='tabler-arrow-right text-xl' />
            </CustomIconButton>
          </div>
        </div>

        {/* Trusted By - Logo Marquee */}
        <div
          className='mbs-16'
          style={{
            opacity: isVisible ? 1 : 0,
            transform: isVisible ? 'translateY(0)' : 'translateY(30px)',
            transition: 'all 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s'
          }}
        >
          <Typography
            variant='body2'
            color='text.secondary'
            className='text-center mbe-6'
            sx={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600, fontSize: '0.75rem' }}
          >
            Trusted by top companies in Nepal
          </Typography>

          {/* Infinite scrolling logo marquee */}
          <div style={{ overflow: 'hidden', position: 'relative', padding: '8px 0' }}>
            {/* Gradient fade edges */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                width: 80,
                background: 'linear-gradient(to right, var(--mui-palette-background-default), transparent)',
                zIndex: 2,
                pointerEvents: 'none'
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: 80,
                background: 'linear-gradient(to left, var(--mui-palette-background-default), transparent)',
                zIndex: 2,
                pointerEvents: 'none'
              }}
            />

            <div className='logo-marquee-track'>
              {[...logos, ...logos].map((item, index) => (
                <div
                  key={index}
                  className='logo-marquee-item'
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '12px 32px',
                    flexShrink: 0
                  }}
                >
                  <img
                    src={item.src}
                    alt={item.alt}
                    style={{
                      height: 36,
                      maxWidth: 130,
                      objectFit: 'contain',
                      filter: 'grayscale(100%)',
                      opacity: 0.5,
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={e => {
                      ;(e.target as HTMLImageElement).style.filter = 'grayscale(0%)'
                      ;(e.target as HTMLImageElement).style.opacity = '1'
                    }}
                    onMouseLeave={e => {
                      ;(e.target as HTMLImageElement).style.filter = 'grayscale(100%)'
                      ;(e.target as HTMLImageElement).style.opacity = '0.5'
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .logo-marquee-track {
              display: flex;
              animation: marqueeScroll 30s linear infinite;
              width: max-content;
            }
            .logo-marquee-track:hover {
              animation-play-state: paused;
            }
            @keyframes marqueeScroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `
        }}
      />
    </section>
  )
}

export default CustomerReviews
