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
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'

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
import type { List } from '@/types/email'

// Styles Imports
import tableStyles from '@core/styles/table.module.css'

type ListWithAction = List & { action?: string }

const fuzzyFilter: FilterFn<ListWithAction> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)

  addMeta({ itemRank })

  return itemRank.passed
}

const columnHelper = createColumnHelper<ListWithAction>()

// Mock data
const mockLists: ListWithAction[] = [
  {
    id: 1, uuid: 'l1', name: 'Newsletter', type: 'public', optin: 'double', tags: ['general'],
    description: 'Main newsletter list for all subscribers', subscriber_count: 5420,
    created_at: '2025-06-15T10:00:00Z', updated_at: '2026-03-01T12:00:00Z'
  },
  {
    id: 2, uuid: 'l2', name: 'Product Updates', type: 'public', optin: 'single', tags: ['product'],
    description: 'Updates about new product features and releases', subscriber_count: 3200,
    created_at: '2025-08-20T14:00:00Z', updated_at: '2026-02-28T09:00:00Z'
  },
  {
    id: 3, uuid: 'l3', name: 'Beta Users', type: 'private', optin: 'double', tags: ['beta', 'internal'],
    description: 'Early access users for beta testing', subscriber_count: 890,
    created_at: '2025-10-10T08:00:00Z', updated_at: '2026-03-05T11:00:00Z'
  },
  {
    id: 4, uuid: 'l4', name: 'Customers', type: 'public', optin: 'single', tags: ['customers'],
    description: 'All paying customers', subscriber_count: 12500,
    created_at: '2025-05-01T09:00:00Z', updated_at: '2026-03-07T16:00:00Z'
  },
  {
    id: 5, uuid: 'l5', name: 'Leads', type: 'private', optin: 'double', tags: ['marketing'],
    description: 'Marketing qualified leads', subscriber_count: 7800,
    created_at: '2025-09-12T11:00:00Z', updated_at: '2026-03-06T14:00:00Z'
  },
  {
    id: 6, uuid: 'l6', name: 'Events', type: 'public', optin: 'single', tags: ['events'],
    description: 'Event announcements and updates', subscriber_count: 2100,
    created_at: '2025-11-05T13:00:00Z', updated_at: '2026-02-25T10:00:00Z'
  }
]

const ListTable = () => {
  const [globalFilter, setGlobalFilter] = useState('')
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newList, setNewList] = useState({
    name: '',
    type: 'public' as 'public' | 'private',
    optin: 'double' as 'single' | 'double',
    description: ''
  })

  const columns = useMemo<ColumnDef<ListWithAction, any>[]>(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: ({ row }) => (
          <div className='flex flex-col'>
            <Typography className='font-medium' color='text.primary'>
              {row.original.name}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {row.original.description}
            </Typography>
          </div>
        )
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        cell: ({ row }) => (
          <Chip
            label={row.original.type.charAt(0).toUpperCase() + row.original.type.slice(1)}
            color={row.original.type === 'public' ? 'primary' : 'secondary'}
            size='small'
            variant='tonal'
          />
        )
      }),
      columnHelper.accessor('optin', {
        header: 'Opt-in',
        cell: ({ row }) => (
          <Chip
            label={row.original.optin === 'double' ? 'Double' : 'Single'}
            color={row.original.optin === 'double' ? 'info' : 'default'}
            size='small'
            variant='outlined'
          />
        )
      }),
      columnHelper.accessor('subscriber_count', {
        header: 'Subscribers',
        cell: ({ row }) => (
          <Typography className='font-medium'>
            {row.original.subscriber_count.toLocaleString()}
          </Typography>
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
            <Tooltip title='Edit'>
              <IconButton size='small'>
                <i className='tabler-pencil text-[22px] text-textSecondary' />
              </IconButton>
            </Tooltip>
            <Tooltip title='Delete'>
              <IconButton size='small'>
                <i className='tabler-trash text-[22px] text-textSecondary' />
              </IconButton>
            </Tooltip>
          </div>
        )
      })
    ],
    []
  )

  const table = useReactTable({
    data: mockLists,
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

  return (
    <>
      <Card>
        <CardHeader
          title='Subscriber Lists'
          action={
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => setAddDialogOpen(true)}>
              Create List
            </Button>
          }
        />
        <div className='flex items-center gap-4 p-6 pt-0'>
          <TextField
            size='small'
            placeholder='Search lists...'
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
                    No lists found
                  </td>
                </tr>
              </tbody>
            ) : (
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id}>
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

      {/* Create List Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Create New List</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pt-2'>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='List Name'
                placeholder='e.g. Newsletter'
                value={newList.name}
                onChange={e => setNewList({ ...newList, name: e.target.value })}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Type</InputLabel>
                <Select
                  value={newList.type}
                  label='Type'
                  onChange={e => setNewList({ ...newList, type: e.target.value as 'public' | 'private' })}
                >
                  <MenuItem value='public'>Public</MenuItem>
                  <MenuItem value='private'>Private</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Opt-in</InputLabel>
                <Select
                  value={newList.optin}
                  label='Opt-in'
                  onChange={e => setNewList({ ...newList, optin: e.target.value as 'single' | 'double' })}
                >
                  <MenuItem value='single'>Single</MenuItem>
                  <MenuItem value='double'>Double</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label='Description'
                placeholder='Describe this list...'
                value={newList.description}
                onChange={e => setNewList({ ...newList, description: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)} color='secondary'>
            Cancel
          </Button>
          <Button onClick={() => setAddDialogOpen(false)} variant='contained'>
            Create List
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default ListTable
