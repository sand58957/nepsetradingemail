'use client'

// React Imports
import { useState, useEffect, useCallback, useRef } from 'react'

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

const describe = (status: string) =>
  STATUS_LABEL[status] ?? { label: status || 'No number linked', color: 'default' as const }

const WASettings = () => {
  // This page is about one thing: the number THIS account sends from. There is no
  // account switcher and no session picker, because an account only ever has its
  // own session and the server resolves it from the request — the client never
  // names one.
  const [session, setSession] = useState<OpenWASession | null>(null)

  // Set while campaigns wait out an unlink of this number; the server words it.
  const [blockedMessage, setBlockedMessage] = useState('')
  const [qr, setQr] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: Severity }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const notify = (message: string, severity: Severity = 'success') => setSnackbar({ open: true, message, severity })

  const errorText = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback

  const load = useCallback(async () => {
    try {
      const res = await whatsappService.mySession()

      setSession(res.data.linked ? res.data.session : null)
      setBlockedMessage(res.data.campaigns_blocked_message || '')
    } catch (err) {
      notify(errorText(err, 'Could not check your WhatsApp connection'), 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // While a session waits to be linked, both the code and the status change on
  // their own — the code rotates every few seconds and the status flips the
  // moment someone scans. Poll so nobody is looking at an expired code.
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const stop = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    if (session?.status !== 'qr_ready') {
      setQr('')
      stop()

      return stop
    }

    let cancelled = false

    // A miss or two is expected while the engine rotates the code. A persistent
    // one is not: silently retrying a request the gateway keeps refusing asked
    // 304 times in one hour and showed nothing. Give up and say why.
    let consecutiveFailures = 0
    const maxConsecutiveFailures = 3

    const tick = async () => {
      try {
        const [qrRes, sessionRes] = await Promise.all([whatsappService.myQR(), whatsappService.mySession()])

        if (cancelled) return

        consecutiveFailures = 0
        setQr(qrRes.data?.qrCode || '')
        setBlockedMessage(sessionRes.data.campaigns_blocked_message || '')

        const fresh = sessionRes.data.linked ? sessionRes.data.session : null

        if (fresh && fresh.status !== 'qr_ready') {
          setSession(fresh)

          if (fresh.status === READY) {
            notify(`Linked ${fresh.phone || 'your number'} successfully`, 'success')
          }
        }
      } catch (err) {
        if (cancelled) return

        consecutiveFailures += 1

        if (consecutiveFailures >= maxConsecutiveFailures) {
          stop()
          setQr('')
          notify(errorText(err, 'The QR code could not be fetched. Start the session and try again.'), 'error')
          load()
        }
      }
    }

    tick()
    pollRef.current = setInterval(tick, 4000)

    return () => {
      cancelled = true
      stop()
    }
  }, [session, load])

  const run = async (fn: () => Promise<void>, done: string) => {
    setBusy(true)

    try {
      await fn()
      await load()
      notify(done)
    } catch (err) {
      notify(errorText(err, 'That did not work'), 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleConnect = () =>
    run(async () => {
      await whatsappService.createMySession()
    }, 'Scan the QR code with the phone that owns your number')

  const handleStart = () =>
    run(async () => {
      await whatsappService.startMySession()
    }, 'Starting')

  const handleLogout = () => run(() => whatsappService.logoutMySession(), 'Number unlinked')

  const handleDelete = () => run(() => whatsappService.deleteMySession(), 'Session deleted')

  const handleTest = () =>
    run(
      () => whatsappService.testMySession(testPhone.trim(), 'Test message from Nepal Fillings.'),
      `Test message sent to ${testPhone.trim()}`
    )

  if (loading) {
    return (
      <Box className='flex justify-center items-center' sx={{ minHeight: 320 }}>
        <CircularProgress />
      </Box>
    )
  }

  const status = describe(session?.status || '')

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <Typography variant='h5'>Your WhatsApp number</Typography>
              <Typography color='text.secondary'>
                Campaigns and messages from this account are sent from the number you link here.
              </Typography>
            </div>
            <div className='flex items-center gap-2'>
              <Chip label={status.label} color={status.color} variant='tonal' />
              {session?.phone && <Chip label={session.phone} variant='tonal' />}
            </div>
          </CardContent>
        </Card>
      </Grid>

      {blockedMessage && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='error'>
            <AlertTitle>Campaigns are on hold for this number</AlertTitle>
            {blockedMessage} In the meantime, use WhatsApp on the phone as normal and don&apos;t message people who
            haven&apos;t asked to hear from you.
          </Alert>
        </Grid>
      )}

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader
            title='Link a number'
            subheader='Scan the code with the phone that will send your messages'
          />
          <CardContent className='flex flex-col gap-4'>
            {!session && (
              <>
                <Alert severity='info'>
                  This account has no WhatsApp number yet. Connecting one takes about a minute and needs the phone in
                  your hand.
                </Alert>
                <Button variant='contained' onClick={handleConnect} disabled={busy}>
                  Connect a WhatsApp number
                </Button>
              </>
            )}

            {session?.status === 'qr_ready' &&
              (qr ? (
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
              ))}

            {session && session.status !== 'qr_ready' && session.status !== READY && (
              <>
                <Alert severity='warning'>
                  This connection is {status.label.toLowerCase()}. Start it to get a QR code.
                  {session.lastError ? ` Last error: ${session.lastError}` : ''}
                </Alert>
                <Button variant='contained' onClick={handleStart} disabled={busy}>
                  Start
                </Button>
              </>
            )}

            {session?.status === READY && (
              <Alert severity='success'>
                <AlertTitle>Linked</AlertTitle>
                Sending as {session.phone || 'your linked number'}
                {session.pushName ? ` (${session.pushName})` : ''}.
              </Alert>
            )}
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Check and manage' subheader='Confirm delivery, or unlink the number' />
          <CardContent className='flex flex-col gap-4'>
            <TextField
              fullWidth
              label='Send a test message to'
              placeholder='+977 98XXXXXXXX'
              value={testPhone}
              onChange={e => setTestPhone(e.target.value)}
              helperText='Confirms your number can actually deliver, without touching a campaign'
            />
            <Button
              variant='tonal'
              onClick={handleTest}
              disabled={busy || !testPhone.trim() || session?.status !== READY}
            >
              Send test message
            </Button>

            <Divider />

            <div className='flex flex-wrap gap-3'>
              <Button color='warning' variant='tonal' onClick={handleLogout} disabled={busy || !session}>
                Unlink number
              </Button>
              <Button color='error' variant='tonal' onClick={handleDelete} disabled={busy || !session}>
                Delete connection
              </Button>
            </div>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <Alert severity='warning'>
          <AlertTitle>Use a number you can afford to lose</AlertTitle>
          This sends through an unofficial WhatsApp client rather than Meta&apos;s Business API, so the linked account
          can be restricted without warning — most often when messages go to people who never opted in or have never
          chatted with the number. WhatsApp usually unlinks a number a few times before it bans it, so campaigns wait
          24 hours after an unlink. Do not link a primary business line, and keep SMS or email available for anything
          critical.
        </Alert>
      </Grid>

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
