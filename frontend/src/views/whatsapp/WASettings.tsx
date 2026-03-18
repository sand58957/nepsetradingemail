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
import whatsappService from '@/services/whatsapp'

// Type Imports
import type { WASettings as WASettingsType } from '@/types/whatsapp'

const WASettings = () => {
  const [settings, setSettings] = useState<Partial<WASettingsType>>({
    gupshup_app_id: '',
    gupshup_api_key: '',
    source_phone: '',
    app_name: '',
    waba_id: '',
    send_rate: 10
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'connected' | 'failed'>('untested')
  const [walletBalance, setWalletBalance] = useState<string>('')

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await whatsappService.getSettings()

        if (response.data) {
          setConfigured(response.data.configured)

          if (response.data.settings) {
            setSettings(response.data.settings)
          }
        }
      } catch (err: any) {
        if (err?.response?.status === 401) return

        console.error('Failed to fetch WA settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    if (!settings.gupshup_api_key || !settings.gupshup_app_id || !settings.source_phone || !settings.app_name) {
      setSnackbar({ open: true, message: 'Please fill in all required fields', severity: 'error' })

      return
    }

    setSaving(true)

    try {
      await whatsappService.updateSettings(settings)
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
      const response = await whatsappService.testConnection()

      if (response.data?.connected) {
        setConnectionStatus('connected')
        setWalletBalance(response.data.balance || '')
        setSnackbar({ open: true, message: 'Connection successful!', severity: 'success' })
      } else {
        setConnectionStatus('failed')
        setSnackbar({ open: true, message: 'Connection failed. Check your API credentials.', severity: 'error' })
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
                  <i className='tabler-brand-whatsapp text-[32px] text-green-500' />
                  <div>
                    <Typography variant='h5'>WhatsApp Settings</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Configure your Gupshup WhatsApp Business API credentials
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
                  {walletBalance && (
                    <Chip label={`Balance: $${walletBalance}`} color='info' variant='tonal' />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* API Configuration */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title='API Configuration' subheader='Enter your Gupshup WhatsApp Business API credentials' />
            <CardContent>
              <div className='flex flex-col gap-5'>
                <TextField
                  fullWidth
                  label='Gupshup App ID *'
                  placeholder='e.g. f97e09c9-5a0d-4cd4-bb72-293a5baf330e'
                  value={settings.gupshup_app_id || ''}
                  onChange={e => setSettings({ ...settings, gupshup_app_id: e.target.value })}
                />
                <TextField
                  fullWidth
                  label='API Key *'
                  placeholder='Enter your Gupshup API key'
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.gupshup_api_key || ''}
                  onChange={e => setSettings({ ...settings, gupshup_api_key: e.target.value })}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position='end'>
                          <IconButton onClick={() => setShowApiKey(!showApiKey)} edge='end'>
                            <i className={showApiKey ? 'tabler-eye-off' : 'tabler-eye'} />
                          </IconButton>
                        </InputAdornment>
                      )
                    }
                  }}
                />
                <TextField
                  fullWidth
                  label='App Name *'
                  placeholder='e.g. Nepalwhatsapp'
                  value={settings.app_name || ''}
                  onChange={e => setSettings({ ...settings, app_name: e.target.value })}
                  helperText='The app name as registered in Gupshup (used as src.name)'
                />
                <TextField
                  fullWidth
                  label='Source Phone Number *'
                  placeholder='e.g. 9779812345678'
                  value={settings.source_phone || ''}
                  onChange={e => setSettings({ ...settings, source_phone: e.target.value })}
                  helperText='Your WhatsApp Business phone number with country code (no + prefix)'
                />
                <TextField
                  fullWidth
                  label='WABA ID'
                  placeholder='e.g. 183201240408546'
                  value={settings.waba_id || ''}
                  onChange={e => setSettings({ ...settings, waba_id: e.target.value })}
                  helperText='WhatsApp Business Account ID (optional)'
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
            <CardHeader title='Setup Guide' subheader='Follow these steps to connect WhatsApp Business API' />
            <CardContent>
              <div className='flex flex-col gap-4'>
                <Alert severity='info' icon={<i className='tabler-info-circle' />}>
                  You need a Gupshup WhatsApp Business API account to use this feature.
                </Alert>

                <Typography variant='subtitle2' color='primary'>Step 1: Create Gupshup Account</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Go to{' '}
                  <a href='https://www.gupshup.io/developer/home' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                    gupshup.io
                  </a>
                  {' '}&rarr; Click <strong>&ldquo;Sign Up&rdquo;</strong> &rarr; Verify your email &rarr; Complete the registration process.
                </Typography>

                <Divider />

                <Typography variant='subtitle2' color='primary'>Step 2: Create a WhatsApp App</Typography>
                <Typography variant='body2' color='text.secondary'>
                  In{' '}
                  <a href='https://www.gupshup.io/whatsapp/dashboard' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                    Gupshup Dashboard
                  </a>
                  {' '}&rarr; Go to <strong>&ldquo;WhatsApp&rdquo;</strong> section &rarr; Click <strong>&ldquo;Create App&rdquo;</strong> &rarr; Enter app name &rarr; Link your WhatsApp Business phone number.
                </Typography>

                <Divider />

                <Typography variant='subtitle2' color='primary'>Step 3: Get App ID &amp; API Key</Typography>
                <Typography variant='body2' color='text.secondary'>
                  In Gupshup Dashboard &rarr; Select your app &rarr; Go to <strong>&ldquo;Settings&rdquo;</strong> &rarr; Copy the <strong>App ID</strong> (UUID format) &rarr; Go to{' '}
                  <a href='https://www.gupshup.io/whatsapp/dashboard/api-key' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                    API Keys page
                  </a>
                  {' '}&rarr; Copy your <strong>API Key</strong>.
                </Typography>

                <Divider />

                <Typography variant='subtitle2' color='primary'>Step 4: Get App Name &amp; Phone Number</Typography>
                <Typography variant='body2' color='text.secondary'>
                  The <strong>App Name</strong> is displayed in your Gupshup app settings (e.g. &ldquo;Nepalwhatsapp&rdquo;). The <strong>Source Phone</strong> is your WhatsApp Business number with country code, no &ldquo;+&rdquo; prefix (e.g. <code>9779812345678</code>).
                </Typography>

                <Divider />

                <Typography variant='subtitle2' color='primary'>Step 5: Save &amp; Test</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Fill all fields &rarr; Click <strong>&ldquo;Save Settings&rdquo;</strong> &rarr; Click <strong>&ldquo;Test Connection&rdquo;</strong>. If successful, your wallet balance will show.
                </Typography>

                <Divider />

                <Typography variant='subtitle2' color='primary'>Step 6: Configure Webhook</Typography>
                <Typography variant='body2' color='text.secondary'>
                  In Gupshup Dashboard &rarr; <strong>&ldquo;Webhooks&rdquo;</strong> section &rarr; Add the webhook URL shown below for delivery reports and incoming messages.
                </Typography>

                {settings.webhook_secret && (
                  <>
                    <Divider />
                    <Typography variant='subtitle2'>Your Webhook URL</Typography>
                    <Typography
                      variant='body2'
                      className='p-2 rounded break-all'
                      sx={{ backgroundColor: 'action.hover', fontFamily: 'monospace', fontSize: '0.75rem' }}
                    >
                      {`${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhooks/whatsapp/${settings.webhook_secret}`}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      Add this URL in your Gupshup dashboard under Webhook Settings
                    </Typography>
                  </>
                )}

                <Divider />

                <Typography variant='subtitle2' color='primary'>Step 7: Create Message Templates</Typography>
                <Typography variant='body2' color='text.secondary'>
                  In Gupshup Dashboard &rarr; <strong>&ldquo;Templates&rdquo;</strong> &rarr; Create templates for marketing messages. Templates must be approved by WhatsApp before use. You can send template messages anytime (no 24-hour limit).
                </Typography>

                <Divider />

                <Alert severity='warning' icon={<i className='tabler-alert-triangle' />}>
                  <Typography variant='caption'>
                    WhatsApp charges per conversation. Template messages (outside 24h window) cost more. Check{' '}
                    <a href='https://developers.facebook.com/docs/whatsapp/pricing' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                      WhatsApp Pricing
                    </a>
                    {' '}for rates.
                  </Typography>
                </Alert>

                <Alert severity='info' variant='outlined' sx={{ py: 0.5 }}>
                  <Typography variant='caption'>
                    <strong>Gupshup Docs:</strong>{' '}
                    <a href='https://docs.gupshup.io/docs/whatsapp-overview' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                      docs.gupshup.io
                    </a>
                  </Typography>
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

export default WASettings
