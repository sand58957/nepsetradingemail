'use client'

// React Imports
import { useState, useEffect } from 'react'

// Next Imports
import dynamic from 'next/dynamic'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'

// Third Party Imports
import type { ApexOptions } from 'apexcharts'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'
import OnboardingChecklist from './OnboardingChecklist'

// Styled Component Imports
const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'))

// Service Imports
import api from '@/services/api'

// Dashboard data shape from Go backend
interface DashboardData {
  total_subscribers: number
  active_subscribers: number
  total_lists: number
  total_campaigns: number
  campaigns_sent: number
  open_rate: number
  click_rate: number
  recent_campaigns: any[]
  list_stats: any[]
}

// Stat Card Component
const StatCard = ({
  title,
  value,
  icon,
  color,
  loading
}: {
  title: string
  value: string
  icon: string
  color: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary'
  loading?: boolean
}) => {
  return (
    <Card>
      <CardContent className='flex justify-between gap-1'>
        <div className='flex flex-col gap-1 grow'>
          <Typography color='text.primary'>{title}</Typography>
          <div className='flex items-center gap-2 flex-wrap'>
            {loading ? (
              <CircularProgress size={24} />
            ) : (
              <Typography variant='h4'>{value}</Typography>
            )}
          </div>
        </div>
        <CustomAvatar color={color} skin='light' variant='rounded' size={42}>
          <i className={`${icon} text-[26px]`} />
        </CustomAvatar>
      </CardContent>
    </Card>
  )
}

// Campaign status color mapping
const statusColorMap: Record<string, 'default' | 'success' | 'primary' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  running: 'success',
  scheduled: 'info',
  paused: 'warning',
  cancelled: 'error',
  finished: 'primary'
}

const EmailDashboard = () => {
  const theme = useTheme()
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchDashboard = async () => {
      try {
        const res = await api.get('/dashboard/stats')

        if (cancelled) return

        if (res.data?.success && res.data?.data) {
          setDashboardData(res.data.data)
        } else {
          setError('Failed to load dashboard data')
        }
      } catch (err: any) {
        if (cancelled) return

        // Don't set error state for 401 — the interceptor handles redirect
        if (err?.response?.status === 401) return

        console.error('Dashboard fetch error:', err)
        setError('Failed to connect to server')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchDashboard()

    return () => {
      cancelled = true
    }
  }, [])

  // Campaign performance bar chart (from real data if available)
  const recentCampaigns = dashboardData?.recent_campaigns || []

  const campaignPerformanceSeries = [
    {
      name: 'Sent',
      data: recentCampaigns.slice(0, 6).map(c => c.sent || 0)
    },
    {
      name: 'Views',
      data: recentCampaigns.slice(0, 6).map(c => c.views || 0)
    }
  ]

  const campaignPerformanceOptions: ApexOptions = {
    chart: {
      parentHeightOffset: 0,
      toolbar: { show: false }
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '50%'
      }
    },
    dataLabels: { enabled: false },
    colors: [theme.palette.primary.main, theme.palette.success.main],
    grid: {
      borderColor: 'var(--mui-palette-divider)',
      padding: {
        top: -10,
        bottom: -5
      }
    },
    xaxis: {
      categories: recentCampaigns.slice(0, 6).map(c => c.name?.substring(0, 12) || 'Campaign'),
      axisTicks: { show: false },
      axisBorder: { show: false }
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `${val}`
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left'
    }
  }

  return (
    <Grid container spacing={6}>
      {/* Onboarding Checklist */}
      <Grid size={{ xs: 12 }}>
        <OnboardingChecklist />
      </Grid>

      {/* Stat Cards */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Total Subscribers'
          value={dashboardData?.total_subscribers?.toLocaleString() || '0'}
          icon='tabler-users'
          color='primary'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Campaigns'
          value={dashboardData?.total_campaigns?.toString() || '0'}
          icon='tabler-send'
          color='success'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Open Rate'
          value={`${((dashboardData?.open_rate || 0) * 100).toFixed(1)}%`}
          icon='tabler-mail-opened'
          color='warning'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Mailing Lists'
          value={dashboardData?.total_lists?.toString() || '0'}
          icon='tabler-list'
          color='info'
          loading={loading}
        />
      </Grid>

      {/* Campaign Performance Chart */}
      {recentCampaigns.length > 0 && (
        <Grid size={{ xs: 12, lg: 8 }}>
          <Card>
            <CardHeader title='Campaign Performance' subheader='Sent vs Views for recent campaigns' />
            <CardContent>
              <AppReactApexCharts
                type='bar'
                height={300}
                width='100%'
                series={campaignPerformanceSeries}
                options={campaignPerformanceOptions}
              />
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* List Stats */}
      {dashboardData?.list_stats && dashboardData.list_stats.length > 0 && (
        <Grid size={{ xs: 12, lg: recentCampaigns.length > 0 ? 4 : 12 }}>
          <Card>
            <CardHeader title='Mailing Lists' subheader='Subscriber count by list' />
            <CardContent>
              {dashboardData.list_stats.map((list: any) => (
                <div key={list.id} className='flex items-center justify-between py-2'>
                  <div>
                    <Typography className='font-medium'>{list.name}</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {list.type} &middot; {list.optin} opt-in
                    </Typography>
                  </div>
                  <Chip label={`${list.subscriber_count} subscribers`} size='small' variant='tonal' color='primary' />
                </div>
              ))}
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Error State */}
      {error && (
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography color='error'>{error}</Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Recent Campaigns Table */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Recent Campaigns' />
          {loading ? (
            <CardContent>
              <Box display='flex' justifyContent='center' p={4}>
                <CircularProgress />
              </Box>
            </CardContent>
          ) : recentCampaigns.length === 0 ? (
            <CardContent>
              <Typography color='text.secondary' align='center'>
                No campaigns yet. Create your first campaign to get started.
              </Typography>
            </CardContent>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Campaign</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align='right'>Sent</TableCell>
                    <TableCell align='right'>Views</TableCell>
                    <TableCell align='right'>Clicks</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentCampaigns.map((campaign: any) => (
                    <TableRow key={campaign.id} hover>
                      <TableCell>
                        <div className='flex flex-col'>
                          <Typography className='font-medium' color='text.primary'>
                            {campaign.name}
                          </Typography>
                          <Typography variant='body2' color='text.secondary'>
                            {campaign.subject}
                          </Typography>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={campaign.status ? campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1) : 'Unknown'}
                          color={statusColorMap[campaign.status] || 'default'}
                          size='small'
                          variant='tonal'
                        />
                      </TableCell>
                      <TableCell align='right'>
                        <Typography>
                          {campaign.sent > 0 ? campaign.sent.toLocaleString() : '-'}
                        </Typography>
                        {campaign.status === 'running' && campaign.to_send > 0 && (
                          <LinearProgress
                            variant='determinate'
                            value={(campaign.sent / campaign.to_send) * 100}
                            className='mt-1'
                            color='success'
                          />
                        )}
                      </TableCell>
                      <TableCell align='right'>
                        <Typography>
                          {campaign.views > 0 ? campaign.views.toLocaleString() : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Typography>
                          {campaign.clicks > 0 ? campaign.clicks.toLocaleString() : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant='body2'>
                          {new Date(campaign.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      </Grid>
    </Grid>
  )
}

export default EmailDashboard
