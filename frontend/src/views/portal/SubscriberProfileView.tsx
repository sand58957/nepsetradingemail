'use client'

import { useEffect, useState } from 'react'

import { useSession } from 'next-auth/react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'

import api from '@/services/api'
import { portalService } from '@/services/portal'

const SubscriberProfileView = () => {
  useSession()
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPreferences, setSavingPreferences] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [profile, setProfile] = useState({
    name: '',
    email: ''
  })

  const [preferences, setPreferences] = useState({
    email_notifications: true,
    marketing_emails: true
  })

  useEffect(() => {
    fetchProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)

      // Get profile
      const profileRes = await api.get('/profile')
      const userData = profileRes.data?.data

      if (userData) {
        setProfile({
          name: userData.name || '',
          email: userData.email || ''
        })
      }

      // Get preferences
      try {
        const prefRes = await portalService.getPreferences()
        const prefs = prefRes.data

        if (prefs && typeof prefs === 'object') {
          setPreferences({
            email_notifications: prefs.email_notifications !== false,
            marketing_emails: prefs.marketing_emails !== false
          })
        }
      } catch {
        // Preferences may not exist yet
      }
    } catch {
      setError('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const handleSaveProfile = async () => {
    try {
      setSavingProfile(true)
      setError('')
      setSuccess('')

      await api.put('/profile', profile)
      setSuccess('Profile updated successfully!')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleSavePreferences = async () => {
    try {
      setSavingPreferences(true)
      setError('')
      setSuccess('')

      await portalService.updatePreferences(preferences)
      setSuccess('Preferences updated successfully!')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update preferences')
    } finally {
      setSavingPreferences(false)
    }
  }

  if (loading) {
    return (
      <Box className='flex justify-center p-8'>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box className='flex flex-col gap-6'>
      {error && <Alert severity='error'>{error}</Alert>}
      {success && <Alert severity='success'>{success}</Alert>}

      {/* Profile Card */}
      <Card>
        <CardHeader title='Profile Information' />
        <CardContent>
          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label='Full Name'
                fullWidth
                value={profile.name}
                onChange={e => setProfile({ ...profile, name: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label='Email Address'
                fullWidth
                type='email'
                value={profile.email}
                onChange={e => setProfile({ ...profile, email: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Button variant='contained' onClick={handleSaveProfile} disabled={savingProfile}>
                {savingProfile ? 'Saving...' : 'Update Profile'}
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Preferences Card */}
      <Card>
        <CardHeader title='Email Preferences' />
        <CardContent>
          <Box className='flex flex-col gap-2'>
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.email_notifications}
                  onChange={e => setPreferences({ ...preferences, email_notifications: e.target.checked })}
                />
              }
              label='Receive email notifications'
            />
            <FormControlLabel
              control={
                <Switch
                  checked={preferences.marketing_emails}
                  onChange={e => setPreferences({ ...preferences, marketing_emails: e.target.checked })}
                />
              }
              label='Receive marketing emails'
            />
          </Box>
          <Divider className='my-4' />
          <Button variant='contained' onClick={handleSavePreferences} disabled={savingPreferences}>
            {savingPreferences ? 'Saving...' : 'Save Preferences'}
          </Button>
        </CardContent>
      </Card>
    </Box>
  )
}

export default SubscriberProfileView
