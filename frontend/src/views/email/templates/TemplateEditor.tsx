'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'

// Type Imports
import type { ContentType } from '@/types/email'

interface TemplateEditorProps {
  id: string
}

const TemplateEditor = ({ id }: TemplateEditorProps) => {
  const isNewTemplate = id === 'new'

  const [name, setName] = useState(isNewTemplate ? '' : 'Newsletter Template')
  const [subject, setSubject] = useState(isNewTemplate ? '' : 'Monthly Newsletter')
  const [contentType, setContentType] = useState<ContentType>('html')
  const [body, setBody] = useState(
    isNewTemplate
      ? ''
      : `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ .Campaign.Subject }}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto;">
    <tr>
      <td style="padding: 20px; background-color: #7c3aed; text-align: center;">
        <h1 style="color: #ffffff; margin: 0;">{{ .Campaign.Subject }}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding: 30px; background-color: #ffffff;">
        <p>Hello {{ .Subscriber.Name }},</p>
        <p>Your email content goes here.</p>
      </td>
    </tr>
    <tr>
      <td style="padding: 20px; background-color: #f3f4f6; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #6b7280;">
          <a href="{{ .UnsubscribeURL }}">Unsubscribe</a>
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`
  )

  return (
    <Grid container spacing={6}>
      {/* Template Details */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardHeader
            title={isNewTemplate ? 'New Template' : 'Edit Template'}
            subheader={isNewTemplate ? undefined : `Template #${id}`}
          />
          <CardContent className='flex flex-col gap-4'>
            <TextField
              fullWidth
              label='Template Name'
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder='Enter template name'
            />
            <TextField
              fullWidth
              label='Default Subject (Optional)'
              value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder='Enter default subject'
            />
            <FormControl fullWidth>
              <InputLabel>Content Type</InputLabel>
              <Select
                value={contentType}
                label='Content Type'
                onChange={e => setContentType(e.target.value as ContentType)}
              >
                <MenuItem value='richtext'>Rich Text</MenuItem>
                <MenuItem value='html'>HTML</MenuItem>
                <MenuItem value='markdown'>Markdown</MenuItem>
                <MenuItem value='plain'>Plain Text</MenuItem>
              </Select>
            </FormControl>

            <Divider />

            <Typography variant='subtitle2' color='text.secondary'>
              Available Variables
            </Typography>
            <div className='flex flex-wrap gap-1'>
              {[
                '{{ .Subscriber.Name }}',
                '{{ .Subscriber.Email }}',
                '{{ .Campaign.Subject }}',
                '{{ .UnsubscribeURL }}',
                '{{ .TrackLink "URL" }}',
                '{{ .MessageURL }}'
              ].map(variable => (
                <Chip
                  key={variable}
                  label={variable}
                  size='small'
                  variant='outlined'
                  className='cursor-pointer'
                  onClick={() => setBody(prev => prev + variable)}
                />
              ))}
            </div>

            <Divider />

            <div className='flex gap-2'>
              <Button variant='contained' fullWidth startIcon={<i className='tabler-device-floppy' />}>
                Save
              </Button>
              <Button variant='outlined' fullWidth startIcon={<i className='tabler-eye' />}>
                Preview
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Template Editor */}
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardHeader
            title='Template Body'
            action={
              <Chip
                label={contentType.toUpperCase()}
                color='primary'
                size='small'
                variant='tonal'
              />
            }
          />
          <CardContent>
            <TextField
              fullWidth
              multiline
              minRows={25}
              maxRows={40}
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder='Enter your template content...'
              sx={{
                '& .MuiInputBase-input': {
                  fontFamily: contentType === 'html' || contentType === 'markdown' ? 'monospace' : 'inherit',
                  fontSize: contentType === 'html' ? '13px' : '14px'
                }
              }}
            />
            <div className='flex justify-between items-center mt-4'>
              <Typography variant='caption' color='text.secondary'>
                {body.length} characters
              </Typography>
              <div className='flex gap-2'>
                <Button variant='outlined' size='small' color='secondary'>
                  Reset
                </Button>
                <Button variant='outlined' size='small' startIcon={<i className='tabler-send' />}>
                  Send Test
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default TemplateEditor
