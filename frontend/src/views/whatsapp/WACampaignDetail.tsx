'use client'

// React Imports
import { useState, useEffect, useMemo } from 'react'

// Next Imports
import { useRouter, useParams } from 'next/navigation'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import LinearProgress from '@mui/material/LinearProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Service Imports
import whatsappService from '@/services/whatsapp'

// Type Imports
import type { WACampaign } from '@/types/whatsapp'

const statusColorMap: Record<string, 'default' | 'success' | 'primary' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  scheduled: 'info',
  sending: 'warning',
  sent: 'success',
  paused: 'warning',
  cancelled: 'error',
  failed: 'error'
}

interface WACampaignDetailProps {
  id: string
}

const WACampaignDetail = ({ id }: WACampaignDetailProps) => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  const [campaign, setCampaign] = useState<WACampaign | null>(null)
  const [statusBreakdown, setStatusBreakdown] = useState<{ status: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Test dialog
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testingSend, setTestingSend] = useState(false)

  // Send confirmation
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [sending, setSending] = useState(false)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  useEffect(() => {
    const fetchCampaign = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await whatsappService.getCampaign(Number(id))

        setCampaign(response.data.campaign)
        setStatusBreakdown(response.data.status_breakdown || [])
      } catch {
        setError('Failed to load campaign details')
      } finally {
        setLoading(false)
      }
    }

    fetchCampaign()
  }, [id])

  // Stats
  const deliveryRate = useMemo(() => {
    if (!campaign || campaign.sent_count <= 0) return '0.0'

    return ((campaign.delivered_count / campaign.sent_count) * 100).toFixed(1)
  }, [campaign])

  const readRate = useMemo(() => {
    if (!campaign || campaign.sent_count <= 0) return '0.0'

    return ((campaign.read_count / campaign.sent_count) * 100).toFixed(1)
  }, [campaign])

  const failRate = useMemo(() => {
    if (!campaign || campaign.sent_count <= 0) return '0.0'

    return ((campaign.failed_count / campaign.sent_count) * 100).toFixed(1)
  }, [campaign])

  // Test send
  const handleTestSend = async () => {
    if (!testPhone) {
      setSnackbar({ open: true, message: 'Please enter a phone number', severity: 'error' })

      return
    }

    setTestingSend(true)

    try {
      const response = await whatsappService.testCampaign(Number(id), testPhone)

      setSnackbar({
        open: true,
        message: `Test message sent! Status: ${response.data.status}`,
        severity: 'success'
      })
      setTestDialogOpen(false)
      setTestPhone('')
    } catch {
      setSnackbar({ open: true, message: 'Failed to send test message', severity: 'error' })
    } finally {
      setTestingSend(false)
    }
  }

  // Send campaign
  const handleSendCampaign = async () => {
    setSending(true)

    try {
      const response = await whatsappService.sendCampaign(Number(id))

      setSnackbar({
        open: true,
        message: `Campaign is now sending to ${response.data.total_targets} contacts`,
        severity: 'success'
      })
      setSendDialogOpen(false)

      // Refresh data
      const updated = await whatsappService.getCampaign(Number(id))

      setCampaign(updated.data.campaign)
    } catch {
      setSnackbar({ open: true, message: 'Failed to send campaign', severity: 'error' })
    } finally {
      setSending(false)
    }
  }

  // Pause campaign
  const handlePause = async () => {
    try {
      await whatsappService.pauseCampaign(Number(id))
      setSnackbar({ open: true, message: 'Campaign paused', severity: 'success' })

      // Refresh
      const updated = await whatsappService.getCampaign(Number(id))

      setCampaign(updated.data.campaign)
    } catch {
      setSnackbar({ open: true, message: 'Failed to pause campaign', severity: 'error' })
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
          <Button variant='outlined' onClick={() => router.push(`/${locale}/whatsapp/campaigns`)}>
            Back to Campaigns
          </Button>
        </CardContent>
      </Card>
    )
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
                  {campaign.started_at && (
                    <Typography variant='body2' color='text.secondary'>
                      Started {new Date(campaign.started_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Typography>
                  )}
                  {campaign.scheduled_at && campaign.status === 'scheduled' && (
                    <Typography variant='body2' color='text.secondary'>
                      Scheduled for {new Date(campaign.scheduled_at).toLocaleString()}
                    </Typography>
                  )}
                </div>
                <div className='flex gap-2 flex-wrap'>
                  {campaign.status === 'draft' && (
                    <>
                      <Button
                        variant='outlined'
                        startIcon={<i className='tabler-test-pipe' />}
                        onClick={() => setTestDialogOpen(true)}
                      >
                        Test Send
                      </Button>
                      <Button
                        variant='contained'
                        color='success'
                        startIcon={<i className='tabler-send' />}
                        onClick={() => setSendDialogOpen(true)}
                      >
                        Send Campaign
                      </Button>
                    </>
                  )}
                  {campaign.status === 'sending' && (
                    <Button
                      variant='outlined'
                      color='warning'
                      startIcon={<i className='tabler-player-pause' />}
                      onClick={handlePause}
                    >
                      Pause
                    </Button>
                  )}
                  <Button
                    variant='outlined'
                    color='secondary'
                    startIcon={<i className='tabler-arrow-left' />}
                    onClick={() => router.push(`/${locale}/whatsapp/campaigns`)}
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
                <Typography variant='h5'>{campaign.sent_count.toLocaleString()}</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Messages Sent
                </Typography>
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
                <Typography variant='h5'>{deliveryRate}%</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Delivered ({campaign.delivered_count.toLocaleString()})
                </Typography>
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
                <Typography variant='h5'>{readRate}%</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Read ({campaign.read_count.toLocaleString()})
                </Typography>
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
                <Typography variant='h5'>{failRate}%</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Failed ({campaign.failed_count.toLocaleString()})
                </Typography>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Sending Progress */}
        {campaign.status === 'sending' && campaign.total_targets > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader title='Sending Progress' />
              <CardContent>
                <div className='flex flex-col gap-2'>
                  <div className='flex items-center justify-between'>
                    <Typography>
                      {campaign.sent_count} / {campaign.total_targets} messages sent
                    </Typography>
                    <Typography className='font-medium'>
                      {((campaign.sent_count / campaign.total_targets) * 100).toFixed(0)}%
                    </Typography>
                  </div>
                  <LinearProgress
                    variant='determinate'
                    value={(campaign.sent_count / campaign.total_targets) * 100}
                    color='success'
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                </div>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Status Breakdown */}
        {statusBreakdown.length > 0 && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title='Message Status Breakdown' />
              <CardContent>
                <Table>
                  <TableBody>
                    {statusBreakdown.map(item => (
                      <TableRow key={item.status}>
                        <TableCell>
                          <Chip
                            label={item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            size='small'
                            variant='tonal'
                            color={
                              item.status === 'delivered' ? 'success' :
                              item.status === 'read' ? 'primary' :
                              item.status === 'failed' ? 'error' :
                              item.status === 'sent' ? 'info' :
                              'default'
                            }
                          />
                        </TableCell>
                        <TableCell align='right'>
                          <Typography className='font-medium'>{item.count.toLocaleString()}</Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Campaign Details */}
        <Grid size={{ xs: 12, md: statusBreakdown.length > 0 ? 6 : 12 }}>
          <Card>
            <CardHeader title='Campaign Details' />
            <CardContent>
              <Table>
                <TableBody>
                  <TableRow>
                    <TableCell className='font-medium'>Status</TableCell>
                    <TableCell>
                      <Chip
                        label={campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                        color={statusColorMap[campaign.status]}
                        size='small'
                        variant='tonal'
                      />
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className='font-medium'>Total Targets</TableCell>
                    <TableCell>{campaign.total_targets > 0 ? campaign.total_targets.toLocaleString() : 'Not calculated yet'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className='font-medium'>Created</TableCell>
                    <TableCell>{new Date(campaign.created_at).toLocaleString()}</TableCell>
                  </TableRow>
                  {campaign.started_at && (
                    <TableRow>
                      <TableCell className='font-medium'>Started</TableCell>
                      <TableCell>{new Date(campaign.started_at).toLocaleString()}</TableCell>
                    </TableRow>
                  )}
                  {campaign.completed_at && (
                    <TableRow>
                      <TableCell className='font-medium'>Completed</TableCell>
                      <TableCell>{new Date(campaign.completed_at).toLocaleString()}</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Test Send Dialog */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Send Test Message</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' className='mb-4'>
            Send a test message to a single phone number to preview before sending to all contacts.
          </Typography>
          <TextField
            fullWidth
            label='Phone Number'
            placeholder='e.g. 9779812345678'
            value={testPhone}
            onChange={e => setTestPhone(e.target.value)}
            helperText='Enter phone number with country code (no + prefix)'
            className='mt-2'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestDialogOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            onClick={handleTestSend}
            disabled={testingSend}
            startIcon={testingSend ? <CircularProgress size={18} /> : <i className='tabler-send' />}
          >
            {testingSend ? 'Sending...' : 'Send Test'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Send Campaign Dialog */}
      <Dialog open={sendDialogOpen} onClose={() => setSendDialogOpen(false)}>
        <DialogTitle>Send Campaign</DialogTitle>
        <DialogContent>
          <Alert severity='warning' className='mb-3'>
            This will send WhatsApp messages to all matching opted-in contacts. This action cannot be undone.
          </Alert>
          <Typography>
            Are you sure you want to send the campaign &quot;{campaign.name}&quot;?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendDialogOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            color='success'
            onClick={handleSendCampaign}
            disabled={sending}
            startIcon={sending ? <CircularProgress size={18} /> : <i className='tabler-send' />}
          >
            {sending ? 'Starting...' : 'Confirm & Send'}
          </Button>
        </DialogActions>
      </Dialog>

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

export default WACampaignDetail
