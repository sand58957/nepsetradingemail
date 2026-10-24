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
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

// Service Imports
import phoneSmsService from '@/services/phoneSms'

// Type Imports
import type { PhoneSMSInboxItem } from '@/types/phoneSms'

const PhoneSMSInbox = () => {
  const [items, setItems] = useState<PhoneSMSInboxItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(25)
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInbox = useCallback(async () => {
    setLoading(true)

    try {
      const response = await phoneSmsService.getInbox({ page: page + 1, per_page: perPage, query: query || undefined })

      setItems(response.data.results || [])
      setTotal(response.data.total || 0)
      setError(null)
    } catch (err: any) {
      if (err?.response?.status === 401) return

      setError('Failed to load the inbox')
    } finally {
      setLoading(false)
    }
  }, [page, perPage, query])

  useEffect(() => {
    fetchInbox()
  }, [fetchInbox])

  // Search after typing pauses
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(0)
      setQuery(search.trim())
    }, 400)

    return () => clearTimeout(timer)
  }, [search])

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <CardHeader
            title='Inbox'
            subheader='SMS your phone received, including replies to your campaigns. A reply of STOP unsubscribes the sender.'
            action={
              <Tooltip title='Refresh'>
                <IconButton onClick={fetchInbox} disabled={loading} aria-label='Refresh inbox'>
                  {loading ? <CircularProgress size={18} /> : <i className='tabler-refresh' />}
                </IconButton>
              </Tooltip>
            }
          />
          <CardContent>
            <TextField
              fullWidth
              size='small'
              placeholder='Search by phone, name or message'
              value={search}
              onChange={e => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position='start'>
                      <i className='tabler-search' />
                    </InputAdornment>
                  )
                }
              }}
            />
          </CardContent>

          {error ? (
            <CardContent>
              <Typography color='error'>{error}</Typography>
            </CardContent>
          ) : !loading && items.length === 0 ? (
            <CardContent className='text-center py-12'>
              <i className='tabler-message-off text-[48px]' style={{ color: 'var(--mui-palette-text-secondary)' }} />
              <Typography color='text.secondary' className='mt-2'>
                {query ? 'No messages match your search' : 'No replies yet. They appear here once your phone receives SMS.'}
              </Typography>
            </CardContent>
          ) : (
            <div className='overflow-x-auto'>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>From</TableCell>
                    <TableCell>Message</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>SIM</TableCell>
                    <TableCell>Received</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map(item => (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography className='font-medium'>{item.contact_name || item.phone}</Typography>
                        {item.contact_name && (
                          <Typography variant='body2' color='text.secondary'>
                            {item.phone}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 480 }}>
                        <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {item.message}
                        </Typography>
                        {item.opted_out && (
                          <Chip size='small' color='warning' variant='tonal' label='Unsubscribed' className='mt-1' />
                        )}
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        {item.sim_number > 0 ? `SIM ${item.sim_number}` : '--'}
                      </TableCell>
                      <TableCell>
                        <Typography variant='body2'>{new Date(item.received_at).toLocaleString()}</Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <TablePagination
            component='div'
            count={total}
            page={page}
            rowsPerPage={perPage}
            rowsPerPageOptions={[25, 50, 100]}
            onPageChange={(_, p) => setPage(p)}
            onRowsPerPageChange={e => {
              setPerPage(parseInt(e.target.value, 10))
              setPage(0)
            }}
          />
        </Card>
      </Grid>
    </Grid>
  )
}

export default PhoneSMSInbox
