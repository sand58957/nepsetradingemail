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

// Services
import accountSettingsService from '@/services/accountSettings'

// Types
import type { LinkTrackingConfig } from '@/types/email'

interface Props {
  data: LinkTrackingConfig
  onSaveSuccess: (message: string) => void
  onSaveError: (message: string) => void
}

const mergeTags = [
  { label: 'Campaign Subject', value: '{$campaign_subject}' },
  { label: 'Campaign Date', value: '{$campaign_date}' },
  { label: 'Campaign Name', value: '{$campaign_name}' },
  { label: 'List Name', value: '{$list_name}' },
  { label: 'Subscriber Email', value: '{$subscriber_email}' },
  { label: 'Subscriber Name', value: '{$subscriber_name}' }
]

const LinkTrackingTab = ({ data, onSaveSuccess, onSaveError }: Props) => {
  const [form, setForm] = useState<LinkTrackingConfig>({
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_term: '',
    utm_content: ''
  })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data) {
      setForm(data)
    }
  }, [data])

  const handleChange = (field: keyof LinkTrackingConfig, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleInsertTag = (field: keyof LinkTrackingConfig, tag: string) => {
    setForm(prev => ({ ...prev, [field]: prev[field] + tag }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await accountSettingsService.updateLinkTracking(form)
      onSaveSuccess('Link tracking settings updated successfully')
    } catch (err) {
      console.error('Failed to save link tracking settings:', err)
      onSaveError('Failed to update link tracking settings')
    } finally {
      setSaving(false)
    }
  }

  const renderField = (
    field: keyof LinkTrackingConfig,
    label: string,
    utmParam: string,
    placeholder: string
  ) => (
    <Grid size={{ xs: 12 }}>
      <div className='flex flex-col gap-2'>
        <div className='flex items-center justify-between'>
          <Typography variant='subtitle2'>{label}</Typography>
          <FormControl size='small' sx={{ minWidth: 180 }}>
            <InputLabel>Insert personalization</InputLabel>
            <Select
              value=''
              label='Insert personalization'
              onChange={e => {
                if (e.target.value) {
                  handleInsertTag(field, e.target.value as string)
                }
              }}
              size='small'
            >
              {mergeTags.map(tag => (
                <MenuItem key={tag.value} value={tag.value}>
                  {tag.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </div>
        <TextField
          fullWidth
          value={form[field]}
          onChange={e => handleChange(field, e.target.value)}
          placeholder={placeholder}
          helperText={`Parameter: ${utmParam}`}
          size='small'
        />
      </div>
    </Grid>
  )

  return (
    <Card>
      <CardContent>
        <div className='flex flex-col gap-6'>
          {/* Header */}
          <div>
            <Typography variant='h6' className='mb-1'>
              Add UTM tags
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              UTM tags are added to the end of your URL so you can track where traffic comes from in Google Analytics.
              Set up UTM tags below and they will be automatically appended to all links in your email campaigns.
            </Typography>
          </div>

          <Divider />

          <Grid container spacing={5}>
            {renderField('utm_source', 'Campaign source', 'utm_source', 'e.g. newsletter')}
            {renderField('utm_medium', 'Campaign medium', 'utm_medium', 'e.g. email')}
            {renderField('utm_campaign', 'Campaign name', 'utm_campaign', 'e.g. spring_sale')}
            {renderField('utm_term', 'Campaign term', 'utm_term', 'e.g. running+shoes')}
            {renderField('utm_content', 'Campaign content', 'utm_content', 'e.g. logolink')}
          </Grid>

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

export default LinkTrackingTab
