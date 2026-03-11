'use client'

// React Imports

import { useSession } from 'next-auth/react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'

const PortalDashboard = () => {
  const { data: session, status } = useSession()
  const loading = status === 'loading'

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
            Manage your email campaigns, subscribers, and analytics.
          </Typography>
          <Button
            variant='contained'
            size='large'
            startIcon={<i className='tabler-mail' />}
            href='https://nepalfillings.com/en/dashboards/email-marketing'
            component='a'
          >
            Email Marketing
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}

export default PortalDashboard
