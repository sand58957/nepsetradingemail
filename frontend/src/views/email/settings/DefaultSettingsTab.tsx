'use client'

import { useState, useEffect, useRef } from 'react'

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
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Box from '@mui/material/Box'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'

// Services
import accountSettingsService from '@/services/accountSettings'

// Types
import type { BrandDefaults, SocialLink } from '@/types/email'

interface Props {
  data: BrandDefaults
  onSaveSuccess: (message: string) => void
  onSaveError: (message: string) => void
}

const fontFamilies = [
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Trebuchet MS',
  'Verdana',
  'Courier New',
  'Tahoma',
  'Lucida Sans',
  'Open Sans',
  'Roboto',
  'Lato',
  'Montserrat',
  'Poppins'
]

const socialPlatforms = [
  'Facebook',
  'Twitter',
  'Instagram',
  'LinkedIn',
  'YouTube',
  'TikTok',
  'Pinterest',
  'Snapchat',
  'Reddit',
  'Discord',
  'Telegram',
  'WhatsApp',
  'Website',
  'Blog',
  'RSS'
]

const defaultBrandDefaults: BrandDefaults = {
  sender_name: '',
  sender_email: '',
  custom_reply_to: false,
  reply_to_email: '',
  add_recipient_name: false,
  logo_url: '',
  force_update_logo: false,
  font_family: 'Arial',
  color_primary: '#009933',
  color_secondary: '#f5f5f5',
  color_heading: '#333333',
  color_text: '#666666',
  color_border: '#e0e0e0',
  track_opens: true,
  google_analytics: false,
  ga_campaigns: true,
  ga_automations: false,
  social_links: [],
  company_details: '',
  auto_generate_footer: true,
  force_update_footer: false,
  unsubscribe_disclaimer: '',
  unsubscribe_link_text: 'Unsubscribe'
}

