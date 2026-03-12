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
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Divider from '@mui/material/Divider'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'

// Service Imports
import whatsappService from '@/services/whatsapp'

// Type Imports
import type { WATemplate } from '@/types/whatsapp'

const statusColorMap: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  APPROVED: 'success',
  approved: 'success',
  PENDING: 'warning',
  pending: 'warning',
  REJECTED: 'error',
  rejected: 'error'
}

const categoryColorMap: Record<string, 'primary' | 'info' | 'warning' | 'default'> = {
  MARKETING: 'primary',
  UTILITY: 'info',
  AUTHENTICATION: 'warning'
}

const WATemplateList = () => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  const [templates, setTemplates] = useState<WATemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    category: 'MARKETING',
    language: 'en',
    body: '',
    example: ''
  })

  // Delete dialog
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const fetchTemplates = async () => {
    setLoading(true)

    try {
      const response = await whatsappService.getTemplates()

      setTemplates(response.data || [])
    } catch {
      setSnackbar({ open: true, message: 'Failed to fetch templates', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTemplates()
  }, [])

  const handleSync = async () => {
    setSyncing(true)

    try {
      const response = await whatsappService.syncTemplates()

      setSnackbar({
        open: true,
        message: response.data.total === 0
          ? 'No templates found in Gupshup. Create templates first, then sync.'
          : `Synced ${response.data.synced} templates (${response.data.total} total from Gupshup)`,
        severity: response.data.total === 0 ? 'info' : 'success'
      })
      fetchTemplates()
    } catch {
      setSnackbar({ open: true, message: 'Failed to sync templates. Check your API settings.', severity: 'error' })
    } finally {
      setSyncing(false)
    }
  }

  const handleCreate = async () => {
    if (!newTemplate.name.trim() || !newTemplate.body.trim()) {
      setSnackbar({ open: true, message: 'Template name and body are required', severity: 'error' })

      return
    }

    // Validate name: lowercase, underscores, no spaces
    const nameRegex = /^[a-z0-9_]+$/

    if (!nameRegex.test(newTemplate.name)) {
      setSnackbar({ open: true, message: 'Template name must be lowercase with underscores only (e.g. welcome_message)', severity: 'error' })

      return
    }

    setCreating(true)

    try {
      // Auto-generate example by replacing {{1}}, {{2}} etc with sample values
      let example = newTemplate.example

      if (!example) {
        example = newTemplate.body.replace(/\{\{(\d+)\}\}/g, (_match, num) => {
          const samples = ['John', 'NepseTrading', '10%', 'March 2026', 'www.example.com']

          return samples[parseInt(num) - 1] || `Sample${num}`
        })
      }

      await whatsappService.createTemplate({
        ...newTemplate,
        example
      })

      setSnackbar({ open: true, message: 'Template created and submitted for Meta approval!', severity: 'success' })
      setCreateOpen(false)
      setNewTemplate({ name: '', category: 'MARKETING', language: 'en', body: '', example: '' })
      fetchTemplates()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to create template'

      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return

    setDeleting(true)

    try {
      await whatsappService.deleteTemplate(deleteId)
      setSnackbar({ open: true, message: 'Template deleted', severity: 'success' })
      setDeleteId(null)
      fetchTemplates()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete template', severity: 'error' })
    } finally {
      setDeleting(false)
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
                  <Typography variant='h5'>WhatsApp Templates</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Pre-approved message templates from your Gupshup account
                  </Typography>
                </div>
                <div className='flex gap-2'>
                  <Button
                    variant='contained'
                    color='info'
                    onClick={() => router.push(`/${locale}/whatsapp/templates/library`)}
                    startIcon={<i className='tabler-books' />}
                  >
                    Template Library
                  </Button>
                  <Button
                    variant='contained'
                    color='success'
                    onClick={() => setCreateOpen(true)}
                    startIcon={<i className='tabler-plus' />}
                  >
                    Create Template
                  </Button>
                  <Button
                    variant='contained'
                    onClick={handleSync}
                    disabled={syncing}
                    startIcon={syncing ? <CircularProgress size={18} /> : <i className='tabler-refresh' />}
                  >
                    {syncing ? 'Syncing...' : 'Sync Templates'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Templates */}
        {loading ? (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent>
                <Box display='flex' justifyContent='center' p={4}>
                  <CircularProgress />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ) : templates.length === 0 ? (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent className='text-center py-12'>
                <i className='tabler-template text-[48px] mb-4' style={{ color: 'var(--mui-palette-text-secondary)' }} />
                <Typography variant='h6' className='mb-2'>No Templates Found</Typography>
                <Typography color='text.secondary' className='mb-4'>
                  You need to create message templates before sending WhatsApp campaigns.
                  <br />
                  Templates must be approved by Meta (usually takes a few minutes).
                </Typography>
                <div className='flex justify-center gap-3'>
                  <Button
                    variant='contained'
                    color='success'
                    onClick={() => setCreateOpen(true)}
                    startIcon={<i className='tabler-plus' />}
                  >
                    Create Template
                  </Button>
                  <Button
                    variant='outlined'
                    onClick={handleSync}
                    disabled={syncing}
                    startIcon={<i className='tabler-refresh' />}
                  >
                    Sync from Gupshup
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          templates.map(template => (
            <Grid key={template.id} size={{ xs: 12, md: 6 }}>
              <Card>
                <CardHeader
                  title={
                    <div className='flex items-center gap-2 flex-wrap'>
                      <Typography variant='h6'>{template.name}</Typography>
                      <Chip
                        label={template.status.toUpperCase()}
                        color={statusColorMap[template.status] || 'default'}
                        size='small'
                        variant='tonal'
                      />
                    </div>
                  }
                  subheader={
                    <div className='flex items-center gap-2 mt-1'>
                      <Chip
                        label={template.category}
                        color={categoryColorMap[template.category] || 'default'}
                        size='small'
                        variant='outlined'
                      />
                      <Chip
                        label={template.language}
                        size='small'
                        variant='outlined'
                      />
                      {template.gupshup_id && (
                        <Typography variant='caption' color='text.secondary'>
                          ID: {template.gupshup_id}
                        </Typography>
                      )}
                    </div>
                  }
                  action={
                    <IconButton
                      color='error'
                      size='small'
                      onClick={() => setDeleteId(template.id)}
                      title='Delete template'
                    >
                      <i className='tabler-trash' />
                    </IconButton>
                  }
                />
                <CardContent>
                  {/* Header */}
                  {template.header_type && template.header_type !== 'none' && template.header_type !== '' && (
                    <>
                      <Typography variant='caption' color='text.secondary'>
                        Header ({template.header_type})
                      </Typography>
                      <Typography variant='body2' className='mb-2'>
                        {template.header_text || `[${template.header_type} media]`}
                      </Typography>
                    </>
                  )}

                  {/* Body */}
                  <Typography variant='caption' color='text.secondary'>Body</Typography>
                  <Box
                    className='p-3 rounded mb-2'
                    sx={{ backgroundColor: 'action.hover', whiteSpace: 'pre-wrap' }}
                  >
                    <Typography variant='body2'>{template.body_text || 'No body text'}</Typography>
                  </Box>

                  {/* Footer */}
                  {template.footer_text && (
                    <>
                      <Typography variant='caption' color='text.secondary'>Footer</Typography>
                      <Typography variant='body2' color='text.secondary' className='mb-2'>
                        {template.footer_text}
                      </Typography>
                    </>
                  )}

                  {/* Buttons */}
                  {template.buttons && template.buttons.length > 0 && (
                    <>
                      <Divider className='my-2' />
                      <Typography variant='caption' color='text.secondary'>Buttons</Typography>
                      <div className='flex gap-1 mt-1 flex-wrap'>
                        {template.buttons.map((btn: any, i: number) => (
                          <Chip
                            key={i}
                            label={btn.text || btn.title || `Button ${i + 1}`}
                            size='small'
                            variant='outlined'
                            color='primary'
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Synced info */}
                  {template.synced_at && (
                    <Typography variant='caption' color='text.secondary' className='mt-3 block'>
                      Last synced: {new Date(template.synced_at).toLocaleString()}
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Create Template Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Create WhatsApp Template</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 mt-2'>
            <Alert severity='info'>
              Templates are submitted to Meta for approval. This usually takes a few minutes.
              Only approved templates can be used in campaigns.
            </Alert>
            <TextField
              fullWidth
              label='Template Name *'
              placeholder='e.g. welcome_message'
              value={newTemplate.name}
              onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') })}
              helperText='Lowercase letters, numbers, and underscores only'
            />
            <FormControl fullWidth>
              <InputLabel>Category *</InputLabel>
              <Select
                value={newTemplate.category}
                label='Category *'
                onChange={e => setNewTemplate({ ...newTemplate, category: e.target.value })}
              >
                <MenuItem value='MARKETING'>Marketing</MenuItem>
                <MenuItem value='UTILITY'>Utility</MenuItem>
                <MenuItem value='AUTHENTICATION'>Authentication</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Language</InputLabel>
              <Select
                value={newTemplate.language}
                label='Language'
                onChange={e => setNewTemplate({ ...newTemplate, language: e.target.value })}
              >
                <MenuItem value='en'>English</MenuItem>
                <MenuItem value='en_US'>English (US)</MenuItem>
                <MenuItem value='hi'>Hindi</MenuItem>
                <MenuItem value='ne'>Nepali</MenuItem>
              </Select>
            </FormControl>
            <TextField
              fullWidth
              multiline
              minRows={3}
              label='Message Body *'
              placeholder={'Hello {{1}}, Welcome to NepseTrading!\n\nCheck out our latest updates at {{2}}.'}
              value={newTemplate.body}
              onChange={e => setNewTemplate({ ...newTemplate, body: e.target.value })}
              helperText='Use {{1}}, {{2}}, etc. for dynamic variables'
            />
            <TextField
              fullWidth
              multiline
              minRows={2}
              label='Example (auto-generated if empty)'
              placeholder='Hello John, Welcome to NepseTrading! Check out our latest updates at www.example.com.'
              value={newTemplate.example}
              onChange={e => setNewTemplate({ ...newTemplate, example: e.target.value })}
              helperText='Example with real values replacing variables. Leave empty to auto-generate.'
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            color='success'
            onClick={handleCreate}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={18} /> : <i className='tabler-plus' />}
          >
            {creating ? 'Creating...' : 'Create & Submit'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteId !== null} onClose={() => setDeleteId(null)}>
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this template? This will also remove it from your Gupshup account.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button
            variant='contained'
            color='error'
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete'}
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

export default WATemplateList
