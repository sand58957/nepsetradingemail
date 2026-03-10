'use client'

import { useState, useEffect } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Autocomplete from '@mui/material/Autocomplete'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Switch from '@mui/material/Switch'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

import type { List, ImportWebhook } from '@/types/email'
import importService from '@/services/import'
import listService from '@/services/lists'
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'

interface WebhookImportProps {
  onWebhookChange?: () => void
}

const WebhookImport = ({ onWebhookChange }: WebhookImportProps) => {
  const [webhooks, setWebhooks] = useState<ImportWebhook[]>([])
  const [loading, setLoading] = useState(true)
  const [availableLists, setAvailableLists] = useState<List[]>([])
  const [listsLoading, setListsLoading] = useState(false)

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLists, setNewLists] = useState<List[]>([])
  const [creating, setCreating] = useState(false)

  // Created webhook display
  const [createdWebhook, setCreatedWebhook] = useState<ImportWebhook | null>(null)

  // Delete confirmation
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })
  const [copied, setCopied] = useState('')
  const isMobile = useMobileBreakpoint()

  const fetchWebhooks = async () => {
    try {
      const res = await importService.getWebhooks()

      setWebhooks(res.data || [])
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  const fetchLists = async () => {
    setListsLoading(true)

    try {
      const res = await listService.getAll({ per_page: 100 })

      setAvailableLists(res.data.results || [])
    } catch {
      // silently fail
    } finally {
      setListsLoading(false)
    }
  }

  useEffect(() => {
    fetchWebhooks()
    fetchLists()
  }, [])

  const getWebhookURL = (secret: string) => {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://nepalfillings.com/api'

    return `${apiBase}/webhooks/import/${secret}`
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)

    try {
      const res = await importService.createWebhook({
        name: newName,
        list_ids: newLists.map(l => l.id)
      })

      setCreatedWebhook(res.data)
      setCreateOpen(false)
      setNewName('')
      setNewLists([])
      fetchWebhooks()
      onWebhookChange?.()
      setSnackbar({ open: true, message: 'Webhook created successfully!', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to create webhook', severity: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (webhook: ImportWebhook) => {
    try {
      await importService.updateWebhook(webhook.id, {
        name: webhook.name,
        list_ids: webhook.list_ids || [],
        is_active: !webhook.is_active
      })

      fetchWebhooks()
      setSnackbar({
        open: true,
        message: `Webhook ${webhook.is_active ? 'disabled' : 'enabled'}`,
        severity: 'success'
      })
    } catch {
      setSnackbar({ open: true, message: 'Failed to update webhook', severity: 'error' })
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)

    try {
      await importService.deleteWebhook(deleteId)
      setDeleteOpen(false)
      setDeleteId(null)
      fetchWebhooks()
      onWebhookChange?.()
      setSnackbar({ open: true, message: 'Webhook deleted', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete webhook', severity: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      setTimeout(() => setCopied(''), 2000)
    } catch (_e) {
      // Clipboard API may not be available in non-HTTPS contexts
    }
  }

  const curlExample = (secret: string) =>
    `curl -X POST ${getWebhookURL(secret)} \\
  -H "Content-Type: application/json" \\
  -d '{"email": "user@example.com", "name": "User Name"}'`

  return (
    <Box className='flex flex-col gap-6'>
      {/* Webhook List */}
      <Box className='flex items-center justify-between'>
        <Typography variant='h6'>Configured Webhooks</Typography>
        <Button
          variant='contained'
          startIcon={<i className='tabler-plus' />}
          onClick={() => setCreateOpen(true)}
        >
          Create Webhook
        </Button>
      </Box>

      {/* Created Webhook Alert */}
      {createdWebhook && (
        <Alert
          severity='success'
          onClose={() => setCreatedWebhook(null)}
          sx={{ '& .MuiAlert-message': { width: '100%' } }}
        >
          <Typography variant='subtitle2' className='mb-2'>
            Webhook Created! Save these details — the secret key will not be shown again.
          </Typography>
          <Box className='flex flex-col gap-2'>
            <Box className='flex items-center gap-2'>
              <Typography variant='body2' className='font-medium' sx={{ minWidth: 80 }}>
                URL:
              </Typography>
              <Paper
                variant='outlined'
                sx={{ px: 1.5, py: 0.5, fontFamily: 'monospace', fontSize: '0.8rem', flex: 1, bgcolor: 'grey.50' }}
              >
                {getWebhookURL(createdWebhook.secret_key)}
              </Paper>
              <Tooltip title={copied === 'url' ? 'Copied!' : 'Copy'}>
                <IconButton
                  size='small'
                  onClick={() => handleCopy(getWebhookURL(createdWebhook.secret_key), 'url')}
                >
                  <i className={copied === 'url' ? 'tabler-check' : 'tabler-copy'} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box className='flex items-center gap-2'>
              <Typography variant='body2' className='font-medium' sx={{ minWidth: 80 }}>
                Secret:
              </Typography>
              <Paper
                variant='outlined'
                sx={{ px: 1.5, py: 0.5, fontFamily: 'monospace', fontSize: '0.8rem', flex: 1, bgcolor: 'grey.50' }}
              >
                {createdWebhook.secret_key}
              </Paper>
              <Tooltip title={copied === 'secret' ? 'Copied!' : 'Copy'}>
                <IconButton
                  size='small'
                  onClick={() => handleCopy(createdWebhook.secret_key, 'secret')}
                >
                  <i className={copied === 'secret' ? 'tabler-check' : 'tabler-copy'} />
                </IconButton>
              </Tooltip>
            </Box>
            <Box className='flex items-center gap-2'>
              <Typography variant='body2' className='font-medium' sx={{ minWidth: 80 }}>
                Example:
              </Typography>
              <Paper
                variant='outlined'
                sx={{
                  px: 1.5,
                  py: 0.5,
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  flex: 1,
                  bgcolor: 'grey.50',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {curlExample(createdWebhook.secret_key)}
              </Paper>
              <Tooltip title={copied === 'curl' ? 'Copied!' : 'Copy'}>
                <IconButton
                  size='small'
                  onClick={() => handleCopy(curlExample(createdWebhook.secret_key), 'curl')}
                >
                  <i className={copied === 'curl' ? 'tabler-check' : 'tabler-copy'} />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </Alert>
      )}

      {loading ? (
        <Box className='flex justify-center py-8'>
          <CircularProgress />
        </Box>
      ) : webhooks.length === 0 ? (
        <Card variant='outlined'>
          <CardContent className='text-center py-8'>
            <i className='tabler-webhook text-[48px]' style={{ color: 'var(--mui-palette-text-disabled)' }} />
            <Typography color='text.secondary' className='mt-2'>
              No webhooks configured yet. Create one to allow external services to push subscribers.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper} variant='outlined'>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Webhook URL</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Lists</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align='center'>
                  Active
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align='center'>
                  Triggers
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }} align='center'>
                  Actions
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {webhooks.map(wh => (
                <TableRow key={wh.id}>
                  <TableCell>
                    <Typography variant='body2' className='font-medium'>
                      {wh.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box className='flex items-center gap-1'>
                      <Typography
                        variant='body2'
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          maxWidth: 250,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {getWebhookURL(wh.secret_key)}
                      </Typography>
                      <Tooltip title={copied === `wh-${wh.id}` ? 'Copied!' : 'Copy URL'}>
                        <IconButton
                          size='small'
                          onClick={() => handleCopy(getWebhookURL(wh.secret_key), `wh-${wh.id}`)}
                        >
                          <i className={copied === `wh-${wh.id}` ? 'tabler-check text-[14px]' : 'tabler-copy text-[14px]'} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box className='flex gap-1 flex-wrap'>
                      {(wh.list_ids || []).map(id => {
                        const list = availableLists.find(l => l.id === id)

                        return (
                          <Chip key={id} label={list?.name || `List #${id}`} size='small' variant='outlined' />
                        )
                      })}
                    </Box>
                  </TableCell>
                  <TableCell align='center'>
                    <Switch checked={wh.is_active} onChange={() => handleToggle(wh)} size='small' />
                  </TableCell>
                  <TableCell align='center'>
                    <Chip label={wh.trigger_count} size='small' color='primary' variant='outlined' />
                  </TableCell>
                  <TableCell align='center'>
                    <Tooltip title='Delete'>
                      <IconButton size='small' color='error' onClick={() => { setDeleteId(wh.id); setDeleteOpen(true) }}>
                        <i className='tabler-trash text-[16px]' />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create Webhook Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth='sm' fullWidth fullScreen={isMobile}>
        <DialogTitle>Create Import Webhook</DialogTitle>
        <DialogContent className='flex flex-col gap-4 pt-2'>
          <TextField
            label='Webhook Name'
            fullWidth
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder='e.g., Zapier Integration'
            sx={{ mt: 1 }}
          />
          <Autocomplete
            multiple
            options={availableLists}
            loading={listsLoading}
            getOptionLabel={opt => opt.name}
            value={newLists}
            onChange={(_, val) => setNewLists(val)}
            renderTags={(value, getTagProps) =>
              value.map((opt, index) => <Chip label={opt.name} size='small' {...getTagProps({ index })} key={opt.id} />)
            }
            renderInput={params => (
              <TextField {...params} label='Assign to Lists' placeholder='Select lists...' />
            )}
          />
          <Alert severity='info' variant='outlined'>
            A unique secret key and URL will be generated. Incoming POST requests to the URL will create subscribers in
            the selected lists.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            onClick={handleCreate}
            disabled={!newName.trim() || creating}
            startIcon={creating ? <CircularProgress size={18} /> : <i className='tabler-plus' />}
          >
            {creating ? 'Creating...' : 'Create Webhook'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)} fullScreen={isMobile}>
        <DialogTitle>Delete Webhook</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this webhook? This action cannot be undone and the secret key will be permanently lost.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            color='error'
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={18} /> : <i className='tabler-trash' />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default WebhookImport
