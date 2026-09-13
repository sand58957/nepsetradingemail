'use client'

// React Imports
import { useState, useEffect, useCallback, useRef } from 'react'

// Next Imports
import { useSession } from 'next-auth/react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import AlertTitle from '@mui/material/AlertTitle'
import Snackbar from '@mui/material/Snackbar'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'

// Service Imports
import whatsappService from '@/services/whatsapp'

// Type Imports
import type { OpenWASession } from '@/types/whatsapp'

type Severity = 'success' | 'error' | 'info' | 'warning'

/** How the gateway's session statuses should read to an operator. */
// Keyed on the gateway's own SessionStatus enum. Note there is no 'connected':
// guessing that name is what made a linked, working number render as "Unknown".
const STATUS_LABEL: Record<string, { label: string; color: 'success' | 'warning' | 'error' | 'default' }> = {
  created: { label: 'Not started', color: 'default' },
  initializing: { label: 'Starting', color: 'warning' },
  qr_ready: { label: 'Waiting for QR scan', color: 'warning' },
  authenticating: { label: 'Authenticating', color: 'warning' },
  ready: { label: 'Connected', color: 'success' },
  disconnected: { label: 'Disconnected', color: 'error' },
  action_required: { label: 'Action needed on the phone', color: 'error' },
  failed: { label: 'Failed', color: 'error' }
}

/** The one status in which the gateway will accept a send. */
const READY = 'ready'

const describe = (status: string) => STATUS_LABEL[status] ?? { label: status || 'Unknown', color: 'default' as const }

