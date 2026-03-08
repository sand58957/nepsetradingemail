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
import { useTheme } from '@mui/material/styles'

// Third Party Imports
import type { ApexOptions } from 'apexcharts'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Type Imports
import type { Campaign, CampaignStatus } from '@/types/email'

// Styled Component Imports
const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'))

// Stat Card Component
const StatCard = ({
  title,
  value,
  icon,
  color,
  trend,
  trendValue
}: {
  title: string
  value: string
  icon: string
  color: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary'
  trend: 'up' | 'down'
  trendValue: string
}) => {
  return (
    <Card>
      <CardContent className='flex justify-between gap-1'>
        <div className='flex flex-col gap-1 grow'>
          <Typography color='text.primary'>{title}</Typography>
          <div className='flex items-center gap-2 flex-wrap'>
            <Typography variant='h4'>{value}</Typography>
            <Typography color={trend === 'up' ? 'success.main' : 'error.main'} variant='body2'>
              {trend === 'up' ? '+' : '-'}
              {trendValue}
            </Typography>
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
const statusColorMap: Record<CampaignStatus, 'default' | 'success' | 'primary' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  running: 'success',
  scheduled: 'info',
  paused: 'warning',
  cancelled: 'error',
  finished: 'primary'
}

// Mock data for recent campaigns
const recentCampaigns: (Campaign & { open_rate: number; click_rate: number })[] = [
  {
    id: 1,
    uuid: '1',
    name: 'March Newsletter',
    subject: 'Monthly Update - March 2026',
    from_email: 'news@company.com',
    status: 'finished',
    type: 'regular',
    tags: [],
    content_type: 'richtext',
    body: '',
    altbody: '',
    send_at: null,
    started_at: '2026-03-01T10:00:00Z',
    to_send: 5420,
    sent: 5420,
    lists: [],
    views: 2340,
    clicks: 567,
    bounces: 23,
    created_at: '2026-02-28T09:00:00Z',
    updated_at: '2026-03-01T12:00:00Z',
    open_rate: 43.2,
    click_rate: 10.5
  },
  {
    id: 2,
    uuid: '2',
    name: 'Product Launch Announcement',
    subject: 'Introducing Our New Product',
    from_email: 'hello@company.com',
    status: 'running',
    type: 'regular',
    tags: [],
    content_type: 'richtext',
    body: '',
    altbody: '',
    send_at: null,
    started_at: '2026-03-08T08:00:00Z',
    to_send: 8350,
    sent: 4200,
    lists: [],
    views: 1890,
    clicks: 342,
    bounces: 12,
    created_at: '2026-03-07T14:00:00Z',
    updated_at: '2026-03-08T08:30:00Z',
    open_rate: 45.0,
    click_rate: 8.1
  },
  {
    id: 3,
    uuid: '3',
    name: 'Weekly Tips',
    subject: 'Top 5 Tips This Week',
    from_email: 'tips@company.com',
    status: 'draft',
    type: 'regular',
    tags: [],
    content_type: 'richtext',
    body: '',
    altbody: '',
    send_at: null,
    started_at: null,
    to_send: 0,
    sent: 0,
    lists: [],
    views: 0,
    clicks: 0,
    bounces: 0,
    created_at: '2026-03-06T11:00:00Z',
    updated_at: '2026-03-06T11:00:00Z',
    open_rate: 0,
    click_rate: 0
  },
  {
    id: 4,
    uuid: '4',
    name: 'Flash Sale Alert',
    subject: '24-Hour Flash Sale - 50% Off!',
    from_email: 'deals@company.com',
    status: 'scheduled',
    type: 'regular',
    tags: [],
    content_type: 'richtext',
    body: '',
    altbody: '',
    send_at: '2026-03-15T09:00:00Z',
    started_at: null,
    to_send: 12000,
    sent: 0,
    lists: [],
    views: 0,
    clicks: 0,
    bounces: 0,
    created_at: '2026-03-05T16:00:00Z',
    updated_at: '2026-03-05T16:30:00Z',
    open_rate: 0,
    click_rate: 0
  },
  {
    id: 5,
    uuid: '5',
    name: 'Welcome Series - Step 1',
    subject: 'Welcome to Our Community!',
    from_email: 'welcome@company.com',
    status: 'finished',
    type: 'regular',
    tags: [],
    content_type: 'richtext',
    body: '',
    altbody: '',
    send_at: null,
    started_at: '2026-02-20T07:00:00Z',
    to_send: 1230,
    sent: 1230,
    lists: [],
    views: 984,
    clicks: 246,
    bounces: 5,
    created_at: '2026-02-19T15:00:00Z',
    updated_at: '2026-02-20T09:00:00Z',
    open_rate: 80.0,
    click_rate: 20.0
  }
]

const EmailDashboard = () => {
  const theme = useTheme()

  // Subscriber growth chart data
  const subscriberGrowthSeries = [
    {
      name: 'Subscribers',
      data: [1200, 1380, 1520, 1690, 1810, 2050, 2340, 2510, 2780, 3100, 3450, 3820]
    }
  ]

  const subscriberGrowthOptions: ApexOptions = {
    chart: {
      parentHeightOffset: 0,
      toolbar: { show: false }
    },
    dataLabels: { enabled: false },
    stroke: {
      width: 3,
      curve: 'smooth'
    },
    grid: {
      borderColor: 'var(--mui-palette-divider)',
      padding: {
        top: -10,
        bottom: -5,
        left: 0,
        right: 10
      }
    },
    fill: {
      type: 'gradient',
      gradient: {
        opacityTo: 0,
        opacityFrom: 1,
        shadeIntensity: 1,
        stops: [0, 100],
        colorStops: [
          [
            {
              offset: 0,
              opacity: 0.4,
              color: theme.palette.primary.main
            },
            {
              offset: 100,
              opacity: 0.1,
              color: 'var(--mui-palette-background-paper)'
            }
          ]
        ]
      }
    },
    theme: {
      monochrome: {
        enabled: true,
        shadeTo: 'light',
        shadeIntensity: 1,
        color: theme.palette.primary.main
      }
    },
    xaxis: {
      categories: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      axisTicks: { show: false },
      axisBorder: { show: false }
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `${(val / 1000).toFixed(1)}k`
      }
    }
  }

  // Campaign performance bar chart
  const campaignPerformanceSeries = [
    {
      name: 'Open Rate',
      data: [42, 38, 45, 51, 39, 43]
    },
    {
      name: 'Click Rate',
      data: [12, 8, 14, 18, 11, 10]
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
      categories: ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
      axisTicks: { show: false },
      axisBorder: { show: false }
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `${val}%`
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left'
    }
  }

  return (
    <Grid container spacing={6}>
      {/* Stat Cards */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Total Subscribers'
          value='3,820'
          icon='tabler-users'
          color='primary'
          trend='up'
          trendValue='12.5%'
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Open Rate'
          value='43.2%'
          icon='tabler-mail-opened'
          color='success'
          trend='up'
          trendValue='3.1%'
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Click Rate'
          value='10.5%'
          icon='tabler-click'
          color='warning'
          trend='up'
          trendValue='1.8%'
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Bounce Rate'
          value='0.4%'
          icon='tabler-bounce-right'
          color='error'
          trend='down'
          trendValue='0.2%'
        />
      </Grid>

      {/* Subscriber Growth Chart */}
      <Grid size={{ xs: 12, lg: 8 }}>
        <Card>
          <CardHeader title='Subscriber Growth' subheader='Monthly subscriber count over the past year' />
          <CardContent>
            <AppReactApexCharts
              type='area'
              height={300}
              width='100%'
              series={subscriberGrowthSeries}
              options={subscriberGrowthOptions}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Campaign Performance */}
      <Grid size={{ xs: 12, lg: 4 }}>
        <Card>
          <CardHeader title='Campaign Performance' subheader='Open & Click rates by week' />
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

      {/* Recent Campaigns Table */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Recent Campaigns' />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Campaign</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align='right'>Sent</TableCell>
                  <TableCell align='right'>Open Rate</TableCell>
                  <TableCell align='right'>Click Rate</TableCell>
                  <TableCell>Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentCampaigns.map(campaign => (
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
                        label={campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        color={statusColorMap[campaign.status]}
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
                      <Typography color={campaign.open_rate > 40 ? 'success.main' : 'text.primary'}>
                        {campaign.open_rate > 0 ? `${campaign.open_rate}%` : '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align='right'>
                      <Typography>
                        {campaign.click_rate > 0 ? `${campaign.click_rate}%` : '-'}
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
        </Card>
      </Grid>
    </Grid>
  )
}

export default EmailDashboard
