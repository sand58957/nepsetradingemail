'use client'

import { useState, useEffect } from 'react'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Paper from '@mui/material/Paper'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Grid from '@mui/material/Grid'

import type { ImportHistoryRecord, ImportSource, ImportStatus } from '@/types/email'
import importService from '@/services/import'

const statusColorMap: Record<ImportStatus, 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info'> = {
  pending: 'default',
  processing: 'info',
  completed: 'success',
  failed: 'error',
  cancelled: 'warning'
}

const sourceColorMap: Record<ImportSource, 'primary' | 'secondary' | 'info'> = {
  csv: 'primary',
  api: 'secondary',
  webhook: 'info'
}

const ImportHistoryTable = () => {
  const [history, setHistory] = useState<ImportHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(10)
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  // Detail dialog
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<ImportHistoryRecord | null>(null)

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' })

  const fetchHistory = async () => {
    setLoading(true)

    try {
      const params: Record<string, any> = {
        page: page + 1,
        per_page: perPage
      }

      if (sourceFilter) params.source = sourceFilter
      if (statusFilter) params.status = statusFilter

      const res = await importService.getHistory(params)

      setHistory(res.data || [])
      setTotal(res.total || 0)
    } catch {
      setHistory([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHistory()
  }, [page, perPage, sourceFilter, statusFilter])

  const handleDelete = async () => {
    if (!deleteId) return
    setDeleting(true)

    try {
      await importService.deleteHistory(deleteId)
      setDeleteOpen(false)
      setDeleteId(null)
      fetchHistory()
      setSnackbar({ open: true, message: 'Import record deleted', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete record', severity: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—'

    return new Date(dateStr).toLocaleString()
  }

  const getDuration = (start: string | null, end: string | null) => {
    if (!start || !end) return '—'
    const ms = new Date(end).getTime() - new Date(start).getTime()
    const seconds = Math.floor(ms / 1000)

    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)

    return `${minutes}m ${seconds % 60}s`
  }

  return (
    <Box className='flex flex-col gap-4'>
      {/* Filters */}
      <Box className='flex items-center gap-3'>
        <FormControl size='small' sx={{ minWidth: 140 }}>
          <InputLabel>Source</InputLabel>
          <Select value={sourceFilter} label='Source' onChange={e => { setSourceFilter(e.target.value); setPage(0) }}>
            <MenuItem value=''>All Sources</MenuItem>
            <MenuItem value='csv'>CSV</MenuItem>
            <MenuItem value='api'>API</MenuItem>
            <MenuItem value='webhook'>Webhook</MenuItem>
          </Select>
        </FormControl>
        <FormControl size='small' sx={{ minWidth: 140 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label='Status' onChange={e => { setStatusFilter(e.target.value); setPage(0) }}>
            <MenuItem value=''>All Statuses</MenuItem>
            <MenuItem value='completed'>Completed</MenuItem>
            <MenuItem value='processing'>Processing</MenuItem>
            <MenuItem value='failed'>Failed</MenuItem>
            <MenuItem value='cancelled'>Cancelled</MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ flex: 1 }} />
        <Button variant='outlined' size='small' onClick={fetchHistory} startIcon={<i className='tabler-refresh' />}>
          Refresh
        </Button>
      </Box>

      {/* Table */}
      {loading ? (
        <Box className='flex justify-center py-8'>
          <CircularProgress />
        </Box>
      ) : history.length === 0 ? (
        <Box className='text-center py-12'>
          <i className='tabler-history text-[48px]' style={{ color: 'var(--mui-palette-text-disabled)' }} />
          <Typography color='text.secondary' className='mt-2'>
            No import history found
          </Typography>
        </Box>
      ) : (
        <>
          <TableContainer component={Paper} variant='outlined'>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Source</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>File</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align='center'>
                    Records
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Started</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Duration</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align='center'>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {history.map(record => (
                  <TableRow
                    key={record.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => {
                      setSelectedRecord(record)
                      setDetailOpen(true)
                    }}
                  >
                    <TableCell>
                      <Chip
                        label={record.source.toUpperCase()}
                        size='small'
                        color={sourceColorMap[record.source] || 'default'}
                        variant='outlined'
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2'>{record.filename || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={record.status}
                        size='small'
                        color={statusColorMap[record.status] || 'default'}
                      />
                    </TableCell>
                    <TableCell align='center'>
                      <Box className='flex items-center justify-center gap-1'>
                        <Typography variant='body2' color='success.main' className='font-medium'>
                          {record.successful}
                        </Typography>
                        {record.failed > 0 && (
                          <>
                            <Typography variant='body2' color='text.disabled'>
                              /
                            </Typography>
                            <Typography variant='body2' color='error.main'>
                              {record.failed}
                            </Typography>
                          </>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2'>{formatDate(record.started_at)}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2'>
                        {getDuration(record.started_at, record.completed_at)}
                      </Typography>
                    </TableCell>
                    <TableCell align='center'>
                      <Tooltip title='Delete'>
                        <IconButton
                          size='small'
                          color='error'
                          onClick={e => {
                            e.stopPropagation()
                            setDeleteId(record.id)
                            setDeleteOpen(true)
                          }}
                        >
                          <i className='tabler-trash text-[16px]' />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <TablePagination
            component='div'
            count={total}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={perPage}
            onRowsPerPageChange={e => {
              setPerPage(parseInt(e.target.value, 10))
              setPage(0)
            }}
            rowsPerPageOptions={[5, 10, 25, 50]}
          />
        </>
      )}

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>Import Details #{selectedRecord?.id}</DialogTitle>
        <DialogContent>
          {selectedRecord && (
            <Box className='flex flex-col gap-4 mt-2'>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Source
                  </Typography>
                  <Chip
                    label={selectedRecord.source.toUpperCase()}
                    size='small'
                    color={sourceColorMap[selectedRecord.source] || 'default'}
                    variant='outlined'
                    sx={{ mt: 0.5 }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Status
                  </Typography>
                  <Chip
                    label={selectedRecord.status}
                    size='small'
                    color={statusColorMap[selectedRecord.status] || 'default'}
                    sx={{ mt: 0.5 }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Started
                  </Typography>
                  <Typography variant='body2'>{formatDate(selectedRecord.started_at)}</Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Duration
                  </Typography>
                  <Typography variant='body2'>
                    {getDuration(selectedRecord.started_at, selectedRecord.completed_at)}
                  </Typography>
                </Grid>
              </Grid>

              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box className='text-center p-3 rounded-lg' sx={{ bgcolor: 'action.hover' }}>
                    <Typography variant='h5' className='font-bold'>
                      {selectedRecord.total}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Total
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box className='text-center p-3 rounded-lg' sx={{ bgcolor: 'action.hover' }}>
                    <Typography variant='h5' className='font-bold' color='success.main'>
                      {selectedRecord.successful}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Successful
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box className='text-center p-3 rounded-lg' sx={{ bgcolor: 'action.hover' }}>
                    <Typography variant='h5' className='font-bold' color='error.main'>
                      {selectedRecord.failed}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Failed
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <Box className='text-center p-3 rounded-lg' sx={{ bgcolor: 'action.hover' }}>
                    <Typography variant='h5' className='font-bold' color='warning.main'>
                      {selectedRecord.skipped}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Skipped
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {selectedRecord.filename && (
                <Box>
                  <Typography variant='subtitle2'>Filename</Typography>
                  <Typography variant='body2'>{selectedRecord.filename}</Typography>
                </Box>
              )}

              {selectedRecord.error_log && selectedRecord.error_log.length > 0 && (
                <Box>
                  <Typography variant='subtitle2' className='mb-1'>
                    Error Log ({selectedRecord.error_log.length} errors)
                  </Typography>
                  <TableContainer component={Paper} variant='outlined' sx={{ maxHeight: 250 }}>
                    <Table size='small'>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                          <TableCell sx={{ fontWeight: 600 }}>Error</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedRecord.error_log.map((err, i) => (
                          <TableRow key={i}>
                            <TableCell>{err.email || '—'}</TableCell>
                            <TableCell>
                              <Typography variant='body2' color='error'>
                                {err.error}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
        <DialogTitle>Delete Import Record</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this import history record? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            color='error'
            onClick={handleDelete}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={18} /> : <i className='tabler-trash' />}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default ImportHistoryTable
