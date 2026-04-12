'use client'

import { useState, useEffect } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import MenuItem from '@mui/material/MenuItem'
import Grid from '@mui/material/Grid'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'

import api from '@/services/api'

interface WidgetConfig {
  enabled: boolean
  phone: string
  message: string
  position: string
  label: string
}

const WhatsAppWidgetTab = () => {
  const [config, setConfig] = useState<WidgetConfig>({
    enabled: true,
    phone: '',
    message: 'Hello! I would like to know more about your services.',
    position: 'right',
    label: 'Chat with us'
  })

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await api.get('/account-settings/whatsapp_widget')

        if (res.data?.data?.value) {
          setConfig(res.data.data.value)
        }
      } catch {
        // Settings not found yet - use defaults
      } finally {
        setLoading(false)
      }
    }

    fetchConfig()
  }, [])

  const handleSave = async () => {
    if (!config.phone) {
      setError('WhatsApp phone number is required')

      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      await api.put('/account-settings/whatsapp_widget', { value: config })
      setSuccess('WhatsApp widget settings saved successfully!')
    } catch {
      setError('Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className='flex justify-center py-12'>
          <CircularProgress />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title='WhatsApp Floating Button'
        subheader='Configure the WhatsApp chat button that appears on your landing page'
      />
      <Divider />
      <CardContent className='flex flex-col gap-6'>
        {error && (
          <Alert severity='error' onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity='success' onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        <FormControlLabel
          control={
            <Switch
              checked={config.enabled}
              onChange={e => setConfig({ ...config, enabled: e.target.checked })}
              color='success'
            />
          }
          label={
            <div>
              <Typography fontWeight={600}>Enable WhatsApp Button</Typography>
              <Typography variant='caption' color='text.secondary'>
                Show floating WhatsApp chat button on all public pages
              </Typography>
            </div>
          }
        />

        <Divider />

        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label='WhatsApp Phone Number'
              placeholder='9779800000000'
              value={config.phone}
              onChange={e => setConfig({ ...config, phone: e.target.value })}
              helperText='Include country code (e.g., 977 for Nepal). Example: 9779812345678'
              slotProps={{
                input: {
                  startAdornment: (
                    <i className='tabler-brand-whatsapp text-xl text-green-500 mr-2' />
                  )
                }
              }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              select
              label='Button Position'
              value={config.position}
              onChange={e => setConfig({ ...config, position: e.target.value })}
              helperText='Where the button appears on the screen'
            >
              <MenuItem value='right'>Bottom Right</MenuItem>
              <MenuItem value='left'>Bottom Left</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              label='Tooltip Label'
              placeholder='Chat with us'
              value={config.label}
              onChange={e => setConfig({ ...config, label: e.target.value })}
              helperText='Text shown in the tooltip bubble above the button'
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label='Pre-filled Message'
              placeholder='Hello! I would like to know more about your services.'
              value={config.message}
              onChange={e => setConfig({ ...config, message: e.target.value })}
              helperText='This message will be pre-filled when visitors click the WhatsApp button'
            />
          </Grid>
        </Grid>

        {/* Preview */}
        <Card variant='outlined' sx={{ bgcolor: 'action.hover' }}>
          <CardContent>
            <Typography variant='subtitle2' color='text.secondary' sx={{ mb: 2 }}>
              Preview
            </Typography>
            <div className='flex items-center gap-3'>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: '#25D366',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 15px rgba(37, 211, 102, 0.4)'
                }}
              >
                <i className='tabler-brand-whatsapp text-2xl text-white' />
              </div>
              <div>
                <Typography variant='body2' fontWeight={600}>
                  {config.label || 'Chat with us'}
                </Typography>
                <Typography variant='caption' color='text.secondary'>
                  Opens wa.me/{config.phone || '9779800000000'}
                </Typography>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className='flex justify-end'>
          <Button variant='contained' onClick={handleSave} disabled={saving} startIcon={saving ? <CircularProgress size={18} /> : <i className='tabler-device-floppy' />}>
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default WhatsAppWidgetTab
