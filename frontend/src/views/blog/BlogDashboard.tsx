'use client'

// React Imports
import { useState, useEffect } from 'react'

// Next Imports
import { useRouter, useParams } from 'next/navigation'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Service Imports
import { blogService } from '@/services/blog'

// Type Imports
import type { BlogDashboardStats, BlogPost } from '@/types/blog'

// Stat Card Component
const StatCard = ({
  title,
  value,
  icon,
  color,
  loading
}: {
  title: string
  value: string
  icon: string
  color: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary'
  loading?: boolean
}) => (
  <Card>
    <CardContent className='flex justify-between gap-1'>
      <div className='flex flex-col gap-1 grow'>
        <Typography color='text.primary'>{title}</Typography>
        <div className='flex items-center gap-2 flex-wrap'>
          {loading ? (
            <CircularProgress size={24} />
          ) : (
            <Typography variant='h4'>{value}</Typography>
          )}
        </div>
      </div>
      <CustomAvatar color={color} skin='light' variant='rounded' size={42}>
        <i className={`${icon} text-[26px]`} />
      </CustomAvatar>
    </CardContent>
  </Card>
)

const getSeoScoreColor = (score: number): string => {
  if (score >= 70) return 'success.main'
  if (score >= 40) return 'warning.main'

  return 'error.main'
}

const BlogDashboard = () => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  const [stats, setStats] = useState<BlogDashboardStats['stats'] | null>(null)
  const [recentPosts, setRecentPosts] = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchDashboard = async () => {
      try {
        const response = await blogService.getDashboardStats()

        if (cancelled) return

        if (response.data) {
          setStats(response.data.stats)
          setRecentPosts(response.data.recent_posts || [])
        } else {
          setError('Failed to load blog dashboard data')
        }
      } catch (err: any) {
        if (cancelled) return

        if (err?.response?.status === 401) return

        console.error('Blog Dashboard fetch error:', err)
        setError('Failed to connect to server')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    fetchDashboard()

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <Grid container spacing={6}>
      {/* Stats Row 1 - 4 columns */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Total Posts'
          value={stats?.total_posts?.toLocaleString() || '0'}
          icon='tabler-article'
          color='primary'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Published'
          value={stats?.published_posts?.toLocaleString() || '0'}
          icon='tabler-world'
          color='success'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Draft Posts'
          value={stats?.draft_posts?.toLocaleString() || '0'}
          icon='tabler-file-text'
          color='warning'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Total Views'
          value={stats?.total_views?.toLocaleString() || '0'}
          icon='tabler-eye'
          color='info'
          loading={loading}
        />
      </Grid>

      {/* Stats Row 2 - 3 columns */}
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          title='Total Authors'
          value={stats?.total_authors?.toLocaleString() || '0'}
          icon='tabler-users'
          color='secondary'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          title='Categories'
          value={stats?.total_categories?.toLocaleString() || '0'}
          icon='tabler-category'
          color='primary'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 4 }}>
        <StatCard
          title='Avg SEO Score'
          value={stats?.avg_seo_score != null ? `${stats.avg_seo_score}%` : '0%'}
          icon='tabler-seo'
          color='success'
          loading={loading}
        />
      </Grid>

      {/* Quick Actions */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent>
            <div className='flex items-center justify-between flex-wrap gap-4'>
              <div>
                <Typography variant='h6'>Blog Management</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Create and manage your blog posts, categories, and authors
                </Typography>
              </div>
              <div className='flex gap-2 flex-wrap'>
                <Button
                  variant='contained'
                  color='success'
                  startIcon={<i className='tabler-plus' />}
                  onClick={() => router.push(`/${locale}/blog/posts/create`)}
                >
                  New Post
                </Button>
                <Button
                  variant='outlined'
                  startIcon={<i className='tabler-category' />}
                  onClick={() => router.push(`/${locale}/blog/categories`)}
                >
                  Manage Categories
                </Button>
                <Button
                  variant='outlined'
                  startIcon={<i className='tabler-users' />}
                  onClick={() => router.push(`/${locale}/blog/authors`)}
                >
                  Manage Authors
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Error State */}
      {error && (
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography color='error'>{error}</Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Recent Posts Table */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title='Recent Posts'
            action={
              <Button
                size='small'
                onClick={() => router.push(`/${locale}/blog/posts`)}
                endIcon={<i className='tabler-arrow-right' />}
              >
                View All
              </Button>
            }
          />
          {loading ? (
            <CardContent>
              <Box display='flex' justifyContent='center' p={4}>
                <CircularProgress />
              </Box>
            </CardContent>
          ) : recentPosts.length === 0 ? (
            <CardContent>
              <Typography color='text.secondary' align='center'>
                No blog posts yet. Create your first post to get started.
              </Typography>
            </CardContent>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Title</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align='right'>SEO Score</TableCell>
                    <TableCell align='right' sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Views</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Date</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {recentPosts.slice(0, 5).map((post) => (
                    <TableRow
                      key={post.id}
                      hover
                      className='cursor-pointer'
                      onClick={() => router.push(`/${locale}/blog/posts/${post.id}`)}
                    >
                      <TableCell>
                        <Typography className='font-medium' color='text.primary'>
                          {post.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={post.status === 'published' ? 'Published' : 'Draft'}
                          color={post.status === 'published' ? 'success' : 'warning'}
                          size='small'
                          variant='tonal'
                        />
                      </TableCell>
                      <TableCell align='right'>
                        <Typography color={getSeoScoreColor(post.seo_score || 0)} className='font-medium'>
                          {post.seo_score != null ? `${post.seo_score}%` : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align='right' sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <Typography>{post.view_count != null ? post.view_count.toLocaleString() : '-'}</Typography>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        <Typography variant='body2'>
                          {new Date(post.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Card>
      </Grid>
    </Grid>
  )
}

export default BlogDashboard
