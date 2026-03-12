'use client'

// React Imports
import { useState, useEffect } from 'react'

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
  const [templates, setTemplates] = useState<WATemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)

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
        message: `Synced ${response.data.synced} templates (${response.data.total} total from Gupshup)`,
        severity: 'success'
      })
      fetchTemplates()
    } catch {
      setSnackbar({ open: true, message: 'Failed to sync templates. Check your API settings.', severity: 'error' })
    } finally {
      setSyncing(false)
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
                <Button
                  variant='contained'
                  onClick={handleSync}
                  disabled={syncing}
                  startIcon={syncing ? <CircularProgress size={18} /> : <i className='tabler-refresh' />}
                >
                  {syncing ? 'Syncing...' : 'Sync Templates'}
                </Button>
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
                  Click &quot;Sync Templates&quot; to fetch templates from your Gupshup account.
                </Typography>
                <Button
                  variant='contained'
                  onClick={handleSync}
                  disabled={syncing}
                  startIcon={<i className='tabler-refresh' />}
                >
                  Sync Now
                </Button>
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
