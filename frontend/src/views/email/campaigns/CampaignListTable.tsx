'use client'

// React Imports
import { useState, useMemo } from 'react'

// Next Imports
import Link from 'next/link'

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
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Tooltip from '@mui/material/Tooltip'
import LinearProgress from '@mui/material/LinearProgress'

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
import type { Campaign, CampaignStatus } from '@/types/email'

// Styles Imports
import tableStyles from '@core/styles/table.module.css'

type CampaignWithAction = Campaign & {
  action?: string
}

const fuzzyFilter: FilterFn<CampaignWithAction> = (row, columnId, value, addMeta) => {
  const itemRank = rankItem(row.getValue(columnId), value)

  addMeta({ itemRank })

  return itemRank.passed
}

const statusColorMap: Record<CampaignStatus, 'default' | 'success' | 'primary' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  running: 'success',
  scheduled: 'info',
  paused: 'warning',
  cancelled: 'error',
  finished: 'primary'
}

const columnHelper = createColumnHelper<CampaignWithAction>()

// Mock data
const mockCampaigns: CampaignWithAction[] = [
  {
    id: 1, uuid: '1', name: 'March Newsletter', subject: 'Monthly Update', from_email: 'news@company.com',
    status: 'finished', type: 'regular', tags: ['newsletter'], content_type: 'richtext', body: '', altbody: '',
    send_at: null, started_at: '2026-03-01T10:00:00Z', to_send: 5420, sent: 5420, lists: [],
    views: 2340, clicks: 567, bounces: 23, created_at: '2026-02-28T09:00:00Z', updated_at: '2026-03-01T12:00:00Z'
  },
  {
    id: 2, uuid: '2', name: 'Product Launch', subject: 'New Product Alert', from_email: 'hello@company.com',
    status: 'running', type: 'regular', tags: ['product'], content_type: 'richtext', body: '', altbody: '',
    send_at: null, started_at: '2026-03-08T08:00:00Z', to_send: 8350, sent: 4200, lists: [],
    views: 1890, clicks: 342, bounces: 12, created_at: '2026-03-07T14:00:00Z', updated_at: '2026-03-08T08:30:00Z'
  },
  {
    id: 3, uuid: '3', name: 'Weekly Tips', subject: 'Top 5 Tips', from_email: 'tips@company.com',
    status: 'draft', type: 'regular', tags: ['tips'], content_type: 'richtext', body: '', altbody: '',
    send_at: null, started_at: null, to_send: 0, sent: 0, lists: [],
    views: 0, clicks: 0, bounces: 0, created_at: '2026-03-06T11:00:00Z', updated_at: '2026-03-06T11:00:00Z'
  },
  {
    id: 4, uuid: '4', name: 'Flash Sale', subject: '50% Off Today Only!', from_email: 'deals@company.com',
    status: 'scheduled', type: 'regular', tags: ['promo'], content_type: 'richtext', body: '', altbody: '',
    send_at: '2026-03-15T09:00:00Z', started_at: null, to_send: 12000, sent: 0, lists: [],
    views: 0, clicks: 0, bounces: 0, created_at: '2026-03-05T16:00:00Z', updated_at: '2026-03-05T16:30:00Z'
  },
  {
    id: 5, uuid: '5', name: 'Welcome Series', subject: 'Welcome!', from_email: 'welcome@company.com',
    status: 'finished', type: 'regular', tags: ['onboarding'], content_type: 'richtext', body: '', altbody: '',
    send_at: null, started_at: '2026-02-20T07:00:00Z', to_send: 1230, sent: 1230, lists: [],
    views: 984, clicks: 246, bounces: 5, created_at: '2026-02-19T15:00:00Z', updated_at: '2026-02-20T09:00:00Z'
  },
  {
    id: 6, uuid: '6', name: 'Feature Update', subject: 'New Features This Month', from_email: 'product@company.com',
    status: 'paused', type: 'regular', tags: ['product'], content_type: 'richtext', body: '', altbody: '',
    send_at: null, started_at: '2026-03-03T10:00:00Z', to_send: 6800, sent: 3400, lists: [],
    views: 1200, clicks: 180, bounces: 15, created_at: '2026-03-02T09:00:00Z', updated_at: '2026-03-03T11:00:00Z'
  }
]

