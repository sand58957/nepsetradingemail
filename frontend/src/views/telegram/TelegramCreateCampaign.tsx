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
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import IconButton from '@mui/material/IconButton'

// Service Imports
import telegramService from '@/services/telegram'

// Type Imports
import type { TelegramContactGroupWithCount } from '@/types/telegram'

interface InlineButton {
  text: string
  url: string
}

const TelegramCreateCampaign = () => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  // Form state
  const [name, setName] = useState('')
  const [messageText, setMessageText] = useState('')
  const [messageType, setMessageType] = useState<'text' | 'photo'>('text')
  const [mediaUrl, setMediaUrl] = useState('')
  const [buttons, setButtons] = useState<InlineButton[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  // Audience
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [loadingAudience, setLoadingAudience] = useState(false)
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [availableGroups, setAvailableGroups] = useState<TelegramContactGroupWithCount[]>([])
  const [selectedGroups, setSelectedGroups] = useState<number[]>([])

  // Test send
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testChatId, setTestChatId] = useState('')
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

  // Fetch available tags and groups
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await telegramService.getContactTags()
        const tagNames = (response.data || []).map(t => t.tag)

        setAvailableTags(tagNames)
      } catch {
        // Silently fail
      }
    }

    const fetchGroups = async () => {
      try {
        const response = await telegramService.getGroups()
        setAvailableGroups(response.data || [])
      } catch {
        // Silently fail
      }
    }

    fetchTags()
    fetchGroups()
  }, [])

  // Fetch audience count when tags or groups change
  useEffect(() => {
    const fetchAudienceCount = async () => {
      setLoadingAudience(true)

      try {
        const filter: Record<string, any> = {}

        if (tags.length > 0) {
          filter.tags = tags
        }

        if (selectedGroups.length > 0) {
          filter.groups = selectedGroups
        }

        const response = await telegramService.getAudienceCount(filter)

        setAudienceCount(response.data?.count ?? null)
      } catch {
        setAudienceCount(null)
      } finally {
        setLoadingAudience(false)
      }
    }

    fetchAudienceCount()
  }, [tags, selectedGroups])

  // Inline button management
  const handleAddButton = () => {
    setButtons(prev => [...prev, { text: '', url: '' }])
  }

  const handleRemoveButton = (index: number) => {
    setButtons(prev => prev.filter((_, i) => i !== index))
  }

  const handleButtonChange = (index: number, field: 'text' | 'url', value: string) => {
    setButtons(prev => prev.map((btn, i) => i === index ? { ...btn, [field]: value } : btn))
  }

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

    if (messageType === 'photo' && !mediaUrl.trim()) {
      setSnackbar({ open: true, message: 'Media URL is required for photo messages', severity: 'error' })

      return
    }

    setCreating(true)

    try {
      const payload: any = {
        name: name.trim(),
        message_text: messageText,
        message_type: messageType,
        media_url: messageType === 'photo' ? mediaUrl : undefined,
        buttons: buttons.filter(b => b.text && b.url).length > 0 ? buttons.filter(b => b.text && b.url) : undefined,
        target_filter: {} as Record<string, any>,
        scheduled_at: scheduledAt || undefined
      }

      if (tags.length > 0) {
        payload.target_filter.tags = tags
      }

      if (selectedGroups.length > 0) {
        payload.target_filter.groups = selectedGroups
      }

      const response = await telegramService.createCampaign(payload)

      setSnackbar({ open: true, message: 'Campaign created', severity: 'success' })

      // Navigate to campaign detail
      setTimeout(() => {
        router.push(`/${locale}/telegram/campaigns/${response.data.id}`)
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

    if (messageType === 'photo' && !mediaUrl.trim()) {
      setSnackbar({ open: true, message: 'Media URL is required for photo messages', severity: 'error' })

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
        message_type: messageType,
        media_url: messageType === 'photo' ? mediaUrl : undefined,
        buttons: buttons.filter(b => b.text && b.url).length > 0 ? buttons.filter(b => b.text && b.url) : undefined,
        target_filter: {} as Record<string, any>
      }

      if (tags.length > 0) {
        payload.target_filter.tags = tags
      }

      if (selectedGroups.length > 0) {
        payload.target_filter.groups = selectedGroups
      }

      // Step 1: Create the campaign
      const response = await telegramService.createCampaign(payload)
      const campaignId = response.data.id

      // Step 2: Immediately send
      try {
        await telegramService.sendCampaign(campaignId)
        setSnackbar({ open: true, message: 'Campaign created and sending started!', severity: 'success' })
      } catch {
        setSnackbar({ open: true, message: 'Campaign created but failed to start sending. Go to campaign detail to retry.', severity: 'error' })
      }

      // Navigate to campaign detail
      setTimeout(() => {
        router.push(`/${locale}/telegram/campaigns/${campaignId}`)
      }, 1000)
    } catch {
      setSnackbar({ open: true, message: 'Failed to create campaign', severity: 'error' })
    } finally {
      setSendingNow(false)
    }
  }

  // Test send
  const handleTestSend = async () => {
    if (!testChatId) {
      setSnackbar({ open: true, message: 'Please enter a chat ID', severity: 'error' })

      return
    }

    if (!name.trim() || !messageText.trim()) {
      setSnackbar({ open: true, message: 'Please fill in campaign name and message first', severity: 'error' })

      return
    }

    setTestingSend(true)

    try {
      const payload: any = {
        name: name.trim(),
        message_text: messageText,
        message_type: messageType,
        media_url: messageType === 'photo' ? mediaUrl : undefined,
        buttons: buttons.filter(b => b.text && b.url).length > 0 ? buttons.filter(b => b.text && b.url) : undefined,
        target_filter: {} as Record<string, any>
      }

      if (tags.length > 0) {
        payload.target_filter.tags = tags
      }

      if (selectedGroups.length > 0) {
        payload.target_filter.groups = selectedGroups
      }

      const response = await telegramService.createCampaign(payload)
      const campaignId = response.data.id

      const testResponse = await telegramService.testCampaign(campaignId, Number(testChatId))

      setSnackbar({
        open: true,
        message: `Test message sent! Status: ${testResponse.data.status}`,
        severity: 'success'
      })
      setTestDialogOpen(false)
      setTestChatId('')
    } catch {
      setSnackbar({ open: true, message: 'Failed to send test message', severity: 'error' })
    } finally {
      setTestingSend(false)
    }
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
                  <Typography variant='h5'>Create Telegram Campaign</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Send a message to your Telegram contacts via your bot
                  </Typography>
                </div>
                <Button
                  variant='outlined'
                  startIcon={<i className='tabler-arrow-left' />}
                  onClick={() => router.push(`/${locale}/telegram/campaigns`)}
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

                {/* Message Type Selector */}
                <div>
                  <Typography variant='subtitle2' className='mb-2'>Message Type</Typography>
                  <ToggleButtonGroup
                    value={messageType}
                    exclusive
                    onChange={(_, value) => { if (value) setMessageType(value) }}
                    size='small'
                  >
                    <ToggleButton value='text'>
                      <i className='tabler-message mr-2' />
                      Text
                    </ToggleButton>
                    <ToggleButton value='photo'>
                      <i className='tabler-photo mr-2' />
                      Photo
                    </ToggleButton>
                  </ToggleButtonGroup>
                </div>

                {/* Media URL (for photo type) */}
                {messageType === 'photo' && (
                  <TextField
                    fullWidth
                    label='Media URL *'
                    placeholder='https://example.com/image.jpg'
                    value={mediaUrl}
                    onChange={e => setMediaUrl(e.target.value)}
                    helperText='URL to the photo to send with the message (JPEG, PNG, GIF)'
                  />
                )}

                {/* Message Composer */}
                <div>
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    label={messageType === 'photo' ? 'Caption *' : 'Message Text *'}
                    placeholder='Type your Telegram message here...'
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    helperText={
                      <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                        <span>
                          Supports Telegram HTML formatting: &lt;b&gt;bold&lt;/b&gt;, &lt;i&gt;italic&lt;/i&gt;, &lt;a href=&quot;...&quot;&gt;link&lt;/a&gt;
                        </span>
                        <span style={{ color: 'var(--mui-palette-text-secondary)' }}>
                          {messageText.length} characters
                        </span>
                      </span>
                    }
                  />
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
                      <i className='tabler-brand-telegram' style={{ fontSize: 20, color: '#0088cc' }} />
                      <Typography variant='subtitle2'>Message Preview</Typography>
                    </div>
                    {messageType === 'photo' && mediaUrl && (
                      <Box className='mb-2 rounded overflow-hidden' sx={{ maxWidth: 300 }}>
                        <img src={mediaUrl} alt='Preview' style={{ width: '100%', display: 'block' }} onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      </Box>
                    )}
                    <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {messageText}
                    </Typography>
                    {buttons.filter(b => b.text && b.url).length > 0 && (
                      <div className='flex flex-col gap-1 mt-3'>
                        {buttons.filter(b => b.text && b.url).map((btn, i) => (
                          <Box
                            key={i}
                            className='text-center p-2 rounded'
                            sx={{ backgroundColor: 'primary.lighter', border: '1px solid', borderColor: 'primary.main', cursor: 'pointer' }}
                          >
                            <Typography variant='body2' color='primary.main' className='font-medium'>
                              {btn.text}
                            </Typography>
                          </Box>
                        ))}
                      </div>
                    )}
                  </Box>
                )}

                <Divider />

                {/* Inline Buttons */}
                <div>
                  <div className='flex items-center justify-between mb-2'>
                    <Typography variant='subtitle1'>Inline Buttons (Optional)</Typography>
                    <Button
                      size='small'
                      startIcon={<i className='tabler-plus' />}
                      onClick={handleAddButton}
                    >
                      Add Button
                    </Button>
                  </div>
                  <Typography variant='body2' color='text.secondary' className='mb-3'>
                    Add clickable buttons below your message. Each button opens a URL when tapped.
                  </Typography>
                  {buttons.map((btn, index) => (
                    <div key={index} className='flex gap-2 mb-2 items-center'>
                      <TextField
                        size='small'
                        label='Button Text'
                        placeholder='e.g. Visit Website'
                        value={btn.text}
                        onChange={e => handleButtonChange(index, 'text', e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size='small'
                        label='URL'
                        placeholder='https://example.com'
                        value={btn.url}
                        onChange={e => handleButtonChange(index, 'url', e.target.value)}
                        sx={{ flex: 1 }}
                      />
                      <IconButton size='small' color='error' onClick={() => handleRemoveButton(index)}>
                        <i className='tabler-trash' />
                      </IconButton>
                    </div>
                  ))}
                </div>

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
                    {tags.length > 0 || selectedGroups.length > 0 ? 'Contacts matching selected filters' : 'All opted-in contacts'}
                  </Typography>
                </div>

                {/* Group filter */}
                {availableGroups.length > 0 && (
                  <div>
                    <Typography variant='body2' className='mb-2'>Filter by Groups</Typography>
                    <div className='flex gap-2 flex-wrap'>
                      {availableGroups.map(group => (
                        <Chip
                          key={group.id}
                          label={`${group.name} (${group.member_count})`}
                          size='small'
                          variant={selectedGroups.includes(group.id) ? 'filled' : 'outlined'}
                          color={selectedGroups.includes(group.id) ? 'primary' : 'default'}
                          onClick={() => {
                            setSelectedGroups(prev =>
                              prev.includes(group.id)
                                ? prev.filter(id => id !== group.id)
                                : [...prev, group.id]
                            )
                          }}
                          sx={selectedGroups.includes(group.id) ? {} : {
                            borderLeft: `3px solid ${group.color}`,
                          }}
                        />
                      ))}
                    </div>
                    <Typography variant='caption' color='text.secondary' className='mt-1 block'>
                      Click to select groups. Contacts in selected groups will receive the campaign.
                    </Typography>
                  </div>
                )}

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
                    onClick={() => router.push(`/${locale}/telegram/campaigns`)}
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
                  <Typography variant='body2'>Choose message type: text-only or photo with caption</Typography>
                </div>
                <div className='flex gap-2'>
                  <Chip label='3' size='small' color='primary' />
                  <Typography variant='body2'>Add inline buttons to include clickable links in your message</Typography>
                </div>
                <div className='flex gap-2'>
                  <Chip label='4' size='small' color='primary' />
                  <Typography variant='body2'>Optionally filter your audience by tags or groups</Typography>
                </div>
                <div className='flex gap-2'>
                  <Chip label='5' size='small' color='primary' />
                  <Typography variant='body2'>Send a test message first, then create or send immediately</Typography>
                </div>

                <Alert severity='success' className='mt-2'>
                  Telegram messaging is free -- no credits or per-message charges!
                </Alert>
              </div>
            </CardContent>
          </Card>

          {/* Formatting Guide */}
          <Card className='mt-6'>
            <CardHeader title='Formatting Guide' />
            <CardContent>
              <div className='flex flex-col gap-3'>
                <Box className='p-3 rounded' sx={{ backgroundColor: 'action.hover' }}>
                  <Typography variant='subtitle2' className='mb-1'>Telegram HTML</Typography>
                  <Typography variant='body2' color='text.secondary' component='div'>
                    <code>&lt;b&gt;bold&lt;/b&gt;</code><br />
                    <code>&lt;i&gt;italic&lt;/i&gt;</code><br />
                    <code>&lt;u&gt;underline&lt;/u&gt;</code><br />
                    <code>&lt;code&gt;monospace&lt;/code&gt;</code><br />
                    <code>&lt;a href=&quot;URL&quot;&gt;link&lt;/a&gt;</code>
                  </Typography>
                </Box>
                <Typography variant='caption' color='text.secondary'>
                  Telegram supports HTML formatting in messages. Use the tags above to style your text.
                </Typography>
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Test Send Dialog */}
      <Dialog open={testDialogOpen} onClose={() => setTestDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Send Test Message</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' className='mb-4'>
            Send a test message to a single Telegram chat to preview before sending to all contacts.
          </Typography>
          <TextField
            fullWidth
            label='Chat ID'
            placeholder='e.g. 123456789'
            value={testChatId}
            onChange={e => setTestChatId(e.target.value)}
            helperText='Enter the Telegram chat ID to send the test to'
            className='mt-2'
            type='number'
          />
          {messageText && (
            <Box className='p-3 rounded mt-3' sx={{ backgroundColor: 'action.hover' }}>
              <Typography variant='caption' color='text.secondary'>Message preview:</Typography>
              {messageType === 'photo' && mediaUrl && (
                <Typography variant='caption' color='info.main' className='block mb-1'>
                  [Photo: {mediaUrl}]
                </Typography>
              )}
              <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>{messageText}</Typography>
              {buttons.filter(b => b.text).length > 0 && (
                <Typography variant='caption' color='text.secondary' className='mt-1 block'>
                  {buttons.filter(b => b.text).length} inline button(s)
                </Typography>
              )}
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
              This will create the campaign and <strong>immediately start sending</strong> Telegram messages to all targeted contacts.
            </Typography>
            <Box className='p-3 rounded' sx={{ backgroundColor: 'action.hover' }}>
              <Typography variant='body2'><strong>Campaign:</strong> {name}</Typography>
              <Typography variant='body2'><strong>Type:</strong> {messageType === 'photo' ? 'Photo with caption' : 'Text message'}</Typography>
              <Typography variant='body2'>
                <strong>Message:</strong> {messageText.length > 100 ? messageText.substring(0, 100) + '...' : messageText}
              </Typography>
              <Typography variant='body2'>
                <strong>Audience:</strong> {tags.length > 0 ? `Contacts with tags: ${tags.join(', ')}` : 'All opted-in contacts'}
                {audienceCount !== null && ` (${audienceCount.toLocaleString()} recipients)`}
              </Typography>
              {buttons.filter(b => b.text && b.url).length > 0 && (
                <Typography variant='body2'>
                  <strong>Buttons:</strong> {buttons.filter(b => b.text && b.url).length} inline button(s)
                </Typography>
              )}
            </Box>
            <Alert severity='info'>
              Telegram messages will be sent immediately. Make sure your message and audience are correct.
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

export default TelegramCreateCampaign
