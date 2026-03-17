// React Imports
import { useEffect, useRef } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'

// Third-party Imports
import classnames from 'classnames'

// Components Imports
import CustomAvatar from '@core/components/mui/Avatar'
import CustomTextField from '@core/components/mui/TextField'

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
              <Typography color='text.primary' variant='h4'>
                <span className='relative z-[1] font-extrabold'>
                  Let&#39;s work
                  <img
                    src='/images/front-pages/landing-page/bg-shape.png'
                    alt='bg-shape'
                    className='absolute block-end-0 z-[1] bs-[40%] is-[132%] -inline-start-[19%] block-start-[17px]'
                  />
                </span>{' '}
                together
              </Typography>
            </div>
            <Typography className='text-center'>Any question or remark? just write us a message</Typography>
          </div>
        </div>
        <div className='lg:pis-[38px]'>
          <Grid container spacing={6}>
            <Grid size={{ xs: 12, md: 6, lg: 5 }}>
              <div className={classnames('border p-[10px] relative', styles.contactRadius)}>
                <img
                  src='/images/front-pages/landing-page/contact-border.png'
                  className='absolute -block-start-[7%] -inline-start-[8%] max-is-full max-lg:hidden '
                  alt='contact-border'
                  width='180'
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
                    minHeight: 360,
                    paddingTop: 30
                  }}
                >
                  {/* Character image */}
                  <img
                    src='/images/illustrations/characters/4.png'
                    alt='Contact us'
                    style={{
                      maxHeight: 300,
                      objectFit: 'contain',
                      position: 'relative',
                      zIndex: 2
                    }}
                  />
                  {/* Floating channel icons */}
                  {[
                    { icon: 'tabler-mail', color: '#7367f0', bg: 'rgba(115,103,240,0.15)', border: 'rgba(115,103,240,0.4)', top: '8%', left: '5%' },
                    { icon: 'tabler-message-2', color: '#28c76f', bg: 'rgba(40,199,111,0.15)', border: 'rgba(40,199,111,0.4)', top: '3%', right: '15%' },
                    { icon: 'tabler-brand-whatsapp', color: '#25D366', bg: 'rgba(37,211,102,0.15)', border: 'rgba(37,211,102,0.4)', top: '35%', left: '-2%' },
                    { icon: 'tabler-brand-telegram', color: '#0088cc', bg: 'rgba(0,136,204,0.15)', border: 'rgba(0,136,204,0.4)', top: '30%', right: '-2%' },
                    { icon: 'tabler-brand-messenger', color: '#0084ff', bg: 'rgba(0,132,255,0.15)', border: 'rgba(0,132,255,0.4)', bottom: '20%', right: '5%' }
                  ].map((ch, i) => (
                    <div key={i} style={{
                      position: 'absolute',
                      top: ch.top, left: ch.left, right: ch.right, bottom: ch.bottom,
                      width: 48, height: 48, borderRadius: 14,
                      background: ch.bg, border: `1.5px solid ${ch.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 4px 20px ${ch.bg}`,
                      zIndex: 3
                    }}>
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
                      <Typography color='text.primary' className='font-medium'>
                        admin@nepsetrading.com
                      </Typography>
                      <Typography color='text.primary' className='font-medium'>
                        admin@nepalfillings.com
                      </Typography>
                    </div>
                  </div>
                  <div className='flex gap-3'>
                    <CustomAvatar variant='rounded' size={36} skin='light' color='success'>
                      <i className='tabler-phone' />
                    </CustomAvatar>
                    <div>
                      <Typography>Phone</Typography>
                      <Typography color='text.primary' className='font-medium'>
                        +977-9802348957 / 9709066517
                      </Typography>
                      <Typography color='text.primary' className='font-medium'>
                        +977-9709066745 / 9708072951
                      </Typography>
                      <Typography color='text.primary' className='font-medium'>
                        +977-9802363869 / 01-5253221
                      </Typography>
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
                  <div className='flex flex-col gap-y-[6px] mbe-6'>
                    <Typography variant='h4'>Send a message</Typography>
                    <Typography>
                      Have questions about our digital marketing services? Want to discuss pricing, partnerships, or
                      need a demo? First visit our office at Koteshwor (Near Rastriya Banijya Bank) or call us directly.
                    </Typography>
                  </div>
                  <form className='flex flex-col items-start gap-6'>
                    <div className='flex gap-5 is-full'>
                      <CustomTextField fullWidth label='Full name' id='name-input' />
                      <CustomTextField fullWidth label='Email address' id='email-input' type='email' />
                    </div>
                    <CustomTextField fullWidth multiline rows={7} label='Message' id='message-input' />
                    <Button variant='contained'>Send Inquiry</Button>
                  </form>
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
