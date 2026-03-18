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
import telegramService from '@/services/telegram'

// Type Imports
import type { TelegramSettings as TelegramSettingsType } from '@/types/telegram'

const TelegramSettings = () => {
  const [settings, setSettings] = useState<Partial<TelegramSettingsType>>({
    bot_token: '',
    send_rate: 10
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [showToken, setShowToken] = useState(false)
  const [botUsername, setBotUsername] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'connected' | 'failed'>('untested')

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await telegramService.getSettings()

        if (response.data) {
          setConfigured(response.data.configured)

          if (response.data.settings) {
            setSettings(response.data.settings)
          }

          if (response.data.bot_username) {
            setBotUsername(response.data.bot_username)
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
    if (!settings.bot_token) {
      setSnackbar({ open: true, message: 'Please enter your bot token', severity: 'error' })

      return
    }

    setSaving(true)

    try {
      await telegramService.updateSettings(settings)
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
      const response = await telegramService.testConnection()

      if (response.data?.connected) {
        setConnectionStatus('connected')

        if (response.data.bot_username) {
          setBotUsername(response.data.bot_username)
        }

        setSnackbar({ open: true, message: 'Connection successful!', severity: 'success' })
      } else {
        setConnectionStatus('failed')
        setSnackbar({ open: true, message: 'Connection failed. Check your bot token.', severity: 'error' })
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
                  <i className='tabler-brand-telegram text-[32px]' style={{ color: '#0088cc' }} />
                  <div>
                    <Typography variant='h5'>Telegram Settings</Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Configure your Telegram Bot API credentials
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
                  {botUsername && (
                    <Chip label={`@${botUsername}`} color='info' variant='tonal' icon={<i className='tabler-robot' />} />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* API Configuration */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader title='Bot Configuration' subheader='Enter your Telegram Bot API credentials' />
            <CardContent>
              <div className='flex flex-col gap-5'>
                <TextField
                  fullWidth
                  label='Bot Token *'
                  placeholder='Enter your Telegram bot token (e.g. 123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11)'
                  type={showToken ? 'text' : 'password'}
                  value={settings.bot_token || ''}
                  onChange={e => setSettings({ ...settings, bot_token: e.target.value })}
                  helperText='Your Telegram Bot API token from @BotFather'
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

                <Divider />

                <TextField
                  fullWidth
                  label='Send Rate (messages/second)'
                  type='number'
                  value={settings.send_rate || 10}
                  onChange={e => setSettings({ ...settings, send_rate: parseInt(e.target.value) || 10 })}
                  helperText='Maximum messages per second during campaign sending (Telegram limit: 30/sec)'
                  slotProps={{ htmlInput: { min: 1, max: 30 } }}
                />

                <Divider />

                <TextField
                  fullWidth
                  label='Subscription Code (Password Gate)'
                  value={settings.subscription_code || ''}
                  onChange={e => setSettings({ ...settings, subscription_code: e.target.value.toUpperCase() })}
                  helperText='Users must send /start CODE to subscribe. Leave empty to allow open subscription without a code.'
                  placeholder='e.g. PAID4283'
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
            <CardHeader title='Setup Guide' subheader='Follow these steps to connect your Telegram Bot' />
            <CardContent>
              <div className='flex flex-col gap-4'>
                <Alert severity='info' icon={<i className='tabler-info-circle' />}>
                  You need a Telegram Bot to use this feature.
                </Alert>

                <Typography variant='subtitle2' color='primary'>Step 1: Open BotFather</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Open Telegram and go to{' '}
                  <a href='https://t.me/BotFather' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                    t.me/BotFather
                  </a>
                  {' '}or search for <strong>@BotFather</strong> in Telegram. This is the official bot for creating and managing Telegram bots.
                </Typography>

                <Divider />

                <Typography variant='subtitle2' color='primary'>Step 2: Create a New Bot</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Send <strong>/newbot</strong> to @BotFather &rarr; Enter a <strong>display name</strong> for your bot (e.g. &ldquo;NEPSE Trading Bot&rdquo;) &rarr; Enter a <strong>username</strong> ending in &ldquo;bot&rdquo; (e.g. &ldquo;nepse_trading_bot&rdquo;).
                </Typography>

                <Divider />

                <Typography variant='subtitle2' color='primary'>Step 3: Copy the Bot Token</Typography>
                <Typography variant='body2' color='text.secondary'>
                  BotFather will reply with your <strong>bot token</strong> (looks like <code>123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11</code>). Copy this token and paste it in the <strong>Bot Token</strong> field on the left.
                </Typography>

                <Divider />

                <Typography variant='subtitle2' color='primary'>Step 4: Set Subscription Code (Optional)</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Enter a <strong>Subscription Code</strong> to require users to send <code>/start CODE</code> to subscribe. Leave empty to allow anyone to subscribe with just <code>/start</code>.
                </Typography>

                <Divider />

                <Typography variant='subtitle2' color='primary'>Step 5: Save &amp; Test</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Click <strong>&ldquo;Save Settings&rdquo;</strong> &rarr; Click <strong>&ldquo;Test Connection&rdquo;</strong>. If successful, your bot username will appear. Then share your bot link: <strong>t.me/your_bot_username</strong>
                </Typography>

                <Divider />

                <Typography variant='subtitle2' color='primary'>Step 6: Customize Your Bot (Optional)</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Back in @BotFather: Send <strong>/setdescription</strong> to add a bot description &rarr; Send <strong>/setuserpic</strong> to set a profile photo &rarr; Send <strong>/setcommands</strong> to add menu commands.
                </Typography>

                <Divider />

                <Alert severity='success' icon={<i className='tabler-free-rights' />}>
                  Telegram messaging is completely free! No per-message charges. Limit: 30 messages/second.
                </Alert>

                <Alert severity='info' variant='outlined' sx={{ py: 0.5 }}>
                  <Typography variant='caption'>
                    <strong>Telegram Bot API Docs:</strong>{' '}
                    <a href='https://core.telegram.org/bots/api' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                      core.telegram.org/bots/api
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

export default TelegramSettings
