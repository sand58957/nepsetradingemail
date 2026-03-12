'use client'

// React Imports
import { useState, useEffect } from 'react'

// Next Imports
import dynamic from 'next/dynamic'
import { useRouter, useParams } from 'next/navigation'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import { useTheme } from '@mui/material/styles'

// Third Party Imports
import type { ApexOptions } from 'apexcharts'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Service Imports
import whatsappService from '@/services/whatsapp'

// Type Imports
import type { WAOverviewStats } from '@/types/whatsapp'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'))

const statusColorMap: Record<string, 'default' | 'success' | 'primary' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  scheduled: 'info',
  sending: 'warning',
  sent: 'success',
  paused: 'warning',
  cancelled: 'error',
  failed: 'error'
}

const WAAnalytics = () => {
  const theme = useTheme()
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  const [stats, setStats] = useState<WAOverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchStats = async () => {
      try {
        const response = await whatsappService.getOverview()

        if (cancelled) return

        if (response.data) {
          setStats(response.data)
        }
      } catch (err: any) {
        if (cancelled) return

        if (err?.response?.status === 401) return

        setError('Failed to load analytics')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchStats()

    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={32} />
        <Typography className='ml-3' color='text.secondary'>Loading analytics...</Typography>
      </div>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent>
          <Typography color='error'>{error}</Typography>
        </CardContent>
      </Card>
    )
  }

  const totalSent = stats?.messages?.total_sent || 0
  const totalDelivered = stats?.messages?.total_delivered || 0
  const totalRead = stats?.messages?.total_read || 0
  const totalFailed = stats?.messages?.total_failed || 0

  // Donut chart data
  const donutSeries = totalSent > 0
    ? [totalDelivered - totalRead, totalRead, totalFailed, totalSent - totalDelivered - totalFailed]
    : [0, 0, 0, 0]

  const donutOptions: ApexOptions = {
    chart: { parentHeightOffset: 0 },
    labels: ['Delivered', 'Read', 'Failed', 'Pending'],
    colors: [
      theme.palette.success.main,
      theme.palette.primary.main,
      theme.palette.error.main,
      theme.palette.grey[400]
    ],
    legend: {
      position: 'bottom'
    },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            total: {
              show: true,
              label: 'Total Sent',
              formatter: () => totalSent.toLocaleString()
            }
          }
        }
      }
    }
  }

  // Campaign performance bar chart
  const recentCampaigns = stats?.recent_campaigns || []

  const barSeries = [
    {
      name: 'Sent',
      data: recentCampaigns.slice(0, 8).map(c => c.sent_count || 0)
    },
    {
      name: 'Delivered',
      data: recentCampaigns.slice(0, 8).map(c => c.delivered_count || 0)
    },
    {
      name: 'Read',
      data: recentCampaigns.slice(0, 8).map(c => c.read_count || 0)
    }
  ]

  const barOptions: ApexOptions = {
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
    colors: [theme.palette.info.main, theme.palette.success.main, theme.palette.primary.main],
    grid: {
      borderColor: 'var(--mui-palette-divider)',
      padding: { top: -10, bottom: -5 }
    },
    xaxis: {
      categories: recentCampaigns.slice(0, 8).map(c => c.name?.substring(0, 12) || 'Campaign'),
      axisTicks: { show: false },
      axisBorder: { show: false }
    },
    yaxis: {
      labels: { formatter: (val: number) => `${val}` }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left'
    }
  }

  return (
    <Grid container spacing={6}>
      {/* Header */}
      <Grid size={{ xs: 12 }}>
        <Typography variant='h5'>WhatsApp Analytics</Typography>
        <Typography variant='body2' color='text.secondary'>
          Overview of your WhatsApp marketing performance
        </Typography>
      </Grid>

      {/* Stat Cards */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar color='info' skin='light' variant='rounded' size={48}>
              <i className='tabler-send text-[26px]' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>{totalSent.toLocaleString()}</Typography>
              <Typography variant='body2' color='text.secondary'>Total Sent</Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar color='success' skin='light' variant='rounded' size={48}>
              <i className='tabler-check text-[26px]' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>
                {totalSent > 0 ? `${((totalDelivered / totalSent) * 100).toFixed(1)}%` : '0%'}
              </Typography>
              <Typography variant='body2' color='text.secondary'>Delivery Rate</Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar color='primary' skin='light' variant='rounded' size={48}>
              <i className='tabler-checks text-[26px]' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>
                {totalSent > 0 ? `${((totalRead / totalSent) * 100).toFixed(1)}%` : '0%'}
              </Typography>
              <Typography variant='body2' color='text.secondary'>Read Rate</Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar color='error' skin='light' variant='rounded' size={48}>
              <i className='tabler-x text-[26px]' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>
                {totalSent > 0 ? `${((totalFailed / totalSent) * 100).toFixed(1)}%` : '0%'}
              </Typography>
              <Typography variant='body2' color='text.secondary'>Fail Rate</Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Message Distribution Chart */}
      <Grid size={{ xs: 12, md: 5 }}>
        <Card>
          <CardHeader title='Message Distribution' subheader='Breakdown of message delivery status' />
          <CardContent>
            {totalSent > 0 ? (
              <AppReactApexCharts
                type='donut'
                height={300}
                width='100%'
                series={donutSeries}
                options={donutOptions}
              />
            ) : (
              <Box display='flex' justifyContent='center' alignItems='center' p={8}>
                <Typography color='text.secondary'>No message data yet</Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Campaign Performance Chart */}
      <Grid size={{ xs: 12, md: 7 }}>
        <Card>
          <CardHeader title='Campaign Performance' subheader='Sent, Delivered, and Read for recent campaigns' />
          <CardContent>
            {recentCampaigns.length > 0 ? (
              <AppReactApexCharts
                type='bar'
                height={300}
                width='100%'
                series={barSeries}
                options={barOptions}
              />
            ) : (
              <Box display='flex' justifyContent='center' alignItems='center' p={8}>
                <Typography color='text.secondary'>No campaign data yet</Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Delivery Summary */}
      {totalSent > 0 && (
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardHeader title='Delivery Summary' />
            <CardContent>
              <div className='flex flex-col gap-4'>
                {[
                  { label: 'Delivered', value: totalDelivered, total: totalSent, color: 'success' as const },
                  { label: 'Read', value: totalRead, total: totalSent, color: 'primary' as const },
                  { label: 'Failed', value: totalFailed, total: totalSent, color: 'error' as const }
                ].map(item => (
                  <div key={item.label}>
                    <div className='flex items-center justify-between mb-1'>
                      <Typography variant='body2'>{item.label}</Typography>
                      <Typography variant='body2' className='font-medium'>
                        {item.value.toLocaleString()} ({((item.value / item.total) * 100).toFixed(1)}%)
                      </Typography>
                    </div>
                    <LinearProgress
                      variant='determinate'
                      value={(item.value / item.total) * 100}
                      color={item.color}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Recent Campaigns Table */}
      {recentCampaigns.length > 0 && (
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardHeader title='Campaign Results' />
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Campaign</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align='right'>Sent</TableCell>
                    <TableCell align='right'>Delivered</TableCell>
                    <TableCell align='right'>Read</TableCell>
                    <TableCell align='right'>Failed</TableCell>
                    <TableCell align='right'>Delivery %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentCampaigns.map(campaign => (
                    <TableRow
                      key={campaign.id}
                      hover
                      className='cursor-pointer'
                      onClick={() => router.push(`/${locale}/whatsapp/campaigns/${campaign.id}`)}
                    >
                      <TableCell>
                        <Typography className='font-medium'>{campaign.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                          color={statusColorMap[campaign.status] || 'default'}
                          size='small'
                          variant='tonal'
                        />
                      </TableCell>
                      <TableCell align='right'>{campaign.sent_count.toLocaleString()}</TableCell>
                      <TableCell align='right'>{campaign.delivered_count.toLocaleString()}</TableCell>
                      <TableCell align='right'>{campaign.read_count.toLocaleString()}</TableCell>
                      <TableCell align='right'>
                        <Typography color={campaign.failed_count > 0 ? 'error.main' : 'text.primary'}>
                          {campaign.failed_count.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        {campaign.sent_count > 0
                          ? `${((campaign.delivered_count / campaign.sent_count) * 100).toFixed(1)}%`
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        </Grid>
      )}
    </Grid>
  )
}

export default WAAnalytics
