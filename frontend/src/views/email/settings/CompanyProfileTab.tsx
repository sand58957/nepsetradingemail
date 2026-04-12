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

// Services
import accountSettingsService from '@/services/accountSettings'

// Types
import type { CompanyProfile } from '@/types/email'

interface Props {
  data: CompanyProfile
  onSaveSuccess: (message: string) => void
  onSaveError: (message: string) => void
}

const timezones = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Kathmandu',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland'
]

const countries = [
  'Nepal',
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda',
  'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
  'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize',
  'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil',
  'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi',
  'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada', 'Central African Republic', 'Chad',
  'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba',
  'Cyprus', 'Czech Republic',
  'Democratic Republic of the Congo', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
  'East Timor', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea',
  'Estonia', 'Eswatini', 'Ethiopia',
  'Fiji', 'Finland', 'France',
  'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala',
  'Guinea', 'Guinea-Bissau', 'Guyana',
  'Haiti', 'Honduras', 'Hong Kong', 'Hungary',
  'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Ivory Coast',
  'Jamaica', 'Japan', 'Jordan',
  'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo', 'Kuwait', 'Kyrgyzstan',
  'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein',
  'Lithuania', 'Luxembourg',
  'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands',
  'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia',
  'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
  'Namibia', 'Nauru', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria',
  'North Korea', 'North Macedonia', 'Norway',
  'Oman',
  'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru',
  'Philippines', 'Poland', 'Portugal',
  'Qatar',
  'Romania', 'Russia', 'Rwanda',
  'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa',
  'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia',
  'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands',
  'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan',
  'Suriname', 'Sweden', 'Switzerland', 'Syria',
  'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Togo', 'Tonga',
  'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu',
  'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States',
  'Uruguay', 'Uzbekistan',
  'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam',
  'Yemen',
  'Zambia', 'Zimbabwe'
]

const CompanyProfileTab = ({ data, onSaveSuccess, onSaveError }: Props) => {
  const [form, setForm] = useState<CompanyProfile>({
    company_name: '',
    website: '',
    address: '',
    city: '',
    country: '',
    timezone: 'UTC',
    time_format: '12h',
    show_branding: true
  })

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data) {
      setForm(data)
    }
  }, [data])

  const handleChange = (field: keyof CompanyProfile, value: string | boolean) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await accountSettingsService.updateCompanyProfile(form)
      onSaveSuccess('Company profile updated successfully')
    } catch (err) {
      console.error('Failed to save company profile:', err)
      onSaveError('Failed to update company profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <div className='flex flex-col gap-6'>
          {/* Organization Information */}
          <div>
            <Typography variant='h6' className='mb-1'>
              Organization information
            </Typography>
            <Typography variant='body2' color='text.secondary' className='mb-4'>
              Your company details used across the platform
            </Typography>
          </div>

          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label='Company name'
                value={form.company_name}
                onChange={e => handleChange('company_name', e.target.value)}
                placeholder='Your company name'
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label='Website URL'
                value={form.website}
                onChange={e => handleChange('website', e.target.value)}
                placeholder='https://www.example.com'
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Address'
                value={form.address}
                onChange={e => handleChange('address', e.target.value)}
                placeholder='Street address'
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label='City'
                value={form.city}
                onChange={e => handleChange('city', e.target.value)}
                placeholder='City'
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Country</InputLabel>
                <Select
                  value={form.country}
                  label='Country'
                  onChange={e => handleChange('country', e.target.value)}
                >
                  {countries.map(c => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Divider />

          {/* Time Settings */}
          <div>
            <Typography variant='h6' className='mb-1'>
              Time
            </Typography>
            <Typography variant='body2' color='text.secondary' className='mb-4'>
              Configure timezone and time format for your account
            </Typography>
          </div>

          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Timezone</InputLabel>
                <Select
                  value={form.timezone}
                  label='Timezone'
                  onChange={e => handleChange('timezone', e.target.value)}
                >
                  {timezones.map(tz => (
                    <MenuItem key={tz} value={tz}>
                      {tz}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Time format</InputLabel>
                <Select
                  value={form.time_format}
                  label='Time format'
                  onChange={e => handleChange('time_format', e.target.value as '12h' | '24h')}
                >
                  <MenuItem value='12h'>12-hour (AM/PM)</MenuItem>
                  <MenuItem value='24h'>24-hour</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Divider />

          {/* Branding */}
          <div>
            <Typography variant='h6' className='mb-1'>
              Branding
            </Typography>
            <Typography variant='body2' color='text.secondary' className='mb-4'>
              Control branding visibility in your emails
            </Typography>
          </div>

          <FormControlLabel
            control={
              <Switch
                checked={form.show_branding}
                onChange={e => handleChange('show_branding', e.target.checked)}
              />
            }
            label='Show platform branding in emails'
          />

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

export default CompanyProfileTab
