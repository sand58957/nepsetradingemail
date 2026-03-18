'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'

import { blogService } from '@/services/blog'
import type { BlogDashboardStats, BlogPost, BlogCategory } from '@/types/blog'

const BlogAnalytics = () => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  const [stats, setStats] = useState<BlogDashboardStats['stats'] | null>(null)
  const [recentPosts, setRecentPosts] = useState<BlogPost[]>([])
  const [allPosts, setAllPosts] = useState<BlogPost[]>([])
  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, postsRes, catsRes] = await Promise.all([
          blogService.getDashboardStats(),
          blogService.listPosts({ per_page: 100 }),
          blogService.listCategories()
        ])
        setStats(statsRes.data.stats)
        setRecentPosts(statsRes.data.recent_posts || [])
        setAllPosts(postsRes.data || [])
        setCategories(catsRes.data || [])
      } catch (err) {
        console.error('Failed to load analytics:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><CircularProgress /></div>

  // Calculate analytics
  const topPosts = [...allPosts].sort((a, b) => (b.view_count || 0) - (a.view_count || 0)).slice(0, 10)
  const avgWordCount = allPosts.length > 0 ? Math.round(allPosts.reduce((sum, p) => sum + (p.word_count || 0), 0) / allPosts.length) : 0
  const avgReadTime = allPosts.length > 0 ? Math.round(allPosts.reduce((sum, p) => sum + (p.reading_time_min || 0), 0) / allPosts.length) : 0
  const avgSeoScore = stats?.avg_seo_score || 0

  // Category distribution
  const categoryStats = categories.map(cat => ({
    ...cat,
    postCount: allPosts.filter(p => p.category_id === cat.id).length
  })).sort((a, b) => b.postCount - a.postCount)

  // SEO score distribution
  const seoExcellent = allPosts.filter(p => p.seo_score >= 80).length
  const seoGood = allPosts.filter(p => p.seo_score >= 60 && p.seo_score < 80).length
  const seoFair = allPosts.filter(p => p.seo_score >= 40 && p.seo_score < 60).length
  const seoPoor = allPosts.filter(p => p.seo_score < 40).length

  // Status distribution
  const publishedCount = allPosts.filter(p => p.status === 'published').length
  const draftCount = allPosts.filter(p => p.status === 'draft').length

  return (
    <>
      <Typography variant='h5' sx={{ mb: 4 }}>Blog Analytics</Typography>

      {/* Overview Stats */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {[
          { label: 'Total Posts', value: stats?.total_posts || 0, color: 'primary.main' },
          { label: 'Total Views', value: stats?.total_views || 0, color: 'success.main' },
          { label: 'Avg SEO Score', value: `${avgSeoScore}%`, color: avgSeoScore >= 60 ? 'success.main' : 'warning.main' },
          { label: 'Avg Word Count', value: avgWordCount.toLocaleString(), color: 'info.main' },
          { label: 'Avg Read Time', value: `${avgReadTime} min`, color: 'secondary.main' }
        ].map((item, i) => (
          <Grid key={i} size={{ xs: 6, sm: 4, md: 2.4 }}>
            <Card>
              <CardContent sx={{ textAlign: 'center', py: 3 }}>
                <Typography variant='h4' sx={{ color: item.color, fontWeight: 700 }}>{item.value}</Typography>
                <Typography variant='body2' color='text.secondary'>{item.label}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Top Posts by Views */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title='Top Posts by Views' />
            <CardContent>
              <TableContainer>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell align='right'>Views</TableCell>
                      <TableCell align='right'>SEO</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {topPosts.length === 0 ? (
                      <TableRow><TableCell colSpan={5} align='center'><Typography color='text.secondary'>No posts yet</Typography></TableCell></TableRow>
                    ) : topPosts.map((post, i) => (
                      <TableRow key={post.id} hover sx={{ cursor: 'pointer' }} onClick={() => router.push(`/${locale}/blog/posts/${post.id}`)}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell><Typography variant='body2' fontWeight={500}>{post.title}</Typography></TableCell>
                        <TableCell align='right'>{(post.view_count || 0).toLocaleString()}</TableCell>
                        <TableCell align='right'>
                          <Typography variant='body2' sx={{ color: post.seo_score >= 70 ? 'success.main' : post.seo_score >= 40 ? 'warning.main' : 'error.main', fontWeight: 600 }}>
                            {post.seo_score}%
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip label={post.status} size='small' variant='tonal' color={post.status === 'published' ? 'success' : 'warning'} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Right column */}
        <Grid size={{ xs: 12, md: 4 }}>
          {/* SEO Score Distribution */}
          <Card sx={{ mb: 3 }}>
            <CardHeader title='SEO Score Distribution' />
            <CardContent>
              {[
                { label: 'Excellent (80-100)', count: seoExcellent, color: '#4caf50' },
                { label: 'Good (60-79)', count: seoGood, color: '#8bc34a' },
                { label: 'Fair (40-59)', count: seoFair, color: '#ff9800' },
                { label: 'Poor (0-39)', count: seoPoor, color: '#f44336' }
              ].map((item, i) => (
                <Box key={i} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant='body2'>{item.label}</Typography>
                    <Typography variant='body2' fontWeight={600}>{item.count}</Typography>
                  </Box>
                  <LinearProgress
                    variant='determinate'
                    value={allPosts.length > 0 ? (item.count / allPosts.length) * 100 : 0}
                    sx={{ height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.1)', '& .MuiLinearProgress-bar': { backgroundColor: item.color, borderRadius: 4 } }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>

          {/* Post Status */}
          <Card sx={{ mb: 3 }}>
            <CardHeader title='Post Status' />
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
                <Box>
                  <Typography variant='h4' color='success.main' fontWeight={700}>{publishedCount}</Typography>
                  <Typography variant='body2' color='text.secondary'>Published</Typography>
                </Box>
                <Divider orientation='vertical' flexItem />
                <Box>
                  <Typography variant='h4' color='warning.main' fontWeight={700}>{draftCount}</Typography>
                  <Typography variant='body2' color='text.secondary'>Drafts</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>

          {/* Category Distribution */}
          <Card>
            <CardHeader title='Posts by Category' />
            <CardContent>
              {categoryStats.length === 0 ? (
                <Typography variant='body2' color='text.secondary'>No categories</Typography>
              ) : categoryStats.map(cat => (
                <Box key={cat.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                  <Typography variant='body2'>{cat.name}</Typography>
                  <Chip label={cat.postCount} size='small' variant='tonal' color='primary' />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  )
}

export default BlogAnalytics