const CampaignListTable = () => {
  const [globalFilter, setGlobalFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null)

  const filteredData = useMemo(() => {
    if (statusFilter === 'all') return mockCampaigns

    return mockCampaigns.filter(c => c.status === statusFilter)
  }, [statusFilter])

  const columns = useMemo<ColumnDef<CampaignWithAction, any>[]>(
    () => [
      columnHelper.accessor('name', {
        header: 'Campaign',
        cell: ({ row }) => (
          <div className='flex flex-col'>
            <Typography className='font-medium' color='text.primary'>
              {row.original.name}
            </Typography>
            <Typography variant='body2' color='text.secondary'>
              {row.original.subject}
            </Typography>
          </div>
        )
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
      columnHelper.accessor('sent', {
        header: 'Sent',
        cell: ({ row }) => (
          <div>
            <Typography>
              {row.original.sent > 0 ? row.original.sent.toLocaleString() : '-'}
            </Typography>
            {row.original.status === 'running' && row.original.to_send > 0 && (
              <div className='flex items-center gap-2 mt-1'>
                <LinearProgress
                  variant='determinate'
                  value={(row.original.sent / row.original.to_send) * 100}
                  className='grow'
                  color='success'
                />
                <Typography variant='caption'>
                  {Math.round((row.original.sent / row.original.to_send) * 100)}%
                </Typography>
              </div>
            )}
          </div>
        )
      }),
      columnHelper.accessor('views', {
        header: 'Opens',
        cell: ({ row }) => {
          const openRate = row.original.sent > 0 ? ((row.original.views / row.original.sent) * 100).toFixed(1) : '0'

          return (
            <div className='flex flex-col'>
              <Typography>{row.original.views > 0 ? row.original.views.toLocaleString() : '-'}</Typography>
              {row.original.sent > 0 && (
                <Typography variant='caption' color='text.secondary'>
                  {openRate}%
                </Typography>
              )}
            </div>
          )
        }
      }),
      columnHelper.accessor('clicks', {
        header: 'Clicks',
        cell: ({ row }) => {
          const clickRate = row.original.sent > 0 ? ((row.original.clicks / row.original.sent) * 100).toFixed(1) : '0'

          return (
            <div className='flex flex-col'>
              <Typography>{row.original.clicks > 0 ? row.original.clicks.toLocaleString() : '-'}</Typography>
              {row.original.sent > 0 && (
                <Typography variant='caption' color='text.secondary'>
                  {clickRate}%
                </Typography>
              )}
            </div>
          )
        }
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
            <Tooltip title='Preview'>
              <IconButton size='small'>
                <i className='tabler-eye text-[22px] text-textSecondary' />
              </IconButton>
            </Tooltip>
            <Tooltip title='More'>
              <IconButton
                size='small'
                onClick={e => {
                  setActionMenuAnchor(e.currentTarget)
                  setSelectedCampaignId(row.original.id)
                }}
              >
                <i className='tabler-dots-vertical text-[22px] text-textSecondary' />
              </IconButton>
            </Tooltip>
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

  return (
    <>
      <Card>
        <CardHeader
          title='Campaigns'
          action={
            <Button
              variant='contained'
              startIcon={<i className='tabler-plus' />}
              component={Link}
              href='/campaigns/create'
            >
              Create Campaign
            </Button>
          }
        />
        <div className='flex items-center justify-between gap-4 p-6 pt-0'>
          <TextField
            size='small'
            placeholder='Search campaigns...'
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
              <MenuItem value='draft'>Draft</MenuItem>
              <MenuItem value='running'>Running</MenuItem>
              <MenuItem value='scheduled'>Scheduled</MenuItem>
              <MenuItem value='paused'>Paused</MenuItem>
              <MenuItem value='finished'>Finished</MenuItem>
              <MenuItem value='cancelled'>Cancelled</MenuItem>
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
                    No campaigns found
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

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={() => setActionMenuAnchor(null)}
      >
        <MenuItem onClick={() => setActionMenuAnchor(null)}>
          <i className='tabler-copy text-[18px] mie-2' /> Duplicate
        </MenuItem>
        <MenuItem onClick={() => setActionMenuAnchor(null)}>
          <i className='tabler-send text-[18px] mie-2' /> Send Test
        </MenuItem>
        <MenuItem onClick={() => setActionMenuAnchor(null)} className='text-error'>
          <i className='tabler-trash text-[18px] mie-2' /> Delete
        </MenuItem>
      </Menu>
    </>
  )
}

export default CampaignListTable
