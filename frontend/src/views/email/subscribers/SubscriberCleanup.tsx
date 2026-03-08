'use client'

import { useState, useEffect } from 'react'

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

import type { Subscriber } from '@/types/email'
import subscriberService from '@/services/subscribers'

const SubscriberCleanup = () => {
  const [loading, setLoading] = useState(true)
  const [inactiveSubscribers, setInactiveSubscribers] = useState<Subscriber[]>([])
  const [inactiveCount, setInactiveCount] = useState(0)
  const [timePeriod, setTimePeriod] = useState('6months')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  useEffect(() => {
    const fetchInactive = async () => {
      setLoading(true)

      try {
        // Fetch subscribers that are disabled or unsubscribed (inactive)
        const response = await subscriberService.getAll({
          per_page: 50,
          query: "subscribers.status = 'disabled' OR subscribers.status = 'blocklisted'"
        })

        setInactiveSubscribers(response.data?.results || [])
        setInactiveCount(response.data?.total || 0)
      } catch {
        console.error('Failed to fetch inactive subscribers')
      } finally {
        setLoading(false)
      }
    }

    fetchInactive()
  }, [])

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={32} />
        <Typography className='ml-3' color='text.secondary'>Loading inactive subscribers...</Typography>
      </div>
    )
  }

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
          <div className='flex items-center justify-between mb-6'>
            <div>
              <Typography variant='body2' color='text.secondary'>This list contains inactive subscribers</Typography>
              <Typography variant='h4' className='font-bold'>{inactiveCount}</Typography>
            </div>
            <Button variant='contained' color='error'>
              Unsubscribe inactive
            </Button>
          </div>

          <div className='flex gap-3 justify-end mb-4'>
            <FormControl size='small' sx={{ minWidth: 200 }}>
              <Select value={timePeriod} onChange={e => setTimePeriod(e.target.value)}>
                <MenuItem value='3months'>Inactive for last 3 mo...</MenuItem>
                <MenuItem value='6months'>Inactive for last 6 mo...</MenuItem>
                <MenuItem value='12months'>Inactive for last 12 mo...</MenuItem>
              </Select>
            </FormControl>
          </div>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding='checkbox'><Checkbox size='small' /></TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Subscribed</TableCell>
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
                    <TableRow key={sub.id} hover>
                      <TableCell padding='checkbox'><Checkbox size='small' /></TableCell>
                      <TableCell>
                        <Typography color='primary' className='font-medium'>{sub.email}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography color='text.secondary'>{sub.status}</Typography>
                      </TableCell>
                      <TableCell>
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

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant='filled'>{snackbar.message}</Alert>
      </Snackbar>
    </>
  )
}

export default SubscriberCleanup
