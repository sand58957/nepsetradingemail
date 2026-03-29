'use client'

// MUI Imports
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { Mode } from '@core/types'

// Component Imports
import Link from '@components/Link'
import Logo from '@components/layout/shared/Logo'
import CustomTextField from '@core/components/mui/TextField'

// Hooks Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

// Util Imports
import { frontLayoutClasses } from '@layouts/utils/layoutClasses'

// Styles Imports
import styles from './styles.module.css'
import frontCommonStyles from '@views/front-pages/styles.module.css'

const Footer = ({ mode }: { mode: Mode }) => {
  // Vars
  const footerImageLight = '/images/front-pages/footer-bg-light.png'
  const footerImageDark = '/images/front-pages/footer-bg-dark.png'

  // Hooks
  const dashboardImage = useImageVariant(mode, footerImageLight, footerImageDark)

  return (
    <footer className={frontLayoutClasses.footer}>
      <div className='relative'>
        <img src={dashboardImage} alt='footer bg' className='absolute inset-0 is-full bs-full object-cover -z-[1]' />
        <div className={classnames('plb-12 text-white', frontCommonStyles.layoutSpacing)}>
          <Grid container rowSpacing={10} columnSpacing={12}>
            <Grid size={{ xs: 12, lg: 5 }}>
              <div className='flex flex-col items-start gap-6'>
                <Link href='/'>
                  <Logo color='var(--mui-palette-common-white)' />
                </Link>
                <Typography color='white' className='md:max-is-[390px] opacity-[0.78]'>
                  Nepal Fillings - Multi-channel digital marketing platform for Email, SMS, Telegram, WhatsApp &
                  Messenger campaigns. Powered by Marketminds Investment Group Pvt Ltd.
                </Typography>
                <div className='flex items-end'>
                  <CustomTextField
                    size='small'
                    className={styles.inputBorder}
                    label='Subscribe to newsletter'
                    placeholder='Your email'
                    sx={{
                      '& .MuiInputBase-root': {
                        borderStartEndRadius: '0 !important',
                        borderEndEndRadius: '0 !important',
                        '&:not(.Mui-focused)': {
                          borderColor: 'rgb(var(--mui-mainColorChannels-dark) / 0.22)'
                        },
                        '&.MuiFilledInput-root:not(.Mui-focused):not(.Mui-disabled):hover': {
                          borderColor: 'rgba(255 255 255 / 0.6) !important'
                        }
                      }
                    }}
                  />
                  <Button
                    variant='contained'
                    color='primary'
                    sx={{
                      borderStartStartRadius: 0,
                      borderEndStartRadius: 0
                    }}
                  >
                    Subscribe
                  </Button>
                </div>
              </div>
            </Grid>
            <Grid size={{ xs: 12, sm: 3, lg: 2 }}>
              <Typography color='white' className='font-medium mbe-6 opacity-[0.92]'>
                Platform
              </Typography>
              <div className='flex flex-col gap-4'>
                <Typography component={Link} href='/' color='white' className='opacity-[0.78]'>
                  Home
                </Typography>
                <Typography component={Link} href='/#pricing-plans' color='white' className='opacity-[0.78]'>
                  Pricing
                </Typography>
                <Typography component={Link} href='/#features' color='white' className='opacity-[0.78]'>
                  Features
                </Typography>
                <Typography component={Link} href='/#faq' color='white' className='opacity-[0.78]'>
                  FAQ
                </Typography>
                <Typography component={Link} href='/#contact-us' color='white' className='opacity-[0.78]'>
                  Contact Us
                </Typography>
              </div>
            </Grid>
            <Grid size={{ xs: 12, sm: 3, lg: 2 }}>
              <Typography color='white' className='font-medium mbe-6 opacity-[0.92]'>
                Channels
              </Typography>
              <div className='flex flex-col gap-4'>
                <Typography component={Link} href='/en/login' color='white' className='opacity-[0.78]'>
                  Email Marketing
                </Typography>
                <Typography component={Link} href='/en/login' color='white' className='opacity-[0.78]'>
                  SMS Marketing
                </Typography>
                <Typography component={Link} href='/en/login' color='white' className='opacity-[0.78]'>
                  Telegram Marketing
                </Typography>
                <Typography component={Link} href='/en/login' color='white' className='opacity-[0.78]'>
                  WhatsApp Marketing
                </Typography>
                <Typography component={Link} href='/en/login' color='white' className='opacity-[0.78]'>
                  Messenger Marketing
                </Typography>
              </div>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Typography color='white' className='font-medium mbe-6 opacity-[0.92]'>
                Legal & Contact
              </Typography>
              <div className='flex flex-col gap-4'>
                <Typography
                  component={Link}
                  href='/front-pages/privacy'
                  color='white'
                  className='opacity-[0.78]'
                >
                  Privacy Policy
                </Typography>
                <Typography
                  component={Link}
                  href='/front-pages/terms'
                  color='white'
                  className='opacity-[0.78]'
                >
                  Terms of Service
                </Typography>
                <Typography
                  component={Link}
                  href='mailto:admin@nepsetrading.com'
                  color='white'
                  className='opacity-[0.78]'
                >
                  admin@nepsetrading.com
                </Typography>
                <Typography
                  component={Link}
                  href='https://nepalfillings.com'
                  target='_blank'
                  color='white'
                  className='opacity-[0.78]'
                >
                  nepalfillings.com
                </Typography>
                <Typography
                  component={Link}
                  href='https://nepsetrading.com'
                  target='_blank'
                  color='white'
                  className='opacity-[0.78]'
                >
                  nepsetrading.com
                </Typography>
              </div>
            </Grid>
          </Grid>
        </div>
      </div>
      <div className='bg-[#211B2C]'>
        <div
          className={classnames(
            'flex flex-wrap items-center justify-center sm:justify-between gap-4 plb-[15px]',
            frontCommonStyles.layoutSpacing
          )}
        >
          <Typography className='text-white' variant='body2'>
            <span>{`\u00A9 ${new Date().getFullYear()} `}</span>
            <Link href='https://nepsetrading.com' target='_blank' className='font-medium text-white'>
              Marketminds Investment Group Pvt Ltd
            </Link>
            <span>{`. All rights reserved.`}</span>
          </Typography>
          <div className='flex gap-4 items-center'>
            <Typography
              component={Link}
              href='/front-pages/privacy'
              variant='body2'
              className='text-white opacity-[0.78]'
            >
              Privacy
            </Typography>
            <Typography
              component={Link}
              href='/front-pages/terms'
              variant='body2'
              className='text-white opacity-[0.78]'
            >
              Terms
            </Typography>
            <div className='flex gap-1.5 items-center'>
              <IconButton component={Link} size='small' href='https://www.facebook.com/profile.php?id=100063477431390' target='_blank'>
                <i className='tabler-brand-facebook-filled text-white text-lg' />
              </IconButton>
              <IconButton component={Link} size='small' href='https://t.me/nepsemarket_alert_bot' target='_blank'>
                <i className='tabler-brand-telegram text-white text-lg' />
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

export default Footer
