'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Stepper from '@mui/material/Stepper'
import Step from '@mui/material/Step'
import StepLabel from '@mui/material/StepLabel'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Grid from '@mui/material/Grid'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Checkbox from '@mui/material/Checkbox'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormGroup from '@mui/material/FormGroup'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableRow from '@mui/material/TableRow'

// Type Imports
import type { ContentType, CampaignType } from '@/types/email'

const steps = ['Campaign Details', 'Select Lists', 'Content', 'Review & Send']

// Mock lists
const availableLists = [
  { id: 1, name: 'Newsletter', subscriber_count: 5420, type: 'public' as const },
  { id: 2, name: 'Product Updates', subscriber_count: 3200, type: 'public' as const },
  { id: 3, name: 'Beta Users', subscriber_count: 890, type: 'private' as const },
  { id: 4, name: 'Customers', subscriber_count: 12500, type: 'public' as const },
  { id: 5, name: 'Leads', subscriber_count: 7800, type: 'private' as const }
]

// Mock templates
const availableTemplates = [
  { id: 1, name: 'Default Template' },
  { id: 2, name: 'Newsletter Template' },
  { id: 3, name: 'Product Announcement' },
  { id: 4, name: 'Simple Text' }
]

const CreateCampaign = () => {
  const [activeStep, setActiveStep] = useState(0)

  // Campaign details state
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [fromEmail, setFromEmail] = useState('')
  const [campaignType, setCampaignType] = useState<CampaignType>('regular')
  const [contentType, setContentType] = useState<ContentType>('richtext')

  // List selection state
  const [selectedLists, setSelectedLists] = useState<number[]>([])

  // Content state
  const [templateId, setTemplateId] = useState<number | ''>('')
  const [body, setBody] = useState('')

  // Schedule state
  const [sendNow, setSendNow] = useState(true)
  const [scheduledDate, setScheduledDate] = useState('')

  const handleNext = () => setActiveStep(prev => prev + 1)
  const handleBack = () => setActiveStep(prev => prev - 1)

  const handleListToggle = (listId: number) => {
    setSelectedLists(prev =>
      prev.includes(listId) ? prev.filter(id => id !== listId) : [...prev, listId]
    )
  }

  const totalRecipients = availableLists
    .filter(l => selectedLists.includes(l.id))
    .reduce((sum, l) => sum + l.subscriber_count, 0)

  const isStepValid = () => {
    switch (activeStep) {
      case 0:
        return name.trim() !== '' && subject.trim() !== '' && fromEmail.trim() !== ''
      case 1:
        return selectedLists.length > 0
      case 2:
        return body.trim() !== ''
      case 3:
        return true
      default:
        return false
    }
  }

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Campaign Name'
                placeholder='e.g. March Newsletter'
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Email Subject'
                placeholder='e.g. Your Monthly Update is Here!'
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='From Email'
                placeholder='e.g. news@yourcompany.com'
                type='email'
                value={fromEmail}
                onChange={e => setFromEmail(e.target.value)}
                required
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Campaign Type</InputLabel>
                <Select
                  value={campaignType}
                  label='Campaign Type'
                  onChange={e => setCampaignType(e.target.value as CampaignType)}
                >
                  <MenuItem value='regular'>Regular</MenuItem>
                  <MenuItem value='optin'>Opt-in</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
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
            </Grid>
          </Grid>
        )

      case 1:
        return (
          <div className='flex flex-col gap-4'>
            <Alert severity='info' className='mb-2'>
              Select one or more subscriber lists to send your campaign to. Total recipients: {totalRecipients.toLocaleString()}
            </Alert>
            <FormGroup>
              {availableLists.map(list => (
                <div
                  key={list.id}
                  className={`flex items-center justify-between p-4 rounded-lg border mb-2 cursor-pointer transition-colors ${
                    selectedLists.includes(list.id) ? 'border-primary bg-primaryLight' : ''
                  }`}
                  onClick={() => handleListToggle(list.id)}
                >
                  <div className='flex items-center gap-3'>
                    <Checkbox
                      checked={selectedLists.includes(list.id)}
                      onChange={() => handleListToggle(list.id)}
                    />
                    <div>
                      <Typography className='font-medium' color='text.primary'>
                        {list.name}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {list.subscriber_count.toLocaleString()} subscribers
                      </Typography>
                    </div>
                  </div>
                  <Chip
                    label={list.type}
                    size='small'
                    variant='tonal'
                    color={list.type === 'public' ? 'primary' : 'secondary'}
                  />
                </div>
              ))}
            </FormGroup>
          </div>
        )

      case 2:
        return (
          <Grid container spacing={4}>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Template (Optional)</InputLabel>
                <Select
                  value={templateId}
                  label='Template (Optional)'
                  onChange={e => setTemplateId(e.target.value as number)}
                >
                  <MenuItem value=''>None - Start from scratch</MenuItem>
                  {availableTemplates.map(t => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                minRows={12}
                maxRows={20}
                label='Email Body'
                placeholder={
                  contentType === 'html'
                    ? '<html>\n<body>\n  <h1>Your content here</h1>\n</body>\n</html>'
                    : 'Write your email content here...'
                }
                value={body}
                onChange={e => setBody(e.target.value)}
                required
              />
              <Typography variant='caption' color='text.secondary' className='mt-1'>
                You can use template variables like {'{{ .Subscriber.Name }}'} and {'{{ .Subscriber.Email }}'}
              </Typography>
            </Grid>
          </Grid>
        )

      case 3:
        return (
          <div className='flex flex-col gap-6'>
            <Alert severity='success'>
              Your campaign is ready to send! Review the details below.
            </Alert>

            <Card variant='outlined'>
              <CardContent>
                <Typography variant='h6' className='mb-4'>
                  Campaign Summary
                </Typography>
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell className='font-medium'>Campaign Name</TableCell>
                      <TableCell>{name}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className='font-medium'>Subject</TableCell>
                      <TableCell>{subject}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className='font-medium'>From Email</TableCell>
                      <TableCell>{fromEmail}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className='font-medium'>Type</TableCell>
                      <TableCell>
                        <Chip label={campaignType} size='small' />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className='font-medium'>Recipients</TableCell>
                      <TableCell>
                        <div className='flex gap-1 flex-wrap'>
                          {availableLists
                            .filter(l => selectedLists.includes(l.id))
                            .map(l => (
                              <Chip key={l.id} label={`${l.name} (${l.subscriber_count.toLocaleString()})`} size='small' variant='outlined' />
                            ))}
                        </div>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className='font-medium'>Total Recipients</TableCell>
                      <TableCell>
                        <Typography className='font-medium' color='primary'>
                          {totalRecipients.toLocaleString()}
                        </Typography>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className='font-medium'>Content Length</TableCell>
                      <TableCell>{body.length} characters</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <div className='flex flex-col gap-3'>
              <Typography variant='h6'>Delivery</Typography>
              <FormControlLabel
                control={<Checkbox checked={sendNow} onChange={e => setSendNow(e.target.checked)} />}
                label='Send immediately'
              />
              {!sendNow && (
                <TextField
                  label='Schedule Date & Time'
                  type='datetime-local'
                  value={scheduledDate}
                  onChange={e => setScheduledDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  className='max-is-[300px]'
                />
              )}
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader title='Create Campaign' />
      <CardContent>
        <Stepper activeStep={activeStep} className='mb-8'>
          {steps.map(label => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <div className='min-bs-[400px]'>
          {renderStepContent(activeStep)}
        </div>

        <Divider className='my-6' />

        <div className='flex justify-between'>
          <Button disabled={activeStep === 0} onClick={handleBack} variant='outlined' color='secondary'>
            Back
          </Button>
          <div className='flex gap-2'>
            {activeStep === steps.length - 1 ? (
              <>
                <Button variant='outlined' color='secondary'>
                  Save as Draft
                </Button>
                <Button
                  variant='contained'
                  color='primary'
                  startIcon={<i className='tabler-send' />}
                  disabled={!isStepValid()}
                >
                  {sendNow ? 'Send Campaign' : 'Schedule Campaign'}
                </Button>
              </>
            ) : (
              <Button variant='contained' onClick={handleNext} disabled={!isStepValid()}>
                Next
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default CreateCampaign
