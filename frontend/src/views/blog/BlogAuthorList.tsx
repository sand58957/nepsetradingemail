'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'

import { blogService } from '@/services/blog'
import type { BlogAuthor } from '@/types/blog'

const BlogAuthorList = () => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = lang || 'en'

  const [authors, setAuthors] = useState<BlogAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  const fetchAuthors = async () => {
    try {
      const res = await blogService.listAuthors()
      setAuthors(res.data || [])
    } catch {
      setSnackbar({ open: true, message: 'Failed to load authors', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAuthors() }, [])

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await blogService.deleteAuthor(deletingId)
      setSnackbar({ open: true, message: 'Author deleted', severity: 'success' })
      setDeleteDialogOpen(false)
      fetchAuthors()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete author', severity: 'error' })
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><CircularProgress /></div>

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant='h5'>Blog Authors</Typography>
        <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => router.push(`/${locale}/blog/authors/create`)}>
          Add Author
        </Button>
      </Box>

      {authors.length === 0 ? (
        <Card>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography color='text.secondary'>No authors yet. Create your first author profile.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={4}>
          {authors.map(author => (
            <Grid key={author.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card sx={{ height: '100%', cursor: 'pointer', '&:hover': { boxShadow: 6 }, transition: 'box-shadow 0.2s' }}
                    onClick={() => router.push(`/${locale}/blog/authors/${author.id}`)}>
                <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 2 }}>
                  <Avatar src={author.avatar_url} sx={{ width: 80, height: 80, fontSize: '2rem' }}>
                    {author.name.charAt(0)}
                  </Avatar>
                  <Box>
                    <Typography variant='h6'>{author.name}</Typography>
                    <Typography variant='body2' color='text.secondary'>{author.email || 'No email'}</Typography>
                  </Box>
                  {author.credentials && (
                    <Typography variant='caption' color='text.secondary'>{author.credentials}</Typography>
                  )}
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, justifyContent: 'center' }}>
                    {(author.expertise || []).slice(0, 3).map((exp, i) => (
                      <Chip key={i} label={exp} size='small' variant='outlined' />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                    <Typography variant='body2'><strong>{author.post_count || 0}</strong> posts</Typography>
                    <Chip label={author.is_active ? 'Active' : 'Inactive'} size='small' color={author.is_active ? 'success' : 'default'} variant='tonal' />
                  </Box>
                  <Box sx={{ mt: 1 }}>
                    <IconButton size='small' onClick={e => { e.stopPropagation(); router.push(`/${locale}/blog/authors/${author.id}`) }}>
                      <i className='tabler-edit' />
                    </IconButton>
                    <IconButton size='small' color='error' onClick={e => { e.stopPropagation(); setDeletingId(author.id); setDeleteDialogOpen(true) }}>
                      <i className='tabler-trash' />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Author</DialogTitle>
        <DialogContent><Typography>Are you sure? Posts by this author will remain but lose their author.</Typography></DialogContent>
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

export default BlogAuthorList
