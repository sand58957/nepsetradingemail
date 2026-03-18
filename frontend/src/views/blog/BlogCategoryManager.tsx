'use client'

import { useState, useEffect } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'

import { blogService } from '@/services/blog'
import type { BlogCategory } from '@/types/blog'

const BlogCategoryManager = () => {
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<BlogCategory | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  const fetchCategories = async () => {
    try {
      const res = await blogService.listCategories()
      setCategories(res.data || [])
    } catch {
      setSnackbar({ open: true, message: 'Failed to load categories', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCategories() }, [])

  const handleOpenCreate = () => {
    setEditingCategory(null)
    setName('')
    setDescription('')
    setDialogOpen(true)
  }

  const handleOpenEdit = (cat: BlogCategory) => {
    setEditingCategory(cat)
    setName(cat.name)
    setDescription(cat.description)
    setDialogOpen(true)
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      if (editingCategory) {
        await blogService.updateCategory(editingCategory.id, { name, description })
        setSnackbar({ open: true, message: 'Category updated', severity: 'success' })
      } else {
        await blogService.createCategory({ name, description })
        setSnackbar({ open: true, message: 'Category created', severity: 'success' })
      }
      setDialogOpen(false)
      fetchCategories()
    } catch {
      setSnackbar({ open: true, message: 'Failed to save category', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await blogService.deleteCategory(deletingId)
      setSnackbar({ open: true, message: 'Category deleted', severity: 'success' })
      setDeleteDialogOpen(false)
      fetchCategories()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete category', severity: 'error' })
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><CircularProgress /></div>

  return (
    <>
      <Card>
        <CardHeader
          title='Blog Categories'
          action={
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={handleOpenCreate}>
              Add Category
            </Button>
          }
        />
        <CardContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Slug</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Posts</TableCell>
                  <TableCell align='right'>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {categories.length === 0 ? (
                  <TableRow><TableCell colSpan={5} align='center'><Typography color='text.secondary'>No categories yet</Typography></TableCell></TableRow>
                ) : categories.map(cat => (
                  <TableRow key={cat.id}>
                    <TableCell><Typography fontWeight={600}>{cat.name}</Typography></TableCell>
                    <TableCell><Typography variant='body2' color='text.secondary'>{cat.slug}</Typography></TableCell>
                    <TableCell><Typography variant='body2'>{cat.description || '-'}</Typography></TableCell>
                    <TableCell><Chip label={cat.post_count || 0} size='small' variant='tonal' color='primary' /></TableCell>
                    <TableCell align='right'>
                      <IconButton size='small' onClick={() => handleOpenEdit(cat)}><i className='tabler-edit' /></IconButton>
                      <IconButton size='small' color='error' onClick={() => { setDeletingId(cat.id); setDeleteDialogOpen(true) }}><i className='tabler-trash' /></IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{editingCategory ? 'Edit Category' : 'Create Category'}</DialogTitle>
        <DialogContent>
          <TextField label='Name' fullWidth value={name} onChange={e => setName(e.target.value)} sx={{ mt: 1, mb: 2 }} />
          <TextField label='Description' fullWidth multiline rows={3} value={description} onChange={e => setDescription(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant='contained' onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <CircularProgress size={20} /> : editingCategory ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Category</DialogTitle>
        <DialogContent><Typography>Are you sure? Posts in this category will be uncategorized.</Typography></DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant='contained' color='error' onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
        <Alert severity={snackbar.severity} variant='filled'>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default BlogCategoryManager
