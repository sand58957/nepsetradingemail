'use client'

// React Imports
import { useState, useEffect, useRef } from 'react'

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
import Box from '@mui/material/Box'

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
    send_rate: 10,
    opt_in_keyword: '',
    welcome_message: '',
    keyword_prompt: '',
    qr_code_url: ''
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [configured, setConfigured] = useState(false)
  const [showPageAccessToken, setShowPageAccessToken] = useState(false)
  const [showAppSecret, setShowAppSecret] = useState(false)
  const [pageName, setPageName] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'connected' | 'failed'>('untested')
  const [generatingKeyword, setGeneratingKeyword] = useState(false)
  const [uploadingQR, setUploadingQR] = useState(false)
  const qrFileRef = useRef<HTMLInputElement>(null)

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

  const handleGenerateKeyword = async () => {
    setGeneratingKeyword(true)

    try {
      const response = await messengerService.generateKeyword()

      if (response.data?.keyword) {
        setSettings({ ...settings, opt_in_keyword: response.data.keyword })
        setSnackbar({ open: true, message: `Generated keyword: ${response.data.keyword}`, severity: 'success' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to generate keyword', severity: 'error' })
    } finally {
      setGeneratingKeyword(false)
    }
  }

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) return

    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setSnackbar({ open: true, message: 'Only PNG, JPEG, and WebP images are allowed', severity: 'error' })

      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setSnackbar({ open: true, message: 'File too large (max 5MB)', severity: 'error' })

      return
    }

    setUploadingQR(true)

    try {
      const formData = new FormData()

      formData.append('file', file)

      const response = await messengerService.uploadQR(formData)

      if (response.data?.url) {
        setSettings({ ...settings, qr_code_url: response.data.url })
        setSnackbar({ open: true, message: 'QR code uploaded successfully', severity: 'success' })
      }
    } catch {
      setSnackbar({ open: true, message: 'Failed to upload QR code', severity: 'error' })
    } finally {
      setUploadingQR(false)

      if (qrFileRef.current) qrFileRef.current.value = ''
    }
  }

  const handleDeleteQR = async () => {
    try {
      await messengerService.deleteQR()
      setSettings({ ...settings, qr_code_url: '' })
      setSnackbar({ open: true, message: 'QR code removed', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to remove QR code', severity: 'error' })
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

                <Divider />

                <Typography variant='subtitle1' className='font-medium'>
                  Opt-in Keyword Settings
                </Typography>
                <Typography variant='body2' color='text.secondary' className='-mt-3'>
                  Require users to send a secret keyword before adding them as contacts. Leave empty to auto-subscribe all users who message the page.
                </Typography>

                <div className='flex gap-3 items-start'>
                  <TextField
                    fullWidth
                    label='Opt-in Keyword'
                    placeholder='e.g. JOIN, SUBSCRIBE, NEPSE2024'
                    value={settings.opt_in_keyword || ''}
                    onChange={e => setSettings({ ...settings, opt_in_keyword: e.target.value })}
                    helperText='Users must send this exact keyword to get subscribed. Leave empty to auto-subscribe everyone.'
                  />
                  <Button
                    variant='outlined'
                    onClick={handleGenerateKeyword}
                    disabled={generatingKeyword}
                    sx={{ mt: 0.5, minWidth: 160, height: 56 }}
                    startIcon={generatingKeyword ? <CircularProgress size={16} /> : <i className='tabler-refresh' />}
                  >
                    {generatingKeyword ? 'Generating...' : 'Generate Key'}
                  </Button>
                </div>

                <TextField
                  fullWidth
                  label='Keyword Prompt Message'
                  placeholder='e.g. Welcome! To subscribe, please send the keyword: JOIN'
                  value={settings.keyword_prompt || ''}
                  onChange={e => setSettings({ ...settings, keyword_prompt: e.target.value })}
                  multiline
                  rows={2}
                  helperText='Message sent to users who message without the correct keyword. Leave empty for default.'
                />

                <TextField
                  fullWidth
                  label='Welcome Message'
                  placeholder='e.g. You have been successfully subscribed! Send STOP to unsubscribe.'
                  value={settings.welcome_message || ''}
                  onChange={e => setSettings({ ...settings, welcome_message: e.target.value })}
                  multiline
                  rows={2}
                  helperText='Message sent to users after successful subscription. Leave empty for default.'
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
          <div className='flex flex-col gap-6'>
            <Card>
              <CardHeader title='Setup Guide' subheader='Follow these steps to connect your Facebook Page' />
              <CardContent>
                <div className='flex flex-col gap-4'>
                  <Alert severity='info' icon={<i className='tabler-info-circle' />}>
                    You need a Facebook App with Messenger product to use this feature.
                  </Alert>

                  <Typography variant='subtitle2' color='primary'>Step 1: Create a Facebook App</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Go to{' '}
                    <a href='https://developers.facebook.com/apps/' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                      developers.facebook.com/apps
                    </a>
                    {' '}&rarr; Click <strong>&ldquo;Create App&rdquo;</strong> &rarr; Select <strong>&ldquo;Business&rdquo;</strong> type &rarr; Enter app name &rarr; Click <strong>&ldquo;Create&rdquo;</strong>.
                  </Typography>

                  <Divider />

                  <Typography variant='subtitle2' color='primary'>Step 2: Add Messenger Product</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    In your App Dashboard &rarr; Click <strong>&ldquo;Use Cases&rdquo;</strong> in sidebar &rarr; Select <strong>&ldquo;Messenger from Meta&rdquo;</strong> &rarr; Click <strong>&ldquo;Messenger API Settings&rdquo;</strong>.
                  </Typography>

                  <Divider />

                  <Typography variant='subtitle2' color='primary'>Step 3: Get App ID &amp; App Secret</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    In your app at{' '}
                    <a href='https://developers.facebook.com/apps/' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                      developers.facebook.com
                    </a>
                    {' '}&rarr; Sidebar &rarr; <strong>&ldquo;App Settings&rdquo;</strong> &rarr; <strong>&ldquo;Basic&rdquo;</strong>. Copy the <strong>App ID</strong> and click <strong>&ldquo;Show&rdquo;</strong> next to App Secret to copy it.
                  </Typography>

                  <Divider />

                  <Typography variant='subtitle2' color='primary'>Step 4: Get Page ID</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Go to your Facebook Page &rarr; Click <strong>&ldquo;About&rdquo;</strong> &rarr; Scroll to <strong>&ldquo;Page Transparency&rdquo;</strong> section &rarr; Copy the <strong>Page ID</strong> (numeric). Or use Graph API Explorer: select your page and the ID shows in the response.
                  </Typography>

                  <Divider />

                  <Typography variant='subtitle2' color='primary'>Step 5: Generate Page Access Token</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Go to{' '}
                    <a href='https://developers.facebook.com/tools/explorer/' target='_blank' rel='noopener noreferrer' style={{ color: '#1976d2' }}>
                      Graph API Explorer
                    </a>
                    {' '}&rarr; Select your app &rarr; Add permissions: <strong>pages_messaging, pages_manage_metadata, pages_read_engagement, pages_show_list</strong> &rarr; Click <strong>&ldquo;Generate Access Token&rdquo;</strong> &rarr; Approve all permissions &rarr; Change dropdown from <strong>&ldquo;User Token&rdquo;</strong> to <strong>&ldquo;Page Token&rdquo;</strong> &rarr; Select your page &rarr; Copy the token.
                  </Typography>
                  <Alert severity='warning' variant='outlined' sx={{ py: 0.5 }}>
                    <Typography variant='caption'>
                      Short-lived tokens expire in ~2 hours. For production, generate a long-lived token from the Messenger API Settings page under &ldquo;Generate access tokens&rdquo;.
                    </Typography>
                  </Alert>

                  <Divider />

                  <Typography variant='subtitle2' color='primary'>Step 6: Configure Webhook</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    In Messenger API Settings &rarr; <strong>&ldquo;Configure webhooks&rdquo;</strong> &rarr; Click <strong>&ldquo;Edit&rdquo;</strong> &rarr; Set Callback URL to: <strong>https://nepalfillings.com/api/webhooks/messenger/YOUR_ACCOUNT_ID</strong> &rarr; Set Verify Token to the same value entered here &rarr; Click <strong>&ldquo;Verify and Save&rdquo;</strong>.
                  </Typography>

                  <Divider />

                  <Typography variant='subtitle2' color='primary'>Step 7: Subscribe Page to Webhook</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    In Messenger API Settings &rarr; <strong>&ldquo;Generate access tokens&rdquo;</strong> section &rarr; Find your page &rarr; Click <strong>&ldquo;Subscribe&rdquo;</strong> button next to it. Ensure <strong>messages, messaging_postbacks, messaging_optins</strong> are checked.
                  </Typography>

                  <Divider />

                  <Typography variant='subtitle2' color='primary'>Step 8: Test Connection</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Fill all fields above &rarr; Click <strong>&ldquo;Save Settings&rdquo;</strong> &rarr; Click <strong>&ldquo;Test Connection&rdquo;</strong>. If successful, your Page name will appear. Then send a message from your personal Messenger to test the webhook.
                  </Typography>

                  <Divider />

                  <Alert severity='success' icon={<i className='tabler-free-rights' />}>
                    Messenger messaging is free within the 24-hour window. After 24 hours since user&apos;s last message, you need a Message Tag to send.
                  </Alert>

                  <Alert severity='info' variant='outlined' sx={{ py: 0.5 }}>
                    <Typography variant='caption'>
                      <strong>Note:</strong> In Development mode, only app admins, developers, and testers can receive messages. Go to <strong>App Roles</strong> to add testers, or submit for <strong>App Review</strong> to go live.
                    </Typography>
                  </Alert>
                </div>
              </CardContent>
            </Card>

            {/* QR Code Upload */}
            <Card>
              <CardHeader title='QR Code' subheader='Upload a QR code for customers to scan and message your page' />
              <CardContent>
                <div className='flex flex-col gap-4'>
                  {settings.qr_code_url ? (
                    <Box className='flex flex-col items-center gap-3'>
                      <Box
                        component='img'
                        src={settings.qr_code_url}
                        alt='Messenger QR Code'
                        sx={{
                          maxWidth: 220,
                          maxHeight: 220,
                          borderRadius: 2,
                          border: '1px solid',
                          borderColor: 'divider',
                          p: 1
                        }}
                      />
                      <Button
                        variant='outlined'
                        color='error'
                        size='small'
                        onClick={handleDeleteQR}
                        startIcon={<i className='tabler-trash' />}
                      >
                        Remove QR Code
                      </Button>
                    </Box>
                  ) : (
                    <Box
                      className='flex flex-col items-center justify-center gap-2'
                      sx={{
                        border: '2px dashed',
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 4,
                        cursor: 'pointer',
                        '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' }
                      }}
                      onClick={() => qrFileRef.current?.click()}
                    >
                      <i className='tabler-qrcode text-[48px]' style={{ opacity: 0.4 }} />
                      <Typography variant='body2' color='text.secondary'>
                        Click to upload QR code
                      </Typography>
                      <Typography variant='caption' color='text.disabled'>
                        PNG, JPEG, WebP (max 5MB)
                      </Typography>
                    </Box>
                  )}

                  <input
                    ref={qrFileRef}
                    type='file'
                    accept='image/png,image/jpeg,image/webp'
                    hidden
                    onChange={handleQRUpload}
                  />

                  {!settings.qr_code_url && (
                    <Button
                      variant='outlined'
                      onClick={() => qrFileRef.current?.click()}
                      disabled={uploadingQR}
                      startIcon={uploadingQR ? <CircularProgress size={16} /> : <i className='tabler-upload' />}
                      fullWidth
                    >
                      {uploadingQR ? 'Uploading...' : 'Upload QR Code'}
                    </Button>
                  )}

                  <Alert severity='info' variant='outlined'>
                    <Typography variant='caption'>
                      Share this QR code with customers. When they scan it, it will open Messenger and they can send the opt-in keyword to subscribe.
                    </Typography>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </div>
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
