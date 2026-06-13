'use client'

import { useEffect } from 'react'

import * as Sentry from '@sentry/browser'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

type ErrorPageProps = {
  error: Error & { digest?: string }
  reset: () => void
}

const ErrorPage = ({ error, reset }: ErrorPageProps) => {
  useEffect(() => {
    console.error('[dashboard error boundary]', error)

    // Report React render crashes to GlitchTip (no-op if Sentry wasn't initialized).
    // React error boundaries don't trigger window.onerror, so capture explicitly here.
    Sentry.captureException(error)
  }, [error])

  return (
    <Box sx={{ p: 4, display: 'flex', flexDirection: 'column', gap: 2, maxWidth: 900, mx: 'auto' }}>
      <Typography variant='h5' color='error' fontWeight={600}>
        Something went wrong on this page
      </Typography>
      <Typography variant='body1' fontWeight={500}>
        {process.env.NODE_ENV === 'production'
          ? 'An unexpected error occurred. Please try again, or contact support if the problem persists.'
          : error.message || 'Unknown error'}
      </Typography>
      {error.digest && (
        <Typography variant='caption' color='text.secondary'>
          Reference: {error.digest}
        </Typography>
      )}
      {process.env.NODE_ENV !== 'production' && error.stack && (
        <Box
          component='pre'
          sx={{
            mt: 1,
            p: 2,
            bgcolor: 'action.hover',
            borderRadius: 1,
            fontSize: 12,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            maxHeight: 400
          }}
        >
          {error.stack}
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
        <Button variant='contained' onClick={reset}>
          Try again
        </Button>
        <Button variant='outlined' onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </Box>
    </Box>
  )
}

export default ErrorPage
