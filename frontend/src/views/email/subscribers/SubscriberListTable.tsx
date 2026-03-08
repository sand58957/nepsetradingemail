'use client'

// React Imports
import { useState, useMemo } from 'react'

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

// Third-party Imports
import classnames from 'classnames'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'

// Type Imports
import type { Subscriber, SubscriberStatus } from '@/types/email'

// Styles Imports
import tableStyles from '@core/styles/table.module.css'

type SubscriberWithAction = Subscriber & {
  action?: string
}

// Fuzzy filter
const fuzzyFilter: FilterFn<SubscriberWithAction> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)

  addMeta({ itemRank })

  return itemRank.passed
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

// Mock data
const mockSubscribers: SubscriberWithAction[] = [
  {
    id: 1,
    uuid: 'a1b2c3',
    email: 'john.doe@example.com',
    name: 'John Doe',
    status: 'enabled',
    lists: [
      { id: 1, uuid: 'l1', name: 'Newsletter', type: 'public', optin: 'double', tags: [], description: '', subscriber_count: 500, created_at: '', updated_at: '' }
    ],
    attribs: {},
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z'
  },
  {
    id: 2,
    uuid: 'd4e5f6',
    email: 'jane.smith@example.com',
    name: 'Jane Smith',
    status: 'enabled',
    lists: [
      { id: 1, uuid: 'l1', name: 'Newsletter', type: 'public', optin: 'double', tags: [], description: '', subscriber_count: 500, created_at: '', updated_at: '' },
      { id: 2, uuid: 'l2', name: 'Product Updates', type: 'public', optin: 'single', tags: [], description: '', subscriber_count: 300, created_at: '', updated_at: '' }
    ],
    attribs: {},
    created_at: '2026-01-20T14:00:00Z',
    updated_at: '2026-02-01T09:00:00Z'
  },
  {
    id: 3,
    uuid: 'g7h8i9',
    email: 'bob.wilson@example.com',
    name: 'Bob Wilson',
    status: 'unsubscribed',
    lists: [],
    attribs: {},
    created_at: '2025-12-10T08:00:00Z',
    updated_at: '2026-02-15T11:00:00Z'
  },
  {
    id: 4,
    uuid: 'j1k2l3',
    email: 'alice.johnson@example.com',
    name: 'Alice Johnson',
    status: 'enabled',
    lists: [
      { id: 2, uuid: 'l2', name: 'Product Updates', type: 'public', optin: 'single', tags: [], description: '', subscriber_count: 300, created_at: '', updated_at: '' }
    ],
    attribs: {},
    created_at: '2026-02-05T16:00:00Z',
    updated_at: '2026-02-05T16:00:00Z'
  },
  {
    id: 5,
    uuid: 'm4n5o6',
    email: 'charlie.brown@example.com',
    name: 'Charlie Brown',
    status: 'blocklisted',
    lists: [],
    attribs: {},
    created_at: '2025-11-20T12:00:00Z',
    updated_at: '2026-01-10T09:00:00Z'
  },
  {
    id: 6,
    uuid: 'p7q8r9',
    email: 'diana.prince@example.com',
    name: 'Diana Prince',
    status: 'unconfirmed',
    lists: [
      { id: 1, uuid: 'l1', name: 'Newsletter', type: 'public', optin: 'double', tags: [], description: '', subscriber_count: 500, created_at: '', updated_at: '' }
    ],
    attribs: {},
    created_at: '2026-03-01T07:00:00Z',
    updated_at: '2026-03-01T07:00:00Z'
  },
  {
    id: 7,
    uuid: 's1t2u3',
    email: 'edward.stark@example.com',
    name: 'Edward Stark',
    status: 'enabled',
    lists: [
      { id: 1, uuid: 'l1', name: 'Newsletter', type: 'public', optin: 'double', tags: [], description: '', subscriber_count: 500, created_at: '', updated_at: '' },
      { id: 2, uuid: 'l2', name: 'Product Updates', type: 'public', optin: 'single', tags: [], description: '', subscriber_count: 300, created_at: '', updated_at: '' }
    ],
    attribs: {},
    created_at: '2026-02-18T13:00:00Z',
    updated_at: '2026-02-18T13:00:00Z'
  },
  {
    id: 8,
    uuid: 'v4w5x6',
    email: 'fiona.green@example.com',
    name: 'Fiona Green',
    status: 'enabled',
    lists: [
      { id: 1, uuid: 'l1', name: 'Newsletter', type: 'public', optin: 'double', tags: [], description: '', subscriber_count: 500, created_at: '', updated_at: '' }
    ],
    attribs: {},
    created_at: '2026-02-25T10:00:00Z',
    updated_at: '2026-02-25T10:00:00Z'
  }
]

