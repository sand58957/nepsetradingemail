'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import InputLabel from '@mui/material/InputLabel'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Grid from '@mui/material/Grid'
import Breadcrumbs from '@mui/material/Breadcrumbs'
import Link from '@mui/material/Link'

import automationService from '@/services/automation'
import type { AutomationData, CreateAutomationPayload } from '@/services/automation'

interface StepFormData {
  step_type: string
  delay_minutes: number
  config: {
    subject?: string
    template_id?: number
    campaign_id?: number
    delay_unit?: 'minutes' | 'hours' | 'days'
    delay_value?: number
  }
}

interface ListOption {
  id: number
  name: string
}

const AutomationEditor = ({ automationId }: { automationId?: number }) => {
  const router = useRouter()
  const { lang: locale } = useParams()

  const [loading, setLoading] = useState(!!automationId)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form state
  const [name, setName] = useState('Untitled Welcome Series')
  const [description, setDescription] = useState('')
  const [triggerType, setTriggerType] = useState('subscriber_added')
  const [triggerListId, setTriggerListId] = useState<number | string>('')
  const [exitCriteria, setExitCriteria] = useState('all_emails_sent')
  const [steps, setSteps] = useState<StepFormData[]>([
    { step_type: 'send_email', delay_minutes: 0, config: { subject: '' } },
    { step_type: 'wait', delay_minutes: 1440, config: { delay_unit: 'days', delay_value: 1 } },
    { step_type: 'send_email', delay_minutes: 0, config: { subject: '' } }
  ])

  // Lists for trigger config
  const [lists, setLists] = useState<ListOption[]>([])

  useEffect(() => {
    fetchLists()
    if (automationId) {
      fetchAutomation()
    }
  }, [automationId])

  const fetchLists = async () => {
    try {
      const { default: api } = await import('@/services/api')
      const res = await api.get('/lists')
      const data = res.data?.data
      if (Array.isArray(data)) {
        setLists(data.map((l: any) => ({ id: l.id, name: l.name })))
      }
    } catch {
      // Lists may not be available
    }
  }

  const fetchAutomation = async () => {
    if (!automationId) return
    try {
      setLoading(true)
      const res = await automationService.getById(automationId)
      const data: AutomationData = res.data

      setName(data.name)
      setDescription(data.description || '')
      setTriggerType(data.trigger_type || 'subscriber_added')

      if (data.trigger_config?.list_id) {
        setTriggerListId(data.trigger_config.list_id)
      }
      if (data.trigger_config?.exit_criteria) {
        setExitCriteria(data.trigger_config.exit_criteria)
      }

      if (data.steps && data.steps.length > 0) {
        setSteps(
          data.steps.map(s => ({
            step_type: s.step_type,
            delay_minutes: s.delay_minutes,
            config: typeof s.config === 'string' ? JSON.parse(s.config) : s.config || {}
          }))
        )
      }
    } catch (err) {
      setError('Failed to load automation')
    } finally {
      setLoading(false)
    }
  }

  const addEmailStep = () => {
    setSteps(prev => [
      ...prev,
      { step_type: 'wait', delay_minutes: 1440, config: { delay_unit: 'days', delay_value: 1 } },
      { step_type: 'send_email', delay_minutes: 0, config: { subject: '' } }
    ])
  }

  const removeEmailStep = (emailIndex: number) => {
    // Find the actual indices in the steps array for this email
    let emailCount = 0
    let stepIdx = -1

    for (let i = 0; i < steps.length; i++) {
      if (steps[i].step_type === 'send_email') {
        emailCount++
        if (emailCount === emailIndex + 1) {
          stepIdx = i
          break
        }
      }
    }

    if (stepIdx < 0 || steps.filter(s => s.step_type === 'send_email').length <= 1) return

    const newSteps = [...steps]

    // Remove the wait step before this email (if exists and it's a wait)
    if (stepIdx > 0 && newSteps[stepIdx - 1].step_type === 'wait') {
      newSteps.splice(stepIdx - 1, 2)
    } else {
      newSteps.splice(stepIdx, 1)
    }

    setSteps(newSteps)
  }

  const updateWaitDelay = (stepIndex: number, value: number, unit: 'minutes' | 'hours' | 'days') => {
    const newSteps = [...steps]
    const minutes = unit === 'days' ? value * 1440 : unit === 'hours' ? value * 60 : value

    newSteps[stepIndex] = {
      ...newSteps[stepIndex],
      delay_minutes: minutes,
      config: { delay_unit: unit, delay_value: value }
    }
    setSteps(newSteps)
  }

  const updateEmailSubject = (stepIndex: number, subject: string) => {
    const newSteps = [...steps]

    newSteps[stepIndex] = {
      ...newSteps[stepIndex],
      config: { ...newSteps[stepIndex].config, subject }
    }
    setSteps(newSteps)
  }

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Automation name is required')
      return
    }

    try {
      setSaving(true)
      setError(null)

      const payload: CreateAutomationPayload = {
        name: name.trim(),
        description: description.trim(),
        trigger_type: triggerType,
        trigger_config: {
          list_id: triggerListId || null,
          exit_criteria: exitCriteria
        },
        steps: steps.map((s, i) => ({
          step_order: i + 1,
          step_type: s.step_type,
          config: s.config,
          delay_minutes: s.delay_minutes
        }))
      }

      if (automationId) {
        await automationService.update(automationId, payload)
      } else {
        await automationService.create(payload)
      }

      setSuccess(true)
      setTimeout(() => router.push(`/${locale}/automations/list`), 1000)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to save automation')
    } finally {
      setSaving(false)
    }
  }

  const getDelayDisplay = (step: StepFormData) => {
    const unit = step.config?.delay_unit || 'days'
    const value = step.config?.delay_value || Math.round(step.delay_minutes / 1440) || 1

    return { value, unit }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
        <CircularProgress />
      </Box>
    )
  }

  // Separate email steps and wait steps for rendering
  let emailNumber = 0

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Breadcrumbs sx={{ mb: 1 }}>
            <Link
              underline='hover'
              color='primary'
              sx={{ cursor: 'pointer' }}
              onClick={() => router.push(`/${locale}/automations/list`)}
            >
              Automations
            </Link>
            <Typography color='text.primary'>{automationId ? 'Edit' : 'Create'}</Typography>
          </Breadcrumbs>
          <Typography variant='h5' fontWeight={700}>
            {automationId ? 'Edit Automation' : 'Edit Automation'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Button variant='outlined' onClick={() => router.push(`/${locale}/automations/list`)}>
            Cancel
          </Button>
          <Button variant='contained' onClick={handleSave} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity='error' sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity='success' sx={{ mb: 3 }}>
          Automation saved successfully!
        </Alert>
      )}

      {/* Step 1: Automation Name */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Chip label='1' size='small' color='primary' variant='outlined' sx={{ borderRadius: '50%', fontWeight: 700 }} />
            <Typography variant='subtitle1' fontWeight={700}>
              What is the name of this automation?
            </Typography>
          </Box>
          <TextField
            fullWidth
            label='Automation Name'
            required
            value={name}
            onChange={e => setName(e.target.value)}
            sx={{ maxWidth: 500 }}
          />
        </CardContent>
      </Card>

      {/* Step 2: Entry Criteria */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Chip label='2' size='small' color='primary' variant='outlined' sx={{ borderRadius: '50%', fontWeight: 700 }} />
            <Typography variant='subtitle1' fontWeight={700}>
              When will your contacts enter the automation?
            </Typography>
          </Box>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2, ml: 5 }}>
            An automation can be triggered when someone is added to a list or segment.
          </Typography>

          <Box sx={{ ml: 5 }}>
            <Typography variant='overline' sx={{ fontWeight: 600, color: 'text.secondary' }}>
              Entry Criteria <Typography component='span' color='error.main'>*</Typography>
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1, maxWidth: 500 }}>
              <Typography variant='body2'>
                The first time a contact is added to
              </Typography>
              <FormControl size='small' sx={{ minWidth: 180 }}>
                <Select
                  value={triggerListId}
                  onChange={e => setTriggerListId(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value=''>All Contacts</MenuItem>
                  {lists.map(list => (
                    <MenuItem key={list.id} value={list.id}>{list.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton size='small'>
                <i className='tabler-edit text-[16px]' />
              </IconButton>
            </Box>
          </Box>
        </CardContent>
      </Card>

      {/* Step 3: Exit Criteria */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Chip label='3' size='small' color='primary' variant='outlined' sx={{ borderRadius: '50%', fontWeight: 700 }} />
            <Typography variant='subtitle1' fontWeight={700}>
              When will your contacts leave the automation?
            </Typography>
          </Box>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2, ml: 5 }}>
            Decide whether contacts will receive all emails in your series, exit once they no longer meet the entry criteria, or exit once they meet your own specified criteria.
          </Typography>

          <Box sx={{ ml: 5 }}>
            <Typography variant='overline' sx={{ fontWeight: 600, color: 'text.secondary' }}>
              Exit Criteria <Typography component='span' color='error.main'>*</Typography>
            </Typography>

            <RadioGroup value={exitCriteria} onChange={e => setExitCriteria(e.target.value)} sx={{ mt: 1 }}>
              <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 0 }}>
                <FormControlLabel
                  value='all_emails_sent'
                  control={<Radio />}
                  label='Contacts have received all emails in the automation.'
                  sx={{ m: 0, px: 2, py: 1, width: '100%', borderBottom: '1px solid', borderColor: 'divider' }}
                />
                <FormControlLabel
                  value='no_longer_meets_entry'
                  control={<Radio />}
                  label='Contacts no longer meet the entry criteria.'
                  sx={{ m: 0, px: 2, py: 1, width: '100%', borderBottom: '1px solid', borderColor: 'divider' }}
                />
                <FormControlLabel
                  value='custom_criteria'
                  control={<Radio />}
                  label='Contact meets following criteria'
                  sx={{ m: 0, px: 2, py: 1, width: '100%' }}
                />
              </Box>
            </RadioGroup>
          </Box>
        </CardContent>
      </Card>

      {/* Step 4: Description / Categories */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Chip label='4' size='small' color='primary' variant='outlined' sx={{ borderRadius: '50%', fontWeight: 700 }} />
            <Typography variant='subtitle1' fontWeight={700}>
              Automation details
            </Typography>
          </Box>
          <Box sx={{ ml: 5 }}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label='Description'
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  multiline
                  rows={2}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Trigger Type</InputLabel>
                  <Select
                    value={triggerType}
                    label='Trigger Type'
                    onChange={e => setTriggerType(e.target.value)}
                  >
                    <MenuItem value='subscriber_added'>Subscriber Added to List</MenuItem>
                    <MenuItem value='manual'>Manual Trigger</MenuItem>
                    <MenuItem value='campaign_open'>Campaign Opened</MenuItem>
                    <MenuItem value='campaign_click'>Campaign Link Clicked</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {/* Step 5: Email Sequence */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Chip label='5' size='small' color='primary' variant='outlined' sx={{ borderRadius: '50%', fontWeight: 700 }} />
            <Typography variant='subtitle1' fontWeight={700}>
              What email(s) are included in your automation?
            </Typography>
          </Box>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 3, ml: 5 }}>
            You can choose to send a single message or create a series of messages to be sent at time intervals you define.
          </Typography>

          {/* Visual Flow */}
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 2 }}>
            {steps.map((step, index) => {
              if (step.step_type === 'send_email') {
                emailNumber++
                const currentEmailNum = emailNumber

                return (
                  <Box key={index} sx={{ width: '100%', maxWidth: 700 }}>
                    {/* Connector line */}
                    {index > 0 && (
                      <Box sx={{ display: 'flex', justifyContent: 'center', my: 0 }}>
                        <Box sx={{ width: 2, height: 24, bgcolor: 'divider' }} />
                      </Box>
                    )}

                    {/* Send immediately badge (only for first email) */}
                    {index === 0 && (
                      <>
                        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 0 }}>
                          <Chip
                            label='Send the first email instantly'
                            variant='outlined'
                            icon={<i className='tabler-send text-[16px]' />}
                            sx={{ borderStyle: 'dashed' }}
                          />
                        </Box>
                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                          <Box sx={{ width: 2, height: 24, bgcolor: 'divider' }} />
                        </Box>
                      </>
                    )}

                    {/* Email Card */}
                    <Box
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 2,
                        p: 2.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        position: 'relative',
                        '&:hover': { borderColor: 'primary.main', boxShadow: 1 }
                      }}
                    >
                      {/* Email label */}
                      <Box
                        sx={{
                          position: 'absolute',
                          left: -1,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          bgcolor: 'primary.main',
                          color: 'white',
                          px: 0.8,
                          py: 2,
                          borderRadius: '4px 0 0 4px',
                          writingMode: 'vertical-rl',
                          textOrientation: 'mixed',
                          fontSize: '0.65rem',
                          fontWeight: 700,
                          letterSpacing: 1
                        }}
                      >
                        EMAIL {currentEmailNum}
                      </Box>

                      {/* Email icon */}
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          bgcolor: 'action.hover',
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          ml: 3,
                          flexShrink: 0
                        }}
                      >
                        <i className='tabler-mail text-[28px]' style={{ color: 'var(--mui-palette-primary-main)' }} />
                      </Box>

                      {/* Subject + Sender */}
                      <Box sx={{ flex: 1, ml: 1 }}>
                        <TextField
                          size='small'
                          label='Subject'
                          required
                          fullWidth
                          value={step.config?.subject || ''}
                          onChange={e => updateEmailSubject(index, e.target.value)}
                          placeholder={`Email ${currentEmailNum} subject line`}
                        />
                      </Box>

                      {/* Remove button */}
                      {steps.filter(s => s.step_type === 'send_email').length > 1 && (
                        <IconButton
                          size='small'
                          color='error'
                          onClick={() => removeEmailStep(currentEmailNum - 1)}
                          sx={{ flexShrink: 0 }}
                        >
                          <i className='tabler-trash text-[18px]' />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                )
              }

              if (step.step_type === 'wait') {
                const { value, unit } = getDelayDisplay(step)

                return (
                  <Box key={index} sx={{ width: '100%', maxWidth: 700 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <Box sx={{ width: 2, height: 24, bgcolor: 'divider' }} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                      <Box
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          border: '1px dashed',
                          borderColor: 'divider',
                          borderRadius: 2,
                          px: 3,
                          py: 1.5,
                          bgcolor: 'action.hover'
                        }}
                      >
                        <i className='tabler-clock text-[18px]' style={{ color: 'var(--mui-palette-warning-main)' }} />
                        <Typography variant='body2' fontWeight={600}>
                          Wait
                        </Typography>
                        <TextField
                          size='small'
                          type='number'
                          value={value}
                          onChange={e => {
                            const v = parseInt(e.target.value) || 1
                            updateWaitDelay(index, v, unit as 'minutes' | 'hours' | 'days')
                          }}
                          inputProps={{ min: 1, max: 365 }}
                          sx={{ width: 70 }}
                        />
                        <Select
                          size='small'
                          value={unit}
                          onChange={e => updateWaitDelay(index, value, e.target.value as 'minutes' | 'hours' | 'days')}
                          sx={{ minWidth: 100 }}
                        >
                          <MenuItem value='minutes'>minute(s)</MenuItem>
                          <MenuItem value='hours'>hour(s)</MenuItem>
                          <MenuItem value='days'>day(s)</MenuItem>
                        </Select>
                      </Box>
                    </Box>
                  </Box>
                )
              }

              return null
            })}

            {/* Add Email button */}
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0 }}>
              <Box sx={{ width: 2, height: 24, bgcolor: 'divider' }} />
            </Box>
            <Button
              variant='outlined'
              startIcon={<i className='tabler-plus' />}
              onClick={addEmailStep}
              sx={{ borderStyle: 'dashed' }}
            >
              Add Another Email
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Save Button at bottom */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mb: 4 }}>
        <Button variant='outlined' onClick={() => router.push(`/${locale}/automations/list`)}>
          Cancel
        </Button>
        <Button variant='contained' size='large' onClick={handleSave} disabled={saving}>
          {saving ? <CircularProgress size={20} /> : automationId ? 'Update Automation' : 'Save Automation'}
        </Button>
      </Box>
    </Box>
  )
}

export default AutomationEditor
