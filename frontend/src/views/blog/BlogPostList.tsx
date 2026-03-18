'use client'

// React Imports
import { useState, useEffect, useCallback } from 'react'

// Next Imports
import { useParams, useRouter } from 'next/navigation'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TablePagination from '@mui/material/TablePagination'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

// Service Imports
import { blogService } from '@/services/blog'

// Type Imports
import type { BlogPost } from '@/types/blog'

const statusColorMap: Record<BlogPost['status'], 'success' | 'warning' | 'info' | 'default'> = {
  published: 'success',
  draft: 'warning',
  scheduled: 'info',
  archived: 'default'
}

const getSeoScoreColor = (score: number): string => {
  if (score >= 70) return 'green'
  if (score >= 40) return 'orange'

  return 'red'
}

const BlogPostList = () => {
  const router = useRouter()
  const params = useParams()
  const locale = params.lang || 'en'

  // State
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [postToDelete, setPostToDelete] = useState<BlogPost | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const fetchPosts = useCallback(async () => {
    setLoading(true)

    try {
      const result = await blogService.listPosts({
        page: page + 1,
        per_page: rowsPerPage,
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined
      })

      setPosts(result.data)
      setTotal(result.total)
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to load blog posts', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, statusFilter, search])

  useEffect(() => {
    fetchPosts()
  }, [fetchPosts])

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleStatusFilterChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setStatusFilter(event.target.value)
    setPage(0)
  }

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value)
    setPage(0)
  }

  const handleEditPost = (id: number) => {
    router.push(`/${locale}/blog/posts/${id}`)
  }

  const handleNewPost = () => {
    router.push(`/${locale}/blog/posts/create`)
  }

  const handleDeleteClick = (post: BlogPost) => {
    setPostToDelete(post)
    setDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (!postToDelete) return

    setDeleting(true)

    try {
      await blogService.deletePost(postToDelete.id)
      setSnackbar({ open: true, message: 'Post deleted successfully', severity: 'success' })
      setDeleteDialogOpen(false)
      setPostToDelete(null)
      fetchPosts()
    } catch (error) {
      setSnackbar({ open: true, message: 'Failed to delete post', severity: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false)
    setPostToDelete(null)
  }

  const handleSnackbarClose = () => {
    setSnackbar(prev => ({ ...prev, open: false }))
  }

  const truncateExcerpt = (text: string, maxLength: number = 60): string => {
    if (!text) return ''
    if (text.length <= maxLength) return text

    return text.substring(0, maxLength) + '...'
  }

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return '-'

    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  return (
    <Card>
      <CardContent>
        {/* Top Bar */}
        <Box display='flex' justifyContent='space-between' alignItems='center' flexWrap='wrap' gap={2} mb={4}>
          <Typography variant='h5'>Blog Posts</Typography>
          <Box display='flex' alignItems='center' gap={2} flexWrap='wrap'>
            <TextField
              select
              size='small'
              label='Status'
              value={statusFilter}
              onChange={handleStatusFilterChange}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value='all'>All</MenuItem>
              <MenuItem value='published'>Published</MenuItem>
              <MenuItem value='draft'>Draft</MenuItem>
              <MenuItem value='archived'>Archived</MenuItem>
            </TextField>
            <TextField
              size='small'
              label='Search'
              placeholder='Search posts...'
              value={search}
              onChange={handleSearchChange}
              sx={{ minWidth: 200 }}
            />
            <Button variant='contained' color='primary' onClick={handleNewPost} startIcon={<i className='tabler-plus' />}>
              New Post
            </Button>
          </Box>
        </Box>

        {/* Table */}
        {loading ? (
          <Box display='flex' justifyContent='center' alignItems='center' py={8}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Author</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>SEO Score</TableCell>
                    <TableCell>Views</TableCell>
                    <TableCell>Published Date</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {posts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align='center'>
                        <Typography variant='body2' color='text.secondary' py={4}>
                          No blog posts found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    posts.map(post => (
                      <TableRow key={post.id} hover>
                        <TableCell>
                          <Typography variant='body2' fontWeight={600}>
                            {post.title}
                          </Typography>
                          <Typography variant='caption' color='text.secondary'>
                            {truncateExcerpt(post.excerpt)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>{post.author_name || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>{post.category_name || '-'}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                            color={statusColorMap[post.status]}
                            size='small'
                            variant='tonal'
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2' fontWeight={600} color={getSeoScoreColor(post.seo_score)}>
                            {post.seo_score}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>{post.view_count.toLocaleString()}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2'>{formatDate(post.published_at)}</Typography>
                        </TableCell>
                        <TableCell align='right'>
                          <IconButton size='small' onClick={() => handleEditPost(post.id)} title='Edit'>
                            <i className='tabler-edit text-[22px] text-textSecondary' />
                          </IconButton>
                          <IconButton size='small' onClick={() => handleDeleteClick(post)} title='Delete'>
                            <i className='tabler-trash text-[22px] text-textSecondary' />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component='div'
              count={total}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </>
        )}
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={handleDeleteCancel} maxWidth='xs' fullWidth>
        <DialogTitle>Delete Post</DialogTitle>
        <DialogContent>
          <Typography variant='body1'>
            Are you sure you want to delete <strong>{postToDelete?.title}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDeleteCancel} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteConfirm} color='error' variant='contained' disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} variant='filled' sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Card>
  )
}

export default BlogPostList
