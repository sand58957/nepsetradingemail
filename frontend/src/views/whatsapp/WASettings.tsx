'use client'

// React Imports
import { useState, useEffect, useCallback } from 'react'

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
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

// Service Imports
import whatsappService from '@/services/whatsapp'

// Type Imports
import type { WANumber } from '@/types/whatsapp'

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

/** What to call a number on screen. */
const numberName = (n: WANumber, index: number) => n.label || n.linked_phone || `Number ${index + 1}`

type Confirm = { action: 'logout' | 'delete'; number: WANumber; name: string } | null

const WASettings = () => {
  // Everything here is about the numbers THIS account sends from. Each number is
  // addressed by the account's own id for it; the server looks it up inside the
  // account, so a number belonging to anyone else can't be reached from here.
  const [numbers, setNumbers] = useState<WANumber[]>([])
  const [max, setMax] = useState(3)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | 'add' | null>(null)
  const [qrCodes, setQrCodes] = useState<Record<number, string>>({})
  const [testPhones, setTestPhones] = useState<Record<number, string>>({})
  const [renaming, setRenaming] = useState<{ id: number; label: string } | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [addLabel, setAddLabel] = useState('')
  const [confirm, setConfirm] = useState<Confirm>(null)

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
      const res = await whatsappService.listNumbers()

      setNumbers(res.data.numbers)
      setMax(res.data.max)
    } catch (err) {
      notify(errorText(err, 'Could not check your WhatsApp numbers'), 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // While a number waits to be linked, both its code and its status change on
  // their own — the code rotates every few seconds and the status flips the
  // moment someone scans. Poll so nobody is looking at an expired code.
  const waitingIds = numbers
    .filter(n => n.status === 'qr_ready')
    .map(n => n.id)
    .join(',')

  useEffect(() => {
    if (!waitingIds) {
      setQrCodes({})

      return
    }

    const ids = waitingIds.split(',').map(Number)
    let cancelled = false
    const poll: { timer?: ReturnType<typeof setInterval> } = {}

    // A miss or two is expected while the engine rotates the code. A persistent
    // one is not: silently retrying a request the gateway keeps refusing asked
    // 304 times in one hour and showed nothing. Give up and say why.
    let consecutiveFailures = 0

    const tick = async () => {
      try {
        const [list, ...codes] = await Promise.all([
          whatsappService.listNumbers(),
          ...ids.map(id => whatsappService.numberQR(id).catch(() => null))
        ])

        if (cancelled) return

        consecutiveFailures = 0

        const next: Record<number, string> = {}

        ids.forEach((id, i) => {
          const code = codes[i]?.data?.qrCode

          if (code) next[id] = code
        })

        setQrCodes(next)

        list.data.numbers.forEach(n => {
          if (ids.includes(n.id) && n.status === READY) {
            notify(`Linked ${n.linked_phone || n.label || 'the number'} successfully`)
          }
        })

        setNumbers(list.data.numbers)
      } catch (err) {
        if (cancelled) return

        consecutiveFailures += 1

        if (consecutiveFailures >= 3) {
          cancelled = true
          clearInterval(poll.timer)
          notify(errorText(err, 'The QR code could not be fetched. Start the number and try again.'), 'error')
        }
      }
    }

    tick()
    poll.timer = setInterval(tick, 4000)

    return () => {
      cancelled = true
      clearInterval(poll.timer)
    }
  }, [waitingIds])

  const run = async (key: number | 'add', fn: () => Promise<void>, done: string) => {
    setBusy(key)

    try {
      await fn()
      await load()
      notify(done)
    } catch (err) {
      notify(errorText(err, 'That did not work'), 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleAdd = () =>
    run(
      'add',
      async () => {
        await whatsappService.addNumber(addLabel.trim())
        setAddOpen(false)
        setAddLabel('')
      },
      'Number added. Scan its QR code with the phone that will send from it.'
    )

  const handleRename = () => {
    if (!renaming) return

    const { id, label } = renaming

    run(
      id,
      async () => {
        await whatsappService.renameNumber(id, label)
        setRenaming(null)
      },
      'Name saved'
    )
  }

  const handleConfirm = () => {
    if (!confirm) return

    const { action, number, name } = confirm

    setConfirm(null)

    if (action === 'logout') {
      run(number.id, () => whatsappService.logoutNumber(number.id), `${name} unlinked`)
    } else {
      run(number.id, () => whatsappService.deleteNumber(number.id), `${name} removed`)
    }
  }

  const handleTest = (number: WANumber) => {
    const phone = (testPhones[number.id] || '').trim()

    run(
      number.id,
      () => whatsappService.testNumber(number.id, phone, 'Test message from Nepal Fillings.'),
      `Test message sent to ${phone}`
    )
  }

  if (loading) {
    return (
      <Box className='flex justify-center items-center' sx={{ minHeight: 320 }}>
        <CircularProgress />
      </Box>
    )
  }

  const atLimit = numbers.length >= max
  const connectedCount = numbers.filter(n => n.connected).length

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardContent className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <Typography variant='h5'>Your WhatsApp numbers</Typography>
              <Typography color='text.secondary'>
                Campaigns send from your default number unless you pick another when sending.
              </Typography>
            </div>
            <div className='flex flex-wrap items-center gap-3'>
              <Chip
                label={`${numbers.length} of ${max} added · ${connectedCount} connected`}
                variant='tonal'
                color={connectedCount > 0 ? 'success' : 'default'}
              />
              <Button
                variant='contained'
                startIcon={<i className='tabler-plus' />}
                onClick={() => setAddOpen(true)}
                disabled={atLimit || busy !== null}
              >
                Add number
              </Button>
            </div>
          </CardContent>
          {atLimit && (
            <CardContent className='pbs-0'>
              <Alert severity='info'>
                This account has reached its limit of {max} numbers. Remove one to add another.
              </Alert>
            </CardContent>
          )}
        </Card>
      </Grid>

      {numbers.length === 0 && (
        <Grid size={{ xs: 12 }}>
          <Alert severity='info'>
            This account has no WhatsApp number yet. Adding one takes about a minute and needs the phone in your hand.
          </Alert>
        </Grid>
      )}

      {numbers.map((number, index) => {
        const status = describe(number.status)
        const name = numberName(number, index)
        const isBusy = busy === number.id
        const qr = qrCodes[number.id]

        return (
          <Grid key={number.id} size={{ xs: 12, md: 6 }}>
            <Card className='bs-full'>
              <CardHeader
                title={
                  renaming?.id === number.id ? (
                    <div className='flex items-center gap-2'>
                      <TextField
                        size='small'
                        autoFocus
                        value={renaming.label}
                        placeholder='e.g. Support, Sales'
                        inputProps={{ maxLength: 40 }}
                        onChange={e => setRenaming({ id: number.id, label: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && handleRename()}
                      />
                      <Button size='small' onClick={handleRename} disabled={isBusy}>
                        Save
                      </Button>
                      <Button size='small' color='secondary' onClick={() => setRenaming(null)}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className='flex items-center gap-2'>
                      <span>{name}</span>
                      <Button
                        size='small'
                        variant='text'
                        aria-label={`Rename ${name}`}
                        onClick={() => setRenaming({ id: number.id, label: number.label })}
                        sx={{ minWidth: 0, px: 1 }}
                      >
                        <i className='tabler-pencil text-base' />
                      </Button>
                    </div>
                  )
                }
                subheader={number.linked_phone && number.label ? number.linked_phone : undefined}
                action={
                  <div className='flex flex-wrap gap-2 justify-end'>
                    {number.is_default && <Chip label='Default' color='primary' size='small' variant='tonal' />}
                    <Chip label={status.label} color={status.color} size='small' variant='tonal' />
                  </div>
                }
              />
              <CardContent className='flex flex-col gap-4'>
                {number.campaigns_blocked_message && (
                  <Alert severity='error'>
                    <AlertTitle>Campaigns from this number are on hold</AlertTitle>
                    {number.campaigns_blocked_message}
                  </Alert>
                )}

                {number.status === 'qr_ready' &&
                  (qr ? (
                    <Box className='flex flex-col items-center gap-3'>
                      {/* The gateway returns a ready-to-render data URI. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qr}
                        alt={`QR code to link ${name}`}
                        width={240}
                        height={240}
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

                {number.status !== 'qr_ready' && !number.connected && (
                  <Alert
                    severity='warning'
                    action={
                      number.linked ? (
                        <Button
                          color='inherit'
                          size='small'
                          onClick={() => run(number.id, () => whatsappService.startNumber(number.id), 'Starting')}
                          disabled={isBusy}
                        >
                          Start
                        </Button>
                      ) : undefined
                    }
                  >
                    {number.linked
                      ? `This number is ${status.label.toLowerCase()}. Start it to get a QR code.`
                      : 'This number lost its connection to the gateway. Remove it and add it again.'}
                    {number.last_error ? ` Last error: ${number.last_error}` : ''}
                  </Alert>
                )}

                {number.connected && (
                  <Alert severity='success'>
                    Sending as {number.linked_phone || 'this number'}
                    {number.is_default ? '. Used unless a campaign picks another number.' : '.'}
                  </Alert>
                )}

                <div className='flex gap-2'>
                  <TextField
                    fullWidth
                    size='small'
                    label='Send a test message to'
                    placeholder='+977 98XXXXXXXX'
                    value={testPhones[number.id] || ''}
                    onChange={e => setTestPhones({ ...testPhones, [number.id]: e.target.value })}
                  />
                  <Button
                    variant='tonal'
                    onClick={() => handleTest(number)}
                    disabled={isBusy || !(testPhones[number.id] || '').trim() || !number.connected}
                  >
                    Test
                  </Button>
                </div>

                <Divider />

                <div className='flex flex-wrap gap-3'>
                  {!number.is_default && (
                    <Button
                      variant='tonal'
                      onClick={() =>
                        run(number.id, () => whatsappService.setDefaultNumber(number.id), `${name} is now the default`)
                      }
                      disabled={isBusy}
                    >
                      Make default
                    </Button>
                  )}
                  <Button
                    color='warning'
                    variant='tonal'
                    onClick={() => setConfirm({ action: 'logout', number, name })}
                    disabled={isBusy || !number.linked_phone}
                  >
                    Unlink phone
                  </Button>
                  <Button
                    color='error'
                    variant='tonal'
                    onClick={() => setConfirm({ action: 'delete', number, name })}
                    disabled={isBusy}
                  >
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          </Grid>
        )
      })}

      <Grid size={{ xs: 12 }}>
        <Alert severity='warning'>
          <AlertTitle>Use numbers you can afford to lose</AlertTitle>
          This sends through an unofficial WhatsApp client rather than Meta&apos;s Business API, so a linked number can be
          restricted without warning — most often when messages go to people who never opted in or have never chatted
          with it. Each number has its own reputation: start a new number with a few messages a day to people who know
          you, and don&apos;t send the same campaign to strangers from every number, or WhatsApp can unlink them all at
          once. Campaigns from a number wait 24 hours after it is unlinked. Keep SMS or email for anything critical.
        </Alert>
      </Grid>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Add a WhatsApp number</DialogTitle>
        <DialogContent>
          <Typography className='mbe-4' color='text.secondary'>
            Give it a name so you can tell your numbers apart when sending. You&apos;ll scan a QR code with the phone
            next.
          </Typography>
          <TextField
            fullWidth
            autoFocus
            label='Name (optional)'
            placeholder='e.g. Support, Sales, Brand B'
            value={addLabel}
            inputProps={{ maxLength: 40 }}
            onChange={e => setAddLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            onClick={handleAdd}
            disabled={busy === 'add'}
            startIcon={busy === 'add' ? <CircularProgress size={18} /> : undefined}
          >
            {busy === 'add' ? 'Adding…' : 'Add and show QR code'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} maxWidth='xs' fullWidth>
        <DialogTitle>{confirm?.action === 'delete' ? `Remove ${confirm?.name}?` : `Unlink ${confirm?.name}?`}</DialogTitle>
        <DialogContent>
          <Typography>
            {confirm?.action === 'delete'
              ? 'The number is removed from this account and its connection is deleted. Campaigns that used it will send from your default number. Messages it already sent stay in your reports.'
              : 'The phone is unlinked from this number. To send from it again you will need to scan a new QR code with the phone.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant='contained' color={confirm?.action === 'delete' ? 'error' : 'warning'} onClick={handleConfirm}>
            {confirm?.action === 'delete' ? 'Remove number' : 'Unlink phone'}
          </Button>
        </DialogActions>
      </Dialog>

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
