'use client'

import { useState } from 'react'

import { useParams, useRouter } from 'next/navigation'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'

import type { Locale } from '@configs/i18n'

import { userService } from '@/services/users'
import { getLocalizedUrl } from '@/utils/i18n'

const UserCreateView = () => {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  })

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const router = useRouter()
  const { lang: locale } = useParams()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!form.name || !form.email || !form.password) {
      setError('All fields are required')

      return
    }

    try {
      setLoading(true)
      await userService.create(form)
      setSuccess('User created successfully!')

      // Redirect back to user list after 1 second
      setTimeout(() => {
        router.push(getLocalizedUrl('/admin/users', locale as Locale))
      }, 1000)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader
        title='Create New User'
        action={
          <Button
            variant='tonal'
            color='secondary'
            startIcon={<i className='tabler-arrow-left' />}
            onClick={() => router.push(getLocalizedUrl('/admin/users', locale as Locale))}
          >
            Back to Users
          </Button>
        }
      />
      <CardContent>
        {error && (
          <Alert severity='error' className='mb-4'>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity='success' className='mb-4'>
            {success}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={4}>
            <Grid item xs={12} md={6}>
              <TextField
                label='Full Name'
                fullWidth
                required
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label='Email Address'
                fullWidth
                required
                type='email'
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label='Password'
                fullWidth
                required
                type='password'
                value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select value={form.role} label='Role' onChange={e => setForm({ ...form, role: e.target.value })}>
                  <MenuItem value='admin'>Admin - Full platform control</MenuItem>
                  <MenuItem value='user'>Staff - Email marketing features</MenuItem>
                  <MenuItem value='subscriber'>Subscriber - Self-service portal only</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <Box className='flex gap-4'>
                <Button type='submit' variant='contained' disabled={loading} startIcon={<i className='tabler-check' />}>
                  {loading ? 'Creating...' : 'Create User'}
                </Button>
                <Button
                  variant='tonal'
                  color='secondary'
                  onClick={() => router.push(getLocalizedUrl('/admin/users', locale as Locale))}
                >
                  Cancel
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </CardContent>
    </Card>
  )
}

export default UserCreateView
