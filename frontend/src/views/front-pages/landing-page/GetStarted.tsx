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
  const getStartedImageLight = '/images/front-pages/landing-page/get-started-bg-light.webp'
  const getStartedImageDark = '/images/front-pages/landing-page/get-started-bg-dark.webp'

  // Hooks
  const getStartedImage = useImageVariant(mode, getStartedImageLight, getStartedImageDark)

  return (
    <section className='relative'>
      <img
        src={getStartedImage}
        alt=''
        aria-hidden='true'
        loading='lazy'
        decoding='async'
        className='absolute is-full flex pointer-events-none bs-full block-end-0'
        style={{ objectFit: 'cover' }}
      />
      <div className={classnames('flex flex-col gap-8 plb-12', frontCommonStyles.layoutSpacing)}>
        <div className='flex flex-col items-center gap-y-6 z-1'>
          <div className='flex flex-col gap-1 items-center'>
            <Typography variant='h3' component='h2' color='primary.main' className='font-bold text-[2.125rem] text-center'>
              Ready to Grow Your Business?
            </Typography>
            <Typography variant='h5' component='p' color='text.secondary' className='text-center'>
              Start sending campaigns today — no monthly fees, pay only for what you use
            </Typography>
          </div>
          <Button component={Link} href='/en/register' variant='contained'>
            Create Free Account
          </Button>
        </div>
        <div className='z-1 flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center'>
          <img
            src='/images/front-pages/landing-page/dashboard-email.webp'
            alt='Email Marketing Dashboard'
            width={1600}
            height={836}
            loading='lazy'
            decoding='async'
            className='w-full sm:w-[48%]'
            style={{ borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', objectFit: 'contain', height: 'auto' }}
          />
          <img
            src='/images/front-pages/landing-page/dashboard-telegram.webp'
            alt='Telegram Marketing Dashboard'
            width={1600}
            height={845}
            loading='lazy'
            decoding='async'
            className='w-full sm:w-[48%]'
            style={{ borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', objectFit: 'contain', height: 'auto' }}
          />
        </div>
      </div>
    </section>
  )
}

export default GetStarted
