'use client'

// MUI Imports
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { Mode } from '@core/types'

// Component Imports
import Link from '@components/Link'
import Logo from '@components/layout/shared/Logo'

// Hooks Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

// Util Imports
import { frontLayoutClasses } from '@layouts/utils/layoutClasses'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'

const Footer = ({ mode }: { mode: Mode }) => {
  // Vars
  const footerImageLight = '/images/front-pages/footer-bg-light.webp'
  const footerImageDark = '/images/front-pages/footer-bg-dark.webp'

  // Hooks
  const dashboardImage = useImageVariant(mode, footerImageLight, footerImageDark)

  return (
    <footer className={frontLayoutClasses.footer}>
      {/* Fallback bg matches the footer image tone so the white text stays readable before/without the image */}
      <div className='relative bg-[#30314a]'>
        <img
          src={dashboardImage}
          alt=''
          aria-hidden='true'
          loading='lazy'
          decoding='async'
          className='absolute inset-0 is-full bs-full object-cover -z-[1]'
        />
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
                {/* The newsletter box that sat here had no handler: its Subscribe button
                    sent nothing. It comes back when it posts to a real list. */}
              </div>
            </Grid>
            <Grid size={{ xs: 12, sm: 3, lg: 2 }}>
              <Typography color='white' className='font-medium mbe-6 opacity-[0.92]'>
                Platform
              </Typography>
              <div className='flex flex-col gap-4'>
                <Typography component={Link} href='/' color='white' className='opacity-[0.78] plb-1'>
                  Home
                </Typography>
                <Typography component={Link} href='/pricing' color='white' className='opacity-[0.78] plb-1'>
                  Pricing
                </Typography>
                <Typography component={Link} href='/about' color='white' className='opacity-[0.78] plb-1'>
                  About
                </Typography>
                <Typography component={Link} href='/#features' color='white' className='opacity-[0.78] plb-1'>
                  Features
                </Typography>
                <Typography component={Link} href='/#faq' color='white' className='opacity-[0.78] plb-1'>
                  FAQ
                </Typography>
                <Typography component={Link} href='/#contact-us' color='white' className='opacity-[0.78] plb-1'>
                  Contact Us
                </Typography>
              </div>
            </Grid>
            <Grid size={{ xs: 12, sm: 3, lg: 2 }}>
              <Typography color='white' className='font-medium mbe-6 opacity-[0.92]'>
                Channels
              </Typography>
              {/* These were five consecutive links to /en/login -- the only
                  per-channel links on the site, every one of them a login wall
                  for a visitor who has not signed up yet, and the footer offered
                  no route to registering at all. They now point at the section
                  that actually describes the channels. */}
              <div className='flex flex-col gap-4'>
                <Typography component={Link} href='/#features' color='white' className='opacity-[0.78] plb-1'>
                  Email Marketing
                </Typography>
                <Typography component={Link} href='/#features' color='white' className='opacity-[0.78] plb-1'>
                  SMS Marketing
                </Typography>
                <Typography component={Link} href='/#features' color='white' className='opacity-[0.78] plb-1'>
                  Telegram Marketing
                </Typography>
                <Typography component={Link} href='/#features' color='white' className='opacity-[0.78] plb-1'>
                  WhatsApp Marketing
                </Typography>
                <Typography component={Link} href='/#features' color='white' className='opacity-[0.78] plb-1'>
                  Messenger Marketing
                </Typography>
                <Typography component={Link} href='/register' color='white' className='font-medium plb-1'>
                  Get started free
                </Typography>
              </div>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
              <Typography color='white' className='font-medium mbe-6 opacity-[0.92]'>
                Legal & Contact
              </Typography>
              <div className='flex flex-col gap-4'>
                <Typography component={Link} href='/privacy' color='white' className='opacity-[0.78] plb-1'>
                  Privacy Policy
                </Typography>
                <Typography component={Link} href='/terms' color='white' className='opacity-[0.78] plb-1'>
                  Terms of Service
                </Typography>
                <Typography
                  component={Link}
                  href='mailto:admin@nepalfillings.com'
                  color='white'
                  className='opacity-[0.78]'
                >
                  admin@nepalfillings.com
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
              href='/privacy'
              variant='body2'
              className='text-white opacity-[0.78]'
            >
              Privacy
            </Typography>
            <Typography
              component={Link}
              href='/terms'
              variant='body2'
              className='text-white opacity-[0.78]'
            >
              Terms
            </Typography>
            <div className='flex gap-1.5 items-center'>
              <IconButton
                component={Link}
                size='small'
                href='https://www.facebook.com/profile.php?id=100063477431390'
                target='_blank'
                aria-label='Nepal Fillings on Facebook'
              >
                <i className='tabler-brand-facebook-filled text-white text-lg' />
              </IconButton>
              <IconButton
                component={Link}
                size='small'
                href='https://t.me/nepsemarket_alert_bot'
                target='_blank'
                aria-label='Nepal Fillings on Telegram'
              >
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
