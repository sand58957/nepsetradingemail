'use client'

import { useState, useEffect } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Alert from '@mui/material/Alert'

import subscriberService from '@/services/subscribers'
import dashboardService from '@/services/dashboard'

interface DashStats {
  messages?: {
    open_rate?: number
    click_rate?: number
    total_sent?: number
  }
  subscribers?: {
    to_lists?: Array<{
      list_id: number
      list_name: string
      subscriber_count: number
    }>
  }
}

const SubscriberStats = () => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  const [stats, setStats] = useState({
    total: 0,
    enabled: 0,
    disabled: 0,
    blocklisted: 0,
    unconfirmed: 0,
    unsubscribed: 0
  })

  const [dashStats, setDashStats] = useState<DashStats | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)
      setError('')

      try {
        const [allRes, enabledRes, disabledRes, blocklistedRes, dRes] = await Promise.allSettled([
          subscriberService.getAll({ per_page: 1 }),
          subscriberService.getAll({ per_page: 1, query: "subscribers.status = 'enabled'" }),
          subscriberService.getAll({ per_page: 1, query: "subscribers.status = 'disabled'" }),
          subscriberService.getAll({ per_page: 1, query: "subscribers.status = 'blocklisted'" }),
          dashboardService.getStats()
        ])

        setStats({
          total: allRes.status === 'fulfilled' ? (allRes.value.data?.total || 0) : 0,
          enabled: enabledRes.status === 'fulfilled' ? (enabledRes.value.data?.total || 0) : 0,
          disabled: disabledRes.status === 'fulfilled' ? (disabledRes.value.data?.total || 0) : 0,
          blocklisted: blocklistedRes.status === 'fulfilled' ? (blocklistedRes.value.data?.total || 0) : 0,
          unconfirmed: 0,
          unsubscribed: 0
        })

        if (dRes.status === 'fulfilled') {
          setDashStats(dRes.value.data)
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch stats'
        setError(msg)
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

  const openRate = Number(dashStats?.messages?.open_rate) || 0
  const clickRate = Number(dashStats?.messages?.click_rate) || 0
  const filteredCount = filter === 'all' ? stats.total : (stats[filter as keyof typeof stats] ?? 0)

  return (
    <div className='flex flex-col gap-4'>
      {error && (
        <Alert severity='error' onClose={() => setError('')}>{error}</Alert>
      )}

      <Card>
        <CardContent>
          <div className='mb-6'>
            <Typography variant='body2' color='text.secondary' className='mb-1'>Showing</Typography>
            <FormControl fullWidth size='small' sx={{ maxWidth: { sm: 300 } }}>
              <Select value={filter} onChange={e => setFilter(e.target.value)}>
                <MenuItem value='all'>All Subscribers ({stats.total.toLocaleString()})</MenuItem>
                <MenuItem value='enabled'>Enabled ({stats.enabled.toLocaleString()})</MenuItem>
                <MenuItem value='disabled'>Disabled ({stats.disabled.toLocaleString()})</MenuItem>
                <MenuItem value='blocklisted'>Blocklisted ({stats.blocklisted.toLocaleString()})</MenuItem>
              </Select>
            </FormControl>
          </div>

          <Grid container spacing={2} className='mb-8'>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card variant='outlined'>
                <CardContent className='text-center' sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                  <Typography variant='body2' color='text.secondary' noWrap>
                    {filter === 'all' ? 'Total' : `${filter.charAt(0).toUpperCase() + filter.slice(1)}`}
                  </Typography>
                  <Typography variant='h5' className='font-bold'>{filteredCount.toLocaleString()}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card variant='outlined'>
                <CardContent className='text-center' sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                  <Typography variant='body2' color='text.secondary' noWrap>Avg open rate</Typography>
                  <Typography variant='h5' className='font-bold'>{openRate.toFixed(1)}%</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card variant='outlined'>
                <CardContent className='text-center' sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                  <Typography variant='body2' color='text.secondary' noWrap>Avg click rate</Typography>
                  <Typography variant='h5' className='font-bold'>{clickRate.toFixed(1)}%</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Card variant='outlined'>
                <CardContent className='text-center' sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
                  <Typography variant='body2' color='text.secondary' noWrap>Messages sent</Typography>
                  <Typography variant='h5' className='font-bold'>
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
                {dashStats.subscribers.to_lists.map((item) => (
                  <div key={item.list_id} className='flex items-center justify-between flex-wrap gap-2 p-3 border rounded-lg'>
                    <Typography className='font-medium' noWrap sx={{ maxWidth: { xs: '60%', sm: 'none' } }}>{item.list_name}</Typography>
                    <Typography className='font-bold'>{item.subscriber_count.toLocaleString()}</Typography>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SubscriberStats
