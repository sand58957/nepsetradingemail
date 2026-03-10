'use client'

import { useState, useEffect } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Grid from '@mui/material/Grid'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import DialogContentText from '@mui/material/DialogContentText'

import type { List } from '@/types/email'
import listService from '@/services/lists'
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'

const SubscriberGroups = () => {
  const [lists, setLists] = useState<List[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [newList, setNewList] = useState({
    name: '',
    type: 'public' as 'public' | 'private' | 'temporary',
    optin: 'single' as 'single' | 'double',
    description: ''
  })

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const isMobile = useMobileBreakpoint()

  const fetchLists = async () => {
    setLoading(true)

    try {
      const response = await listService.getAll({ per_page: 100 })

      setLists(response.data?.results || [])
    } catch {
      setSnackbar({ open: true, message: 'Failed to fetch groups', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLists()
  }, [])

  const handleCreate = async () => {
    if (!newList.name) return
    setSubmitting(true)

    try {
      await listService.create(newList)
      setSnackbar({ open: true, message: 'Group created successfully', severity: 'success' })
      setDialogOpen(false)
      setNewList({ name: '', type: 'public', optin: 'single', description: '' })
      fetchLists()
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to create group', severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return

    try {
      await listService.delete(deletingId)
      setSnackbar({ open: true, message: 'Group deleted', severity: 'success' })
      setDeleteDialogOpen(false)
      setDeletingId(null)
      fetchLists()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete group', severity: 'error' })
    }
  }

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={32} />
        <Typography className='ml-3' color='text.secondary'>Loading groups...</Typography>
      </div>
    )
  }

  return (
    <>
      <Card>
        <CardContent>
          <div className='flex items-center justify-between mb-6'>
            <div className='flex items-center gap-2'>
              <Typography color='text.secondary'>Showing 1 to {lists.length} of {lists.length} results</Typography>
            </div>
            <Button variant='contained' color='success' onClick={() => setDialogOpen(true)}>
              Create group
            </Button>
          </div>

          {lists.length === 0 ? (
            <Typography color='text.secondary' className='text-center py-8'>No groups found</Typography>
          ) : (
            <div className='flex flex-col gap-4'>
              {lists.map(list => (
                <div key={list.id} className='flex items-center justify-between p-4 border rounded-lg'>
                  <div className='flex-1'>
                    <div className='flex items-center gap-2 mb-1'>
                      <Typography className='font-bold'>{list.name}</Typography>
                      <Chip
                        label={list.type}
                        size='small'
                        color={list.type === 'public' ? 'success' : list.type === 'private' ? 'warning' : 'default'}
                        variant='tonal'
                      />
                      <Chip label={`${list.optin} opt-in`} size='small' variant='outlined' />
                    </div>
                    <Typography variant='body2' color='text.secondary'>
                      Created {new Date(list.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })}
                    </Typography>
                    {list.description && (
                      <Typography variant='body2' color='text.secondary' className='mt-1'>{list.description}</Typography>
                    )}
                  </div>
                  <div className='flex items-center gap-6'>
                    <div className='text-center'>
                      <Typography variant='body2' color='text.secondary'>Subscribers</Typography>
                      <Typography className='font-bold'>{list.subscriber_count || 0}</Typography>
                    </div>
                    <div>
                      <IconButton size='small' color='error' onClick={() => { setDeletingId(list.id); setDeleteDialogOpen(true) }}>
                        <i className='tabler-trash text-[20px]' />
                      </IconButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Group Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth fullScreen={isMobile}>
        <DialogTitle>Create Group</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pt-2'>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label='Name' value={newList.name} onChange={e => setNewList({ ...newList, name: e.target.value })} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select value={newList.type} label='Type' onChange={e => setNewList({ ...newList, type: e.target.value as any })}>
                  <MenuItem value='public'>Public</MenuItem>
                  <MenuItem value='private'>Private</MenuItem>
                  <MenuItem value='temporary'>Temporary</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Opt-in</InputLabel>
                <Select value={newList.optin} label='Opt-in' onChange={e => setNewList({ ...newList, optin: e.target.value as any })}>
                  <MenuItem value='single'>Single</MenuItem>
                  <MenuItem value='double'>Double</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label='Description' multiline rows={2} value={newList.description} onChange={e => setNewList({ ...newList, description: e.target.value })} />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} color='secondary' disabled={submitting}>Cancel</Button>
          <Button onClick={handleCreate} variant='contained' disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} fullScreen={isMobile}>
        <DialogTitle>Delete Group</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this group? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color='secondary'>Cancel</Button>
          <Button onClick={handleDelete} color='error' variant='contained'>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant='filled'>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default SubscriberGroups
