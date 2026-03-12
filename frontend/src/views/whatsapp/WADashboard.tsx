'use client'

// React Imports
import { useState, useEffect } from 'react'

// Next Imports
import { useRouter, useParams } from 'next/navigation'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
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

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Service Imports
import whatsappService from '@/services/whatsapp'

// Type Imports
import type { WAOverviewStats } from '@/types/whatsapp'

// Status color mapping
const statusColorMap: Record<string, 'default' | 'success' | 'primary' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  scheduled: 'info',
  sending: 'warning',
  sent: 'success',
  paused: 'warning',
  cancelled: 'error',
  failed: 'error'
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
}) => (
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

const WADashboard = () => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  const [stats, setStats] = useState<WAOverviewStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchOverview = async () => {
      try {
        const response = await whatsappService.getOverview()

        if (cancelled) return

        if (response.data) {
          setStats(response.data)
        } else {
          setError('Failed to load WhatsApp dashboard data')
        }
      } catch (err: any) {
        if (cancelled) return

        if (err?.response?.status === 401) return

        console.error('WA Dashboard fetch error:', err)
        setError('Failed to connect to server')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchOverview()

    return () => {
      cancelled = true
    }
  }, [])

  const recentCampaigns = stats?.recent_campaigns || []
  const deliveryRate =
    stats?.messages?.total_sent && stats.messages.total_sent > 0
      ? ((stats.messages.total_delivered / stats.messages.total_sent) * 100).toFixed(1)
      : '0.0'
  const readRate =
    stats?.messages?.total_sent && stats.messages.total_sent > 0
      ? ((stats.messages.total_read / stats.messages.total_sent) * 100).toFixed(1)
      : '0.0'

  return (
    <Grid container spacing={6}>
      {/* Stat Cards */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Total Contacts'
          value={stats?.contacts?.total_contacts?.toLocaleString() || '0'}
          icon='tabler-address-book'
          color='primary'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Messages Sent'
          value={stats?.messages?.total_sent?.toLocaleString() || '0'}
          icon='tabler-brand-whatsapp'
          color='success'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Delivery Rate'
          value={`${deliveryRate}%`}
          icon='tabler-check'
          color='info'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Read Rate'
          value={`${readRate}%`}
          icon='tabler-checks'
          color='warning'
          loading={loading}
        />
      </Grid>

      {/* Quick Actions */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <div className='flex items-center justify-between flex-wrap gap-4'>
              <div>
                <Typography variant='h6'>WhatsApp Marketing</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Send targeted WhatsApp campaigns to your contacts
                </Typography>
              </div>
              <div className='flex gap-2 flex-wrap'>
                <Button
                  variant='contained'
                  color='success'
                  startIcon={<i className='tabler-plus' />}
                  onClick={() => router.push(`/${locale}/whatsapp/campaigns/create`)}
                >
                  New Campaign
                </Button>
                <Button
                  variant='outlined'
                  startIcon={<i className='tabler-upload' />}
                  onClick={() => router.push(`/${locale}/whatsapp/contacts/import`)}
                >
                  Import Contacts
                </Button>
                <Button
                  variant='outlined'
                  startIcon={<i className='tabler-settings' />}
                  onClick={() => router.push(`/${locale}/whatsapp/settings`)}
                >
                  Settings
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>

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

      {/* Message Stats Summary */}
      {stats?.messages && (
        <Grid size={{ xs: 12, md: 6 }}>
          <Card>
            <CardHeader title='Message Delivery' subheader='Overall message delivery breakdown' />
            <CardContent>
              <div className='flex flex-col gap-4'>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <CustomAvatar color='success' skin='light' variant='rounded' size={32}>
                      <i className='tabler-check text-[18px]' />
                    </CustomAvatar>
                    <Typography>Delivered</Typography>
                  </div>
                  <Typography className='font-medium'>{stats.messages.total_delivered.toLocaleString()}</Typography>
                </div>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <CustomAvatar color='info' skin='light' variant='rounded' size={32}>
                      <i className='tabler-checks text-[18px]' />
                    </CustomAvatar>
                    <Typography>Read</Typography>
                  </div>
                  <Typography className='font-medium'>{stats.messages.total_read.toLocaleString()}</Typography>
                </div>
                <div className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <CustomAvatar color='error' skin='light' variant='rounded' size={32}>
                      <i className='tabler-x text-[18px]' />
                    </CustomAvatar>
                    <Typography>Failed</Typography>
                  </div>
                  <Typography className='font-medium'>{stats.messages.total_failed.toLocaleString()}</Typography>
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Contact Stats */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Contact Overview' subheader='Your WhatsApp contact database' />
          <CardContent>
            <div className='flex flex-col gap-4'>
              <div className='flex items-center justify-between'>
                <Typography>Total Contacts</Typography>
                <Typography className='font-medium'>{stats?.contacts?.total_contacts?.toLocaleString() || '0'}</Typography>
              </div>
              <div className='flex items-center justify-between'>
                <Typography>Opted In</Typography>
                <Chip
                  label={stats?.contacts?.opted_in?.toLocaleString() || '0'}
                  color='success'
                  size='small'
                  variant='tonal'
                />
              </div>
              <div className='flex items-center justify-between'>
                <Typography>Total Campaigns</Typography>
                <Typography className='font-medium'>{stats?.contacts?.total_campaigns?.toLocaleString() || '0'}</Typography>
              </div>
              <Button
                fullWidth
                variant='outlined'
                startIcon={<i className='tabler-address-book' />}
                onClick={() => router.push(`/${locale}/whatsapp/contacts`)}
                className='mt-2'
              >
                Manage Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Recent Campaigns Table */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title='Recent Campaigns'
            action={
              <Button
                size='small'
                onClick={() => router.push(`/${locale}/whatsapp/campaigns`)}
                endIcon={<i className='tabler-arrow-right' />}
              >
                View All
              </Button>
            }
          />
          {loading ? (
            <CardContent>
              <Box display='flex' justifyContent='center' p={4}>
                <CircularProgress />
              </Box>
            </CardContent>
          ) : recentCampaigns.length === 0 ? (
            <CardContent>
              <Typography color='text.secondary' align='center'>
                No campaigns yet. Create your first WhatsApp campaign to get started.
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
                    <TableCell align='right'>Delivered</TableCell>
                    <TableCell align='right'>Read</TableCell>
                    <TableCell align='right'>Failed</TableCell>
                    <TableCell>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentCampaigns.map((campaign) => (
                    <TableRow
                      key={campaign.id}
                      hover
                      className='cursor-pointer'
                      onClick={() => router.push(`/${locale}/whatsapp/campaigns/${campaign.id}`)}
                    >
                      <TableCell>
                        <Typography className='font-medium' color='text.primary'>
                          {campaign.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                          color={statusColorMap[campaign.status] || 'default'}
                          size='small'
                          variant='tonal'
                        />
                      </TableCell>
                      <TableCell align='right'>
                        <Typography>{campaign.sent_count > 0 ? campaign.sent_count.toLocaleString() : '-'}</Typography>
                        {campaign.status === 'sending' && campaign.total_targets > 0 && (
                          <LinearProgress
                            variant='determinate'
                            value={(campaign.sent_count / campaign.total_targets) * 100}
                            className='mt-1'
                            color='success'
                          />
                        )}
                      </TableCell>
                      <TableCell align='right'>
                        <Typography>{campaign.delivered_count > 0 ? campaign.delivered_count.toLocaleString() : '-'}</Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Typography>{campaign.read_count > 0 ? campaign.read_count.toLocaleString() : '-'}</Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Typography color={campaign.failed_count > 0 ? 'error.main' : 'text.primary'}>
                          {campaign.failed_count > 0 ? campaign.failed_count.toLocaleString() : '-'}
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

export default WADashboard
