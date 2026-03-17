'use client'

// React Imports
import { useState, useEffect } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Divider from '@mui/material/Divider'

// Service Imports
import messengerService from '@/services/messenger'

// Type Imports
import type { MessengerSettings as MessengerSettingsType } from '@/types/messenger'

const MessengerSettings = () => {
  const [settings, setSettings] = useState<Partial<MessengerSettingsType>>({
    page_id: '',
    page_access_token: '',
    app_id: '',
    app_secret: '',
    verify_token: '',
    send_rate: 10
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [showPageAccessToken, setShowPageAccessToken] = useState(false)
  const [showAppSecret, setShowAppSecret] = useState(false)
  const [pageName, setPageName] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'connected' | 'failed'>('untested')

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await messengerService.getSettings()

        if (response.data) {
          setConfigured(response.data.configured)

          if (response.data.settings) {
            setSettings(response.data.settings)
          }

          if (response.data.page_name) {
            setPageName(response.data.page_name)
          }
        }
      } catch (err: any) {
        if (err?.response?.status === 401) return


      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    if (!settings.page_id || !settings.page_access_token || !settings.app_id || !settings.app_secret || !settings.verify_token) {
      setSnackbar({ open: true, message: 'Please fill in all required fields', severity: 'error' })

      return
    }

    setSaving(true)

    try {
      await messengerService.updateSettings(settings)
      setConfigured(true)
      setSnackbar({ open: true, message: 'Settings saved successfully', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to save settings', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setConnectionStatus('untested')

    try {
      const response = await messengerService.testConnection()

      if (response.data?.connected) {
        setConnectionStatus('connected')

        if (response.data.page_name) {
          setPageName(response.data.page_name)
        }

        setSnackbar({ open: true, message: 'Connection successful!', severity: 'success' })
      } else {
        setConnectionStatus('failed')
        setSnackbar({ open: true, message: 'Connection failed. Check your credentials.', severity: 'error' })
      }
    } catch {
      setConnectionStatus('failed')
      setSnackbar({ open: true, message: 'Connection test failed. Check your credentials.', severity: 'error' })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={32} />
        <Typography className='ml-3' color='text.secondary'>Loading settings...</Typography>
      </div>
    )
  }

  return (
    <>
      <Grid container spacing={6}>
        {/* Header */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <div className='flex items-center justify-between flex-wrap gap-4'>
                <div className='flex items-center gap-3'>
                  <i className='tabler-brand-facebook-messenger text-[32px]' style={{ color: '#0084FF' }} />
                  <div>
                    <Typography variant='h5'>Messenger Settings</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Configure your Facebook Messenger API credentials
                    </Typography>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  {connectionStatus === 'connected' && (
                    <Chip label='Connected' color='success' variant='tonal' icon={<i className='tabler-check' />} />
                  )}
                  {connectionStatus === 'failed' && (
                    <Chip label='Disconnected' color='error' variant='tonal' icon={<i className='tabler-x' />} />
                  )}
                  {pageName && (
                    <Chip label={pageName} color='info' variant='tonal' icon={<i className='tabler-brand-facebook' />} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* API Configuration */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title='Messenger Configuration' subheader='Enter your Facebook Messenger API credentials' />
            <CardContent>
              <div className='flex flex-col gap-5'>
                <TextField
                  fullWidth
                  label='Page ID *'
                  placeholder='Enter your Facebook Page ID (e.g. 123456789012345)'
                  value={settings.page_id || ''}
                  onChange={e => setSettings({ ...settings, page_id: e.target.value })}
                  helperText='Your Facebook Page ID from Page Settings'
                />

                <TextField
                  fullWidth
                  label='Page Access Token *'
                  placeholder='Enter your Page Access Token'
                  type={showPageAccessToken ? 'text' : 'password'}
                  value={settings.page_access_token || ''}
                  onChange={e => setSettings({ ...settings, page_access_token: e.target.value })}
                  helperText='Long-lived Page Access Token generated from your Facebook App'
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position='end'>
                          <IconButton onClick={() => setShowPageAccessToken(!showPageAccessToken)} edge='end'>
                            <i className={showPageAccessToken ? 'tabler-eye-off' : 'tabler-eye'} />
                          </IconButton>
                        </InputAdornment>
                      )
                    }
                  }}
                />

                <Divider />

                <TextField
                  fullWidth
                  label='App ID *'
                  placeholder='Enter your Facebook App ID'
                  value={settings.app_id || ''}
                  onChange={e => setSettings({ ...settings, app_id: e.target.value })}
                  helperText='Your Facebook App ID from the App Dashboard'
                />

                <TextField
                  fullWidth
                  label='App Secret *'
                  placeholder='Enter your Facebook App Secret'
                  type={showAppSecret ? 'text' : 'password'}
                  value={settings.app_secret || ''}
                  onChange={e => setSettings({ ...settings, app_secret: e.target.value })}
                  helperText='Your Facebook App Secret from the App Dashboard'
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position='end'>
                          <IconButton onClick={() => setShowAppSecret(!showAppSecret)} edge='end'>
                            <i className={showAppSecret ? 'tabler-eye-off' : 'tabler-eye'} />
                          </IconButton>
                        </InputAdornment>
                      )
                    }
                  }}
                />

                <Divider />

                <TextField
                  fullWidth
                  label='Verify Token *'
                  placeholder='Enter a custom verify token for webhook validation'
                  value={settings.verify_token || ''}
                  onChange={e => setSettings({ ...settings, verify_token: e.target.value })}
                  helperText='A custom string used to verify your webhook endpoint with Facebook'
                />

                <Divider />

                <TextField
                  fullWidth
                  label='Send Rate (messages/second)'
                  type='number'
                  value={settings.send_rate || 10}
                  onChange={e => setSettings({ ...settings, send_rate: parseInt(e.target.value) || 10 })}
                  helperText='Maximum messages per second during campaign sending'
                  slotProps={{ htmlInput: { min: 1, max: 100 } }}
                />

                <div className='flex gap-3 mt-2'>
                  <Button
                    variant='contained'
                    onClick={handleSave}
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={18} /> : <i className='tabler-device-floppy' />}
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                  <Button
                    variant='outlined'
                    onClick={handleTestConnection}
                    disabled={testing || !configured}
                    startIcon={testing ? <CircularProgress size={18} /> : <i className='tabler-plug-connected' />}
                  >
                    {testing ? 'Testing...' : 'Test Connection'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Help / Info */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardHeader title='Setup Guide' />
            <CardContent>
              <div className='flex flex-col gap-4'>
                <Alert severity='info' icon={<i className='tabler-info-circle' />}>
                  You need a Facebook App with Messenger product to use this feature.
                </Alert>

                <Typography variant='body2' color='text.secondary'>
                  <strong>Step 1:</strong> Go to developers.facebook.com and create a new Facebook App (or use an existing one)
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  <strong>Step 2:</strong> Add the Messenger product to your app from the App Dashboard
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  <strong>Step 3:</strong> Generate a Page Access Token by linking your Facebook Page to the app
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  <strong>Step 4:</strong> Configure the webhook URL in your app&apos;s Messenger settings and use your Verify Token
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  <strong>Step 5:</strong> Click &ldquo;Test Connection&rdquo; to verify your credentials
                </Typography>

                <Divider />

                <Alert severity='success' icon={<i className='tabler-free-rights' />}>
                  Messenger messaging is free within the 24-hour window.
                </Alert>
              </div>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant='filled'
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default MessengerSettings
