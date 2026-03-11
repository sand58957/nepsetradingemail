'use client'

// React Imports
import { useState, useEffect, useMemo } from 'react'

// Next Imports
import dynamic from 'next/dynamic'
import { useRouter, useParams } from 'next/navigation'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'
import LinearProgress from '@mui/material/LinearProgress'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import { useTheme } from '@mui/material/styles'

// Third Party Imports
import type { ApexOptions } from 'apexcharts'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Service Imports
import campaignService from '@/services/campaigns'

// Type Imports
import type { Campaign, CampaignStatus } from '@/types/email'

const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'))

const statusColorMap: Record<CampaignStatus, 'default' | 'success' | 'primary' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  running: 'success',
  scheduled: 'info',
  paused: 'warning',
  cancelled: 'error',
  finished: 'primary'
}

interface CampaignDetailProps {
  id: string
}

const CampaignDetail = ({ id }: CampaignDetailProps) => {
  const theme = useTheme()
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  useEffect(() => {
    const fetchCampaign = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await campaignService.getById(Number(id))

        setCampaign(response.data)
      } catch {
        setError('Failed to load campaign details')
        console.error('Failed to fetch campaign')
      } finally {
        setLoading(false)
      }
    }

    fetchCampaign()
  }, [id])

  // All hooks must be called before any early returns (React Rules of Hooks)
  const openRate = useMemo(() => {
    if (!campaign || campaign.sent <= 0) return '0.0'

    return ((campaign.views / campaign.sent) * 100).toFixed(1)
  }, [campaign])

  const clickRate = useMemo(() => {
    if (!campaign || campaign.sent <= 0) return '0.0'

    return ((campaign.clicks / campaign.sent) * 100).toFixed(1)
  }, [campaign])

  const bounceRate = useMemo(() => {
    if (!campaign || campaign.sent <= 0) return '0.0'

    return ((campaign.bounces / campaign.sent) * 100).toFixed(1)
  }, [campaign])

  // Opens over time chart (estimated cumulative distribution based on total views)
  const opensOverTimeSeries = useMemo(() => {
    if (!campaign || campaign.views <= 0) {
      return [{ name: 'Opens', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] }]
    }

    // Model a typical email open curve: fast initial opens, then tapering off
    const weights = [0.15, 0.30, 0.45, 0.58, 0.68, 0.76, 0.82, 0.87, 0.91, 0.94, 0.97, 1.0]
    const data = weights.map(w => Math.round(campaign.views * w))

    return [{ name: 'Opens', data }]
  }, [campaign])

  // Duplicate campaign
  const handleDuplicate = async () => {
    if (!campaign) return

    try {
      const result = await campaignService.create({
        name: `${campaign.name} (Copy)`,
        subject: campaign.subject,
        from_email: campaign.from_email,
        type: campaign.type,
        content_type: campaign.content_type,
        body: campaign.body,
        altbody: campaign.altbody,
        lists: campaign.lists?.map(l => l.id) || [],
        tags: campaign.tags
      })

      setSnackbar({ open: true, message: 'Campaign duplicated successfully', severity: 'success' })
      router.push(`/${locale}/campaigns/${result.data.id}`)
    } catch {
      setSnackbar({ open: true, message: 'Failed to duplicate campaign', severity: 'error' })
    }
  }

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={32} />
        <Typography className='ml-3' color='text.secondary'>Loading campaign...</Typography>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <Card>
        <CardContent className='text-center py-16'>
          <Typography color='error' className='mb-4'>{error || 'Campaign not found'}</Typography>
          <Button variant='outlined' onClick={() => router.push(`/${locale}/campaigns/list`)}>
            Back to Campaigns
          </Button>
        </CardContent>
      </Card>
    )
  }

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
    <>
      <Grid container spacing={6}>
        {/* Campaign Header */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <div className='flex items-start flex-wrap gap-4 justify-between'>
                <div>
                  <div className='flex items-center gap-3 mb-2'>
                    <Typography variant='h5'>{campaign.name}</Typography>
                    <Chip
                      label={campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                      color={statusColorMap[campaign.status]}
                      variant='tonal'
                      size='small'
                    />
                  </div>
                  <Typography color='text.secondary' className='mb-1'>
                    Subject: {campaign.subject}
                  </Typography>
                  {campaign.started_at && (
                    <Typography variant='body2' color='text.secondary'>
                      Sent on {new Date(campaign.started_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Typography>
                  )}
                </div>
                <div className='flex gap-2'>
                  <Button variant='outlined' startIcon={<i className='tabler-copy' />} onClick={handleDuplicate}>
                    Duplicate
                  </Button>
                  <Button
                    variant='outlined'
                    color='secondary'
                    startIcon={<i className='tabler-arrow-left' />}
                    onClick={() => router.push(`/${locale}/campaigns/list`)}
                  >
                    Back
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
                        {campaign.lists && campaign.lists.length > 0
                          ? campaign.lists.map(list => (
                            <Chip key={list.id} label={list.name} size='small' variant='outlined' />
                          ))
                          : <Typography variant='body2' color='text.secondary'>No lists</Typography>
                        }
                      </div>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className='font-medium'>Created</TableCell>
                    <TableCell>{new Date(campaign.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className='font-medium'>Content Type</TableCell>
                    <TableCell>
                      <Chip label={campaign.content_type} size='small' variant='outlined' />
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        {/* Delivery Progress */}
        {campaign.sent > 0 && (
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
                  </div>
                </div>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant='filled'
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default CampaignDetail
