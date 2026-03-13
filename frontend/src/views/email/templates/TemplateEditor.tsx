'use client'

// React Imports
import { useState, useEffect, useCallback } from 'react'

// Next Imports
import { useParams, useRouter } from 'next/navigation'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

// Type Imports
import type { ContentType, Template } from '@/types/email'

// Service Imports
import templateService from '@/services/templates'

// Utils
import type { Locale } from '@configs/i18n'
import { getLocalizedUrl } from '@/utils/i18n'

// Hook Imports
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'

interface TemplateEditorProps {
  id: string
}

const defaultBody = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ .Campaign.Subject }}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <tr>
      <td style="padding: 20px; background-color: #7c3aed; text-align: center;">
        <h1 style="color: #ffffff; margin: 0;">{{ .Campaign.Subject }}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 30px; background-color: #ffffff;">
        <p>Hello {{ .Subscriber.Name }},</p>
        <p>Your email content goes here.</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px; background-color: #f3f4f6; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #6b7280;">
          <a href="{{ UnsubscribeURL . }}">Unsubscribe</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`

const TemplateEditor = ({ id }: TemplateEditorProps) => {
  const isNewTemplate = id === 'new'
  const templateId = isNewTemplate ? null : parseInt(id, 10)
  const router = useRouter()
  const { lang: locale } = useParams()
  const isMobile = useMobileBreakpoint()

  const [loading, setLoading] = useState(!isNewTemplate)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [contentType, setContentType] = useState<ContentType>('html')
  const [body, setBody] = useState(isNewTemplate ? defaultBody : '')
  const [originalBody, setOriginalBody] = useState('')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [testEmailOpen, setTestEmailOpen] = useState(false)
  const [testEmail, setTestEmail] = useState('')

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  // Fetch existing template data
  const fetchTemplate = useCallback(async () => {
    if (!templateId || isNaN(templateId)) return

    try {
      setLoading(true)
      const response = await templateService.getById(templateId)
      const tpl: Template = response.data

      setName(tpl.name || '')
      setSubject(tpl.subject || '')
      setContentType(tpl.type || 'html')
      setBody(tpl.body || '')
      setOriginalBody(tpl.body || '')
    } catch (err) {
      console.error('Failed to fetch template:', err)
      setSnackbar({ open: true, message: 'Failed to load template', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [templateId])

  useEffect(() => {
    if (!isNewTemplate) {
      fetchTemplate()
    }
  }, [isNewTemplate, fetchTemplate])

  // Save template
  const handleSave = async () => {
    if (!name.trim()) {
      setSnackbar({ open: true, message: 'Template name is required', severity: 'error' })
      return
    }

    if (!body.trim()) {
      setSnackbar({ open: true, message: 'Template body is required', severity: 'error' })
      return
    }

    try {
      setSaving(true)

      if (isNewTemplate) {
        const response = await templateService.create({
          name: name.trim(),
          type: contentType,
          subject: subject.trim() || undefined,
          body
        })

        setSnackbar({ open: true, message: 'Template created successfully', severity: 'success' })

        // Navigate to edit page for the newly created template
        const newId = response.data?.id

        if (newId) {
          router.push(getLocalizedUrl(`/templates/editor/${newId}`, locale as Locale))
        }
      } else if (templateId) {
        await templateService.update(templateId, {
          name: name.trim(),
          type: contentType,
          subject: subject.trim() || undefined,
          body
        })

        setOriginalBody(body)
        setSnackbar({ open: true, message: 'Template saved successfully', severity: 'success' })
      }
    } catch (err) {
      console.error('Failed to save template:', err)
      setSnackbar({ open: true, message: 'Failed to save template', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Preview template
  const handlePreview = async () => {
    if (isNewTemplate || !templateId) {
      // For new templates, just show raw HTML in preview
      setPreviewHtml(body)
      setPreviewOpen(true)
      return
    }

    try {
      setPreviewLoading(true)
      const response = await templateService.preview(templateId)

      setPreviewHtml(response.data || body)
      setPreviewOpen(true)
    } catch {
      // Fallback to raw body if preview endpoint fails
      setPreviewHtml(body)
      setPreviewOpen(true)
    } finally {
      setPreviewLoading(false)
    }
  }

  // Reset body to original
  const handleReset = () => {
    if (isNewTemplate) {
      setBody(defaultBody)
    } else {
      setBody(originalBody)
    }

    setSnackbar({ open: true, message: 'Template body reset', severity: 'success' })
  }

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={32} />
        <Typography className='ml-3' color='text.secondary'>Loading template...</Typography>
      </div>
    )
  }

  return (
    <>
      <Grid container spacing={6}>
        {/* Template Details */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardHeader
              title={isNewTemplate ? 'New Template' : 'Edit Template'}
              subheader={isNewTemplate ? undefined : `Template #${id}`}
            />
            <CardContent className='flex flex-col gap-4'>
              <TextField
                fullWidth
                label='Template Name'
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder='Enter template name'
              />
              <TextField
                fullWidth
                label='Default Subject (Optional)'
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder='Enter default subject'
              />
              <FormControl fullWidth>
                <InputLabel>Content Type</InputLabel>
                <Select
                  value={contentType}
                  label='Content Type'
                  onChange={e => setContentType(e.target.value as ContentType)}
                >
                  <MenuItem value='richtext'>Rich Text</MenuItem>
                  <MenuItem value='html'>HTML</MenuItem>
                  <MenuItem value='markdown'>Markdown</MenuItem>
                  <MenuItem value='plain'>Plain Text</MenuItem>
                </Select>
              </FormControl>

              <Divider />

              <Typography variant='subtitle2' color='text.secondary'>
                Available Variables
              </Typography>
              <div className='flex flex-wrap gap-1'>
                {[
                  '{{ .Subscriber.Name }}',
                  '{{ .Subscriber.Email }}',
                  '{{ .Campaign.Subject }}',
                  '{{ UnsubscribeURL . }}',
                  '{{ TrackLink . "URL" }}',
                  '{{ MessageURL . }}'
                ].map(variable => (
                  <Chip
                    key={variable}
                    label={variable}
                    size='small'
                    variant='outlined'
                    className='cursor-pointer'
                    onClick={() => setBody(prev => prev + variable)}
                  />
                ))}
              </div>

              <Divider />

              <div className='flex gap-2'>
                <Button
                  variant='contained'
                  fullWidth
                  startIcon={saving ? <CircularProgress size={16} color='inherit' /> : <i className='tabler-device-floppy' />}
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  variant='outlined'
                  fullWidth
                  startIcon={previewLoading ? <CircularProgress size={16} /> : <i className='tabler-eye' />}
                  onClick={handlePreview}
                  disabled={previewLoading}
                >
                  Preview
                </Button>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Template Editor */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader
              title='Template Body'
              action={
                <Chip
                  label={contentType.toUpperCase()}
                  color='primary'
                  size='small'
                  variant='tonal'
                />
              }
            />
            <CardContent>
              <TextField
                fullWidth
                multiline
                minRows={25}
                maxRows={40}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder='Enter your template content...'
                sx={{
                  '& .MuiInputBase-input': {
                    fontFamily: contentType === 'html' || contentType === 'markdown' ? 'monospace' : 'inherit',
                    fontSize: contentType === 'html' ? '13px' : '14px'
                  }
                }}
              />
              <div className='flex justify-between items-center mt-4 flex-wrap gap-2'>
                <Typography variant='caption' color='text.secondary'>
                  {body.length} characters
                </Typography>
                <div className='flex gap-2'>
                  <Button variant='outlined' size='small' color='secondary' onClick={handleReset}>
                    Reset
                  </Button>
                  <Button
                    variant='outlined'
                    size='small'
                    startIcon={<i className='tabler-send' />}
                    onClick={() => setTestEmailOpen(true)}
                  >
                    Send Test
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth='md' fullWidth fullScreen={isMobile}>
        <DialogTitle>Template Preview</DialogTitle>
        <DialogContent>
          <div
            style={{ border: '1px solid #e5e7eb', borderRadius: 4, overflow: 'auto', minHeight: 300 }}
          >
            <iframe
              srcDoc={previewHtml}
              title='Template Preview'
              style={{ width: '100%', minHeight: 400, border: 'none' }}
              sandbox='allow-same-origin'
            />
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Send Test Email Dialog */}
      <Dialog open={testEmailOpen} onClose={() => setTestEmailOpen(false)} maxWidth='sm' fullWidth fullScreen={isMobile}>
        <DialogTitle>Send Test Email</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            {isNewTemplate
              ? 'Please save the template first before sending a test email.'
              : 'Enter the email address to send a test email to.'}
          </Typography>
          {!isNewTemplate && (
            <TextField
              fullWidth
              label='Email Address'
              type='email'
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder='test@example.com'
              autoFocus
              sx={{ mt: 1 }}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTestEmailOpen(false)} color='secondary'>Cancel</Button>
          {!isNewTemplate && (
            <Button
              variant='contained'
              disabled={!testEmail.trim()}
              onClick={() => {
                setTestEmailOpen(false)
                setSnackbar({ open: true, message: 'Test email functionality requires campaign context', severity: 'info' as any })
              }}
            >
              Send Test
            </Button>
          )}
        </DialogActions>
      </Dialog>

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

export default TemplateEditor
