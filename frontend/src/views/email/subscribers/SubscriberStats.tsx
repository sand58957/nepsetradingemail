'use client'

import { useState, useEffect } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'

import subscriberService from '@/services/subscribers'
import dashboardService from '@/services/dashboard'

const SubscriberStats = () => {
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [stats, setStats] = useState({
    total: 0,
    enabled: 0,
    disabled: 0,
    blocklisted: 0,
    unconfirmed: 0,
    unsubscribed: 0
  })
  const [dashStats, setDashStats] = useState<any>(null)

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)

      try {
        // Fetch subscriber counts by status
        const allRes = await subscriberService.getAll({ per_page: 1 })
        const total = allRes.data?.total || 0

        // Try dashboard stats
        let dStats = null

        try {
          const dRes = await dashboardService.getStats()
          dStats = dRes.data
        } catch {
          // Dashboard stats may not be available
        }

        setStats(prev => ({ ...prev, total }))
        setDashStats(dStats)
      } catch {
        console.error('Failed to fetch stats')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={32} />
        <Typography className='ml-3' color='text.secondary'>Loading stats...</Typography>
      </div>
    )
  }

  const openRate = dashStats?.messages?.open_rate ?? 0
  const clickRate = dashStats?.messages?.click_rate ?? 0

  return (
    <Card>
      <CardContent>
        <div className='mb-6'>
          <Typography variant='body2' color='text.secondary' className='mb-1'>Showing</Typography>
          <FormControl fullWidth size='small'>
            <Select value={filter} onChange={e => setFilter(e.target.value)}>
              <MenuItem value='all'>All Subscribers</MenuItem>
              <MenuItem value='enabled'>Enabled</MenuItem>
              <MenuItem value='disabled'>Disabled</MenuItem>
              <MenuItem value='blocklisted'>Blocklisted</MenuItem>
            </Select>
          </FormControl>
        </div>

        <Grid container spacing={3} className='mb-8'>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card variant='outlined'>
              <CardContent className='text-center'>
                <Typography variant='body2' color='text.secondary'>Total subscribers</Typography>
                <Typography variant='h4' className='font-bold'>{stats.total.toLocaleString()}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card variant='outlined'>
              <CardContent className='text-center'>
                <Typography variant='body2' color='text.secondary'>Avg open rate</Typography>
                <Typography variant='h4' className='font-bold'>{openRate.toFixed(2)}%</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card variant='outlined'>
              <CardContent className='text-center'>
                <Typography variant='body2' color='text.secondary'>Avg click rate</Typography>
                <Typography variant='h4' className='font-bold'>{clickRate.toFixed(2)}%</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, sm: 3 }}>
            <Card variant='outlined'>
              <CardContent className='text-center'>
                <Typography variant='body2' color='text.secondary'>Messages sent</Typography>
                <Typography variant='h4' className='font-bold'>
                  {(dashStats?.messages?.total_sent || 0).toLocaleString()}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {dashStats?.subscribers?.to_lists && dashStats.subscribers.to_lists.length > 0 && (
          <div>
            <Typography variant='h6' className='mb-4'>Subscribers by list</Typography>
            <div className='flex flex-col gap-3'>
              {dashStats.subscribers.to_lists.map((item: any) => (
                <div key={item.list_id} className='flex items-center justify-between p-3 border rounded-lg'>
                  <Typography className='font-medium'>{item.list_name}</Typography>
                  <Typography className='font-bold'>{item.subscriber_count.toLocaleString()}</Typography>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default SubscriberStats
