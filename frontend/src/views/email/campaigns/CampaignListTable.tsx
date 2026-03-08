'use client'

// React Imports
import { useState, useEffect, useMemo, useCallback } from 'react'

// Next Imports
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'

// Third-party Imports
import classnames from 'classnames'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import type { ColumnDef, FilterFn } from '@tanstack/react-table'
import { rankItem } from '@tanstack/match-sorter-utils'

// Type Imports
import type { Campaign, CampaignStatus } from '@/types/email'

// Service Imports
import campaignService from '@/services/campaigns'

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

const CampaignListTable = () => {
  const router = useRouter()

  // Data state
  const [campaigns, setCampaigns] = useState<CampaignWithAction[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)

  // Filter/pagination state
  const [globalFilter, setGlobalFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)

  // UI state
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null)
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  // Debounced search
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm)
      setPage(0)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch campaigns from API
  const fetchCampaigns = useCallback(async () => {
    setLoading(true)

    try {
      let query = ''

      if (statusFilter !== 'all') {
        query = `campaigns.status = '${statusFilter}'`
      }

      if (globalFilter) {
        const searchQuery = `campaigns.name ILIKE '%${globalFilter}%' OR campaigns.subject ILIKE '%${globalFilter}%'`

        query = query ? `(${query}) AND (${searchQuery})` : searchQuery
      }

      const response = await campaignService.getAll({
        page: page + 1,
        per_page: rowsPerPage,
        query: query || undefined,
        order_by: 'created_at',
        order: 'desc'
      })

      setCampaigns(response.data?.results || [])
      setTotalCount(response.data?.total || 0)
    } catch {
      console.error('Failed to fetch campaigns')
      setSnackbar({ open: true, message: 'Failed to fetch campaigns', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, statusFilter, globalFilter])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  // Delete campaign
  const handleDelete = async () => {
    if (!deletingId) return

    try {
      await campaignService.delete(deletingId)
      setSnackbar({ open: true, message: 'Campaign deleted successfully', severity: 'success' })
      setDeleteDialogOpen(false)
      setDeletingId(null)
      fetchCampaigns()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete campaign', severity: 'error' })
    }
  }

  // Duplicate campaign
  const handleDuplicate = async (id: number) => {
    try {
      const response = await campaignService.getById(id)
      const original = response.data

      await campaignService.create({
        name: `${original.name} (Copy)`,
        subject: original.subject,
        from_email: original.from_email,
        type: original.type,
        content_type: original.content_type,
        body: original.body,
        altbody: original.altbody,
        lists: original.lists?.map((l: any) => l.id) || [],
        tags: original.tags
      })

      setSnackbar({ open: true, message: 'Campaign duplicated successfully', severity: 'success' })
      fetchCampaigns()
    } catch {
      setSnackbar({ open: true, message: 'Failed to duplicate campaign', severity: 'error' })
    }
  }

  const columns = useMemo<ColumnDef<CampaignWithAction, any>[]>(
    () => [
      columnHelper.accessor('name', {
        header: 'Campaign',
        cell: ({ row }) => (
          <div className='flex flex-col'>
            <Typography
              className='font-medium cursor-pointer hover:underline'
              color='text.primary'
              onClick={() => router.push(`/campaigns/${row.original.id}`)}
            >
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
              <IconButton size='small' onClick={() => router.push(`/campaigns/${row.original.id}`)}>
                <i className='tabler-pencil text-[22px] text-textSecondary' />
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
    [router]
  )

  const table = useReactTable({
    data: campaigns,
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
    manualPagination: true,
    pageCount: Math.ceil(totalCount / rowsPerPage)
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
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
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
            <Select
              value={statusFilter}
              label='Status'
              onChange={e => {
                setStatusFilter(e.target.value)
                setPage(0)
              }}
            >
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

        {loading ? (
          <div className='flex justify-center items-center py-16'>
            <CircularProgress size={32} />
            <Typography className='ml-3' color='text.secondary'>Loading campaigns...</Typography>
          </div>
        ) : (
          <>
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
                {campaigns.length === 0 ? (
                  <tbody>
                    <tr>
                      <td colSpan={table.getVisibleLeafColumns().length} className='text-center'>
                        <Typography color='text.secondary' className='py-8'>
                          No campaigns found. Create your first campaign to get started.
                        </Typography>
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
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={e => {
                setRowsPerPage(Number(e.target.value))
                setPage(0)
              }}
            />
          </>
        )}
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={actionMenuAnchor}
        open={Boolean(actionMenuAnchor)}
        onClose={() => setActionMenuAnchor(null)}
      >
        <MenuItem onClick={() => {
          if (selectedCampaignId) handleDuplicate(selectedCampaignId)
          setActionMenuAnchor(null)
        }}>
          <i className='tabler-copy text-[18px] mie-2' /> Duplicate
        </MenuItem>
        <MenuItem onClick={() => {
          setActionMenuAnchor(null)

          if (selectedCampaignId) {
            setDeletingId(selectedCampaignId)
            setDeleteDialogOpen(true)
          }
        }} className='text-error'>
          <i className='tabler-trash text-[18px] mie-2' /> Delete
        </MenuItem>
      </Menu>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Campaign</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this campaign? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} color='secondary'>Cancel</Button>
          <Button onClick={handleDelete} color='error' variant='contained'>Delete</Button>
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

export default CampaignListTable
