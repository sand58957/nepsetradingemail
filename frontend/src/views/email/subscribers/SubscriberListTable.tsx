'use client'

// React Imports
import { useState, useMemo, useEffect, useCallback } from 'react'

// Next Imports
import { useParams } from 'next/navigation'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import TablePagination from '@mui/material/TablePagination'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Checkbox from '@mui/material/Checkbox'
import Autocomplete from '@mui/material/Autocomplete'

// Third-party Imports
import classnames from 'classnames'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable
} from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'

// Type Imports
import type { Subscriber, SubscriberStatus, List } from '@/types/email'

// Service Imports
import subscriberService from '@/services/subscribers'
import listService from '@/services/lists'

// Hook Imports
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'

// Styles Imports
import tableStyles from '@core/styles/table.module.css'

type SubscriberWithAction = Subscriber & {
  action?: string
}

// Status color mapping
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

// Column helper
const columnHelper = createColumnHelper<SubscriberWithAction>()

const SubscriberListTable = () => {
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  // States
  const [subscribers, setSubscribers] = useState<SubscriberWithAction[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [perPage, setPerPage] = useState(10)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchDebounce, setSearchDebounce] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false)
  const [deleteAllConfirmText, setDeleteAllConfirmText] = useState('')
  const [subscriberToDelete, setSubscriberToDelete] = useState<SubscriberWithAction | null>(null)

  const [newSubscriber, setNewSubscriber] = useState({
    name: '',
    email: '',
    status: 'enabled' as SubscriberStatus,
    lists: [] as number[]
  })

  // Available lists for the Add dialog
  const [availableLists, setAvailableLists] = useState<List[]>([])

  // Snackbar
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const [submitting, setSubmitting] = useState(false)

  const isMobile = useMobileBreakpoint()

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(searchQuery)
      setPage(0)
    }, 400)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch subscribers from the API
  const fetchSubscribers = useCallback(async () => {
    setLoading(true)

    try {
      const params: Record<string, any> = {
        page: page + 1,
        per_page: perPage
      }

      if (searchDebounce) {
        // Sanitize: escape SQL special chars and strip dangerous patterns
        const sanitized = searchDebounce
          .replace(/'/g, "''")
          .replace(/%/g, '\\%')
          .replace(/_/g, '\\_')
          .replace(/[;\-\\]/g, '')
          .replace(/\/\*/g, '')
          .slice(0, 200)

        params.query = `subscribers.name ILIKE '%${sanitized}%' OR subscribers.email ILIKE '%${sanitized}%'`
      }

      if (statusFilter !== 'all') {
        const allowed = ['enabled', 'disabled', 'blocklisted', 'unconfirmed', 'unsubscribed']

        if (allowed.includes(statusFilter)) {
          const statusQuery = `subscribers.status = '${statusFilter}'`

          params.query = params.query ? `(${params.query}) AND ${statusQuery}` : statusQuery
        }
      }

      const response = await subscriberService.getAll(params)

      setSubscribers(response.data?.results || [])
      setTotalCount(response.data?.total || 0)
    } catch (error) {
      console.error('Failed to fetch subscribers:', error)
      setSnackbar({ open: true, message: 'Failed to fetch subscribers', severity: 'error' })
      setSubscribers([])
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }, [page, perPage, searchDebounce, statusFilter])

  // Fetch on mount and when params change
  useEffect(() => {
    fetchSubscribers()
  }, [fetchSubscribers])

  // Fetch available lists for add dialog
  useEffect(() => {
    const fetchLists = async () => {
      try {
        const response = await listService.getAll({ per_page: 100 })

        setAvailableLists(response.data?.results || [])
      } catch {
        console.error('Failed to fetch lists')
      }
    }

    fetchLists()
  }, [])

  // Handle add subscriber
  const handleAddSubscriber = async () => {
    const emailTrimmed = newSubscriber.email.trim()

    if (!emailTrimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setSnackbar({ open: true, message: 'Please enter a valid email address', severity: 'error' })

      return
    }

    setSubmitting(true)

    try {
      await subscriberService.create({
        name: newSubscriber.name,
        email: newSubscriber.email,
        status: newSubscriber.status,
        lists: newSubscriber.lists
      })

      setSnackbar({ open: true, message: 'Subscriber added successfully', severity: 'success' })
      setAddDialogOpen(false)
      setNewSubscriber({ name: '', email: '', status: 'enabled', lists: [] })
      fetchSubscribers()
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to add subscriber'

      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  // Handle delete subscriber
  const handleDeleteSubscriber = async () => {
    if (!subscriberToDelete) return

    setSubmitting(true)

    try {
      await subscriberService.delete(subscriberToDelete.id)
      setSnackbar({ open: true, message: 'Subscriber deleted successfully', severity: 'success' })
      setDeleteDialogOpen(false)
      setSubscriberToDelete(null)
      fetchSubscribers()
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to delete subscriber'

      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  // Handle delete all subscribers
  const handleDeleteAll = async () => {
    if (deleteAllConfirmText !== 'DELETE ALL') return

    setSubmitting(true)

    try {
      const result = await subscriberService.deleteAll()

      setSnackbar({
        open: true,
        message: result?.data?.message || `All subscribers deleted successfully`,
        severity: 'success'
      })
      setDeleteAllDialogOpen(false)
      setDeleteAllConfirmText('')
      fetchSubscribers()
    } catch (error: any) {
      const msg = error?.response?.data?.message || 'Failed to delete all subscribers'

      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const columns = useMemo<ColumnDef<SubscriberWithAction, any>[]>(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: ({ row }) => (
          <div className='flex flex-col'>
            <Typography className='font-medium' color='text.primary'>
              {row.original.name || '-'}
            </Typography>
          </div>
        )
      }),
      columnHelper.accessor('email', {
        header: 'Email',
        cell: ({ row }) => <Typography>{row.original.email}</Typography>
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: ({ row }) => (
          <Chip
            label={row.original.status.charAt(0).toUpperCase() + row.original.status.slice(1)}
            color={statusColorMap[row.original.status]}
            size='small'
            variant='tonal'
          />
        )
      }),
      columnHelper.accessor('lists', {
        header: 'Lists',
        cell: ({ row }) => (
          <div className='flex gap-1 flex-wrap'>
            {row.original.lists && row.original.lists.length > 0 ? (
              row.original.lists.map(list => (
                <Chip key={list.id} label={list.name} size='small' variant='outlined' />
              ))
            ) : (
              <Typography variant='body2' color='text.secondary'>
                None
              </Typography>
            )}
          </div>
        )
      }),
      columnHelper.accessor('created_at', {
        header: 'Created',
        cell: ({ row }) => (
          <Typography variant='body2'>
            {new Date(row.original.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </Typography>
        )
      }),
      columnHelper.display({
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => (
          <div className='flex items-center gap-1'>
            <IconButton
              size='small'
              href={`/${locale}/subscribers/${row.original.id}`}
              title='View details'
            >
              <i className='tabler-eye text-[22px] text-textSecondary' />
            </IconButton>
            <IconButton
              size='small'
              title='Delete'
              onClick={() => {
                setSubscriberToDelete(row.original)
                setDeleteDialogOpen(true)
              }}
            >
              <i className='tabler-trash text-[22px] text-textSecondary' />
            </IconButton>
          </div>
        )
      })
    ],
    []
  )

  const table = useReactTable({
    data: subscribers,
    columns,
    filterFns: {
      fuzzy: () => true
    },
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualFiltering: true,
    pageCount: Math.ceil(totalCount / perPage)
  })

  return (
    <>
      <Card>
        <CardHeader
          title='Subscribers'
          subheader={!loading ? `${totalCount} total subscribers` : undefined}
          sx={{ flexWrap: 'wrap', rowGap: 2 }}
          action={
            <div className='flex gap-2 flex-wrap'>
              {totalCount > 0 && (
                <Button
                  variant='outlined'
                  color='error'
                  startIcon={<i className='tabler-trash' />}
                  onClick={() => setDeleteAllDialogOpen(true)}
                >
                  Delete All
                </Button>
              )}
              <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => setAddDialogOpen(true)}>
                Add Subscriber
              </Button>
            </div>
          }
        />
        <div className='flex items-center flex-wrap justify-between gap-4 p-6 pt-0'>
          <TextField
            size='small'
            placeholder='Search subscribers...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className='max-sm:is-full'
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='tabler-search' />
                </InputAdornment>
              )
            }}
          />
          <FormControl size='small' className='min-is-[150px] max-sm:is-full'>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label='Status'
              onChange={e => {
                setStatusFilter(e.target.value)
                setPage(0)
              }}
            >
              <MenuItem value='all'>All</MenuItem>
              <MenuItem value='enabled'>Enabled</MenuItem>
              <MenuItem value='disabled'>Disabled</MenuItem>
              <MenuItem value='blocklisted'>Blocklisted</MenuItem>
              {/* Uncomment below if using Listmonk v4+ which supports these statuses */}
              {/* <MenuItem value='unconfirmed'>Unconfirmed</MenuItem> */}
              {/* <MenuItem value='unsubscribed'>Unsubscribed</MenuItem> */}
            </Select>
          </FormControl>
        </div>
        <div className='overflow-x-auto'>
          <table className={tableStyles.table}>
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id}>
                      {header.isPlaceholder ? null : (
                        <div
                          className={classnames({
                            'flex items-center': header.column.getIsSorted(),
                            'cursor-pointer select-none': header.column.getCanSort()
                          })}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {{
                            asc: <i className='tabler-chevron-up text-xl' />,
                            desc: <i className='tabler-chevron-down text-xl' />
                          }[header.column.getIsSorted() as string] ?? null}
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            {loading ? (
              <tbody>
                <tr>
                  <td colSpan={table.getVisibleLeafColumns().length} className='text-center'>
                    <div className='flex justify-center items-center py-8'>
                      <CircularProgress size={32} />
                      <Typography className='ml-3' color='text.secondary'>
                        Loading subscribers...
                      </Typography>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : table.getRowModel().rows.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={table.getVisibleLeafColumns().length} className='text-center'>
                    <div className='py-8'>
                      <Typography color='text.secondary'>No subscribers found</Typography>
                    </div>
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className={classnames({ selected: row.getIsSelected() })}>
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
        <TablePagination
          component='div'
          count={totalCount}
          rowsPerPage={perPage}
          page={page}
          onPageChange={(_, newPage) => setPage(newPage)}
          onRowsPerPageChange={e => {
            setPerPage(Number(e.target.value))
            setPage(0)
          }}
        />
      </Card>

      {/* Add Subscriber Dialog */}
      <Dialog open={addDialogOpen} onClose={() => { setAddDialogOpen(false); setNewSubscriber({ name: '', email: '', status: 'enabled', lists: [] }) }} maxWidth='sm' fullWidth fullScreen={isMobile}>
        <DialogTitle>Add New Subscriber</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pt-2'>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Name'
                value={newSubscriber.name}
                onChange={e => setNewSubscriber({ ...newSubscriber, name: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Email'
                type='email'
                required
                value={newSubscriber.email}
                onChange={e => setNewSubscriber({ ...newSubscriber, email: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={newSubscriber.status}
                  label='Status'
                  onChange={e => setNewSubscriber({ ...newSubscriber, status: e.target.value as SubscriberStatus })}
                >
                  <MenuItem value='enabled'>Enabled</MenuItem>
                  <MenuItem value='disabled'>Disabled</MenuItem>
                  <MenuItem value='blocklisted'>Blocklisted</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Autocomplete
                multiple
                options={availableLists}
                getOptionLabel={option => option.name}
                value={availableLists.filter(l => newSubscriber.lists.includes(l.id))}
                onChange={(_, selected) => setNewSubscriber({ ...newSubscriber, lists: selected.map(l => l.id) })}
                disableCloseOnSelect
                renderOption={(props, option, { selected }) => (
                  <li {...props} key={option.id}>
                    <Checkbox checked={selected} className='mr-2' />
                    {option.name}
                  </li>
                )}
                renderInput={params => <TextField {...params} label='Lists' placeholder='Select lists...' />}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setAddDialogOpen(false); setNewSubscriber({ name: '', email: '', status: 'enabled', lists: [] }) }} color='secondary' disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleAddSubscriber} variant='contained' disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : 'Add Subscriber'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth='xs' fullWidth fullScreen={isMobile}>
        <DialogTitle>Delete Subscriber</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{subscriberToDelete?.name || subscriberToDelete?.email}</strong>?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color='secondary' disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteSubscriber} variant='contained' color='error' disabled={submitting}>
            {submitting ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete All Confirmation Dialog */}
      <Dialog open={deleteAllDialogOpen} onClose={() => { setDeleteAllDialogOpen(false); setDeleteAllConfirmText('') }} maxWidth='sm' fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ color: 'error.main' }}>
          <i className='tabler-alert-triangle mr-2' />
          Delete All Subscribers
        </DialogTitle>
        <DialogContent>
          <Alert severity='error' sx={{ mb: 3 }}>
            This will permanently delete all <strong>{totalCount}</strong> subscribers. This action cannot be undone!
          </Alert>
          <Typography sx={{ mb: 2 }}>
            To confirm, type <strong>DELETE ALL</strong> below:
          </Typography>
          <TextField
            fullWidth
            placeholder='Type DELETE ALL to confirm'
            value={deleteAllConfirmText}
            onChange={e => setDeleteAllConfirmText(e.target.value)}
            autoFocus
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setDeleteAllDialogOpen(false); setDeleteAllConfirmText('') }} color='secondary' disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteAll}
            variant='contained'
            color='error'
            disabled={submitting || deleteAllConfirmText !== 'DELETE ALL'}
          >
            {submitting ? <CircularProgress size={20} /> : `Delete All ${totalCount} Subscribers`}
          </Button>
        </DialogActions>
      </Dialog>

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

export default SubscriberListTable
