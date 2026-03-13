'use client'

import { useState, useEffect } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

// Service Imports
import whatsappService from '@/services/whatsapp'

const WAContactTags = () => {
  const [tags, setTags] = useState<{ tag: string; count: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteTag, setDeleteTag] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const fetchTags = async () => {
    setLoading(true)

    try {
      const response = await whatsappService.getContactTags()

      setTags(response.data || [])
    } catch {
      setSnackbar({ open: true, message: 'Failed to fetch tags', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTags()
  }, [])

  const handleCreate = async () => {
    const tag = newTag.trim().toLowerCase()

    if (!tag) {
      setSnackbar({ open: true, message: 'Tag name is required', severity: 'error' })

      return
    }

    setCreating(true)

    try {
      await whatsappService.createContactTag(tag, [])
      setSnackbar({ open: true, message: `Tag "${tag}" created`, severity: 'success' })
      setCreateOpen(false)
      setNewTag('')
      fetchTags()
    } catch {
      setSnackbar({ open: true, message: 'Failed to create tag', severity: 'error' })
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTag) return

    setDeleting(true)

    try {
      const response = await whatsappService.deleteContactTag(deleteTag)

      setSnackbar({
        open: true,
        message: `Tag "${deleteTag}" removed from ${response.data.removed} contacts`,
        severity: 'success'
      })
      setDeleteTag(null)
      fetchTags()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete tag', severity: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={28} />
        <Typography className='ml-3' color='text.secondary'>Loading tags...</Typography>
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Contact Tags'
          subheader='Organize your WhatsApp contacts using tags for targeted campaigns'
          action={
            <Button
              variant='contained'
              size='small'
              startIcon={<i className='tabler-plus' />}
              onClick={() => setCreateOpen(true)}
            >
              Create Tag
            </Button>
          }
        />
        <CardContent>
          {tags.length === 0 ? (
            <div className='text-center py-8'>
              <i className='tabler-tags text-[48px] mb-3' style={{ color: 'var(--mui-palette-text-secondary)' }} />
              <Typography color='text.secondary' className='mb-2'>No tags found</Typography>
              <Typography variant='body2' color='text.secondary'>
                Create tags to organize your contacts into groups for targeted campaigns.
              </Typography>
            </div>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Tag</TableCell>
                    <TableCell align='center'>Contacts</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tags.map(item => (
                    <TableRow key={item.tag} hover>
                      <TableCell>
                        <Chip label={item.tag} variant='tonal' color='primary' size='small' />
                      </TableCell>
                      <TableCell align='center'>
                        <Typography variant='body2' className='font-medium'>
                          {item.count.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <IconButton
                          size='small'
                          color='error'
                          onClick={() => setDeleteTag(item.tag)}
                          title='Delete tag from all contacts'
                        >
                          <i className='tabler-trash text-[18px]' />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Tag Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Create Tag</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label='Tag Name'
            placeholder='e.g. vip, newsletter, promotion'
            value={newTag}
            onChange={e => setNewTag(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            helperText='Lowercase letters, numbers, hyphens and underscores only'
            className='mt-2'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            onClick={handleCreate}
            disabled={creating}
            startIcon={creating ? <CircularProgress size={18} /> : <i className='tabler-plus' />}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Tag Dialog */}
      <Dialog open={deleteTag !== null} onClose={() => setDeleteTag(null)}>
        <DialogTitle>Delete Tag</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to remove the tag &quot;{deleteTag}&quot; from all contacts?
            This will not delete the contacts themselves.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteTag(null)}>Cancel</Button>
          <Button
            variant='contained'
            color='error'
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Tag'}
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

export default WAContactTags
