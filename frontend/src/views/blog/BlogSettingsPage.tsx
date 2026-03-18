'use client'

import { useState, useEffect } from 'react'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'

import { blogService } from '@/services/blog'
import type { BlogSettings } from '@/types/blog'

const BlogSettingsPage = () => {
  const [settings, setSettings] = useState<BlogSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  // Form fields
  const [blogTitle, setBlogTitle] = useState('')
  const [blogDescription, setBlogDescription] = useState('')
  const [postsPerPage, setPostsPerPage] = useState(10)
  const [robotsTxt, setRobotsTxt] = useState('')
  const [customHeadTags, setCustomHeadTags] = useState('')
  const [defaultOgImage, setDefaultOgImage] = useState('')
  const [sitemapEnabled, setSitemapEnabled] = useState(true)

  useEffect(() => {
    blogService.getSettings().then(res => {
      const s = res.data
      setSettings(s)
      setBlogTitle(s.blog_title)
      setBlogDescription(s.blog_description)
      setPostsPerPage(s.posts_per_page)
      setRobotsTxt(s.robots_txt)
      setCustomHeadTags(s.custom_head_tags)
      setDefaultOgImage(s.default_og_image)
      setSitemapEnabled(s.sitemap_enabled)
    }).catch(() => {
      setSnackbar({ open: true, message: 'Failed to load settings', severity: 'error' })
    }).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true)
    try {
      await blogService.updateSettings({
        blog_title: blogTitle,
        blog_description: blogDescription,
        posts_per_page: postsPerPage,
        robots_txt: robotsTxt,
        custom_head_tags: customHeadTags,
        default_og_image: defaultOgImage,
        sitemap_enabled: sitemapEnabled
      })
      setSnackbar({ open: true, message: 'Settings saved', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to save settings', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><CircularProgress /></div>

  return (
    <>
      <Typography variant='h5' sx={{ mb: 4 }}>Blog Settings</Typography>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card sx={{ mb: 3 }}>
            <CardHeader title='General Settings' />
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField label='Blog Title' fullWidth value={blogTitle} onChange={e => setBlogTitle(e.target.value)}
                helperText='Displayed in blog header and page title' />
              <TextField label='Blog Description' fullWidth multiline rows={3} value={blogDescription} onChange={e => setBlogDescription(e.target.value)}
                helperText='Used in meta description for blog homepage' />
              <TextField label='Posts Per Page' type='number' value={postsPerPage} onChange={e => setPostsPerPage(Number(e.target.value))}
                inputProps={{ min: 1, max: 50 }} sx={{ maxWidth: 200 }} />
              <TextField label='Default OG Image URL' fullWidth value={defaultOgImage} onChange={e => setDefaultOgImage(e.target.value)}
                helperText='Default social sharing image when a post has no featured image' />
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardHeader title='Technical SEO' />
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <FormControlLabel
                control={<Switch checked={sitemapEnabled} onChange={e => setSitemapEnabled(e.target.checked)} />}
                label='Enable XML Sitemap'
              />
              <Typography variant='body2' color='text.secondary'>
                Sitemap URL: <code>/api/public/blog/sitemap.xml</code>
              </Typography>
              <Divider />
              <TextField
                label='robots.txt'
                fullWidth
                multiline
                rows={6}
                value={robotsTxt}
                onChange={e => setRobotsTxt(e.target.value)}
                sx={{ fontFamily: 'monospace' }}
                helperText='Custom robots.txt content for blog crawlers'
              />
              <Divider />
              <TextField
                label='Custom Head Tags'
                fullWidth
                multiline
                rows={4}
                value={customHeadTags}
                onChange={e => setCustomHeadTags(e.target.value)}
                sx={{ fontFamily: 'monospace' }}
                helperText='Custom HTML tags to inject in blog page head (e.g., Google verification, analytics)'
              />
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 3 }}>
            <CardHeader title='Quick Links' />
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Typography variant='body2'>
                <i className='tabler-sitemap' style={{ marginRight: 8 }} />
                <a href='/api/public/blog/sitemap.xml' target='_blank' rel='noopener noreferrer'>View Sitemap</a>
              </Typography>
              <Typography variant='body2'>
                <i className='tabler-robot' style={{ marginRight: 8 }} />
                <a href='/api/public/blog/robots.txt' target='_blank' rel='noopener noreferrer'>View robots.txt</a>
              </Typography>
            </CardContent>
          </Card>

          <Button variant='contained' fullWidth size='large' onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={24} /> : 'Save Settings'}
          </Button>
        </Grid>
      </Grid>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
        <Alert severity={snackbar.severity} variant='filled'>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default BlogSettingsPage
