'use client'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Type Imports
import type { ImportAnalytics } from '@/types/email'

interface ImportAnalyticsCardProps {
  importData: ImportAnalytics | null
  loading: boolean
}

const ImportAnalyticsCard = ({ importData, loading }: ImportAnalyticsCardProps) => {
  const items = [
    {
      label: 'Total Imports',
      count: importData?.total_imports || 0,
      icon: 'tabler-upload',
      color: 'primary' as const
    },
    {
      label: 'Successful',
      count: importData?.total_successful || 0,
      icon: 'tabler-check',
      color: 'success' as const
    },
    {
      label: 'Failed',
      count: importData?.total_failed || 0,
      icon: 'tabler-x',
      color: 'error' as const
    },
    {
      label: 'Skipped',
      count: importData?.total_skipped || 0,
      icon: 'tabler-minus',
      color: 'warning' as const
    },
    {
      label: 'Active Webhooks',
      count: importData?.active_webhooks || 0,
      icon: 'tabler-webhook',
      color: 'info' as const
    }
  ]

  return (
    <Card>
      <CardHeader title='Import Analytics' />
      <CardContent>
        {loading ? (
          <Box display='flex' justifyContent='center' p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <div className='flex flex-col gap-4'>
            {items.map(item => (
              <div key={item.label} className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <CustomAvatar color={item.color} skin='light' variant='rounded' size={38}>
                    <i className={`${item.icon} text-[22px]`} />
                  </CustomAvatar>
                  <Typography className='font-medium' color='text.primary'>
                    {item.label}
                  </Typography>
                </div>
                <Typography variant='h6' color='text.primary'>
                  {item.count.toLocaleString()}
                </Typography>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ImportAnalyticsCard