const DefaultSettingsTab = ({ data, onSaveSuccess, onSaveError }: Props) => {
  const [form, setForm] = useState<BrandDefaults>(defaultBrandDefaults)
  const [saving, setSaving] = useState(false)
  const [gaTab, setGaTab] = useState(0)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (data) {
      setForm({ ...defaultBrandDefaults, ...data })
    }
  }, [data])

  const handleChange = (field: keyof BrandDefaults, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleSocialLinkChange = (index: number, field: keyof SocialLink, value: string) => {
    setForm(prev => ({
      ...prev,
      social_links: prev.social_links.map((link, i) => (i === index ? { ...link, [field]: value } : link))
    }))
  }

  const handleAddSocialLink = () => {
    setForm(prev => ({
      ...prev,
      social_links: [...prev.social_links, { platform: 'Facebook', url: '' }]
    }))
  }

  const handleRemoveSocialLink = (index: number) => {
    setForm(prev => ({
      ...prev,
      social_links: prev.social_links.filter((_, i) => i !== index)
    }))
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) return

    try {
      setUploading(true)

      const response = await accountSettingsService.uploadLogo(file)

      handleChange('logo_url', response.data.url)
    } catch (err) {
      console.error('Failed to upload logo:', err)
      onSaveError('Failed to upload logo')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveLogo = () => {
    handleChange('logo_url', '')
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await accountSettingsService.updateBrandDefaults(form)
      onSaveSuccess('Default settings updated successfully')
    } catch (err) {
      console.error('Failed to save default settings:', err)
      onSaveError('Failed to update default settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardContent>
        <div className='flex flex-col gap-6'>
          {/* Default Sender */}
          <div>
            <Typography variant='h6' className='mb-1'>
              Default sender
            </Typography>
            <Typography variant='body2' color='text.secondary' className='mb-4'>
              These details will be used as defaults when creating new campaigns
            </Typography>
          </div>

          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label='Sender name'
                value={form.sender_name}
                onChange={e => handleChange('sender_name', e.target.value)}
                placeholder='Your Company'
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                fullWidth
                label='Sender email address'
                value={form.sender_email}
                onChange={e => handleChange('sender_email', e.target.value)}
                placeholder='hello@yourcompany.com'
                type='email'
              />
            </Grid>
          </Grid>

          <Divider />

          {/* Custom Reply-to */}
          <div>
            <FormControlLabel
              control={
                <Switch
                  checked={form.custom_reply_to}
                  onChange={e => handleChange('custom_reply_to', e.target.checked)}
                />
              }
              label={
                <div>
                  <Typography variant='subtitle2'>Custom reply-to email address</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Set a different email address for receiving replies
                  </Typography>
                </div>
              }
            />
            {form.custom_reply_to && (
              <TextField
                fullWidth
                label='Reply-to email'
                value={form.reply_to_email}
                onChange={e => handleChange('reply_to_email', e.target.value)}
                placeholder='reply@yourcompany.com'
                type='email'
                className='mt-3'
                size='small'
              />
            )}
          </div>

          <Divider />

          {/* Add Recipient Name */}
          <FormControlLabel
            control={
              <Switch
                checked={form.add_recipient_name}
                onChange={e => handleChange('add_recipient_name', e.target.checked)}
              />
            }
            label={
              <div>
                <Typography variant='subtitle2'>Add recipient&apos;s name to &quot;To&quot; field</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Display subscriber name alongside their email address in the recipient field
                </Typography>
              </div>
            }
          />

          <Divider />

          {/* Default Logo */}
          <div>
            <Typography variant='h6' className='mb-1'>
              Default logo
            </Typography>
            <Typography variant='body2' color='text.secondary' className='mb-4'>
              Your logo will be shown in email headers. Recommended size: 200x50px
            </Typography>
          </div>

          <div className='flex items-center gap-4'>
            {form.logo_url ? (
              <div className='flex items-center gap-4'>
                <div className='border rounded-lg p-3 bg-gray-50'>
                  <img
                    src={form.logo_url}
                    alt='Logo'
                    style={{ maxWidth: 200, maxHeight: 60, objectFit: 'contain' }}
                  />
                </div>
                <div className='flex flex-col gap-2'>
                  <Button
                    variant='outlined'
                    size='small'
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? 'Uploading...' : 'Change logo'}
                  </Button>
                  <Button variant='outlined' size='small' color='error' onClick={handleRemoveLogo}>
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant='outlined'
                onClick={() => fileInputRef.current?.click()}
                startIcon={<i className='tabler-upload' />}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload logo'}
              </Button>
            )}
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              onChange={handleLogoUpload}
              style={{ display: 'none' }}
            />
          </div>

          <FormControlLabel
            control={
              <Switch
                checked={form.force_update_logo}
                onChange={e => handleChange('force_update_logo', e.target.checked)}
              />
            }
            label='Force update logo in all existing templates'
          />

          <Divider />

          {/* Brand Settings */}
          <div>
            <Typography variant='h6' className='mb-1'>
              Brand settings
            </Typography>
            <Typography variant='body2' color='text.secondary' className='mb-4'>
              Customize the look and feel of your emails
            </Typography>
          </div>

          <Grid container spacing={4}>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Font family</InputLabel>
                <Select
                  value={form.font_family}
                  label='Font family'
                  onChange={e => handleChange('font_family', e.target.value)}
                >
                  {fontFamilies.map(font => (
                    <MenuItem key={font} value={font}>
                      <span style={{ fontFamily: font }}>{font}</span>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
              <div className='flex flex-col gap-2'>
                <Typography variant='caption' color='text.secondary'>
                  Primary color
                </Typography>
                <div className='flex items-center gap-2'>
                  <input
                    type='color'
                    value={form.color_primary}
                    onChange={e => handleChange('color_primary', e.target.value)}
                    style={{ width: 40, height: 40, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                  />
                  <TextField
                    size='small'
                    value={form.color_primary}
                    onChange={e => handleChange('color_primary', e.target.value)}
                    sx={{ width: 100 }}
                  />
                </div>
              </div>
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
              <div className='flex flex-col gap-2'>
                <Typography variant='caption' color='text.secondary'>
                  Secondary color
                </Typography>
                <div className='flex items-center gap-2'>
                  <input
                    type='color'
                    value={form.color_secondary}
                    onChange={e => handleChange('color_secondary', e.target.value)}
                    style={{ width: 40, height: 40, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                  />
                  <TextField
                    size='small'
                    value={form.color_secondary}
                    onChange={e => handleChange('color_secondary', e.target.value)}
                    sx={{ width: 100 }}
                  />
                </div>
              </div>
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
              <div className='flex flex-col gap-2'>
                <Typography variant='caption' color='text.secondary'>
                  Heading color
                </Typography>
                <div className='flex items-center gap-2'>
                  <input
                    type='color'
                    value={form.color_heading}
                    onChange={e => handleChange('color_heading', e.target.value)}
                    style={{ width: 40, height: 40, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                  />
                  <TextField
                    size='small'
                    value={form.color_heading}
                    onChange={e => handleChange('color_heading', e.target.value)}
                    sx={{ width: 100 }}
                  />
                </div>
              </div>
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
              <div className='flex flex-col gap-2'>
                <Typography variant='caption' color='text.secondary'>
                  Text color
                </Typography>
                <div className='flex items-center gap-2'>
                  <input
                    type='color'
                    value={form.color_text}
                    onChange={e => handleChange('color_text', e.target.value)}
                    style={{ width: 40, height: 40, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                  />
                  <TextField
                    size='small'
                    value={form.color_text}
                    onChange={e => handleChange('color_text', e.target.value)}
                    sx={{ width: 100 }}
                  />
                </div>
              </div>
            </Grid>
            <Grid size={{ xs: 6, sm: 4, md: 2.4 }}>
              <div className='flex flex-col gap-2'>
                <Typography variant='caption' color='text.secondary'>
                  Border color
                </Typography>
                <div className='flex items-center gap-2'>
                  <input
                    type='color'
                    value={form.color_border}
                    onChange={e => handleChange('color_border', e.target.value)}
                    style={{ width: 40, height: 40, border: 'none', cursor: 'pointer', borderRadius: 4 }}
                  />
                  <TextField
                    size='small'
                    value={form.color_border}
                    onChange={e => handleChange('color_border', e.target.value)}
                    sx={{ width: 100 }}
                  />
                </div>
              </div>
            </Grid>
          </Grid>

          <Divider />

          {/* Tracking Options */}
          <div>
            <Typography variant='h6' className='mb-1'>
              Tracking options
            </Typography>
            <Typography variant='body2' color='text.secondary' className='mb-4'>
              Configure email tracking and analytics
            </Typography>
          </div>

          <FormControlLabel
            control={
              <Switch
                checked={form.track_opens}
                onChange={e => handleChange('track_opens', e.target.checked)}
              />
            }
            label={
              <div>
                <Typography variant='subtitle2'>Track opens</Typography>
                <Typography variant='body2' color='text.secondary'>
                  Track when subscribers open your emails
                </Typography>
              </div>
            }
          />

          <div>
            <FormControlLabel
              control={
                <Switch
                  checked={form.google_analytics}
                  onChange={e => handleChange('google_analytics', e.target.checked)}
                />
              }
              label={
                <div>
                  <Typography variant='subtitle2'>Google Analytics</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Enable Google Analytics tracking for links in your emails
                  </Typography>
                </div>
              }
            />

            {form.google_analytics && (
              <Box className='ml-12 mt-2'>
                <Tabs value={gaTab} onChange={(_, v) => setGaTab(v)} sx={{ mb: 1 }}>
                  <Tab label='Campaigns' sx={{ textTransform: 'none', fontSize: '0.85rem' }} />
                  <Tab label='Automations' sx={{ textTransform: 'none', fontSize: '0.85rem' }} />
                </Tabs>
                {gaTab === 0 && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.ga_campaigns}
                        onChange={e => handleChange('ga_campaigns', e.target.checked)}
                        size='small'
                      />
                    }
                    label='Enable for campaigns'
                  />
                )}
                {gaTab === 1 && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={form.ga_automations}
                        onChange={e => handleChange('ga_automations', e.target.checked)}
                        size='small'
                      />
                    }
                    label='Enable for automations'
                  />
                )}
              </Box>
            )}
          </div>

          <Divider />

          {/* Social Links */}
          <div>
            <Typography variant='h6' className='mb-1'>
              Social links
            </Typography>
            <Typography variant='body2' color='text.secondary' className='mb-4'>
              Add social media links to include in your email footers
            </Typography>
          </div>

          {form.social_links.map((link, index) => (
            <Grid container spacing={2} key={index} className='items-center'>
              <Grid size={{ xs: 12, sm: 4 }}>
                <FormControl fullWidth size='small'>
                  <InputLabel>Platform</InputLabel>
                  <Select
                    value={link.platform}
                    label='Platform'
                    onChange={e => handleSocialLinkChange(index, 'platform', e.target.value)}
                  >
                    {socialPlatforms.map(platform => (
                      <MenuItem key={platform} value={platform}>
                        {platform}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 10, sm: 7 }}>
                <TextField
                  fullWidth
                  size='small'
                  label='URL'
                  value={link.url}
                  onChange={e => handleSocialLinkChange(index, 'url', e.target.value)}
                  placeholder='https://'
                />
              </Grid>
              <Grid size={{ xs: 2, sm: 1 }}>
                <Tooltip title='Remove'>
                  <IconButton size='small' color='error' onClick={() => handleRemoveSocialLink(index)}>
                    <i className='tabler-trash text-[18px]' />
                  </IconButton>
                </Tooltip>
              </Grid>
            </Grid>
          ))}

          <div>
            <Button
              variant='outlined'
              size='small'
              startIcon={<i className='tabler-plus' />}
              onClick={handleAddSocialLink}
            >
              Add social link
            </Button>
          </div>

          <Divider />

          {/* Company Details / Footer */}
          <div>
            <Typography variant='h6' className='mb-1'>
              Company details in footer
            </Typography>
            <Typography variant='body2' color='text.secondary' className='mb-4'>
              This information appears in the footer of your emails. HTML is supported.
            </Typography>
          </div>

          <TextField
            fullWidth
            multiline
            rows={4}
            value={form.company_details}
            onChange={e => handleChange('company_details', e.target.value)}
            placeholder='Your Company Name\n123 Street Address\nCity, State 12345\nCountry'
          />

          <FormControlLabel
            control={
              <Switch
                checked={form.auto_generate_footer}
                onChange={e => handleChange('auto_generate_footer', e.target.checked)}
              />
            }
            label='Auto-generate footer from company profile'
          />

          <FormControlLabel
            control={
              <Switch
                checked={form.force_update_footer}
                onChange={e => handleChange('force_update_footer', e.target.checked)}
              />
            }
            label='Force update footer in all existing templates'
          />

          <Divider />

          {/* Unsubscribe Disclaimer */}
          <div>
            <Typography variant='h6' className='mb-1'>
              Unsubscribe disclaimer
            </Typography>
            <Typography variant='body2' color='text.secondary' className='mb-4'>
              Customize the unsubscribe text shown at the bottom of your emails
            </Typography>
          </div>

          <TextField
            fullWidth
            multiline
            rows={3}
            value={form.unsubscribe_disclaimer}
            onChange={e => handleChange('unsubscribe_disclaimer', e.target.value)}
            placeholder='You are receiving this email because you signed up for our newsletter. If you no longer wish to receive these emails, you can unsubscribe at any time.'
          />

          <TextField
            fullWidth
            label='Unsubscribe link text'
            value={form.unsubscribe_link_text}
            onChange={e => handleChange('unsubscribe_link_text', e.target.value)}
            placeholder='Unsubscribe'
            size='small'
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

export default DefaultSettingsTab
