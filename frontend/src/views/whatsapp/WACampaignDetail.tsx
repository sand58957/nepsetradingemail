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
import FormControlLabel from '@mui/material/FormControlLabel'
import Switch from '@mui/material/Switch'
import Divider from '@mui/material/Divider'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Service Imports
import whatsappService from '@/services/whatsapp'

// Type Imports
import type { WACampaign, WACampaignRecipient } from '@/types/whatsapp'

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
  const [recipients, setRecipients] = useState<WACampaignRecipient[]>([])

  // Opted-in contacts this campaign has not reached yet, straight from the API —
  // it is what sets the length of a continuous run.
  const [remainingEstimate, setRemainingEstimate] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Test dialog
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testingSend, setTestingSend] = useState(false)

  // Send confirmation
  const [sendDialogOpen, setSendDialogOpen] = useState(false)
  const [sending, setSending] = useState(false)

  // Campaigns go out in phases. The transport is a single WhatsApp number on an
  // unofficial gateway, and a large run at people who have not messaged first is
  // what gets a number restricted — so the size of each phase is a deliberate
  // choice, starting small.
  const [batchSize, setBatchSize] = useState(25)

  // Continuous mode works through the whole remaining list on its own, spacing
  // messages by intervalSeconds, instead of stopping after one phase.
  const [continuous, setContinuous] = useState(false)
  const [intervalSeconds, setIntervalSeconds] = useState(30)

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
        setRecipients(response.data.recipients || [])
        setRemainingEstimate(response.data.remaining ?? null)
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

  // How long a continuous run would take at the chosen interval. Picking "30" in
  // a form does not make it obvious that 30,000 contacts is then ten days of
  // sending, so say so before they start.
  const continuousEta = useMemo(() => {
    const hours = ((remainingEstimate ?? 0) * intervalSeconds) / 3600

    if (hours < 1) return { hours, label: `${Math.max(1, Math.round(hours * 60))} minutes` }
    if (hours < 48) return { hours, label: `${hours.toFixed(1)} hours` }

    return { hours, label: `${(hours / 24).toFixed(1)} days` }
  }, [remainingEstimate, intervalSeconds])

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
      const response = await whatsappService.sendCampaign(Number(id), batchSize, {
        continuous,
        intervalSeconds
      })

      setSnackbar({
        open: true,
        message:
          response.data.message ||
          `Sending to ${response.data.sending_now} contacts; ${response.data.remaining_after} remain`,
        severity: 'success'
      })
      setSendDialogOpen(false)

      // Refresh data
      const updated = await whatsappService.getCampaign(Number(id))

      setCampaign(updated.data.campaign)
      setRemainingEstimate(updated.data.remaining ?? null)
    } catch (err) {
      // Say why: a refused send explains itself, e.g. when nobody opted in is in the
      // campaign's groups.
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message

      setSnackbar({ open: true, message: message || 'Failed to send campaign', severity: 'error' })
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
        <Typography className='ml-3' color='text.secondary'>
          Loading campaign...
        </Typography>
      </div>
    )
  }

  if (error || !campaign) {
    return (
      <Card>
        <CardContent className='text-center py-16'>
          <Typography color='error' className='mb-4'>
            {error || 'Campaign not found'}
          </Typography>
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
                      Started{' '}
                      {new Date(campaign.started_at).toLocaleDateString('en-US', {
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
                  {/* A campaign that has stopped must still offer a way forward.
                      These buttons used to render only for 'draft', so the moment a
                      phase finished and parked the campaign at 'paused' there was no
                      control left to continue it — the backend accepted a resume the
                      whole time, the button simply was not there. */}
                  {(campaign.status === 'draft' ||
                    campaign.status === 'paused' ||
                    campaign.status === 'failed') && (
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
                        {campaign.status === 'draft' ? 'Send Campaign' : 'Continue Sending'}
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
                              item.status === 'delivered'
                                ? 'success'
                                : item.status === 'read'
                                  ? 'primary'
                                  : item.status === 'failed'
                                    ? 'error'
                                    : item.status === 'sent'
                                      ? 'info'
                                      : 'default'
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
                    <TableCell>
                      {campaign.total_targets > 0 ? campaign.total_targets.toLocaleString() : 'Not calculated yet'}
                    </TableCell>
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

        {/* Recipients */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardHeader
              title={`Recipients (${recipients.length})`}
              subheader={
                recipients.length === 0
                  ? 'No messages have been sent for this campaign yet'
                  : 'Individual message delivery status for each contact'
              }
            />
            <CardContent>
              {recipients.length === 0 ? (
                <div className='text-center py-8'>
                  <i className='tabler-users text-[48px] mb-3' style={{ color: 'var(--mui-palette-text-secondary)' }} />
                  <Typography color='text.secondary'>
                    {campaign.status === 'draft'
                      ? 'Recipients will appear here after you send the campaign.'
                      : 'No recipient messages found for this campaign.'}
                  </Typography>
                </div>
              ) : (
                <TableContainer>
                  <Table size='small'>
                    <TableHead>
                      <TableRow>
                        <TableCell>Contact</TableCell>
                        <TableCell>Phone</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Submitted</TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Delivered</TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Read</TableCell>
                        <TableCell>Error</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {recipients.map(recipient => (
                        <TableRow key={recipient.id}>
                          <TableCell>
                            <Typography variant='body2' className='font-medium'>
                              {recipient.contact_name || '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant='body2'>{recipient.phone}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={recipient.status.charAt(0).toUpperCase() + recipient.status.slice(1)}
                              size='small'
                              variant='tonal'
                              color={
                                recipient.status === 'delivered'
                                  ? 'success'
                                  : recipient.status === 'read'
                                    ? 'primary'
                                    : recipient.status === 'failed'
                                      ? 'error'
                                      : recipient.status === 'sent' || recipient.status === 'submitted'
                                        ? 'info'
                                        : recipient.status === 'queued'
                                          ? 'warning'
                                          : 'default'
                              }
                            />
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                            <Typography variant='caption'>
                              {recipient.submitted_at ? new Date(recipient.submitted_at).toLocaleString() : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                            <Typography variant='caption'>
                              {recipient.delivered_at ? new Date(recipient.delivered_at).toLocaleString() : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                            <Typography variant='caption'>
                              {recipient.read_at ? new Date(recipient.read_at).toLocaleString() : '—'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant='caption' color='error'>
                              {recipient.error_reason || '—'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
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
            Messages are sent through a single WhatsApp number on an unofficial gateway. Sending to a large number of
            people who have never messaged you is the most common reason such a number gets restricted — send a small
            phase first and check the number is still connected before widening.
          </Alert>
          <Typography className='mb-4'>
            Send &quot;{campaign.name}&quot;. Contacts already reached by this campaign are skipped, so nobody is
            messaged twice however many times you run it.
          </Typography>

          <FormControlLabel
            control={<Switch checked={continuous} onChange={e => setContinuous(e.target.checked)} />}
            label='Keep sending until the list is finished'
          />
          <Typography variant='body2' color='text.secondary' className='mbe-4'>
            {continuous
              ? 'The campaign works through everyone remaining on its own, waiting the interval below between messages. It carries on after a restart, and stops when you pause it.'
              : 'The campaign sends one phase and then pauses, so you can check the number is still connected before continuing.'}
          </Typography>

          <Divider className='mbe-4' />

          {continuous ? (
            <>
              <TextField
                fullWidth
                type='number'
                label='Seconds between messages'
                value={intervalSeconds}
                onChange={e => setIntervalSeconds(Math.max(1, Math.min(3600, Number(e.target.value) || 1)))}
                helperText='Longer gaps look more like a person and are much safer for the number. 30 seconds is a reasonable starting point.'
                inputProps={{ min: 1, max: 3600 }}
              />
              {remainingEstimate !== null && (
                <Alert severity={continuousEta.hours > 24 ? 'warning' : 'info'} className='mbs-4'>
                  About {remainingEstimate.toLocaleString()} contacts left. At one every {intervalSeconds}s that is
                  roughly <strong>{continuousEta.label}</strong> of continuous sending.
                </Alert>
              )}
            </>
          ) : (
            <TextField
              fullWidth
              type='number'
              label='Contacts in this phase'
              value={batchSize}
              onChange={e => setBatchSize(Math.max(1, Math.min(500, Number(e.target.value) || 1)))}
              helperText='Start around 25. Maximum 500 per phase; sending is capped at 2 messages per second.'
              inputProps={{ min: 1, max: 500 }}
            />
          )}
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
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant='filled'>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default WACampaignDetail
