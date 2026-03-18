'use client'

import { useState, useEffect } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'

import { blogService } from '@/services/blog'
import type { BlogTag } from '@/types/blog'

const BlogTagManager = () => {
  const [tags, setTags] = useState<BlogTag[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newTag, setNewTag] = useState('')
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  const fetchTags = async () => {
    try {
      const res = await blogService.listTags()
      setTags(res.data || [])
    } catch {
      setSnackbar({ open: true, message: 'Failed to load tags', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTags() }, [])

  const handleCreate = async () => {
    if (!newTag.trim()) return
    setSaving(true)
    try {
      await blogService.createTag(newTag.trim())
      setSnackbar({ open: true, message: 'Tag created', severity: 'success' })
      setDialogOpen(false)
      setNewTag('')
      fetchTags()
    } catch {
      setSnackbar({ open: true, message: 'Failed to create tag', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await blogService.deleteTag(id)
      setSnackbar({ open: true, message: 'Tag deleted', severity: 'success' })
      fetchTags()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete tag', severity: 'error' })
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><CircularProgress /></div>

  return (
    <>
      <Card>
        <CardHeader
          title='Blog Tags'
          subheader={`${tags.length} tags`}
          action={
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => setDialogOpen(true)}>
              Add Tag
            </Button>
          }
        />
        <CardContent>
          {tags.length === 0 ? (
            <Typography color='text.secondary' textAlign='center' py={4}>No tags yet. Create your first tag.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {tags.map(tag => (
                <Chip
                  key={tag.id}
                  label={`${tag.name} (${tag.post_count || 0})`}
                  variant='outlined'
                  onDelete={() => handleDelete(tag.id)}
                  sx={{ fontSize: '0.875rem' }}
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Create Tag</DialogTitle>
        <DialogContent>
          <TextField
            label='Tag Name'
            fullWidth
            value={newTag}
            onChange={e => setNewTag(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreate() }}
            sx={{ mt: 1 }}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant='contained' onClick={handleCreate} disabled={saving || !newTag.trim()}>
            {saving ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
        <Alert severity={snackbar.severity} variant='filled'>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default BlogTagManager
