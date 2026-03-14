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
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Autocomplete from '@mui/material/Autocomplete'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import LinearProgress from '@mui/material/LinearProgress'

// Service Imports
import smsService from '@/services/sms'

// Helper: detect Unicode/Nepali characters
const hasUnicode = (text: string): boolean => {
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7F]/.test(text)
}

// Helper: calculate SMS segments and credits
const calculateSMSCredits = (text: string) => {
  const isUnicode = hasUnicode(text)
  const charLimit = isUnicode ? 70 : 160
  const multipartLimit = isUnicode ? 67 : 153
  const length = text.length

  if (length === 0) return { segments: 0, charLimit, isUnicode, length }

  let segments: number

  if (length <= charLimit) {
    segments = 1
  } else {
    segments = Math.ceil(length / multipartLimit)
  }

  return { segments, charLimit, isUnicode, length }
}

const SMSCreateCampaign = () => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  // Form state
  const [name, setName] = useState('')
  const [messageText, setMessageText] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  // Audience
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [loadingAudience, setLoadingAudience] = useState(false)
  const [availableTags, setAvailableTags] = useState<string[]>([])

  // Test send
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [testingSend, setTestingSend] = useState(false)

  // UI
  const [creating, setCreating] = useState(false)
  const [sendingNow, setSendingNow] = useState(false)
  const [confirmSendNow, setConfirmSendNow] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  // Calculate credits
  const smsInfo = useMemo(() => calculateSMSCredits(messageText), [messageText])

  // Fetch available tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await smsService.getContactTags()
        const tagNames = (response.data || []).map(t => t.tag)

        setAvailableTags(tagNames)
      } catch {
        // Silently fail
      }
    }

    fetchTags()
  }, [])

  // Fetch audience count when tags change
  useEffect(() => {
    const fetchAudienceCount = async () => {
      setLoadingAudience(true)

      try {
        const filter: Record<string, any> = {}

        if (tags.length > 0) {
          filter.tags = tags
        }

        const response = await smsService.getAudienceCount(filter)

        setAudienceCount(response.data?.count ?? null)
      } catch {
        setAudienceCount(null)
      } finally {
        setLoadingAudience(false)
      }
    }

    fetchAudienceCount()
  }, [tags])

  // Total credits estimate
  const estimatedCredits = useMemo(() => {
    if (audienceCount === null || smsInfo.segments === 0) return 0

    return smsInfo.segments * audienceCount
  }, [audienceCount, smsInfo.segments])

  // Create campaign (draft)
  const handleCreate = async () => {
    if (!name.trim()) {
      setSnackbar({ open: true, message: 'Campaign name is required', severity: 'error' })

      return
    }

    if (!messageText.trim()) {
      setSnackbar({ open: true, message: 'Message text is required', severity: 'error' })

      return
    }

    setCreating(true)

    try {
      const payload: any = {
        name: name.trim(),
        message_text: messageText,
        target_filter: {} as Record<string, any>,
        scheduled_at: scheduledAt || undefined
      }

      if (tags.length > 0) {
        payload.target_filter.tags = tags
      }

      const response = await smsService.createCampaign(payload)

      setSnackbar({ open: true, message: 'Campaign created', severity: 'success' })

      // Navigate to campaign detail
      setTimeout(() => {
        router.push(`/${locale}/sms/campaigns/${response.data.id}`)
      }, 500)
    } catch {
      setSnackbar({ open: true, message: 'Failed to create campaign', severity: 'error' })
    } finally {
      setCreating(false)
    }
  }

  // Send Now flow
  const handleSendNow = async () => {
    if (!name.trim()) {
      setSnackbar({ open: true, message: 'Campaign name is required', severity: 'error' })

      return
    }

    if (!messageText.trim()) {
      setSnackbar({ open: true, message: 'Message text is required', severity: 'error' })

      return
    }

    setConfirmSendNow(true)
  }

  const handleConfirmSendNow = async () => {
    setConfirmSendNow(false)
    setSendingNow(true)

    try {
      const payload: any = {
        name: name.trim(),
        message_text: messageText,
        target_filter: {} as Record<string, any>
      }

      if (tags.length > 0) {
        payload.target_filter.tags = tags
      }

      // Step 1: Create the campaign
      const response = await smsService.createCampaign(payload)
      const campaignId = response.data.id

      // Step 2: Immediately send
      try {
        await smsService.sendCampaign(campaignId)
        setSnackbar({ open: true, message: 'Campaign created and sending started!', severity: 'success' })
      } catch {
        setSnackbar({ open: true, message: 'Campaign created but failed to start sending. Go to campaign detail to retry.', severity: 'error' })
      }

      // Navigate to campaign detail
      setTimeout(() => {
        router.push(`/${locale}/sms/campaigns/${campaignId}`)
      }, 1000)
    } catch {
      setSnackbar({ open: true, message: 'Failed to create campaign', severity: 'error' })
    } finally {
      setSendingNow(false)
    }
  }

  // Test send (creates draft then tests)
  const handleTestSend = async () => {
    if (!testPhone) {
      setSnackbar({ open: true, message: 'Please enter a phone number', severity: 'error' })

      return
    }

    if (!name.trim() || !messageText.trim()) {
      setSnackbar({ open: true, message: 'Please fill in campaign name and message first', severity: 'error' })

      return
    }

    setTestingSend(true)

    try {
      // Create draft first if needed, then test
      const payload: any = {
        name: name.trim(),
        message_text: messageText,
        target_filter: {} as Record<string, any>
      }

      if (tags.length > 0) {
        payload.target_filter.tags = tags
      }

      const response = await smsService.createCampaign(payload)
      const campaignId = response.data.id

      const testResponse = await smsService.testCampaign(campaignId, testPhone)

      setSnackbar({
        open: true,
        message: `Test SMS sent! Status: ${testResponse.data.status}, Credits: ${testResponse.data.credits}`,
        severity: 'success'
      })
      setTestDialogOpen(false)
      setTestPhone('')
    } catch {
      setSnackbar({ open: true, message: 'Failed to send test SMS', severity: 'error' })
    } finally {
      setTestingSend(false)
    }
  }

  // Character counter color
  const getCounterColor = () => {
    if (smsInfo.length === 0) return 'text.secondary'
    if (smsInfo.segments > 3) return 'error.main'
    if (smsInfo.segments > 1) return 'warning.main'

    return 'success.main'
  }

  return (
    <>
      <Grid container spacing={6}>
        {/* Header */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <div className='flex items-center justify-between flex-wrap gap-4'>
                <div>
                  <Typography variant='h5'>Create SMS Campaign</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Send a text message to your SMS contacts via Aakash SMS
                  </Typography>
                </div>
                <Button
                  variant='outlined'
                  startIcon={<i className='tabler-arrow-left' />}
                  onClick={() => router.push(`/${locale}/sms/campaigns`)}
                >
                  Back to Campaigns
                </Button>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Campaign Form */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title='Campaign Details' />
            <CardContent>
              <div className='flex flex-col gap-5'>
                {/* Name */}
                <TextField
                  fullWidth
                  label='Campaign Name *'
                  placeholder='e.g. March Stock Alert'
                  value={name}
                  onChange={e => setName(e.target.value)}
                />

                {/* Message Composer */}
                <div>
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    label='Message Text *'
                    placeholder='Type your SMS message here...'
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    helperText={
                      <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span>
                          {smsInfo.isUnicode
                            ? 'Unicode detected: 70 chars per credit instead of 160'
                            : 'English text: 160 chars per credit'
                          }
                        </span>
                        <span style={{ color: 'var(--mui-palette-text-secondary)' }}>
                          Press Enter for new line
                        </span>
                      </span>
                    }
                  />

                  {/* Character Counter */}
                  <Box className='flex items-center justify-between mt-2 px-1'>
                    <Typography variant='body2' sx={{ color: getCounterColor() }}>
                      {smsInfo.length}/{smsInfo.charLimit} characters ({smsInfo.segments} {smsInfo.segments === 1 ? 'credit' : 'credits'})
                    </Typography>
                    {audienceCount !== null && smsInfo.segments > 0 && (
                      <Typography variant='body2' color='text.secondary'>
                        Estimated total: {estimatedCredits.toLocaleString()} credits for {audienceCount.toLocaleString()} recipients
                      </Typography>
                    )}
                  </Box>

                  {/* Unicode Warning */}
                  {smsInfo.isUnicode && messageText.length > 0 && (
                    <Alert severity='warning' className='mt-3' icon={<i className='tabler-alert-triangle' />}>
                      Unicode detected: Your message contains Nepali or special characters. Each credit covers only 70 characters instead of 160. This will use more credits per message.
                    </Alert>
                  )}

                  {/* Multi-segment warning */}
                  {smsInfo.segments > 1 && (
                    <Alert severity='info' className='mt-2' icon={<i className='tabler-info-circle' />}>
                      Your message will be split into {smsInfo.segments} segments, using {smsInfo.segments} credits per recipient.
                    </Alert>
                  )}
                </div>

                {/* Message Preview */}
                {messageText.length > 0 && (
                  <Box
                    className='p-4 rounded'
                    sx={{
                      backgroundColor: 'action.hover',
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: '12px'
                    }}
                  >
                    <div className='flex items-center gap-2 mb-2'>
                      <i className='tabler-message' style={{ fontSize: 20, color: 'var(--mui-palette-primary-main)' }} />
                      <Typography variant='subtitle2'>Message Preview</Typography>
                    </div>
                    <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {messageText}
                    </Typography>
                  </Box>
                )}

                <Divider />

                {/* Target Audience */}
                <Typography variant='subtitle1'>Target Audience</Typography>

                <div className='flex items-center gap-2'>
                  {loadingAudience ? (
                    <CircularProgress size={16} />
                  ) : (
                    <Chip
                      label={`${audienceCount !== null ? audienceCount.toLocaleString() : '?'} recipients`}
                      color='primary'
                      variant='tonal'
                      size='small'
                    />
                  )}
                  <Typography variant='body2' color='text.secondary'>
                    {tags.length > 0 ? 'Contacts matching selected tags' : 'All opted-in contacts'}
                  </Typography>
                </div>

                <Autocomplete
                  multiple
                  freeSolo
                  options={availableTags}
                  value={tags}
                  inputValue={tagInput}
                  onInputChange={(_, value) => setTagInput(value)}
                  onChange={(_, value) => setTags(value as string[])}
                  renderTags={(value, getTagProps) =>
                    value.map((tag, index) => (
                      <Chip {...getTagProps({ index })} key={tag} label={tag} size='small' />
                    ))
                  }
                  renderInput={params => (
                    <TextField
                      {...params}
                      size='small'
                      label='Filter by Tags'
                      placeholder='Type tag and press Enter'
                      helperText='Only contacts with these tags will receive the campaign. Leave empty for all opted-in contacts.'
                    />
                  )}
                />

                <Divider />

                {/* Schedule */}
                <Typography variant='subtitle1'>Schedule (Optional)</Typography>
                <TextField
                  fullWidth
                  type='datetime-local'
                  label='Scheduled Send Time'
                  value={scheduledAt}
                  onChange={e => setScheduledAt(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText='Leave empty to send manually from the campaign detail page'
                />

                {/* Submit */}
                <div className='flex gap-3 mt-2 flex-wrap'>
                  <Button
                    variant='contained'
                    color='success'
                    onClick={handleCreate}
                    disabled={creating || sendingNow}
                    startIcon={creating ? <CircularProgress size={18} /> : <i className='tabler-plus' />}
                  >
                    {creating ? 'Creating...' : 'Create Campaign'}
                  </Button>
                  <Button
                    variant='contained'
                    color='primary'
                    onClick={handleSendNow}
                    disabled={creating || sendingNow}
                    startIcon={sendingNow ? <CircularProgress size={18} /> : <i className='tabler-send' />}
                  >
                    {sendingNow ? 'Sending...' : 'Send Now'}
                  </Button>
                  <Button
                    variant='outlined'
                    onClick={() => setTestDialogOpen(true)}
                    disabled={!messageText.trim()}
                    startIcon={<i className='tabler-test-pipe' />}
                  >
                    Test Send
                  </Button>
                  <Button
                    variant='outlined'
                    onClick={() => router.push(`/${locale}/sms/campaigns`)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Help Sidebar */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardHeader title='How It Works' />
            <CardContent>
              <div className='flex flex-col gap-3'>
                <div className='flex gap-2'>
                  <Chip label='1' size='small' color='primary' />
                  <Typography variant='body2'>Enter a campaign name and compose your message</Typography>
                </div>
                <div className='flex gap-2'>
                  <Chip label='2' size='small' color='primary' />
                  <Typography variant='body2'>Watch the character counter -- English uses 160 chars/credit, Nepali uses 70 chars/credit</Typography>
                </div>
                <div className='flex gap-2'>
                  <Chip label='3' size='small' color='primary' />
                  <Typography variant='body2'>Optionally filter your audience by tags to target specific groups</Typography>
                </div>
                <div className='flex gap-2'>
                  <Chip label='4' size='small' color='primary' />
                  <Typography variant='body2'>Send a test message first, then create or send immediately</Typography>
                </div>

                <Alert severity='warning' className='mt-2'>
                  Only opted-in contacts will receive messages. Credits are deducted per SMS segment sent.
                </Alert>
              </div>
            </CardContent>
          </Card>

          {/* Credit Info Card */}
          <Card className='mt-6'>
            <CardHeader title='SMS Credit Guide' />
            <CardContent>
              <div className='flex flex-col gap-3'>
                <Box className='p-3 rounded' sx={{ backgroundColor: 'action.hover' }}>
                  <Typography variant='subtitle2' className='mb-1'>English (GSM-7)</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    1 credit = 160 characters<br />
                    Long messages: 153 chars per additional segment
                  </Typography>
                </Box>
                <Box className='p-3 rounded' sx={{ backgroundColor: 'warning.lighter' }}>
                  <Typography variant='subtitle2' className='mb-1'>Nepali / Unicode (UCS-2)</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    1 credit = 70 characters<br />
                    Long messages: 67 chars per additional segment
                  </Typography>
                </Box>
                <Typography variant='caption' color='text.secondary'>
                  Messages exceeding the single-segment limit are automatically split into multiple segments, each consuming one credit.
                </Typography>
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Test Send Dialog */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Send Test SMS</DialogTitle>
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
          {messageText && (
            <Box className='p-3 rounded mt-3' sx={{ backgroundColor: 'action.hover' }}>
              <Typography variant='caption' color='text.secondary'>Message preview:</Typography>
              <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>{messageText}</Typography>
              <Typography variant='caption' color='text.secondary' className='mt-1 block'>
                {smsInfo.segments} credit(s) per message
              </Typography>
            </Box>
          )}
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

      {/* Send Now Confirmation Dialog */}
      <Dialog open={confirmSendNow} onClose={() => setConfirmSendNow(false)}>
        <DialogTitle>
          <div className='flex items-center gap-2'>
            <i className='tabler-alert-triangle' style={{ color: 'var(--mui-palette-warning-main)' }} />
            Confirm Send Now
          </div>
        </DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-3 mt-1'>
            <Typography>
              This will create the campaign and <strong>immediately start sending</strong> SMS messages to all targeted contacts.
            </Typography>
            <Box className='p-3 rounded' sx={{ backgroundColor: 'action.hover' }}>
              <Typography variant='body2'><strong>Campaign:</strong> {name}</Typography>
              <Typography variant='body2'>
                <strong>Message:</strong> {messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText}
              </Typography>
              <Typography variant='body2'>
                <strong>Audience:</strong> {tags.length > 0 ? `Contacts with tags: ${tags.join(', ')}` : 'All opted-in contacts'}
                {audienceCount !== null && ` (${audienceCount.toLocaleString()} recipients)`}
              </Typography>
              <Typography variant='body2'>
                <strong>Estimated credits:</strong> {estimatedCredits.toLocaleString()} ({smsInfo.segments} per recipient)
              </Typography>
            </Box>
            <Alert severity='warning'>
              SMS messages will be sent immediately and credits will be deducted. Make sure your message and audience are correct.
            </Alert>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSendNow(false)}>Cancel</Button>
          <Button
            variant='contained'
            color='primary'
            onClick={handleConfirmSendNow}
            startIcon={<i className='tabler-send' />}
          >
            Yes, Send Now
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

export default SMSCreateCampaign
