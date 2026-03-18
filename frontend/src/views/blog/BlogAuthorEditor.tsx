'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'

import { blogService } from '@/services/blog'

const BlogAuthorEditor = () => {
  const router = useRouter()
  const params = useParams()
  const locale = params.lang || 'en'
  const authorId = params.id ? Number(params.id) : null
  const isEditing = !!authorId

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [bio, setBio] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [credentials, setCredentials] = useState('')
  const [expertiseInput, setExpertiseInput] = useState('')
  const [expertise, setExpertise] = useState<string[]>([])
  const [socialLinkedin, setSocialLinkedin] = useState('')
  const [socialTwitter, setSocialTwitter] = useState('')
  const [socialWebsite, setSocialWebsite] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({ open: false, message: '', severity: 'success' })

  useEffect(() => {
    if (authorId) {
      setLoading(true)
      blogService.getAuthor(authorId).then(res => {
        const a = res.data
        setName(a.name)
        setEmail(a.email)
        setBio(a.bio)
        setAvatarUrl(a.avatar_url)
        setCredentials(a.credentials)
        setExpertise(a.expertise || [])
        setSocialLinkedin(a.social_links?.linkedin || '')
        setSocialTwitter(a.social_links?.twitter || '')
        setSocialWebsite(a.social_links?.website || '')
      }).catch(() => {
        setSnackbar({ open: true, message: 'Failed to load author', severity: 'error' })
      }).finally(() => setLoading(false))
    }
  }, [authorId])

  const handleAddExpertise = () => {
    if (expertiseInput.trim() && !expertise.includes(expertiseInput.trim())) {
      setExpertise([...expertise, expertiseInput.trim()])
      setExpertiseInput('')
    }
  }

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const data = {
        name,
        email,
        bio,
        avatar_url: avatarUrl,
        credentials,
        expertise,
        social_links: {
          linkedin: socialLinkedin,
          twitter: socialTwitter,
          website: socialWebsite
        }
      }
      if (isEditing) {
        await blogService.updateAuthor(authorId!, data)
        setSnackbar({ open: true, message: 'Author updated', severity: 'success' })
      } else {
        await blogService.createAuthor(data)
        setSnackbar({ open: true, message: 'Author created', severity: 'success' })
      }
      setTimeout(() => router.push(`/${locale}/blog/authors`), 1000)
    } catch {
      setSnackbar({ open: true, message: 'Failed to save author', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><CircularProgress /></div>

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant='h5'>{isEditing ? 'Edit Author' : 'Create Author'}</Typography>
        <Button variant='outlined' onClick={() => router.push(`/${locale}/blog/authors`)}>Back to Authors</Button>
      </Box>

      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title='Author Profile' subheader='EEAT (Experience, Expertise, Authoritativeness, Trustworthiness)' />
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label='Full Name' fullWidth value={name} onChange={e => setName(e.target.value)} required />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label='Email' fullWidth value={email} onChange={e => setEmail(e.target.value)} type='email' />
                </Grid>
              </Grid>
              <TextField label='Bio' fullWidth multiline rows={4} value={bio} onChange={e => setBio(e.target.value)}
                helperText='Professional biography. Important for EEAT and author authority.' />
              <TextField label='Credentials / Certifications' fullWidth value={credentials} onChange={e => setCredentials(e.target.value)}
                helperText='e.g., CFA, PhD Finance, 10+ years NEPSE experience' />
              <Divider />
              <Typography variant='subtitle2'>Expertise Areas</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                {expertise.map((exp, i) => (
                  <Chip key={i} label={exp} onDelete={() => setExpertise(expertise.filter((_, idx) => idx !== i))} />
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField label='Add Expertise' size='small' value={expertiseInput} onChange={e => setExpertiseInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddExpertise() } }} />
                <Button variant='outlined' onClick={handleAddExpertise}>Add</Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card sx={{ mb: 3 }}>
            <CardHeader title='Avatar' />
            <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <Avatar src={avatarUrl} sx={{ width: 100, height: 100, fontSize: '2.5rem' }}>
                {name.charAt(0) || '?'}
              </Avatar>
              <TextField label='Avatar URL' fullWidth size='small' value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} />
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardHeader title='Social Links' />
            <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField label='LinkedIn' fullWidth size='small' value={socialLinkedin} onChange={e => setSocialLinkedin(e.target.value)} />
              <TextField label='Twitter/X' fullWidth size='small' value={socialTwitter} onChange={e => setSocialTwitter(e.target.value)} />
              <TextField label='Website' fullWidth size='small' value={socialWebsite} onChange={e => setSocialWebsite(e.target.value)} />
            </CardContent>
          </Card>

          <Button variant='contained' fullWidth size='large' onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <CircularProgress size={24} /> : isEditing ? 'Update Author' : 'Create Author'}
          </Button>
        </Grid>
      </Grid>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
        <Alert severity={snackbar.severity} variant='filled'>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default BlogAuthorEditor
