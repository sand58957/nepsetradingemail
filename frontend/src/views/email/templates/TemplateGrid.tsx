'use client'

// React Imports
import { useState, useEffect, useCallback } from 'react'

// Next Imports
import { useParams } from 'next/navigation'
import Link from 'next/link'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

// Hook Imports
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Type Imports
import type { ContentType, Template } from '@/types/email'

// Service Imports
import templateService from '@/services/templates'

const typeIconMap: Record<ContentType, string> = {
  richtext: 'tabler-text-wrap',
  html: 'tabler-code',
  markdown: 'tabler-markdown',
  plain: 'tabler-file-text'
}

const typeColorMap: Record<ContentType, 'primary' | 'info' | 'warning' | 'secondary'> = {
  richtext: 'primary',
  html: 'info',
  markdown: 'warning',
  plain: 'secondary'
}

const TemplateGrid = () => {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingTemplate, setDeletingTemplate] = useState<Template | null>(null)
  const [creating, setCreating] = useState(false)

  // SendGrid Import
  const [sendGridDialogOpen, setSendGridDialogOpen] = useState(false)
  const [sendGridTemplates, setSendGridTemplates] = useState<any[]>([])
  const [sendGridLoading, setSendGridLoading] = useState(false)
  const [sendGridImporting, setSendGridImporting] = useState(false)
  const [selectedSendGrid, setSelectedSendGrid] = useState<string[]>([])

  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: 'richtext' as ContentType
  })

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const isMobile = useMobileBreakpoint()
  const { lang: locale } = useParams()

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true)

      const response = await templateService.getAll()

      setTemplates(response.data || [])
    } catch (err) {
      console.error('Failed to fetch templates:', err)
      setSnackbar({ open: true, message: 'Failed to load templates', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  const handleCreate = async () => {
    if (!newTemplate.name.trim()) return

    try {
      setCreating(true)

      await templateService.create({
        name: newTemplate.name.trim(),
        type: newTemplate.type,
        body: ''
      })

      setCreateDialogOpen(false)
      setNewTemplate({ name: '', type: 'richtext' })
      setSnackbar({ open: true, message: 'Template created successfully', severity: 'success' })
      fetchTemplates()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to create template',
        severity: 'error'
      })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingTemplate) return

    try {
      await templateService.delete(deletingTemplate.id)
      setDeleteDialogOpen(false)
      setDeletingTemplate(null)
      setSnackbar({ open: true, message: 'Template deleted', severity: 'success' })
      fetchTemplates()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to delete template',
        severity: 'error'
      })
    }
  }

  const handleSetDefault = async (id: number) => {
    try {
      await templateService.setDefault(id)
      setSnackbar({ open: true, message: 'Default template updated', severity: 'success' })
      fetchTemplates()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to set default template',
        severity: 'error'
      })
    }
  }

  // SendGrid Import handlers
  const handleOpenSendGrid = async () => {
    setSendGridDialogOpen(true)
    setSendGridLoading(true)
    setSelectedSendGrid([])

    try {
      const response = await templateService.listSendGrid()

      setSendGridTemplates(response.data || [])
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to load SendGrid templates',
        severity: 'error'
      })
      setSendGridDialogOpen(false)
    } finally {
      setSendGridLoading(false)
    }
  }

  const handleToggleSendGrid = (id: string) => {
    setSelectedSendGrid(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    )
  }

  const handleImportSendGrid = async () => {
    setSendGridImporting(true)

    try {
      const ids = selectedSendGrid.length > 0 ? selectedSendGrid : undefined
      const response = await templateService.importSendGrid(ids)
      const result = response.data

      setSendGridDialogOpen(false)
      setSnackbar({
        open: true,
        message: `Imported ${result.imported} template(s)${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`,
        severity: 'success'
      })
      fetchTemplates()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to import SendGrid templates',
        severity: 'error'
      })
    } finally {
      setSendGridImporting(false)
    }
  }

  if (loading && templates.length === 0) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={32} />
        <Typography className='ml-3' color='text.secondary'>Loading templates...</Typography>
      </div>
    )
  }

  return (
    <>
      <Card className='mb-6'>
        <CardHeader
          title='Email Templates'
          sx={{ flexWrap: 'wrap', rowGap: 2 }}
          action={
            <div className='flex gap-2 flex-wrap'>
              <Button
                variant='outlined'
                startIcon={<i className='tabler-download' />}
                onClick={handleOpenSendGrid}
              >
                Import from SendGrid
              </Button>
              <Button
                variant='contained'
                startIcon={<i className='tabler-plus' />}
                onClick={() => setCreateDialogOpen(true)}
              >
                Create Template
              </Button>
            </div>
          }
        />
        <CardContent>
          <TextField
            size='small'
            placeholder='Search templates...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='max-sm:is-full min-is-[300px]'
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='tabler-search' />
                </InputAdornment>
              )
            }}
          />
        </CardContent>
      </Card>

      {filteredTemplates.length === 0 && !loading ? (
        <Card>
          <CardContent className='text-center py-8'>
            <Typography color='text.secondary'>
              {search ? 'No templates match your search' : 'No templates yet. Create your first template to get started.'}
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={6}>
          {filteredTemplates.map(template => (
            <Grid key={template.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card className='h-full flex flex-col'>
                <CardContent className='grow'>
                  <div className='flex items-start justify-between mb-4'>
                    <CustomAvatar color={typeColorMap[template.type] || 'primary'} skin='light' variant='rounded' size={44}>
                      <i className={`${typeIconMap[template.type] || 'tabler-file'} text-[24px]`} />
                    </CustomAvatar>
                    {template.is_default && (
                      <Chip label='Default' color='primary' size='small' variant='tonal' />
                    )}
                  </div>
                  <Typography variant='h6' className='mb-1'>
                    {template.name}
                  </Typography>
                  <div className='flex gap-2 mb-3'>
                    <Chip
                      label={(template.type || 'html').toUpperCase()}
                      size='small'
                      variant='outlined'
                      color={typeColorMap[template.type] || 'primary'}
                    />
                  </div>
                  {template.subject && (
                    <Typography variant='body2' color='text.secondary'>
                      Subject: {template.subject}
                    </Typography>
                  )}
                </CardContent>
                <Divider />
                <CardActions className='flex justify-between'>
                  <Typography variant='caption' color='text.secondary'>
                    Updated {new Date(template.updated_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric'
                    })}
                  </Typography>
                  <div className='flex gap-1'>
                    {!template.is_default && (
                      <Tooltip title='Set as Default'>
                        <IconButton size='small' onClick={() => handleSetDefault(template.id)}>
                          <i className='tabler-star text-[20px]' />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title='Edit'>
                      <IconButton size='small' component={Link} href={`/${locale}/templates/editor/${template.id}`}>
                        <i className='tabler-pencil text-[20px]' />
                      </IconButton>
                    </Tooltip>
                    {!template.is_default && (
                      <Tooltip title='Delete'>
                        <IconButton
                          size='small'
                          onClick={() => {
                            setDeletingTemplate(template)
                            setDeleteDialogOpen(true)
                          }}
                        >
                          <i className='tabler-trash text-[20px]' />
                        </IconButton>
                      </Tooltip>
                    )}
                  </div>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth='sm' fullWidth fullScreen={isMobile}>
        <DialogTitle>Create New Template</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pt-2'>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Template Name'
                placeholder='e.g. Monthly Newsletter'
                value={newTemplate.name}
                onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Content Type</InputLabel>
                <Select
                  value={newTemplate.type}
                  label='Content Type'
                  onChange={e => setNewTemplate({ ...newTemplate, type: e.target.value as ContentType })}
                >
                  <MenuItem value='richtext'>Rich Text</MenuItem>
                  <MenuItem value='html'>HTML</MenuItem>
                  <MenuItem value='markdown'>Markdown</MenuItem>
                  <MenuItem value='plain'>Plain Text</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} color='secondary'>
            Cancel
          </Button>
          <Button onClick={handleCreate} variant='contained' disabled={!newTemplate.name.trim() || creating}>
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullScreen={isMobile}>
        <DialogTitle>Delete Template</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deletingTemplate?.name}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color='error' variant='contained'>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* SendGrid Import Dialog */}
      <Dialog open={sendGridDialogOpen} onClose={() => setSendGridDialogOpen(false)} maxWidth='sm' fullWidth fullScreen={isMobile}>
        <DialogTitle>Import from SendGrid</DialogTitle>
        <DialogContent>
          {sendGridLoading ? (
            <div className='flex justify-center items-center py-8'>
              <CircularProgress size={32} />
              <Typography className='ml-3' color='text.secondary'>Loading SendGrid templates...</Typography>
            </div>
          ) : sendGridTemplates.length === 0 ? (
            <Typography color='text.secondary' className='py-4'>
              No dynamic templates found in your SendGrid account.
            </Typography>
          ) : (
            <>
              <DialogContentText className='mb-4'>
                Select templates to import from SendGrid. The active version of each template will be imported.
              </DialogContentText>
              {sendGridTemplates.map((tpl: any) => {
                const activeVersion = tpl.versions?.find((v: any) => v.active === 1) || tpl.versions?.[0]
                const isSelected = selectedSendGrid.includes(tpl.id)

                return (
                  <Card
                    key={tpl.id}
                    className='mb-3 cursor-pointer'
                    onClick={() => handleToggleSendGrid(tpl.id)}
                    sx={{
                      border: '2px solid',
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      backgroundColor: isSelected ? 'primary.lighter' : 'background.paper',
                      transition: 'all 0.2s'
                    }}
                  >
                    <CardContent className='flex items-center gap-4'>
                      <div className='flex items-center'>
                        <input
                          type='checkbox'
                          checked={isSelected}
                          onChange={() => handleToggleSendGrid(tpl.id)}
                          onClick={e => e.stopPropagation()}
                          style={{ width: 18, height: 18 }}
                        />
                      </div>
                      {activeVersion?.thumbnail_url && (
                        <img
                          src={`https:${activeVersion.thumbnail_url}`}
                          alt={tpl.name}
                          style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--mui-palette-divider)' }}
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                        />
                      )}
                      <div className='grow'>
                        <Typography className='font-medium'>{tpl.name}</Typography>
                        {activeVersion && (
                          <Typography variant='body2' color='text.secondary'>
                            Subject: {activeVersion.subject || 'N/A'}
                          </Typography>
                        )}
                        <div className='flex gap-1 mt-1'>
                          <Chip label={tpl.generation || 'dynamic'} size='small' variant='outlined' color='info' />
                          <Chip
                            label={`${tpl.versions?.length || 0} version(s)`}
                            size='small'
                            variant='outlined'
                            color='secondary'
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSendGridDialogOpen(false)} color='secondary'>
            Cancel
          </Button>
          <Button
            onClick={handleImportSendGrid}
            variant='contained'
            disabled={sendGridImporting || sendGridLoading || sendGridTemplates.length === 0}
            startIcon={sendGridImporting ? <CircularProgress size={18} /> : <i className='tabler-download' />}
          >
            {sendGridImporting ? 'Importing...' : selectedSendGrid.length > 0 ? `Import Selected (${selectedSendGrid.length})` : 'Import All'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity} variant='filled'>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default TemplateGrid
