'use client'

// React Imports
import { useState, useEffect } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Type Imports
import type { Subscriber, SubscriberStatus } from '@/types/email'

// Service Imports
import subscriberService from '@/services/subscribers'

interface SubscriberDetailProps {
  id: string
}

const statusColorMap: Record<
  SubscriberStatus,
  'success' | 'error' | 'warning' | 'default' | 'primary' | 'info' | 'secondary'
> = {
  enabled: 'success',
  disabled: 'secondary',
  blocklisted: 'error',
  unconfirmed: 'warning',
  unsubscribed: 'default'
}

const SubscriberDetail = ({ id }: SubscriberDetailProps) => {
  const [subscriber, setSubscriber] = useState<Subscriber | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Editable fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<SubscriberStatus>('enabled')

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  // Fetch subscriber data
  useEffect(() => {
    const fetchSubscriber = async () => {
      setLoading(true)
      setError(null)

      try {
        const response = await subscriberService.getById(Number(id))
        const data = response.data

        setSubscriber(data)
        setName(data.name || '')
        setEmail(data.email || '')
        setStatus(data.status)
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Failed to load subscriber'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchSubscriber()
    }
  }, [id])

  // Handle save
  const handleSave = async () => {
    if (!subscriber) return
    setSaving(true)

    try {
      const response = await subscriberService.update(subscriber.id, {
        name,
        email,
        status
      })

      setSubscriber(response.data)
      setEditing(false)
      setSnackbar({ open: true, message: 'Subscriber updated successfully', severity: 'success' })
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to update subscriber'
      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  // Handle cancel edit
  const handleCancelEdit = () => {
    if (subscriber) {
      setName(subscriber.name || '')
      setEmail(subscriber.email || '')
      setStatus(subscriber.status)
    }

    setEditing(false)
  }

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={40} />
        <Typography className='ml-4' color='text.secondary'>
          Loading subscriber...
        </Typography>
      </div>
    )
  }

  if (error || !subscriber) {
    return (
      <Alert severity='error' className='m-4'>
        {error || 'Subscriber not found'}
      </Alert>
    )
  }

  return (
    <>
      <Grid container spacing={6}>
        {/* Subscriber Info Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardContent className='flex flex-col items-center gap-4 pt-8'>
              <CustomAvatar color='primary' skin='light' size={80}>
                <i className='tabler-user text-[40px]' />
              </CustomAvatar>
              <div className='text-center'>
                <Typography variant='h5'>{subscriber.name || 'No name'}</Typography>
                <Typography color='text.secondary'>{subscriber.email}</Typography>
              </div>
              <Chip
                label={subscriber.status.charAt(0).toUpperCase() + subscriber.status.slice(1)}
                color={statusColorMap[subscriber.status]}
                variant='tonal'
              />
            </CardContent>
            <Divider />
            <CardContent>
              <div className='flex flex-col gap-4'>
                <div className='flex justify-between'>
                  <Typography color='text.secondary'>Created</Typography>
                  <Typography className='font-medium'>
                    {new Date(subscriber.created_at).toLocaleDateString()}
                  </Typography>
                </div>
                <div className='flex justify-between'>
                  <Typography color='text.secondary'>Updated</Typography>
                  <Typography className='font-medium'>
                    {new Date(subscriber.updated_at).toLocaleDateString()}
                  </Typography>
                </div>
                <div className='flex justify-between'>
                  <Typography color='text.secondary'>UUID</Typography>
                  <Typography className='font-medium' variant='body2'>
                    {subscriber.uuid}
                  </Typography>
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Edit / Details */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader
              title='Subscriber Details'
              action={
                editing ? (
                  <div className='flex gap-2'>
                    <Button
                      variant='outlined'
                      color='secondary'
                      onClick={handleCancelEdit}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant='contained'
                      onClick={handleSave}
                      disabled={saving}
                      startIcon={saving ? <CircularProgress size={16} /> : <i className='tabler-check' />}
                    >
                      Save
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant='outlined'
                    onClick={() => setEditing(true)}
                    startIcon={<i className='tabler-pencil' />}
                  >
                    Edit
                  </Button>
                )
              }
            />
            <CardContent>
              <Grid container spacing={4}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label='Name'
                    value={name}
                    onChange={e => setName(e.target.value)}
                    disabled={!editing}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    fullWidth
                    label='Email'
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    disabled={!editing}
                  />
                </Grid>
                {editing && (
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <FormControl fullWidth>
                      <InputLabel>Status</InputLabel>
                      <Select
                        value={status}
                        label='Status'
                        onChange={e => setStatus(e.target.value as SubscriberStatus)}
                      >
                        <MenuItem value='enabled'>Enabled</MenuItem>
                        <MenuItem value='disabled'>Disabled</MenuItem>
                        <MenuItem value='blocklisted'>Blocklisted</MenuItem>
                        <MenuItem value='unconfirmed'>Unconfirmed</MenuItem>
                        <MenuItem value='unsubscribed'>Unsubscribed</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                )}
              </Grid>
            </CardContent>
            {subscriber.attribs && Object.keys(subscriber.attribs).length > 0 && (
              <>
                <Divider />
                <CardHeader title='Attributes' />
                <CardContent>
                  <Grid container spacing={4}>
                    {Object.entries(subscriber.attribs).map(([key, value]) => (
                      <Grid size={{ xs: 12, sm: 6 }} key={key}>
                        <TextField
                          fullWidth
                          label={key.charAt(0).toUpperCase() + key.slice(1)}
                          value={String(value)}
                          disabled
                        />
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </>
            )}
          </Card>
        </Grid>

        {/* Lists */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardHeader title='Subscribed Lists' />
            <CardContent>
              {subscriber.lists && subscriber.lists.length > 0 ? (
                <div className='flex flex-col gap-3'>
                  {subscriber.lists.map(list => (
                    <div key={list.id} className='flex items-center justify-between p-3 rounded-lg border'>
                      <div className='flex items-center gap-3'>
                        <CustomAvatar color='primary' skin='light' variant='rounded' size={36}>
                          <i className='tabler-list text-[20px]' />
                        </CustomAvatar>
                        <div>
                          <Typography className='font-medium' color='text.primary'>
                            {list.name}
                          </Typography>
                          {list.subscriber_count !== undefined && (
                            <Typography variant='body2' color='text.secondary'>
                              {list.subscriber_count} subscribers
                            </Typography>
                          )}
                        </div>
                      </div>
                      <Chip
                        label={list.type === 'public' ? 'Public' : list.type === 'private' ? 'Private' : 'Temporary'}
                        color={list.type === 'public' ? 'success' : 'default'}
                        size='small'
                        variant='tonal'
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <Typography color='text.secondary'>Not subscribed to any lists</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Snackbar for notifications */}
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

export default SubscriberDetail
