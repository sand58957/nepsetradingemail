'use client'

// Next Imports
import dynamic from 'next/dynamic'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import LinearProgress from '@mui/material/LinearProgress'
import { useTheme } from '@mui/material/styles'

// Third Party Imports
import type { ApexOptions } from 'apexcharts'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'))

interface CampaignDetailProps {
  id: string
}

const CampaignDetail = ({ id }: CampaignDetailProps) => {
  const theme = useTheme()

  // Mock campaign detail data
  const campaign = {
    id: parseInt(id),
    name: 'March Newsletter',
    subject: 'Monthly Update - March 2026',
    from_email: 'news@company.com',
    status: 'finished' as const,
    type: 'regular',
    sent: 5420,
    to_send: 5420,
    views: 2340,
    clicks: 567,
    bounces: 23,
    unsubscribes: 8,
    lists: ['Newsletter', 'Product Updates'],
    created_at: '2026-02-28T09:00:00Z',
    started_at: '2026-03-01T10:00:00Z',
    updated_at: '2026-03-01T12:00:00Z'
  }

  const openRate = ((campaign.views / campaign.sent) * 100).toFixed(1)
  const clickRate = ((campaign.clicks / campaign.sent) * 100).toFixed(1)
  const bounceRate = ((campaign.bounces / campaign.sent) * 100).toFixed(1)

  // Opens over time chart
  const opensOverTimeSeries = [
    {
      name: 'Opens',
      data: [120, 450, 680, 890, 1100, 1350, 1580, 1780, 1950, 2100, 2220, 2340]
    }
  ]

  const opensOverTimeOptions: ApexOptions = {
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
        bottom: -5
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
            { offset: 0, opacity: 0.4, color: theme.palette.primary.main },
            { offset: 100, opacity: 0.1, color: 'var(--mui-palette-background-paper)' }
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
      categories: ['0h', '2h', '4h', '6h', '8h', '10h', '12h', '14h', '16h', '18h', '20h', '22h'],
      axisTicks: { show: false },
      axisBorder: { show: false }
    },
    yaxis: {
      labels: {
        formatter: (val: number) => val.toLocaleString()
      }
    }
  }

  return (
    <Grid container spacing={6}>
      {/* Campaign Header */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <div className='flex items-start justify-between'>
              <div>
                <div className='flex items-center gap-3 mb-2'>
                  <Typography variant='h5'>{campaign.name}</Typography>
                  <Chip label='Finished' color='primary' variant='tonal' size='small' />
                </div>
                <Typography color='text.secondary' className='mb-1'>
                  Subject: {campaign.subject}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Sent on {new Date(campaign.started_at || '').toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </Typography>
              </div>
              <div className='flex gap-2'>
                <Button variant='outlined' startIcon={<i className='tabler-copy' />}>
                  Duplicate
                </Button>
                <Button variant='outlined' color='secondary' startIcon={<i className='tabler-download' />}>
                  Export
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Stats Cards */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar color='info' skin='light' variant='rounded' size={48}>
              <i className='tabler-send text-[26px]' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>{campaign.sent.toLocaleString()}</Typography>
              <Typography variant='body2' color='text.secondary'>
                Emails Sent
              </Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar color='success' skin='light' variant='rounded' size={48}>
              <i className='tabler-mail-opened text-[26px]' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>{openRate}%</Typography>
              <Typography variant='body2' color='text.secondary'>
                Open Rate ({campaign.views.toLocaleString()})
              </Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar color='warning' skin='light' variant='rounded' size={48}>
              <i className='tabler-click text-[26px]' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>{clickRate}%</Typography>
              <Typography variant='body2' color='text.secondary'>
                Click Rate ({campaign.clicks.toLocaleString()})
              </Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar color='error' skin='light' variant='rounded' size={48}>
              <i className='tabler-bounce-right text-[26px]' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>{bounceRate}%</Typography>
              <Typography variant='body2' color='text.secondary'>
                Bounce Rate ({campaign.bounces.toLocaleString()})
              </Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Opens Over Time Chart */}
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardHeader title='Opens Over Time' subheader='Cumulative email opens in the first 24 hours' />
          <CardContent>
            <AppReactApexCharts
              type='area'
              height={300}
              width='100%'
              series={opensOverTimeSeries}
              options={opensOverTimeOptions}
            />
          </CardContent>
        </Card>
      </Grid>

      {/* Campaign Details */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardHeader title='Campaign Details' />
          <CardContent>
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className='font-medium'>From</TableCell>
                  <TableCell>{campaign.from_email}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className='font-medium'>Type</TableCell>
                  <TableCell>
                    <Chip label={campaign.type} size='small' />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className='font-medium'>Lists</TableCell>
                  <TableCell>
                    <div className='flex gap-1 flex-wrap'>
                      {campaign.lists.map(list => (
                        <Chip key={list} label={list} size='small' variant='outlined' />
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className='font-medium'>Created</TableCell>
                  <TableCell>{new Date(campaign.created_at).toLocaleDateString()}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className='font-medium'>Unsubscribes</TableCell>
                  <TableCell>{campaign.unsubscribes}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </Grid>

      {/* Delivery Progress */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader title='Delivery Summary' />
          <CardContent>
            <div className='flex flex-col gap-4'>
              <div className='flex items-center justify-between'>
                <Typography>Delivered</Typography>
                <Typography className='font-medium'>
                  {(campaign.sent - campaign.bounces).toLocaleString()} / {campaign.sent.toLocaleString()}
                </Typography>
              </div>
              <LinearProgress
                variant='determinate'
                value={((campaign.sent - campaign.bounces) / campaign.sent) * 100}
                color='success'
              />
              <div className='flex gap-8 mt-2'>
                <div>
                  <Typography variant='body2' color='text.secondary'>
                    Delivered
                  </Typography>
                  <Typography className='font-medium'>
                    {(((campaign.sent - campaign.bounces) / campaign.sent) * 100).toFixed(1)}%
                  </Typography>
                </div>
                <div>
                  <Typography variant='body2' color='text.secondary'>
                    Bounced
                  </Typography>
                  <Typography className='font-medium' color='error.main'>
                    {bounceRate}%
                  </Typography>
                </div>
                <div>
                  <Typography variant='body2' color='text.secondary'>
                    Unsubscribed
                  </Typography>
                  <Typography className='font-medium' color='warning.main'>
                    {((campaign.unsubscribes / campaign.sent) * 100).toFixed(2)}%
                  </Typography>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default CampaignDetail
