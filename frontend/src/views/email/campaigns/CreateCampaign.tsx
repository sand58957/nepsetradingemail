'use client'

import { useState, useEffect, useRef } from 'react'

import { useRouter, useSearchParams, useParams } from 'next/navigation'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Switch from '@mui/material/Switch'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Box from '@mui/material/Box'

import type { List } from '@/types/email'

import campaignService from '@/services/campaigns'
import listService from '@/services/lists'
import subscriberService from '@/services/subscribers'
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'

const FORM_STATE_KEY = 'campaign_form_state'

const CreateCampaign = () => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const campaignType = searchParams.get('type') || 'regular'

  const [saving, setSaving] = useState(false)

  // Fetched data
  const [availableLists, setAvailableLists] = useState<List[]>([])
  const [loadingLists, setLoadingLists] = useState(true)

  // Campaign details
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [fromName, setFromName] = useState('NEPSE Trading')
  const [fromEmail, setFromEmail] = useState('noreply@nepsetrading.com')
  const [preheader, setPreheader] = useState('')

  // Recipients
  const [selectedLists, setSelectedLists] = useState<number[]>([])

  // Content
  const [body, setBody] = useState('')

  // Delivery
  const [sendNow, setSendNow] = useState(true)
  const [scheduledDate, setScheduledDate] = useState('')

  // Settings
  const [trackOpens, setTrackOpens] = useState(true)
  const [trackClicks, setTrackClicks] = useState(true)

  // UI state
  const [recipientDialogOpen, setRecipientDialogOpen] = useState(false)
  const [testEmailOpen, setTestEmailOpen] = useState(false)
  const [testEmailAddress, setTestEmailAddress] = useState('')
  const [editContentAnchor, setEditContentAnchor] = useState<null | HTMLElement>(null)
  const [htmlEditOpen, setHtmlEditOpen] = useState(false)
  const [htmlEditValue, setHtmlEditValue] = useState('')

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const isMobile = useMobileBreakpoint()

  // Fetch lists
  useEffect(() => {
    const fetchLists = async () => {
      setLoadingLists(true)

      try {
        const response = await listService.getAll({ per_page: 100 })

        setAvailableLists(response.data?.results || [])
      } catch {
        console.error('Failed to fetch lists')
      } finally {
        setLoadingLists(false)
      }
    }

    fetchLists()
  }, [])

  // Load HTML from editor (sessionStorage) and restore form state
  useEffect(() => {
    const editorParam = searchParams.get('editor')

    if (editorParam === 'done') {
      const editorHtml = sessionStorage.getItem('campaign_email_html')

      if (editorHtml) {
        setBody(editorHtml)
      }
    }

    // Restore form state if coming back from editor
    const savedState = sessionStorage.getItem(FORM_STATE_KEY)

    if (savedState) {
      try {
        const state = JSON.parse(savedState)

        if (state.name) setName(state.name)
        if (state.subject) setSubject(state.subject)
        if (state.fromName) setFromName(state.fromName)
        if (state.fromEmail) setFromEmail(state.fromEmail)
        if (state.preheader) setPreheader(state.preheader)
        if (state.selectedLists) setSelectedLists(state.selectedLists)
        if (state.sendNow !== undefined) setSendNow(state.sendNow)
        if (state.scheduledDate) setScheduledDate(state.scheduledDate)
        if (state.trackOpens !== undefined) setTrackOpens(state.trackOpens)
        if (state.trackClicks !== undefined) setTrackClicks(state.trackClicks)
      } catch {
        // Ignore parse errors
      }

      sessionStorage.removeItem(FORM_STATE_KEY)
    }
  }, [searchParams])

  const handleListToggle = (listId: number) => {
    setSelectedLists(prev =>
      prev.includes(listId) ? prev.filter(id => id !== listId) : [...prev, listId]
    )
  }

  const totalRecipients = availableLists
    .filter(l => selectedLists.includes(l.id))
    .reduce((sum, l) => sum + (l.subscriber_count || 0), 0)

  const isFormValid = () => {
    return name.trim() !== '' && subject.trim() !== '' && fromEmail.trim() !== '' && selectedLists.length > 0 && body.trim() !== ''
  }

  // Save form state to sessionStorage before navigating away
  const saveFormState = () => {
    const state = {
      name, subject, fromName, fromEmail, preheader,
      selectedLists, sendNow, scheduledDate, trackOpens, trackClicks
    }

    sessionStorage.setItem(FORM_STATE_KEY, JSON.stringify(state))
  }

  // Assemble from_email field
  const assembleFromEmail = () => {
    if (fromName.trim()) {
      return `${fromName.trim()} <${fromEmail.trim()}>`
    }

    return fromEmail.trim()
  }

  // Inject preheader into HTML body (HTML-encode to prevent injection)
  const assembleBody = () => {
    if (!preheader.trim()) return body

    // HTML-encode the preheader to prevent XSS injection
    const encoded = preheader.trim()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

    const preheaderHtml = `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${encoded}</div>`

    // Insert after <body> tag if it exists, otherwise prepend
    if (body.includes('<body')) {
      return body.replace(/(<body[^>]*>)/i, `$1${preheaderHtml}`)
    }

    return preheaderHtml + body
  }

  // Save as draft
  const handleSaveAsDraft = async () => {
    setSaving(true)

    try {
      const result = await campaignService.create({
        name,
        subject,
        from_email: assembleFromEmail(),
        type: campaignType as any,
        content_type: 'html',
        body: assembleBody(),
        lists: selectedLists,
        send_at: !sendNow && scheduledDate ? new Date(scheduledDate).toISOString() : undefined
      })

      // Clean up sessionStorage
      sessionStorage.removeItem('campaign_email_html')
      sessionStorage.removeItem('campaign_email_design')

      setSnackbar({ open: true, message: 'Campaign saved as draft', severity: 'success' })
      setTimeout(() => router.push(`/${locale}/campaigns/${result.data.id}`), 1000)
    } catch {
      setSnackbar({ open: true, message: 'Failed to save campaign', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Send or schedule campaign
  const handleSendCampaign = async () => {
    setSaving(true)

    try {
      const result = await campaignService.create({
        name,
        subject,
        from_email: assembleFromEmail(),
        type: campaignType as any,
        content_type: 'html',
        body: assembleBody(),
        lists: selectedLists,
        send_at: !sendNow && scheduledDate ? new Date(scheduledDate).toISOString() : undefined
      })

      const status = sendNow ? 'running' : 'scheduled'

      await campaignService.updateStatus(result.data.id, status)

      sessionStorage.removeItem('campaign_email_html')
      sessionStorage.removeItem('campaign_email_design')

      setSnackbar({
        open: true,
        message: sendNow ? 'Campaign is now sending!' : 'Campaign scheduled successfully',
        severity: 'success'
      })

      setTimeout(() => router.push(`/${locale}/campaigns/${result.data.id}`), 1000)
    } catch {
      setSnackbar({ open: true, message: 'Failed to send campaign', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Navigate back to editor
  const handleEditInEditor = () => {
    setEditContentAnchor(null)
    saveFormState()
    router.push(`/${locale}/campaigns/create?type=${campaignType}&template=scratch`)
  }

  // Open HTML editor dialog
  const handleEditHtml = () => {
    setEditContentAnchor(null)
    setHtmlEditValue(body)
    setHtmlEditOpen(true)
  }

  // Save HTML edits
  const handleSaveHtml = () => {
    setBody(htmlEditValue)
    sessionStorage.setItem('campaign_email_html', htmlEditValue)
    setHtmlEditOpen(false)
  }

  // Send test email
  const handleSendTestEmail = async () => {
    if (!testEmailAddress.trim() || !body) return

    const email = testEmailAddress.trim()

    // Need at least one list — use selected or first available
    const listsForTest = selectedLists.length > 0
      ? selectedLists
      : availableLists.length > 0
        ? [availableLists[0].id]
        : []

    if (listsForTest.length === 0) {
      setSnackbar({ open: true, message: 'No subscriber lists available. Create a list first.', severity: 'error' })

      return
    }

    let tempCampaignId: number | null = null
    let tempSubscriberId: number | null = null

    try {
      // Step 1: Find or create subscriber by email (Listmonk test endpoint needs subscriber IDs)
      let subscriberId: number | null = null

      try {
        const sanitizedEmail = email.replace(/'/g, "''").replace(/[;\-\\]/g, '').replace(/\/\*/g, '')

        const searchResult = await subscriberService.getAll({
          query: `subscribers.email='${sanitizedEmail}'`,
          per_page: 1
        })

        const results = searchResult.data?.results || []

        if (results.length > 0) {
          subscriberId = results[0].id
        }
      } catch {
        // Search failed, will create temp subscriber
      }

      if (!subscriberId) {
        // Create a temporary subscriber for testing
        const subResult = await subscriberService.create({
          email,
          name: 'Test Recipient',
          status: 'enabled',
          lists: listsForTest
        })

        subscriberId = subResult.data.id
        tempSubscriberId = subscriberId
      }

      // Step 2: Create temp campaign
      const tempResult = await campaignService.create({
        name: `Test - ${name || 'Untitled'}`,
        subject: subject || 'Test Email',
        from_email: fromEmail.trim() || 'noreply@nepsetrading.com',
        type: campaignType as any,
        content_type: 'html',
        body: assembleBody(),
        lists: listsForTest
      })

      tempCampaignId = tempResult.data.id

      // Step 3: Send test using email address (Listmonk expects email strings)
      await campaignService.test(tempCampaignId, [email])

      setTestEmailOpen(false)
      setTestEmailAddress('')
      setSnackbar({ open: true, message: 'Test email sent!', severity: 'success' })
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to send test email'

      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      // Clean up temp campaign
      if (tempCampaignId) {
        try {
          await campaignService.delete(tempCampaignId)
        } catch {
          // Ignore cleanup errors
        }
      }

      // Clean up temp subscriber
      if (tempSubscriberId) {
        try {
          await subscriberService.delete(tempSubscriberId)
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  return (
    <>
      {/* Header */}
      <div className='flex items-center justify-between mb-6'>
        <div className='flex items-center gap-3'>
          <Button
            variant='text'
            color='secondary'
            startIcon={<i className='tabler-arrow-left' />}
            onClick={() => router.push(`/${locale}/campaigns/list`)}
          >
            Back to Campaigns
          </Button>
        </div>
        <Typography variant='h5' className='font-semibold'>
          Campaign Details
        </Typography>
      </div>

      <Grid container spacing={6}>
        {/* LEFT COLUMN */}
        <Grid size={{ xs: 12, md: 7 }}>
          {/* Campaign Details Card */}
          <Card className='mb-6'>
            <CardHeader title='Campaign Details' />
            <CardContent className='flex flex-col gap-4'>
              <TextField
                fullWidth
                label='Campaign Name'
                placeholder='e.g. March Newsletter'
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
              <TextField
                fullWidth
                label='Email Subject'
                placeholder='e.g. Your Monthly Update is Here!'
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
                helperText='Use {{ .Subscriber.Name }} for personalization'
              />
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label='Sender Name'
                    placeholder='e.g. Your Company'
                    value={fromName}
                    onChange={e => setFromName(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label='Sender Email'
                    placeholder='e.g. news@yourcompany.com'
                    type='email'
                    value={fromEmail}
                    onChange={e => setFromEmail(e.target.value)}
                    required
                  />
                </Grid>
              </Grid>
              <TextField
                fullWidth
                label='Preheader Text'
                placeholder='Preview text shown in inbox...'
                value={preheader}
                onChange={e => setPreheader(e.target.value)}
                helperText='This text appears next to the subject line in the inbox preview'
              />
            </CardContent>
          </Card>

          {/* Recipients Card */}
          <Card className='mb-6'>
            <CardHeader
              title='Recipients'
              action={
                <Button
                  size='small'
                  variant='outlined'
                  startIcon={<i className='tabler-edit text-[16px]' />}
                  onClick={() => setRecipientDialogOpen(true)}
                >
                  Edit recipients
                </Button>
              }
            />
            <CardContent>
              {selectedLists.length === 0 ? (
                <div className='flex flex-col items-center py-4 gap-2'>
                  <Typography color='text.secondary'>No recipients selected</Typography>
                  <Button
                    variant='outlined'
                    size='small'
                    onClick={() => setRecipientDialogOpen(true)}
                  >
                    Select recipient lists
                  </Button>
                </div>
              ) : (
                <div className='flex flex-col gap-3'>
                  <div className='flex gap-2 flex-wrap'>
                    {availableLists
                      .filter(l => selectedLists.includes(l.id))
                      .map(l => (
                        <Chip
                          key={l.id}
                          label={`${l.name} (${(l.subscriber_count || 0).toLocaleString()})`}
                          variant='outlined'
                          color='primary'
                          onDelete={() => handleListToggle(l.id)}
                        />
                      ))}
                  </div>
                  <Typography variant='body2' color='text.secondary'>
                    Total recipients: <strong>{totalRecipients.toLocaleString()}</strong>
                  </Typography>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Delivery Card */}
          <Card>
            <CardHeader title='Delivery' />
            <CardContent>
              <RadioGroup
                value={sendNow ? 'now' : 'later'}
                onChange={e => setSendNow(e.target.value === 'now')}
              >
                <FormControlLabel value='now' control={<Radio />} label='Send immediately' />
                <FormControlLabel value='later' control={<Radio />} label='Schedule for later' />
              </RadioGroup>
              {!sendNow && (
                <TextField
                  label='Schedule Date & Time'
                  type='datetime-local'
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  className='mt-3 max-is-[300px]'
                  fullWidth
                />
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* RIGHT COLUMN */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Box sx={{ position: { xs: 'static', md: 'sticky' }, top: { md: 100 } }}>
            {/* Email Preview Card */}
            <Card className='mb-6'>
              <CardHeader
                title='Email Preview'
                titleTypographyProps={{ variant: 'subtitle1' }}
              />
              <CardContent className='flex flex-col gap-3'>
                {body ? (
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 1,
                      overflow: 'hidden',
                      height: { xs: 250, sm: 300, md: 400 },
                      bgcolor: '#fff'
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      srcDoc={body}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                      title='Email Preview'
                      sandbox='allow-same-origin'
                    />
                  </Box>
                ) : (
                  <Box
                    sx={{
                      border: '1px dashed',
                      borderColor: 'divider',
                      borderRadius: 1,
                      height: 200,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: 1
                    }}
                  >
                    <i className='tabler-mail text-[40px] text-textSecondary' />
                    <Typography color='text.secondary'>No email content yet</Typography>
                  </Box>
                )}

                <div className='flex items-center justify-between'>
                  <Button
                    size='small'
                    variant='outlined'
                    endIcon={<i className='tabler-chevron-down text-[14px]' />}
                    onClick={e => setEditContentAnchor(e.currentTarget)}
                  >
                    Edit content
                  </Button>
                  <Button
                    size='small'
                    variant='text'
                    startIcon={<i className='tabler-send text-[16px]' />}
                    onClick={() => setTestEmailOpen(true)}
                    disabled={!body}
                  >
                    Send a test email
                  </Button>
                </div>

                <Menu
                  anchorEl={editContentAnchor}
                  open={Boolean(editContentAnchor)}
                  onClose={() => setEditContentAnchor(null)}
                >
                  <MenuItem onClick={handleEditInEditor}>
                    <ListItemIcon><i className='tabler-palette text-[18px]' /></ListItemIcon>
                    <ListItemText>Edit in editor</ListItemText>
                  </MenuItem>
                  <MenuItem onClick={handleEditHtml}>
                    <ListItemIcon><i className='tabler-code text-[18px]' /></ListItemIcon>
                    <ListItemText>Edit HTML directly</ListItemText>
                  </MenuItem>
                </Menu>
              </CardContent>
            </Card>

            {/* Settings Card */}
            <Card>
              <CardHeader
                title='Settings'
                titleTypographyProps={{ variant: 'subtitle1' }}
              />
              <CardContent className='flex flex-col gap-1'>
                <FormControlLabel
                  control={
                    <Switch
                      checked={trackOpens}
                      onChange={e => setTrackOpens(e.target.checked)}
                    />
                  }
                  label='Track opens'
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={trackClicks}
                      onChange={e => setTrackClicks(e.target.checked)}
                    />
                  }
                  label='Track clicks (UTM tags)'
                />
              </CardContent>
            </Card>
          </Box>
        </Grid>
      </Grid>

      {/* Bottom Action Bar */}
      <Divider className='my-6' />
      <div className='flex flex-wrap gap-3 justify-between'>
        <Button
          variant='outlined'
          color='secondary'
          onClick={handleSaveAsDraft}
          disabled={saving || !name.trim()}
          startIcon={saving ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-device-floppy' />}
        >
          Save as Draft
        </Button>
        <Button
          variant='contained'
          color='primary'
          startIcon={saving ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-send' />}
          disabled={!isFormValid() || saving}
          onClick={handleSendCampaign}
        >
          {sendNow ? 'Send Campaign' : 'Schedule Campaign'}
        </Button>
      </div>

      {/* Recipient Selection Dialog */}
      <Dialog
        open={recipientDialogOpen}
        onClose={() => setRecipientDialogOpen(false)}
        maxWidth='sm'
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Select Recipient Lists</DialogTitle>
        <DialogContent>
          {loadingLists ? (
            <div className='flex justify-center items-center py-8'>
              <CircularProgress size={24} />
              <Typography className='ml-2' color='text.secondary'>Loading lists...</Typography>
            </div>
          ) : availableLists.length === 0 ? (
            <Alert severity='warning' className='mt-2'>
              No subscriber lists found. Create a list first.
            </Alert>
          ) : (
            <FormGroup className='mt-2'>
              {availableLists.map(list => (
                <div
                  key={list.id}
                  className={`flex items-center justify-between p-3 rounded-lg border mb-2 cursor-pointer transition-colors ${
                    selectedLists.includes(list.id) ? 'border-primary bg-primaryLight' : ''
                  }`}
                  onClick={() => handleListToggle(list.id)}
                >
                  <div className='flex items-center gap-3'>
                    <Checkbox
                      checked={selectedLists.includes(list.id)}
                      onClick={e => e.stopPropagation()}
                      onChange={() => handleListToggle(list.id)}
                    />
                    <div>
                      <Typography className='font-medium' color='text.primary'>
                        {list.name}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {(list.subscriber_count || 0).toLocaleString()} subscribers
                      </Typography>
                    </div>
                  </div>
                  <Chip
                    label={list.type}
                    size='small'
                    variant='tonal'
                    color={list.type === 'public' ? 'primary' : 'secondary'}
                  />
                </div>
              ))}
            </FormGroup>
          )}
        </DialogContent>
        <DialogActions>
          <Typography variant='body2' color='text.secondary' className='flex-1 pl-4'>
            {selectedLists.length} list(s) selected · {totalRecipients.toLocaleString()} recipients
          </Typography>
          <Button onClick={() => setRecipientDialogOpen(false)} variant='contained'>
            Done
          </Button>
        </DialogActions>
      </Dialog>

      {/* Test Email Dialog */}
      <Dialog
        open={testEmailOpen}
        onClose={() => setTestEmailOpen(false)}
        maxWidth='xs'
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Send a Test Email</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' className='mb-3'>
            Send a preview of this email to test how it looks in an inbox.
          </Typography>
          <TextField
            fullWidth
            label='Email Address'
            placeholder='you@example.com'
            type='email'
            value={testEmailAddress}
            onChange={e => setTestEmailAddress(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestEmailOpen(false)} color='secondary'>Cancel</Button>
          <Button
            onClick={handleSendTestEmail}
            variant='contained'
            disabled={!testEmailAddress.trim()}
            startIcon={<i className='tabler-send' />}
          >
            Send Test
          </Button>
        </DialogActions>
      </Dialog>

      {/* HTML Editor Dialog */}
      <Dialog
        open={htmlEditOpen}
        onClose={() => setHtmlEditOpen(false)}
        maxWidth='md'
        fullWidth
        fullScreen={isMobile}
      >
        <DialogTitle>Edit HTML</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            multiline
            minRows={15}
            maxRows={25}
            value={htmlEditValue}
            onChange={e => setHtmlEditValue(e.target.value)}
            placeholder='<html>...</html>'
            sx={{ mt: 1, '& .MuiInputBase-input': { fontFamily: 'monospace', fontSize: 13 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHtmlEditOpen(false)} color='secondary'>Cancel</Button>
          <Button onClick={handleSaveHtml} variant='contained'>
            Save Changes
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

export default CreateCampaign
