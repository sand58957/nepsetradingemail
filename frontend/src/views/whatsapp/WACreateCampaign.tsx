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

// Service Imports
import whatsappService from '@/services/whatsapp'

// Type Imports
import type { WATemplate } from '@/types/whatsapp'

const WACreateCampaign = () => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  // Form state
  const [name, setName] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<WATemplate | null>(null)
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')

  // Data
  const [templates, setTemplates] = useState<WATemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(true)

  // UI
  const [creating, setCreating] = useState(false)
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

    fetchTemplates()
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
      const payload: any = {
        name: name.trim(),
        template_id: selectedTemplate.id,
        target_filter: {} as Record<string, any>,
        scheduled_at: scheduledAt || undefined
      }

      if (tags.length > 0) {
        payload.target_filter.tags = tags
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
                <FormControl fullWidth>
                  <InputLabel>Message Template *</InputLabel>
                  <Select
                    value={selectedTemplate?.id || ''}
                    label='Message Template *'
                    onChange={e => {
                      const t = templates.find(t => t.id === Number(e.target.value))

                      setSelectedTemplate(t || null)
                    }}
                  >
                    {loadingTemplates ? (
                      <MenuItem disabled>
                        <CircularProgress size={18} className='mr-2' /> Loading templates...
                      </MenuItem>
                    ) : approvedTemplates.length === 0 ? (
                      <MenuItem disabled>No approved templates found. Sync templates first.</MenuItem>
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

                {/* Template Preview */}
                {selectedTemplate && (
                  <Box className='p-4 rounded' sx={{ backgroundColor: 'action.hover' }}>
                    <Typography variant='subtitle2' className='mb-2'>Template Preview</Typography>
                    {selectedTemplate.header_text && (
                      <Typography variant='body2' className='font-bold mb-1'>{selectedTemplate.header_text}</Typography>
                    )}
                    <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap' }}>{selectedTemplate.body_text}</Typography>
                    {selectedTemplate.footer_text && (
                      <Typography variant='caption' color='text.secondary' className='mt-1 block'>
                        {selectedTemplate.footer_text}
                      </Typography>
                    )}
                    {templateVars.length > 0 && (
                      <Alert severity='info' className='mt-2'>
                        This template has {templateVars.length} variable(s): {templateVars.join(', ')}
                      </Alert>
                    )}
                  </Box>
                )}

                <Divider />

                {/* Target Audience */}
                <Typography variant='subtitle1'>Target Audience</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Filter contacts by tags. Leave empty to send to all opted-in contacts.
                </Typography>

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
                <div className='flex gap-3 mt-2'>
                  <Button
                    variant='contained'
                    color='success'
                    onClick={handleCreate}
                    disabled={creating}
                    startIcon={creating ? <CircularProgress size={18} /> : <i className='tabler-plus' />}
                  >
                    {creating ? 'Creating...' : 'Create Campaign'}
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
                  <Typography variant='body2'>Optionally filter your audience by tags</Typography>
                </div>
                <div className='flex gap-2'>
                  <Chip label='3' size='small' color='primary' />
                  <Typography variant='body2'>Create the campaign (it starts as &quot;draft&quot;)</Typography>
                </div>
                <div className='flex gap-2'>
                  <Chip label='4' size='small' color='primary' />
                  <Typography variant='body2'>Test with a single number, then send to all targets</Typography>
                </div>

                <Alert severity='warning' className='mt-2'>
                  Only opted-in contacts will receive messages. Make sure your contacts have consented to receive WhatsApp messages.
                </Alert>
              </div>
            </CardContent>
          </Card>
        </Grid>
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

export default WACreateCampaign
