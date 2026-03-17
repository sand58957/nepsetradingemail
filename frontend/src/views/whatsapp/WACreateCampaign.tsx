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
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
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

// Service Imports
import whatsappService from '@/services/whatsapp'

// Type Imports
import type { WATemplate, WAContactGroupWithCount } from '@/types/whatsapp'

const WACreateCampaign = () => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  // Form state
  const [name, setName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<WATemplate | null>(null)
  const [templateVarValues, setTemplateVarValues] = useState<Record<string, string>>({})
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  // Data
  const [templates, setTemplates] = useState<WATemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)
  const [availableGroups, setAvailableGroups] = useState<WAContactGroupWithCount[]>([])
  const [selectedGroups, setSelectedGroups] = useState<number[]>([])

  // UI
  const [creating, setCreating] = useState(false)
  const [sendingNow, setSendingNow] = useState(false)
  const [confirmSendNow, setConfirmSendNow] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  // Fetch templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await whatsappService.getTemplates()

        setTemplates(response.data || [])
      } catch {
        setSnackbar({ open: true, message: 'Failed to fetch templates', severity: 'error' })
      } finally {
        setLoadingTemplates(false)
      }
    }

    const fetchGroups = async () => {
      try {
        const response = await whatsappService.getGroups()
        setAvailableGroups(response.data || [])
      } catch {
        // Silently fail
      }
    }

    fetchTemplates()
    fetchGroups()
  }, [])

  // Create campaign
  const handleCreate = async () => {
    if (!name.trim()) {
      setSnackbar({ open: true, message: 'Campaign name is required', severity: 'error' })

      return
    }

    if (!selectedTemplate) {
      setSnackbar({ open: true, message: 'Please select a template', severity: 'error' })

      return
    }

    setCreating(true)

    try {
      // Build template params from variable values
      const paramsList = templateVars.map((v, idx) => ({
        index: idx + 1,
        value: templateVarValues[v] || '',
        field: ''
      }))

      const payload: any = {
        name: name.trim(),
        template_id: selectedTemplate.id,
        template_params: paramsList.length > 0 ? paramsList : undefined,
        target_filter: {} as Record<string, any>,
        scheduled_at: scheduledAt || undefined
      }

      if (tags.length > 0) {
        payload.target_filter.tags = tags
      }

      if (selectedGroups.length > 0) {
        payload.target_filter.groups = selectedGroups
      }

      const response = await whatsappService.createCampaign(payload)

      setSnackbar({ open: true, message: 'Campaign created', severity: 'success' })

      // Navigate to campaign detail
      setTimeout(() => {
        router.push(`/${locale}/whatsapp/campaigns/${response.data.id}`)
      }, 500)
    } catch {
      setSnackbar({ open: true, message: 'Failed to create campaign', severity: 'error' })
    } finally {
      setCreating(false)
    }
  }

  // Create campaign and immediately send
  const handleSendNow = async () => {
    if (!name.trim()) {
      setSnackbar({ open: true, message: 'Campaign name is required', severity: 'error' })

      return
    }

    if (!selectedTemplate) {
      setSnackbar({ open: true, message: 'Please select a template', severity: 'error' })

      return
    }

    setConfirmSendNow(true)
  }

  const handleConfirmSendNow = async () => {
    setConfirmSendNow(false)
    setSendingNow(true)

    try {
      // Build template params
      const paramsList = templateVars.map((v, idx) => ({
        index: idx + 1,
        value: templateVarValues[v] || '',
        field: ''
      }))

      const payload: any = {
        name: name.trim(),
        template_id: selectedTemplate!.id,
        template_params: paramsList.length > 0 ? paramsList : undefined,
        target_filter: {} as Record<string, any>
      }

      if (tags.length > 0) {
        payload.target_filter.tags = tags
      }

      if (selectedGroups.length > 0) {
        payload.target_filter.groups = selectedGroups
      }

      // Step 1: Create the campaign
      const response = await whatsappService.createCampaign(payload)
      const campaignId = response.data.id

      // Step 2: Immediately send
      try {
        await whatsappService.sendCampaign(campaignId)
        setSnackbar({ open: true, message: 'Campaign created and sending started!', severity: 'success' })
      } catch {
        setSnackbar({ open: true, message: 'Campaign created but failed to start sending. Go to campaign detail to retry.', severity: 'error' })
      }

      // Navigate to campaign detail
      setTimeout(() => {
        router.push(`/${locale}/whatsapp/campaigns/${campaignId}`)
      }, 1000)
    } catch {
      setSnackbar({ open: true, message: 'Failed to create campaign', severity: 'error' })
    } finally {
      setSendingNow(false)
    }
  }

  const approvedTemplates = templates.filter(t => t.status === 'APPROVED' || t.status === 'approved')

  // Extract template variables ({{1}}, {{2}}, etc.)
  const templateVars = selectedTemplate?.body_text?.match(/\{\{\d+\}\}/g) || []

  return (
    <>
      <Grid container spacing={6}>
        {/* Header */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <div className='flex items-center justify-between flex-wrap gap-4'>
                <div>
                  <Typography variant='h5'>Create WhatsApp Campaign</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Send a template message to your WhatsApp contacts
                  </Typography>
                </div>
                <Button
                  variant='outlined'
                  startIcon={<i className='tabler-arrow-left' />}
                  onClick={() => router.push(`/${locale}/whatsapp/campaigns`)}
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
                  placeholder='e.g. March Promotion'
                  value={name}
                  onChange={e => setName(e.target.value)}
                />

                {/* Template Selection */}
                {!loadingTemplates && approvedTemplates.length === 0 ? (
                  <Alert severity='warning' action={
                    <Button
                      color='inherit'
                      size='small'
                      onClick={() => router.push(`/${locale}/whatsapp/templates`)}
                    >
                      Go to Templates
                    </Button>
                  }>
                    No approved templates found. You need to create templates first and wait for Meta approval before creating campaigns.
                  </Alert>
                ) : (
                  <FormControl fullWidth>
                    <InputLabel>Message Template *</InputLabel>
                    <Select
                      value={selectedTemplate?.id || ''}
                      label='Message Template *'
                      onChange={e => {
                        const t = templates.find(t => t.id === Number(e.target.value))

                        setSelectedTemplate(t || null)
                        setTemplateVarValues({})
                      }}
                    >
                      {loadingTemplates ? (
                        <MenuItem disabled>
                          <CircularProgress size={18} className='mr-2' /> Loading templates...
                        </MenuItem>
                      ) : (
                        approvedTemplates.map(t => (
                          <MenuItem key={t.id} value={t.id}>
                            <div>
                              <Typography>{t.name}</Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {t.category} · {t.language}
                              </Typography>
                            </div>
                          </MenuItem>
                        ))
                      )}
                    </Select>
                  </FormControl>
                )}

                {/* Template Variable Editing */}
                {selectedTemplate && templateVars.length > 0 && (
                  <Box className='p-4 rounded' sx={{ backgroundColor: 'primary.lighter', border: '1px solid', borderColor: 'primary.light' }}>
                    <Typography variant='subtitle2' className='mb-1' color='primary.main'>
                      <i className='tabler-edit mr-1' />
                      Fill Template Variables
                    </Typography>
                    <Typography variant='caption' color='text.secondary' className='mb-3 block'>
                      Enter values for each variable or use a contact field (e.g. name, phone) for personalization.
                    </Typography>
                    <div className='flex flex-col gap-3'>
                      {templateVars.map((v, idx) => (
                        <div key={v} className='flex items-center gap-3'>
                          <Chip label={v} size='small' color='primary' variant='outlined' sx={{ minWidth: 55 }} />
                          <TextField
                            fullWidth
                            size='small'
                            label={`Value for ${v}`}
                            placeholder={`e.g. ${idx === 0 ? 'Customer Name' : idx === 1 ? 'Your message here' : 'Valid date'}`}
                            value={templateVarValues[v] || ''}
                            onChange={e => setTemplateVarValues(prev => ({ ...prev, [v]: e.target.value }))}
                          />
                          <FormControl size='small' sx={{ minWidth: 140 }}>
                            <InputLabel>Or use field</InputLabel>
                            <Select
                              value={templateVarValues[`_field_${v}`] || ''}
                              label='Or use field'
                              onChange={e => {
                                const field = e.target.value as string

                                if (field) {
                                  setTemplateVarValues(prev => ({
                                    ...prev,
                                    [v]: `{{${field}}}`,
                                    [`_field_${v}`]: field
                                  }))
                                } else {
                                  setTemplateVarValues(prev => {
                                    const next = { ...prev }

                                    delete next[`_field_${v}`]
                                    next[v] = ''

                                    return next
                                  })
                                }
                              }}
                            >
                              <MenuItem value=''><em>Static value</em></MenuItem>
                              <MenuItem value='name'>Contact Name</MenuItem>
                              <MenuItem value='phone'>Phone Number</MenuItem>
                              <MenuItem value='email'>Email</MenuItem>
                            </Select>
                          </FormControl>
                        </div>
                      ))}
                    </div>
                  </Box>
                )}

                {/* Live Template Preview */}
                {selectedTemplate && (
                  <Box className='p-4 rounded' sx={{ backgroundColor: '#DCF8C6', border: '1px solid #c5e1a5', borderRadius: '12px' }}>
                    <div className='flex items-center gap-2 mb-2'>
                      <i className='tabler-brand-whatsapp' style={{ color: '#25D366', fontSize: 20 }} />
                      <Typography variant='subtitle2'>Message Preview</Typography>
                    </div>
                    {selectedTemplate.header_text && (
                      <Typography variant='body2' className='font-bold mb-1'>
                        {(() => {
                          let text = selectedTemplate.header_text

                          templateVars.forEach(v => {
                            const val = templateVarValues[v]

                            if (val && !val.startsWith('{{')) text = text.replace(v, val)
                          })

                          return text
                        })()}
                      </Typography>
                    )}
                    <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {(() => {
                        let text = selectedTemplate.body_text

                        templateVars.forEach(v => {
                          const val = templateVarValues[v]

                          if (val && !val.startsWith('{{')) {
                            text = text.replace(v, val)
                          }
                        })

                        return text
                      })()}
                    </Typography>
                    {selectedTemplate.footer_text && (
                      <Typography variant='caption' color='text.secondary' className='mt-2 block'>
                        {selectedTemplate.footer_text}
                      </Typography>
                    )}
                    {selectedTemplate.buttons && selectedTemplate.buttons.length > 0 && (
                      <div className='flex gap-2 mt-2 pt-2' style={{ borderTop: '1px solid #b5d6a3' }}>
                        {selectedTemplate.buttons.map((btn: any, idx: number) => (
                          <Chip
                            key={idx}
                            label={btn.text || btn.label || `Button ${idx + 1}`}
                            size='small'
                            variant='outlined'
                            sx={{ borderColor: '#25D366', color: '#25D366' }}
                          />
                        ))}
                      </div>
                    )}
                  </Box>
                )}

                <Divider />

                {/* Target Audience */}
                <Typography variant='subtitle1'>Target Audience</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Filter contacts by tags or groups. Leave empty to send to all opted-in contacts.
                </Typography>

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
                  options={[]}
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
                      helperText='Only contacts with these tags will receive the campaign'
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
                    onClick={() => router.push(`/${locale}/whatsapp/campaigns`)}
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
                  <Typography variant='body2'>Choose a campaign name and select an approved template</Typography>
                </div>
                <div className='flex gap-2'>
                  <Chip label='2' size='small' color='primary' />
                  <Typography variant='body2'>Fill in template variables with static values or use contact fields for personalization</Typography>
                </div>
                <div className='flex gap-2'>
                  <Chip label='3' size='small' color='primary' />
                  <Typography variant='body2'>Optionally filter your audience by tags</Typography>
                </div>
                <div className='flex gap-2'>
                  <Chip label='4' size='small' color='primary' />
                  <Typography variant='body2'>Click &quot;Create Campaign&quot; to save as draft, or &quot;Send Now&quot; to send immediately</Typography>
                </div>

                <Alert severity='warning' className='mt-2'>
                  Only opted-in contacts will receive messages. Make sure your contacts have consented to receive WhatsApp messages.
                </Alert>
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

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
              This will create the campaign and <strong>immediately start sending</strong> messages to all targeted contacts.
            </Typography>
            <Box className='p-3 rounded' sx={{ backgroundColor: 'action.hover' }}>
              <Typography variant='body2'><strong>Campaign:</strong> {name}</Typography>
              <Typography variant='body2'><strong>Template:</strong> {selectedTemplate?.name}</Typography>
              {templateVars.length > 0 && (
                <Typography variant='body2'>
                  <strong>Variables:</strong> {templateVars.map(v => `${v} = "${templateVarValues[v] || '(empty)'}"`).join(', ')}
                </Typography>
              )}
              <Typography variant='body2'>
                <strong>Audience:</strong> {tags.length > 0 || selectedGroups.length > 0
                  ? [
                      tags.length > 0 ? `Tags: ${tags.join(', ')}` : '',
                      selectedGroups.length > 0 ? `Groups: ${availableGroups.filter(g => selectedGroups.includes(g.id)).map(g => g.name).join(', ')}` : ''
                    ].filter(Boolean).join(' + ')
                  : 'All opted-in contacts'}
              </Typography>
            </Box>
            <Alert severity='warning'>
              Messages will be sent immediately. Make sure your template and audience are correct.
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

export default WACreateCampaign
