'use client'

import { useEffect, useState } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'
import Divider from '@mui/material/Divider'

import systemSettingsService from '@/services/systemSettings'
import type { SendGridStatus } from '@/services/systemSettings'

const SystemSettingsView = () => {
  const [status, setStatus] = useState<SendGridStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [testing, setTesting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null)
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const load = async () => {
    setLoading(true)

    try {
      const data = await systemSettingsService.getSendGrid()

      setStatus(data)
    } catch (e: any) {
      setSnack({
        open: true,
        message: e?.response?.data?.message || 'Failed to load SendGrid status',
        severity: 'error'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const handleStartEdit = () => {
    setEditing(true)
    setNewKey('')
    setTestResult(null)
  }

  const handleCancel = () => {
    setEditing(false)
    setNewKey('')
    setTestResult(null)
  }

  const handleTest = async () => {
    const trimmed = newKey.trim()

    if (!trimmed) {
      setTestResult({ valid: false, message: 'Enter a key first' })

      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const result = await systemSettingsService.testSendGrid(trimmed)

      setTestResult(result)
    } catch (e: any) {
      setTestResult({
        valid: false,
        message: e?.response?.data?.message || 'Test request failed'
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSave = async () => {
    const trimmed = newKey.trim()

    if (!trimmed) return

    setSaving(true)

    try {
      const updated = await systemSettingsService.updateSendGrid(trimmed)

      setStatus(updated)
      setEditing(false)
      setNewKey('')
      setTestResult(null)
      setSnack({ open: true, message: 'SendGrid API key updated', severity: 'success' })
    } catch (e: any) {
      setSnack({
        open: true,
        message: e?.response?.data?.message || 'Failed to save key',
        severity: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  const sourceChip = (source: SendGridStatus['source']) => {
    if (source === 'database') return <Chip size='small' label='Database' color='success' />
    if (source === 'env') return <Chip size='small' label='Env var' color='warning' />

    return <Chip size='small' label='Not set' color='error' />
  }

  return (
    <Box>
      <Typography variant='h4' sx={{ mb: 1 }}>
        System Settings
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 4 }}>
        Platform-wide secrets and integrations. Changes here apply immediately — no backend restart needed.
      </Typography>

      <Card>
        <CardHeader
          title='SendGrid API Key'
          subheader='Used for transactional email sending, domain authentication, and template imports.'
        />
        <CardContent>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              <Stack spacing={2}>
                <Stack direction='row' spacing={2} alignItems='center'>
                  <Typography variant='subtitle2' sx={{ minWidth: 120 }}>
                    Current key:
                  </Typography>
                  <Typography
                    variant='body1'
                    sx={{ fontFamily: 'monospace', flex: 1 }}
                  >
                    {status?.has_key ? status.masked_key : <em>not configured</em>}
                  </Typography>
                  {status && sourceChip(status.source)}
                </Stack>

                {status?.updated_by && (
                  <Stack direction='row' spacing={2} alignItems='center'>
                    <Typography variant='subtitle2' sx={{ minWidth: 120 }}>
                      Last updated:
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {status.updated_at} by {status.updated_by}
                    </Typography>
                  </Stack>
                )}

                {status?.source === 'env' && (
                  <Alert severity='info'>
                    The key is currently coming from the SENDGRID_API_KEY environment variable. Saving a key here will
                    take precedence and persist across deploys.
                  </Alert>
                )}
              </Stack>

              <Divider sx={{ my: 3 }} />

              {!editing ? (
                <Button variant='contained' startIcon={<i className='tabler-edit' />} onClick={handleStartEdit}>
                  Change API key
                </Button>
              ) : (
                <Stack spacing={2}>
                  <TextField
                    label='New SendGrid API Key'
                    placeholder='SG.xxxxxxxx.yyyyyyyyyyyyyyy'
                    value={newKey}
                    onChange={e => {
                      setNewKey(e.target.value)
                      setTestResult(null)
                    }}
                    fullWidth
                    autoFocus
                    helperText='Paste the full key. We will validate it against SendGrid before saving.'
                  />

                  {testResult && (
                    <Alert severity={testResult.valid ? 'success' : 'error'}>{testResult.message}</Alert>
                  )}

                  <Stack direction='row' spacing={2}>
                    <Button
                      variant='outlined'
                      onClick={handleTest}
                      disabled={testing || saving || !newKey.trim()}
                      startIcon={testing ? <CircularProgress size={16} /> : <i className='tabler-flask' />}
                    >
                      {testing ? 'Testing…' : 'Test key'}
                    </Button>
                    <Button
                      variant='contained'
                      color='primary'
                      onClick={handleSave}
                      disabled={saving || testing || !newKey.trim()}
                      startIcon={saving ? <CircularProgress size={16} /> : <i className='tabler-device-floppy' />}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                    <Button variant='text' onClick={handleCancel} disabled={saving || testing}>
                      Cancel
                    </Button>
                  </Stack>
                </Stack>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={snack.open}
        autoHideDuration={4000}
        onClose={() => setSnack({ ...snack, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snack.severity} onClose={() => setSnack({ ...snack, open: false })}>
          {snack.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default SystemSettingsView
