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
import smsService from '@/services/sms'

// Type Imports
import type { SMSSettings as SMSSettingsType } from '@/types/sms'

const SMSSettings = () => {
  const [settings, setSettings] = useState<Partial<SMSSettingsType>>({
    auth_token: '',
    sender_id: '',
    send_rate: 10
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'connected' | 'failed'>('untested')

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await smsService.getSettings()

        if (response.data) {
          setConfigured(response.data.configured)

          if (response.data.settings) {
            setSettings(response.data.settings)
          }
        }
      } catch (err: any) {
        if (err?.response?.status === 401) return

        console.error('Failed to fetch SMS settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    if (!settings.auth_token || !settings.sender_id) {
      setSnackbar({ open: true, message: 'Please fill in all required fields', severity: 'error' })

      return
    }

    setSaving(true)

    try {
      await smsService.updateSettings(settings)
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
      const response = await smsService.testConnection()

      if (response.data?.connected) {
        setConnectionStatus('connected')
        setSnackbar({ open: true, message: 'Connection successful!', severity: 'success' })
      } else {
        setConnectionStatus('failed')
        setSnackbar({ open: true, message: 'Connection failed. Check your auth token.', severity: 'error' })
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
                  <i className='tabler-message text-[32px] text-blue-500' />
                  <div>
                    <Typography variant='h5'>SMS Settings</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Configure your Aakash SMS API credentials
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
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* API Configuration */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title='API Configuration' subheader='Enter your Aakash SMS API credentials' />
            <CardContent>
              <div className='flex flex-col gap-5'>
                <TextField
                  fullWidth
                  label='Auth Token *'
                  placeholder='Enter your Aakash SMS auth token'
                  type={showToken ? 'text' : 'password'}
                  value={settings.auth_token || ''}
                  onChange={e => setSettings({ ...settings, auth_token: e.target.value })}
                  helperText='Your Aakash SMS API authentication token'
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position='end'>
                          <IconButton onClick={() => setShowToken(!showToken)} edge='end'>
                            <i className={showToken ? 'tabler-eye-off' : 'tabler-eye'} />
                          </IconButton>
                        </InputAdornment>
                      )
                    }
                  }}
                />
                <TextField
                  fullWidth
                  label='Sender ID *'
                  placeholder='e.g. InfoSMS'
                  value={settings.sender_id || ''}
                  onChange={e => setSettings({ ...settings, sender_id: e.target.value })}
                  helperText='The sender identity displayed on recipients phones'
                />

                <Divider />

                <TextField
                  fullWidth
                  label='Send Rate (messages/second)'
                  type='number'
                  value={settings.send_rate || 10}
                  onChange={e => setSettings({ ...settings, send_rate: parseInt(e.target.value) || 10 })}
                  helperText='Maximum messages per second during campaign sending'
                  slotProps={{ htmlInput: { min: 1, max: 50 } }}
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
                  You need an Aakash SMS account to use this feature.
                </Alert>

                <Typography variant='body2' color='text.secondary'>
                  <strong>Step 1:</strong> Sign up at aakashsms.com and purchase SMS credits
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  <strong>Step 2:</strong> Go to your Aakash SMS dashboard and copy your Auth Token
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  <strong>Step 3:</strong> Enter your Auth Token and Sender ID here and save
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  <strong>Step 4:</strong> Click &ldquo;Test Connection&rdquo; to verify your credentials and check credit balance
                </Typography>

                <Divider />

                <Alert severity='warning' icon={<i className='tabler-alert-triangle' />}>
                  SMS credits are deducted per message. English messages use 1 credit per 160 characters. Nepali/Unicode messages use 1 credit per 70 characters.
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

export default SMSSettings