const SubscriberListTable = () => {
  // States
  const [globalFilter, setGlobalFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newSubscriber, setNewSubscriber] = useState({ name: '', email: '', status: 'enabled' as SubscriberStatus })

  // Filter data based on status
  const filteredData = useMemo(() => {
    if (statusFilter === 'all') return mockSubscribers

    return mockSubscribers.filter(sub => sub.status === statusFilter)
  }, [statusFilter])

  const columns = useMemo<ColumnDef<SubscriberWithAction, any>[]>(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: ({ row }) => (
          <div className='flex flex-col'>
            <Typography className='font-medium' color='text.primary'>
              {row.original.name}
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
            {row.original.lists.length > 0 ? (
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
            <IconButton size='small'>
              <i className='tabler-eye text-[22px] text-textSecondary' />
            </IconButton>
            <IconButton size='small'>
              <i className='tabler-pencil text-[22px] text-textSecondary' />
            </IconButton>
            <IconButton size='small'>
              <i className='tabler-trash text-[22px] text-textSecondary' />
            </IconButton>
          </div>
        )
      })
    ],
    []
  )

  const table = useReactTable({
    data: filteredData,
    columns,
    filterFns: {
      fuzzy: fuzzyFilter
    },
    state: {
      globalFilter
    },
    globalFilterFn: fuzzyFilter,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 10
      }
    }
  })

  const handleAddSubscriber = () => {
    // In a real app, this would call the API
    setAddDialogOpen(false)
    setNewSubscriber({ name: '', email: '', status: 'enabled' })
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Subscribers'
          action={
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => setAddDialogOpen(true)}>
              Add Subscriber
            </Button>
          }
        />
        <div className='flex items-center justify-between gap-4 p-6 pt-0'>
          <TextField
            size='small'
            placeholder='Search subscribers...'
            value={globalFilter ?? ''}
            onChange={e => setGlobalFilter(e.target.value)}
            className='max-sm:is-full'
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='tabler-search' />
                </InputAdornment>
              )
            }}
          />
          <FormControl size='small' className='min-is-[150px]'>
            <InputLabel>Status</InputLabel>
            <Select value={statusFilter} label='Status' onChange={e => setStatusFilter(e.target.value)}>
              <MenuItem value='all'>All</MenuItem>
              <MenuItem value='enabled'>Enabled</MenuItem>
              <MenuItem value='disabled'>Disabled</MenuItem>
              <MenuItem value='blocklisted'>Blocklisted</MenuItem>
              <MenuItem value='unconfirmed'>Unconfirmed</MenuItem>
              <MenuItem value='unsubscribed'>Unsubscribed</MenuItem>
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
            {table.getFilteredRowModel().rows.length === 0 ? (
              <tbody>
                <tr>
                  <td colSpan={table.getVisibleLeafColumns().length} className='text-center'>
                    No subscribers found
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
          count={table.getFilteredRowModel().rows.length}
          rowsPerPage={table.getState().pagination.pageSize}
          page={table.getState().pagination.pageIndex}
          onPageChange={(_, page) => table.setPageIndex(page)}
          onRowsPerPageChange={e => table.setPageSize(Number(e.target.value))}
        />
      </Card>

      {/* Add Subscriber Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth='sm' fullWidth>
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
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} color='secondary'>
            Cancel
          </Button>
          <Button onClick={handleAddSubscriber} variant='contained'>
            Add Subscriber
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default SubscriberListTable
