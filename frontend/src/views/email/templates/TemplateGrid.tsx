'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Type Imports
import type { ContentType } from '@/types/email'

// Mock template data
const mockTemplates = [
  {
    id: 1,
    name: 'Default Template',
    type: 'richtext' as ContentType,
    subject: '',
    is_default: true,
    created_at: '2025-06-01T10:00:00Z',
    updated_at: '2026-02-15T14:00:00Z',
    bodyPreview: 'A clean, professional default template suitable for most campaigns.'
  },
  {
    id: 2,
    name: 'Newsletter Template',
    type: 'html' as ContentType,
    subject: 'Monthly Newsletter',
    is_default: false,
    created_at: '2025-08-10T09:00:00Z',
    updated_at: '2026-03-01T11:00:00Z',
    bodyPreview: 'Multi-section newsletter layout with header, featured article, and sidebar.'
  },
  {
    id: 3,
    name: 'Product Announcement',
    type: 'html' as ContentType,
    subject: 'New Product Launch',
    is_default: false,
    created_at: '2025-10-20T16:00:00Z',
    updated_at: '2026-01-25T09:00:00Z',
    bodyPreview: 'Eye-catching product announcement template with hero image and CTA buttons.'
  },
  {
    id: 4,
    name: 'Simple Text',
    type: 'plain' as ContentType,
    subject: '',
    is_default: false,
    created_at: '2025-07-15T12:00:00Z',
    updated_at: '2025-12-10T08:00:00Z',
    bodyPreview: 'Plain text template for simple, personal-style emails without HTML formatting.'
  },
  {
    id: 5,
    name: 'Welcome Email',
    type: 'html' as ContentType,
    subject: 'Welcome to Our Community',
    is_default: false,
    created_at: '2025-09-05T14:00:00Z',
    updated_at: '2026-02-20T16:00:00Z',
    bodyPreview: 'Onboarding welcome email with company intro, getting started guide, and social links.'
  },
  {
    id: 6,
    name: 'Event Invitation',
    type: 'html' as ContentType,
    subject: 'You Are Invited!',
    is_default: false,
    created_at: '2025-11-12T10:00:00Z',
    updated_at: '2026-03-02T13:00:00Z',
    bodyPreview: 'Event invitation template with date/time details, RSVP button, and venue information.'
  }
]

const typeIconMap: Record<ContentType, string> = {
  richtext: 'tabler-text-wrap',
  html: 'tabler-code',
  markdown: 'tabler-markdown',
  plain: 'tabler-file-text'
}

const typeColorMap: Record<ContentType, 'primary' | 'info' | 'warning' | 'secondary'> = {
  richtext: 'primary',
  html: 'info',
  markdown: 'warning',
  plain: 'secondary'
}

const TemplateGrid = () => {
  const [search, setSearch] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    type: 'richtext' as ContentType
  })

  const filteredTemplates = mockTemplates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <Card className='mb-6'>
        <CardHeader
          title='Email Templates'
          action={
            <Button
              variant='contained'
              startIcon={<i className='tabler-plus' />}
              onClick={() => setCreateDialogOpen(true)}
            >
              Create Template
            </Button>
          }
        />
        <CardContent>
          <TextField
            size='small'
            placeholder='Search templates...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='max-sm:is-full min-is-[300px]'
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='tabler-search' />
                </InputAdornment>
              )
            }}
          />
        </CardContent>
      </Card>

      <Grid container spacing={6}>
        {filteredTemplates.map(template => (
          <Grid key={template.id} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card className='h-full flex flex-col'>
              <CardContent className='grow'>
                <div className='flex items-start justify-between mb-4'>
                  <CustomAvatar color={typeColorMap[template.type]} skin='light' variant='rounded' size={44}>
                    <i className={`${typeIconMap[template.type]} text-[24px]`} />
                  </CustomAvatar>
                  {template.is_default && (
                    <Chip label='Default' color='primary' size='small' variant='tonal' />
                  )}
                </div>
                <Typography variant='h6' className='mb-1'>
                  {template.name}
                </Typography>
                <div className='flex gap-2 mb-3'>
                  <Chip
                    label={template.type.toUpperCase()}
                    size='small'
                    variant='outlined'
                    color={typeColorMap[template.type]}
                  />
                </div>
                <Typography variant='body2' color='text.secondary'>
                  {template.bodyPreview}
                </Typography>
              </CardContent>
              <Divider />
              <CardActions className='flex justify-between'>
                <Typography variant='caption' color='text.secondary'>
                  Updated {new Date(template.updated_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  })}
                </Typography>
                <div className='flex gap-1'>
                  <Tooltip title='Preview'>
                    <IconButton size='small'>
                      <i className='tabler-eye text-[20px]' />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title='Edit'>
                    <IconButton size='small' component={Link} href={`/templates/editor/${template.id}`}>
                      <i className='tabler-pencil text-[20px]' />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title='Duplicate'>
                    <IconButton size='small'>
                      <i className='tabler-copy text-[20px]' />
                    </IconButton>
                  </Tooltip>
                  {!template.is_default && (
                    <Tooltip title='Delete'>
                      <IconButton size='small'>
                        <i className='tabler-trash text-[20px]' />
                      </IconButton>
                    </Tooltip>
                  )}
                </div>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Create Template Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Create New Template</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pt-2'>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Template Name'
                placeholder='e.g. Monthly Newsletter'
                value={newTemplate.name}
                onChange={e => setNewTemplate({ ...newTemplate, name: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Content Type</InputLabel>
                <Select
                  value={newTemplate.type}
                  label='Content Type'
                  onChange={e => setNewTemplate({ ...newTemplate, type: e.target.value as ContentType })}
                >
                  <MenuItem value='richtext'>Rich Text</MenuItem>
                  <MenuItem value='html'>HTML</MenuItem>
                  <MenuItem value='markdown'>Markdown</MenuItem>
                  <MenuItem value='plain'>Plain Text</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)} color='secondary'>
            Cancel
          </Button>
          <Button onClick={() => setCreateDialogOpen(false)} variant='contained'>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default TemplateGrid
