'use client'

import { useEffect, useState } from 'react'

import { useParams, useRouter } from 'next/navigation'

import { useSession } from 'next-auth/react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'

import type { Locale } from '@configs/i18n'

import { portalService } from '@/services/portal'
import { getLocalizedUrl } from '@/utils/i18n'

const PortalDashboard = () => {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { lang: locale } = useParams()
  const [subscriptionCount, setSubscriptionCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // If session is still loading, wait
    if (status === 'loading') return

    // If no session (unauthenticated), stop loading
    if (!session) {
      setLoading(false)

      return
    }

    const fetchData = async () => {
      try {
        // Only fetch subscriptions for subscriber role — admin/staff don't have portal access
        const role = (session as any)?.role

        if (role === 'subscriber') {
          const subData = await portalService.getSubscriptions()

          if (subData?.data?.lists) {
            setSubscriptionCount(subData.data.lists.length)
          }
        }
      } catch (_e) {
        // Ignore errors — subscriber may not exist in Listmonk yet
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [session, status])

  if (loading) {
    return (
      <Box className='flex justify-center p-8'>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {/* Welcome Card */}
      <Card className='mb-6'>
        <CardContent className='p-4 sm:p-8'>
          <Typography variant='h4' className='mb-2'>
            Welcome back, {session?.user?.name || 'Subscriber'}!
          </Typography>
          <Typography color='text.secondary' className='mb-4'>
            Manage your email subscriptions and browse our newsletter archive.
          </Typography>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card>
            <CardContent className='text-center p-4 sm:p-6'>
              <i className='tabler-mail text-4xl mb-2 text-primary' />
              <Typography variant='h4'>{subscriptionCount}</Typography>
              <Typography color='text.secondary'>Active Subscriptions</Typography>
              <Button
                variant='tonal'
                className='mt-4'
                onClick={() => router.push(getLocalizedUrl('/portal/subscriptions', locale as Locale))}
              >
                Manage Subscriptions
              </Button>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Card>
            <CardContent className='text-center p-4 sm:p-6'>
              <i className='tabler-archive text-4xl mb-2 text-primary' />
              <Typography variant='h4'>
                <i className='tabler-arrow-right text-lg' />
              </Typography>
              <Typography color='text.secondary'>Newsletter Archive</Typography>
              <Button
                variant='tonal'
                className='mt-4'
                onClick={() => router.push(getLocalizedUrl('/portal/archive', locale as Locale))}
              >
                Browse Archive
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default PortalDashboard
