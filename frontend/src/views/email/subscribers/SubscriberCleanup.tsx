'use client'

import { useState, useEffect, useCallback } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import FormControl from '@mui/material/FormControl'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Checkbox from '@mui/material/Checkbox'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'

import type { Subscriber } from '@/types/email'
import subscriberService from '@/services/subscribers'

const SubscriberCleanup = () => {
  const [loading, setLoading] = useState(true)
  const [inactiveSubscribers, setInactiveSubscribers] = useState<Subscriber[]>([])
  const [inactiveCount, setInactiveCount] = useState(0)
  const [timePeriod, setTimePeriod] = useState('6months')
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [processing, setProcessing] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchInactive = useCallback(async () => {
    setLoading(true)

    try {
      const response = await subscriberService.getAll({
        per_page: 50,
        query: "subscribers.status = 'disabled' OR subscribers.status = 'blocklisted'"
      })

      setInactiveSubscribers(response.data?.results || [])
      setInactiveCount(response.data?.total || 0)
      setSelectedIds(new Set())
    } catch {
      console.error('Failed to fetch inactive subscribers')
      setSnackbar({ open: true, message: 'Failed to load inactive subscribers', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInactive()
  }, [fetchInactive])

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(inactiveSubscribers.map(s => s.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: number, checked: boolean) => {
    const next = new Set(selectedIds)

    if (checked) {
      next.add(id)
    } else {
      next.delete(id)
    }

    setSelectedIds(next)
  }

  const handleDisableInactive = async () => {
    setConfirmOpen(false)

    const targets = selectedIds.size > 0
      ? inactiveSubscribers.filter(s => selectedIds.has(s.id))
      : inactiveSubscribers

    if (targets.length === 0) return

    setProcessing(true)

    let successCount = 0
    let failCount = 0

    for (const sub of targets) {
      try {
        await subscriberService.update(sub.id, { status: 'disabled' })
        successCount++
      } catch {
        failCount++
      }
    }

    setProcessing(false)

    if (failCount > 0) {
      setSnackbar({
        open: true,
        message: `Disabled ${successCount} subscribers, ${failCount} failed`,
        severity: 'error'
      })
    } else {
      setSnackbar({
        open: true,
        message: `Successfully disabled ${successCount} inactive subscribers`,
        severity: 'success'
      })
    }

    fetchInactive()
  }

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={32} />
        <Typography className='ml-3' color='text.secondary'>Loading inactive subscribers...</Typography>
      </div>
    )
  }

  const allSelected = inactiveSubscribers.length > 0 && selectedIds.size === inactiveSubscribers.length

  return (
    <>
      <Card className='mb-6'>
        <CardContent>
          <Typography variant='h6' className='mb-4'>Clean up inactive</Typography>
          <Typography color='text.secondary' className='mb-4'>
            Inactive subscribers are people who have either never opened an email from you or have previously
            opened an email from you BUT haven&apos;t opened one in more than 6 months. You can change the time
            period using the <strong>Time inactive</strong> and <strong>Emails sent</strong> options.
          </Typography>
          <Typography color='text.secondary'>
            Before you unsubscribe your inactive subscribers, we highly recommend that you remove these
            email addresses to maintain healthy deliverability and optimal performance.
          </Typography>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className='flex items-center justify-between mb-6 flex-wrap gap-4'>
            <div>
              <Typography variant='body2' color='text.secondary'>This list contains inactive subscribers</Typography>
              <Typography variant='h4' className='font-bold'>{inactiveCount}</Typography>
            </div>
            <Button
              variant='contained'
              color='error'
              onClick={() => setConfirmOpen(true)}
              disabled={processing || inactiveSubscribers.length === 0}
            >
              {processing ? 'Processing...' : selectedIds.size > 0
                ? `Disable ${selectedIds.size} selected`
                : 'Disable all inactive'}
            </Button>
          </div>

          <div className='flex gap-3 justify-end mb-4 flex-wrap'>
            <FormControl size='small' sx={{ minWidth: { xs: '100%', sm: 200 } }}>
              <Select value={timePeriod} onChange={e => setTimePeriod(e.target.value)}>
                <MenuItem value='3months'>Inactive for last 3 mo...</MenuItem>
                <MenuItem value='6months'>Inactive for last 6 mo...</MenuItem>
                <MenuItem value='12months'>Inactive for last 12 mo...</MenuItem>
              </Select>
            </FormControl>
          </div>

          {processing && (
            <div className='flex items-center gap-2 mb-4'>
              <CircularProgress size={18} />
              <Typography variant='body2' color='text.secondary'>Processing subscribers...</Typography>
            </div>
          )}

          <TableContainer sx={{ overflowX: 'auto' }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding='checkbox'>
                    <Checkbox
                      size='small'
                      checked={allSelected}
                      indeterminate={selectedIds.size > 0 && !allSelected}
                      onChange={e => handleSelectAll(e.target.checked)}
                      inputProps={{ 'aria-label': 'Select all subscribers' }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, minWidth: 180 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600, minWidth: 80 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, minWidth: 100, display: { xs: 'none', sm: 'table-cell' } }}>Subscribed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {inactiveSubscribers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className='text-center'>
                      <Typography color='text.secondary' className='py-4'>No inactive subscribers found. Great job!</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  inactiveSubscribers.map(sub => (
                    <TableRow key={sub.id} hover selected={selectedIds.has(sub.id)}>
                      <TableCell padding='checkbox'>
                        <Checkbox
                          size='small'
                          checked={selectedIds.has(sub.id)}
                          onChange={e => handleSelectOne(sub.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography color='primary' className='font-medium'>{sub.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography color='text.secondary'>{sub.status}</Typography>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <Typography variant='body2' color='text.secondary'>
                          {new Date(sub.created_at).toLocaleDateString('en-US', {
                            year: 'numeric', month: '2-digit', day: '2-digit'
                          })}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Confirm Cleanup</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to disable{' '}
            <strong>{selectedIds.size > 0 ? selectedIds.size : inactiveSubscribers.length}</strong>{' '}
            inactive subscriber{(selectedIds.size > 0 ? selectedIds.size : inactiveSubscribers.length) !== 1 ? 's' : ''}?
            They will no longer receive any emails.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={handleDisableInactive} color='error' variant='contained'>
            Confirm
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant='filled'>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default SubscriberCleanup
