'use client'

import { useState, useEffect } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Snackbar from '@mui/material/Snackbar'

// Type Imports
import type { WAContact } from '@/types/whatsapp'

// Service Imports
import whatsappService from '@/services/whatsapp'

const WAContactCleanup = () => {
  const [contacts, setContacts] = useState<WAContact[]>([])
  const [totalOptedOut, setTotalOptedOut] = useState(0)
  const [loading, setLoading] = useState(true)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const fetchOptedOut = async () => {
    setLoading(true)

    try {
      const response = await whatsappService.getCleanupContacts()

      setContacts(response.data.contacts || [])
      setTotalOptedOut(response.data.total || 0)
    } catch {
      setSnackbar({ open: true, message: 'Failed to fetch opted-out contacts', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOptedOut()
  }, [])

  const handleCleanup = async () => {
    setProcessing(true)

    try {
      const response = await whatsappService.deleteOptedOutContacts()

      setSnackbar({
        open: true,
        message: `Successfully removed ${response.data.deleted} opted-out contacts`,
        severity: 'success'
      })
      setConfirmOpen(false)
      fetchOptedOut()
    } catch {
      setSnackbar({ open: true, message: 'Failed to clean up contacts', severity: 'error' })
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={28} />
        <Typography className='ml-3' color='text.secondary'>Loading...</Typography>
      </div>
    )
  }

  return (
    <>
      {/* Info Card */}
      <Card className='mb-6'>
        <CardContent>
          <Alert severity='info'>
            <Typography variant='body2'>
              <strong>Clean up inactive contacts</strong> — This tool helps you identify and remove contacts
              who have opted out of receiving WhatsApp messages. Removing opted-out contacts keeps your
              contact list clean and avoids sending messages to uninterested recipients.
            </Typography>
          </Alert>
        </CardContent>
      </Card>

      {/* Opted-out Contacts */}
      <Card>
        <CardHeader
          title={`Opted-out Contacts (${totalOptedOut})`}
          subheader='Contacts who have opted out will not receive campaign messages'
          action={
            totalOptedOut > 0 ? (
              <Button
                variant='contained'
                color='error'
                size='small'
                startIcon={<i className='tabler-trash' />}
                onClick={() => setConfirmOpen(true)}
              >
                Remove All Opted-out
              </Button>
            ) : null
          }
        />
        <CardContent>
          {contacts.length === 0 ? (
            <div className='text-center py-8'>
              <i className='tabler-mood-happy text-[48px] mb-3' style={{ color: 'var(--mui-palette-success-main)' }} />
              <Typography color='text.secondary' className='mb-1'>
                No opted-out contacts found
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                All your contacts are actively opted in. Great job!
              </Typography>
            </div>
          ) : (
            <TableContainer>
              <Table size='small'>
                <TableHead>
                  <TableRow>
                    <TableCell>Phone</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Opted Out</TableCell>
                    <TableCell>Tags</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contacts.map(contact => (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Typography variant='body2'>{contact.phone}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant='body2'>{contact.name || '—'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label='Opted Out' size='small' variant='tonal' color='error' />
                      </TableCell>
                      <TableCell>
                        <Typography variant='caption'>
                          {contact.opted_out_at ? new Date(contact.opted_out_at).toLocaleDateString() : '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <div className='flex gap-1 flex-wrap'>
                          {(contact.tags || []).slice(0, 3).map((tag: string) => (
                            <Chip key={tag} label={tag} size='small' variant='outlined' />
                          ))}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <DialogTitle>Remove Opted-out Contacts</DialogTitle>
        <DialogContent>
          <Alert severity='warning' className='mb-3'>
            This action cannot be undone. All opted-out contacts will be permanently deleted.
          </Alert>
          <Typography>
            Are you sure you want to permanently remove {totalOptedOut} opted-out contact{totalOptedOut !== 1 ? 's' : ''}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            color='error'
            onClick={handleCleanup}
            disabled={processing}
            startIcon={processing ? <CircularProgress size={18} /> : <i className='tabler-trash' />}
          >
            {processing ? 'Removing...' : `Remove ${totalOptedOut} Contacts`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
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

export default WAContactCleanup
