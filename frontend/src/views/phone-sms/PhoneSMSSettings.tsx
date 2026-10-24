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
import MenuItem from '@mui/material/MenuItem'

// Service Imports
import phoneSmsService from '@/services/phoneSms'

// Type Imports
import type { PhoneSMSDevice, PhoneSMSSettingsUpdate } from '@/types/phoneSms'

const CLOUD_SERVER = 'https://api.sms-gate.app/3rdparty/v1'

const emptyForm: PhoneSMSSettingsUpdate = {
  server_url: CLOUD_SERVER,
  username: '',
  password: '',
  device_id: '',
  sim_number: 0,
  daily_limit: 100,
  send_gap_seconds: 30,
  signing_key: ''
}

const PhoneSMSSettings = () => {
  const [form, setForm] = useState<PhoneSMSSettingsUpdate>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [devices, setDevices] = useState<PhoneSMSDevice[]>([])
  const [webhookStatus, setWebhookStatus] = useState<string>('')
  const [webhooksRegisteredAt, setWebhooksRegisteredAt] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'connected' | 'failed'>('untested')

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const set = <K extends keyof PhoneSMSSettingsUpdate>(key: K, value: PhoneSMSSettingsUpdate[K]) =>
    setForm(prev => ({ ...prev, [key]: value }))

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await phoneSmsService.getSettings()
        const data = response.data

        setConfigured(data.configured)

        if (data.settings) {
          setForm({
            server_url: data.settings.server_url,
            username: data.settings.username,
            password: data.password || '',
            device_id: data.settings.device_id,
            sim_number: data.settings.sim_number,
            daily_limit: data.settings.daily_limit,
            send_gap_seconds: data.settings.send_gap_seconds,
            signing_key: data.signing_key || ''
          })
          setWebhooksRegisteredAt(data.settings.webhooks_registered_at)
        } else if (data.defaults) {
          setForm({ ...emptyForm, ...data.defaults })
        }
      } catch (err: any) {
        if (err?.response?.status === 401) return

        console.error('Failed to fetch Phone SMS settings:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchSettings()
  }, [])

  const handleSave = async () => {
    if (!form.username.trim() || !form.password) {
      setSnackbar({ open: true, message: 'Enter the username and password shown in the SMSGate app', severity: 'error' })

      return
    }

    setSaving(true)

    try {
      await phoneSmsService.updateSettings(form)
      setConfigured(true)
      setSnackbar({ open: true, message: 'Settings saved. Now press Test connection.', severity: 'success' })
    } catch (err: any) {
      setSnackbar({ open: true, message: err?.response?.data?.message || 'Failed to save settings', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setConnectionStatus('untested')

    try {
      const response = await phoneSmsService.testConnection()
      const data = response.data

      setDevices(data.devices || [])
      setWebhookStatus(data.webhooks)
      setConnectionStatus('connected')

      if (data.webhooks === 'registered') setWebhooksRegisteredAt(new Date().toISOString())

      setSnackbar({
        open: true,
        message:
          data.devices?.length > 0
            ? `Connected: ${data.devices.length} phone${data.devices.length === 1 ? '' : 's'} found`
            : 'Connected, but no phone is linked to this login yet. Open the SMSGate app and go online.',
        severity: data.devices?.length > 0 ? 'success' : 'info'
      })
    } catch (err: any) {
      setConnectionStatus('failed')
      setSnackbar({
        open: true,
        message: err?.response?.data?.message || 'Connection failed. Check the username and password.',
        severity: 'error'
      })
    } finally {
      setTesting(false)
    }
  }

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={32} />
        <Typography className='ml-3' color='text.secondary'>
          Loading settings...
        </Typography>
      </div>
    )
  }

  const simOptions = devices.find(d => d.id === form.device_id)?.simCards || devices[0]?.simCards || []

  return (
    <>
      <Grid container spacing={6}>
        {/* Header */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <div className='flex items-center justify-between flex-wrap gap-4'>
                <div className='flex items-center gap-3'>
                  <i className='tabler-device-mobile-message text-[32px] text-blue-500' />
                  <div>
                    <Typography variant='h5'>Phone SMS Settings</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Send SMS from your own Android phone and SIM with the free SMSGate app
                    </Typography>
                  </div>
                </div>
                <div className='flex items-center gap-2'>
                  {connectionStatus === 'connected' && (
                    <Chip label='Connected' color='success' variant='tonal' icon={<i className='tabler-check' />} />
                  )}
                  {connectionStatus === 'failed' && (
                    <Chip label='Not connected' color='error' variant='tonal' icon={<i className='tabler-x' />} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Connection */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title='Connect your phone' subheader='Copy these from the Cloud Server section of the SMSGate app' />
            <CardContent>
              <div className='flex flex-col gap-5'>
                <TextField
                  fullWidth
                  label='Username'
                  value={form.username}
                  onChange={e => set('username', e.target.value)}
                  placeholder='e.g. ABCDEF'
                  required
                />

                <TextField
                  fullWidth
                  label='Password'
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  required
                  helperText={configured ? 'Leave as it is to keep the saved password' : undefined}
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position='end'>
                          <IconButton onClick={() => setShowPassword(!showPassword)} edge='end' size='small'>
                            <i className={showPassword ? 'tabler-eye-off' : 'tabler-eye'} />
                          </IconButton>
                        </InputAdornment>
                      )
                    }
                  }}
                />

                <TextField
                  fullWidth
                  label='SMSGate server'
                  value={form.server_url}
                  onChange={e => set('server_url', e.target.value)}
                  helperText='Leave the cloud address unless you run your own SMSGate server'
                />

                <Divider />

                <Typography variant='subtitle2'>Sending</Typography>

                <Grid container spacing={4}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      fullWidth
                      label='Phone'
                      value={form.device_id}
                      onChange={e => set('device_id', e.target.value)}
                      helperText={devices.length === 0 ? 'Press Test connection to list your phones' : undefined}
                    >
                      <MenuItem value=''>Any connected phone</MenuItem>
                      {devices.map(d => (
                        <MenuItem key={d.id} value={d.id}>
                          {d.name || d.id}
                        </MenuItem>
                      ))}
                      {form.device_id && !devices.some(d => d.id === form.device_id) && (
                        <MenuItem value={form.device_id}>{form.device_id}</MenuItem>
                      )}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      fullWidth
                      label='SIM'
                      value={form.sim_number}
                      onChange={e => set('sim_number', Number(e.target.value))}
                    >
                      <MenuItem value={0}>Phone&apos;s default SIM</MenuItem>
                      {[1, 2, 3].map(n => {
                        const sim = simOptions.find(s => s.simNumber === n)

                        if (simOptions.length > 0 && !sim && form.sim_number !== n) return null

                        return (
                          <MenuItem key={n} value={n}>
                            SIM {n}
                            {sim?.carrierName ? ` (${sim.carrierName})` : ''}
                          </MenuItem>
                        )
                      })}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label='Daily limit'
                      type='number'
                      value={form.daily_limit}
                      onChange={e => set('daily_limit', Math.max(1, Math.min(5000, parseInt(e.target.value) || 1)))}
                      helperText='Ncell’s unlimited pack allows 100 SMS a day. Campaigns pause at the limit and carry on at 9 AM.'
                      slotProps={{ htmlInput: { min: 1, max: 5000 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      fullWidth
                      label='Seconds between messages'
                      type='number'
                      value={form.send_gap_seconds}
                      onChange={e => set('send_gap_seconds', Math.max(5, Math.min(3600, parseInt(e.target.value) || 5)))}
                      helperText='30 or more keeps the SIM safer from operator blocking'
                      slotProps={{ htmlInput: { min: 5, max: 3600 } }}
                    />
                  </Grid>
                </Grid>

                <Divider />

                <TextField
                  fullWidth
                  label='Webhook signing key (optional)'
                  value={form.signing_key}
                  onChange={e => set('signing_key', e.target.value)}
                  helperText='From the SMSGate app: Settings → Webhooks → Signing Key. When set, only reports signed by your phone are accepted.'
                />

                <div className='flex gap-4 flex-wrap'>
                  <Button
                    variant='contained'
                    onClick={handleSave}
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-device-floppy' />}
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </Button>
                  <Button
                    variant='outlined'
                    onClick={handleTestConnection}
                    disabled={testing || !configured}
                    startIcon={testing ? <CircularProgress size={18} color='inherit' /> : <i className='tabler-plug' />}
                  >
                    {testing ? 'Testing...' : 'Test connection'}
                  </Button>
                </div>

                {webhookStatus && webhookStatus !== 'registered' && <Alert severity='warning'>{webhookStatus}</Alert>}
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* How to */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardHeader title='Set up in 3 steps' />
            <CardContent>
              <div className='flex flex-col gap-4'>
                <Typography variant='body2'>
                  <strong>1.</strong> On an Android phone with your SIM, install the SMSGate app from{' '}
                  <a href='https://sms-gate.app' target='_blank' rel='noopener noreferrer'>
                    sms-gate.app
                  </a>
                  . It isn&apos;t on the Play Store.
                </Typography>
                <Typography variant='body2'>
                  <strong>2.</strong> In the app, turn on <em>Cloud Server</em> and tap <em>Offline</em> so it goes
                  online. It then shows a username and password.
                </Typography>
                <Typography variant='body2'>
                  <strong>3.</strong> Enter them here, save, and press <em>Test connection</em>. Delivery reports and
                  replies are then set up automatically.
                </Typography>

                <Divider />

                <Typography variant='body2' color='text.secondary'>
                  Messages go out from your own number, so your SIM pack pays for them and recipients can reply.
                  Replies appear in the Inbox; a reply of STOP unsubscribes the sender.
                </Typography>

                <Alert severity='info' variant='outlined'>
                  Keep the phone charged and online. Operators may block a SIM that sends a lot of promotional SMS, so
                  message people who expect to hear from you.
                </Alert>

                {webhooksRegisteredAt && (
                  <Chip
                    label='Delivery reports and replies are on'
                    color='success'
                    variant='tonal'
                    icon={<i className='tabler-check' />}
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Connected phones */}
        {devices.length > 0 && (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardHeader title='Connected phones' />
              <CardContent>
                <div className='flex flex-col gap-3'>
                  {devices.map(d => (
                    <div key={d.id} className='flex items-center justify-between flex-wrap gap-2'>
                      <div className='flex items-center gap-3'>
                        <i className='tabler-device-mobile text-[24px]' />
                        <div>
                          <Typography className='font-medium'>{d.name || d.id}</Typography>
                          <Typography variant='body2' color='text.secondary'>
                            Last seen {d.lastSeen ? new Date(d.lastSeen).toLocaleString() : 'never'}
                          </Typography>
                        </div>
                      </div>
                      <div className='flex gap-2 flex-wrap'>
                        {(d.simCards || []).map(s => (
                          <Chip
                            key={s.simNumber}
                            size='small'
                            variant='tonal'
                            label={`SIM ${s.simNumber}${s.carrierName ? ` · ${s.carrierName}` : ''}${s.phoneNumber ? ` · ${s.phoneNumber}` : ''}`}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant='filled'
          className='is-full'
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default PhoneSMSSettings
