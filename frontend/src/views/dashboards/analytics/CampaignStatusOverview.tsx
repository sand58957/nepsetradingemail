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

interface CampaignData {
  total: number
  sent: number
  running: number
  draft: number
}

interface CampaignStatusOverviewProps {
  campaigns: CampaignData | null
  loading: boolean
}

const CampaignStatusOverview = ({ campaigns, loading }: CampaignStatusOverviewProps) => {
  const items = [
    {
      label: 'Total Campaigns',
      count: campaigns?.total || 0,
      icon: 'tabler-mail',
      color: 'primary' as const
    },
    {
      label: 'Sent (Finished)',
      count: campaigns?.sent || 0,
      icon: 'tabler-check',
      color: 'success' as const
    },
    {
      label: 'Running',
      count: campaigns?.running || 0,
      icon: 'tabler-player-play',
      color: 'info' as const
    },
    {
      label: 'Draft',
      count: campaigns?.draft || 0,
      icon: 'tabler-pencil',
      color: 'warning' as const
    }
  ]

  return (
    <Card>
      <CardHeader title='Campaign Status' />
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

export default CampaignStatusOverview