const WASettings = () => {
  const { data: session } = useSession()
  const isSuperAdmin = (session as { role?: string } | null)?.role === 'superadmin'

  const [sessions, setSessions] = useState<OpenWASession[]>([])
  const [active, setActive] = useState<OpenWASession | null>(null)
  const [qr, setQr] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [newName, setNewName] = useState('nepalfillings-main')
  const [testPhone, setTestPhone] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: Severity }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const notify = (message: string, severity: Severity = 'success') => setSnackbar({ open: true, message, severity })

  const errorText = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback

  const loadSessions = useCallback(async () => {
    try {
      const res = await whatsappService.listSessions()
      const list = res.data || []

      setSessions(list)
      setActive(prev => list.find(s => s.id === prev?.id) ?? list[0] ?? null)
    } catch (err) {
      notify(errorText(err, 'Could not reach the WhatsApp gateway'), 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  // While a session is waiting to be linked, both the status and the QR code
  // change on their own — the code rotates every few seconds and the status
  // flips the moment someone scans. Poll so the operator is never looking at a
  // code that has already expired.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const stop = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    if (!active || active.status !== 'qr_ready') {
      setQr('')
      stop()

      return stop
    }

    let cancelled = false

    const tick = async () => {
      try {
        const [qrRes, sessionRes] = await Promise.all([
          whatsappService.getSessionQR(active.id),
          whatsappService.getSession(active.id)
        ])

        if (cancelled) return

        setQr(qrRes.data?.qrCode || '')

        // Scanned: swap the code for the connected state straight away.
        if (sessionRes.data?.status !== 'qr_ready') {
          setActive(sessionRes.data)
          setSessions(prev => prev.map(s => (s.id === sessionRes.data.id ? sessionRes.data : s)))
          notify(`Linked ${sessionRes.data.phone || 'number'} successfully`, 'success')
        }
      } catch {
        // A transient miss is expected while the engine rotates the code; the
        // next tick recovers, so this is deliberately silent.
      }
    }

    tick()
    pollRef.current = setInterval(tick, 4000)

    return () => {
      cancelled = true
      stop()
    }
  }, [active])

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true)

    try {
      await fn()
      await loadSessions()
      notify(done)
    } catch (err) {
      notify(errorText(err, 'That did not work'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleCreate = () =>
    run(async () => {
      const created = await whatsappService.createSession(newName.trim())

      await whatsappService.startSession(created.data.id)
      setActive(created.data)
    }, 'Session created — scan the QR code to link a number')

  const handleStart = () =>
    active && run(() => whatsappService.startSession(active.id).then(() => undefined), 'Starting')

  const handleLogout = () => active && run(() => whatsappService.logoutSession(active.id), 'Number unlinked')

  const handleDelete = () => active && run(() => whatsappService.deleteSession(active.id), 'Session deleted')

  const handleTest = () =>
    active &&
    run(
      () => whatsappService.sendSessionTest(active.id, testPhone.trim(), 'Test message from Nepal Fillings.'),
      `Test message sent to ${testPhone.trim()}`
    )

  if (loading) {
    return (
      <Box className='flex justify-center items-center' sx={{ minHeight: 320 }}>
        <CircularProgress />
      </Box>
    )
  }

  const status = describe(active?.status || '')

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <Typography variant='h5'>WhatsApp Connection</Typography>
              <Typography color='text.secondary'>
                Messages are sent through a WhatsApp account linked to this server by QR code.
              </Typography>
            </div>
            <div className='flex items-center gap-2'>
              <Chip label={status.label} color={status.color} variant='tonal' />
              {active?.phone && <Chip label={active.phone} variant='tonal' />}
            </div>
          </CardContent>
        </Card>
      </Grid>

      {!isSuperAdmin && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='info'>
            <AlertTitle>Managed centrally</AlertTitle>
            Linking a WhatsApp number requires scanning a QR code with the handset that owns it, so it is done by an
            administrator. Ask them to link a number if this shows as disconnected.
          </Alert>
        </Grid>
      )}

      {isSuperAdmin && (
        <>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader
                title='Link a number'
                subheader='Scan the code below with the phone that will send your messages'
              />
              <CardContent className='flex flex-col gap-4'>
                {!active && (
                  <>
                    <TextField
                      fullWidth
                      label='Session name'
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      helperText='A label for this connection, for example nepalfillings-main'
                    />
                    <Button variant='contained' onClick={handleCreate} disabled={busy || !newName.trim()}>
                      Create session
                    </Button>
                  </>
                )}

                {active?.status === 'qr_ready' && (
                  <>
                    {qr ? (
                      <Box className='flex flex-col items-center gap-3'>
                        {/* The gateway returns a ready-to-render data URI. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qr}
                          alt='WhatsApp linking QR code'
                          width={260}
                          height={260}
                          style={{ background: '#fff', padding: 12, borderRadius: 12 }}
                        />
                        <Typography variant='body2' color='text.secondary' className='text-center'>
                          On the phone: WhatsApp → Settings → Linked devices → Link a device.
                          <br />
                          The code refreshes automatically until it is scanned.
                        </Typography>
                      </Box>
                    ) : (
                      <Box className='flex justify-center' sx={{ py: 6 }}>
                        <CircularProgress />
                      </Box>
                    )}
                  </>
                )}

                {active && active.status !== 'qr_ready' && active.status !== READY && (
                  <>
                    <Alert severity='warning'>
                      This session is {status.label.toLowerCase()}. Start it to get a QR code.
                      {active.lastError ? ` Last error: ${active.lastError}` : ''}
                    </Alert>
                    <Button variant='contained' onClick={handleStart} disabled={busy}>
                      Start session
                    </Button>
                  </>
                )}

                {active?.status === READY && (
                  <Alert severity='success'>
                    <AlertTitle>Linked</AlertTitle>
                    Sending as {active.phone || 'the linked number'}
                    {active.pushName ? ` (${active.pushName})` : ''}.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card>
              <CardHeader title='Session' subheader='Check delivery and manage the link' />
              <CardContent className='flex flex-col gap-4'>
                <TextField
                  fullWidth
                  label='Send a test message to'
                  placeholder='+977 98XXXXXXXX'
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  helperText='Confirms the linked number can actually deliver, without touching a campaign'
                />
                <Button
                  variant='tonal'
                  onClick={handleTest}
                  disabled={busy || !testPhone.trim() || active?.status !== READY}
                >
                  Send test message
                </Button>

                <Divider />

                <div className='flex flex-wrap gap-3'>
                  <Button color='warning' variant='tonal' onClick={handleLogout} disabled={busy || !active}>
                    Unlink number
                  </Button>
                  <Button color='error' variant='tonal' onClick={handleDelete} disabled={busy || !active}>
                    Delete session
                  </Button>
                </div>

                {sessions.length > 1 && (
                  <>
                    <Divider />
                    <Typography variant='body2' color='text.secondary'>
                      Other sessions on this gateway
                    </Typography>
                    <div className='flex flex-wrap gap-2'>
                      {sessions.map(s => (
                        <Chip
                          key={s.id}
                          label={`${s.name} · ${describe(s.status).label}`}
                          color={s.id === active?.id ? 'primary' : 'default'}
                          variant='tonal'
                          onClick={() => setActive(s)}
                        />
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12 }}>
            <Alert severity='warning'>
              <AlertTitle>Use a number you can afford to lose</AlertTitle>
              This gateway drives WhatsApp through an unofficial client rather than Meta&apos;s Business API, so the
              linked account can be restricted without warning — most often when messages go to people who never opted
              in. Do not link a primary business line, and keep SMS or email available for anything critical.
            </Alert>
          </Grid>
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={5000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Grid>
  )
}

export default WASettings
