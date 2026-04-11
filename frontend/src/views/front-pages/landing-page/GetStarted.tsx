// Next Imports
import Link from 'next/link'

// MUI Imports
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { SystemMode } from '@core/types'

// Hooks Imports
import { useImageVariant } from '@core/hooks/useImageVariant'

// Styles Imports
import frontCommonStyles from '@views/front-pages/styles.module.css'

const GetStarted = ({ mode }: { mode: SystemMode }) => {
  // Vars
  const getStartedImageLight = '/images/front-pages/landing-page/get-started-bg-light.png'
  const getStartedImageDark = '/images/front-pages/landing-page/get-started-bg-dark.png'

  // Hooks
  const getStartedImage = useImageVariant(mode, getStartedImageLight, getStartedImageDark)

  return (
    <section className='relative'>
      <img
        src={getStartedImage}
        alt='background-image'
        className='absolute is-full flex pointer-events-none bs-full block-end-0'
      />
      <div className={classnames('flex flex-col gap-8 plb-12', frontCommonStyles.layoutSpacing)}>
        <div className='flex flex-col items-center gap-y-6 z-1'>
          <div className='flex flex-col gap-1 items-center'>
            <Typography variant='h3' color='primary.main' className='font-bold text-[2.125rem] text-center'>
              Ready to Grow Your Business?
            </Typography>
            <Typography variant='h5' color='text.secondary' className='text-center'>
              Start sending campaigns today — no monthly fees, pay only for what you use
            </Typography>
          </div>
          <Button component={Link} href='/en/register' variant='contained'>
            Create Free Account
          </Button>
        </div>
        <div className='z-1 flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center'>
          <img
            src='/images/front-pages/landing-page/dashboard-email.png'
            alt='Email Marketing Dashboard'
            className='w-full sm:w-[48%]'
            style={{ borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', objectFit: 'contain' }}
          />
          <img
            src='/images/front-pages/landing-page/dashboard-telegram.png'
            alt='Telegram Marketing Dashboard'
            className='w-full sm:w-[48%]'
            style={{ borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', objectFit: 'contain' }}
          />
        </div>
      </div>
    </section>
  )
}

export default GetStarted
