// React Imports
import { useEffect, useRef } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Link from '@mui/material/Link'

// Third-party Imports
import classnames from 'classnames'

// Components Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Hook Imports
import { useIntersection } from '@/hooks/useIntersection'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'
import styles from './styles.module.css'

const ContactUs = () => {
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
    <section id='contact-us' className='plb-[100px] bg-backgroundDefault' ref={ref}>
      <div className={classnames('flex flex-col gap-14', frontCommonStyles.layoutSpacing)}>
        <div className='flex flex-col gap-y-4 items-center justify-center'>
          <Chip size='small' variant='tonal' color='primary' label='Contact Us' />
          <div className='flex flex-col items-center gap-y-1 justify-center flex-wrap'>
            <div className='flex items-center gap-x-2'>
              <Typography color='text.primary' variant='h4' component='h2'>
                <span className='relative z-[1] font-extrabold'>
                  Let&#39;s work
                  <img
                    src='/images/front-pages/landing-page/bg-shape.webp'
                    alt='bg-shape'
                    className='absolute block-end-0 z-[1] bs-[40%] is-[132%] -inline-start-[19%] block-start-[17px]'
                  />
                </span>{' '}
                together
              </Typography>
            </div>
            <Typography className='text-center'>Questions about plans, API credits or setting up a channel? Call or email us.</Typography>
          </div>
        </div>
        <div className='lg:pis-[38px]'>
          <Grid container spacing={6}>
            <Grid size={{ xs: 12, md: 6, lg: 5 }}>
              <div className={classnames('border p-[10px] relative', styles.contactRadius)}>
                <img
                  src='/images/front-pages/landing-page/contact-border.webp'
                  className='absolute -block-start-[7%] -inline-start-[8%] max-is-full max-lg:hidden '
                  alt=''
                  aria-hidden='true'
                  width='180'
                  height='150'
                  loading='lazy'
                  decoding='async'
                  style={{ height: 'auto' }}
                />
                <div
                  className={classnames(styles.contactRadius)}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    background: 'var(--mui-palette-background-default)',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    minHeight: 280,
                    paddingTop: 20
                  }}
                >
                  {/* Character image */}
                  <img
                    src='/images/illustrations/characters/4.webp'
                    alt='Contact us'
                    loading='lazy'
                    decoding='async'
                    style={{
                      maxHeight: 300,
                      objectFit: 'contain',
                      position: 'relative',
                      zIndex: 2
                    }}
                  />
                  {/* Floating channel icons */}
                  {[
                    {
                      icon: 'tabler-mail',
                      color: '#7367f0',
                      bg: 'rgba(115,103,240,0.15)',
                      border: 'rgba(115,103,240,0.4)',
                      top: '8%',
                      left: '5%'
                    },
                    {
                      icon: 'tabler-message-2',
                      color: '#28c76f',
                      bg: 'rgba(40,199,111,0.15)',
                      border: 'rgba(40,199,111,0.4)',
                      top: '3%',
                      right: '15%'
                    },
                    {
                      icon: 'tabler-brand-whatsapp',
                      color: '#25D366',
                      bg: 'rgba(37,211,102,0.15)',
                      border: 'rgba(37,211,102,0.4)',
                      top: '35%',
                      left: '-2%'
                    },
                    {
                      icon: 'tabler-brand-telegram',
                      color: '#0088cc',
                      bg: 'rgba(0,136,204,0.15)',
                      border: 'rgba(0,136,204,0.4)',
                      top: '30%',
                      right: '-2%'
                    },
                    {
                      icon: 'tabler-brand-messenger',
                      color: '#0084ff',
                      bg: 'rgba(0,132,255,0.15)',
                      border: 'rgba(0,132,255,0.4)',
                      bottom: '20%',
                      right: '5%'
                    }
                  ].map((ch, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        top: ch.top,
                        left: ch.left,
                        right: ch.right,
                        bottom: ch.bottom,
                        width: 48,
                        height: 48,
                        borderRadius: 14,
                        background: ch.bg,
                        border: `1.5px solid ${ch.border}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: `0 4px 20px ${ch.bg}`,
                        zIndex: 3
                      }}
                    >
                      <i className={ch.icon} style={{ fontSize: 22, color: ch.color }} />
                    </div>
                  ))}
                </div>
                <div className='flex flex-col gap-4 pli-6 pbs-4 pbe-[10px]'>
                  <div className='flex gap-3'>
                    <CustomAvatar variant='rounded' size={36} skin='light' color='primary'>
                      <i className='tabler-mail' />
                    </CustomAvatar>
                    <div>
                      <Typography>Email</Typography>
                      <Link href='mailto:admin@nepalfillings.com' color='text.primary' className='font-medium block'>
                        admin@nepalfillings.com
                      </Link>
                      <Link href='mailto:admin@nepsetrading.com' color='text.primary' className='font-medium block'>
                        admin@nepsetrading.com
                      </Link>
                    </div>
                  </div>
                  <div className='flex gap-3'>
                    <CustomAvatar variant='rounded' size={36} skin='light' color='success'>
                      <i className='tabler-phone' />
                    </CustomAvatar>
                    <div>
                      <Typography>Phone</Typography>
                      {/* Tappable: on a phone, a number that can't be tapped is one that doesn't get called. */}
                      {[
                        ['+977-9802348957', '+9779802348957', '9709066517', '+9779709066517'],
                        ['+977-9709066745', '+9779709066745', '9708072951', '+9779708072951'],
                        ['+977-9802363869', '+9779802363869', '01-5253221', '+97715253221']
                      ].map(([label, tel, label2, tel2]) => (
                        <Typography key={tel} color='text.primary' className='font-medium'>
                          <Link href={`tel:${tel}`} color='inherit'>
                            {label}
                          </Link>
                          {' / '}
                          <Link href={`tel:${tel2}`} color='inherit'>
                            {label2}
                          </Link>
                        </Typography>
                      ))}
                    </div>
                  </div>
                  <div className='flex gap-3'>
                    <CustomAvatar variant='rounded' size={36} skin='light' color='info'>
                      <i className='tabler-map-pin' />
                    </CustomAvatar>
                    <div>
                      <Typography>Office Location</Typography>
                      <Typography color='text.primary' className='font-medium'>
                        Koteshwor, Kathmandu, Nepal
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        Near Rastriya Banijya Bank, Koteshwor
                      </Typography>
                    </div>
                  </div>
                </div>
              </div>
            </Grid>
            <Grid size={{ xs: 12, md: 6, lg: 7 }}>
              <Card>
                <CardContent>
                  {/* This used to be a message form whose Send button did nothing: the
                      inputs were never read and nothing was posted anywhere, so every
                      enquiry was lost while looking sent. Until a form is wired to an
                      inbox someone reads, it offers the two ways that do reach us. */}
                  <div className='flex flex-col gap-y-[6px] mbe-6'>
                    <Typography variant='h4' component='h3'>
                      Talk to us
                    </Typography>
                    <Typography>
                      Want to upgrade your plan, buy API credits, or get help setting up SMS, WhatsApp or another
                      channel? Call us or send an email.
                    </Typography>
                  </div>
                  <div className='flex flex-col gap-3 is-full'>
                    <Button
                      component='a'
                      href='tel:+9779802348957'
                      variant='contained'
                      size='large'
                      startIcon={<i className='tabler-phone' />}
                    >
                      Call +977-9802348957
                    </Button>
                    <Button
                      component='a'
                      href='mailto:admin@nepalfillings.com?subject=Nepal%20Fillings%20enquiry'
                      variant='outlined'
                      size='large'
                      startIcon={<i className='tabler-mail' />}
                    >
                      Email admin@nepalfillings.com
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </div>
      </div>
    </section>
  )
}

export default ContactUs
