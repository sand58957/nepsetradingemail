'use client'

import { useState, useEffect } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'

// Services
import accountSettingsService from '@/services/accountSettings'

// Types
import type { EcommerceConfig } from '@/types/email'

interface Props {
  data: EcommerceConfig
  onSaveSuccess: (message: string) => void
  onSaveError: (message: string) => void
}

const EcommerceTab = ({ data, onSaveSuccess, onSaveError }: Props) => {
  const [form, setForm] = useState<EcommerceConfig>({
    enabled: false,
    provider: '',
    api_key: '',
    store_url: ''
  })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data) {
      setForm(data)
    }
  }, [data])

  const handleChange = (field: keyof EcommerceConfig, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await accountSettingsService.updateEcommerce(form)
      onSaveSuccess('E-commerce settings updated successfully')
    } catch (err) {
      console.error('Failed to save e-commerce settings:', err)
      onSaveError('Failed to update e-commerce settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <div className='flex flex-col gap-6'>
          {/* Header */}
          <div>
            <Typography variant='h6' className='mb-1'>
              E-commerce Integration
            </Typography>
            <Typography variant='body2' color='text.secondary' className='mb-4'>
              Connect your online store to sync customer data and enable targeted email campaigns
            </Typography>
          </div>

          <Alert severity='info'>
            E-commerce integration allows you to sync customer purchase data, create targeted segments based on
            buying behavior, and send automated post-purchase emails. Connect your store provider below.
          </Alert>

          <FormControlLabel
            control={
              <Switch
                checked={form.enabled}
                onChange={e => handleChange('enabled', e.target.checked)}
              />
            }
            label='Enable e-commerce integration'
          />

          {form.enabled && (
            <>
              <Divider />

              <Grid container spacing={4}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <FormControl fullWidth>
                    <InputLabel>Provider</InputLabel>
                    <Select
                      value={form.provider}
                      label='Provider'
                      onChange={e => handleChange('provider', e.target.value)}
                    >
                      <MenuItem value='shopify'>Shopify</MenuItem>
                      <MenuItem value='woocommerce'>WooCommerce</MenuItem>
                      <MenuItem value='magento'>Magento</MenuItem>
                      <MenuItem value='bigcommerce'>BigCommerce</MenuItem>
                      <MenuItem value='custom'>Custom API</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label='Store URL'
                    value={form.store_url}
                    onChange={e => handleChange('store_url', e.target.value)}
                    placeholder='https://your-store.com'
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label='API Key'
                    value={form.api_key}
                    onChange={e => handleChange('api_key', e.target.value)}
                    placeholder='Enter your store API key'
                    type='password'
                    helperText='Your API key is encrypted and stored securely'
                  />
                </Grid>
              </Grid>
            </>
          )}

          <Divider />

          {/* Save Button */}
          <div className='flex justify-end'>
            <Button
              variant='contained'
              color='success'
              onClick={handleSave}
              disabled={saving}
              startIcon={saving ? null : <i className='tabler-device-floppy' />}
            >
              {saving ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default EcommerceTab
