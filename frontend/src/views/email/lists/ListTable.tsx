'use client'

// React Imports
import { useState, useEffect, useMemo, useCallback } from 'react'

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
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Grid from '@mui/material/Grid'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Tooltip from '@mui/material/Tooltip'
import CircularProgress from '@mui/material/CircularProgress'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'

// Third-party Imports
import classnames from 'classnames'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table'
import type { ColumnDef } from '@tanstack/react-table'

// Type Imports
import type { List } from '@/types/email'

// Styles Imports
import tableStyles from '@core/styles/table.module.css'

// Hook Imports
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'

// Service Imports
import listService from '@/services/lists'

type ListWithAction = List & { action?: string }

const columnHelper = createColumnHelper<ListWithAction>()

const ListTable = () => {
  const [lists, setLists] = useState<ListWithAction[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [globalFilter, setGlobalFilter] = useState('')

  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editingList, setEditingList] = useState<List | null>(null)
  const [deletingList, setDeletingList] = useState<List | null>(null)
  const [saving, setSaving] = useState(false)

  const [newList, setNewList] = useState({
    name: '',
    type: 'public' as 'public' | 'private',
    optin: 'double' as 'single' | 'double',
    description: ''
  })

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const isMobile = useMobileBreakpoint()
  const { lang: locale } = useParams()

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true)

      const response = await listService.getAll({
        page: page + 1,
        per_page: rowsPerPage
      })

      setLists(response.data?.results || [])
      setTotalCount(response.data?.total || 0)
    } catch (err) {
      console.error('Failed to fetch lists:', err)
      setSnackbar({ open: true, message: 'Failed to load lists', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage])

  useEffect(() => {
    fetchLists()
  }, [fetchLists])

  const handleCreate = async () => {
    if (!newList.name.trim()) return

    try {
      setSaving(true)

      await listService.create({
        name: newList.name.trim(),
        type: newList.type,
        optin: newList.optin,
        description: newList.description
      })

      setAddDialogOpen(false)
      setNewList({ name: '', type: 'public', optin: 'double', description: '' })
      setSnackbar({ open: true, message: 'List created successfully', severity: 'success' })
      fetchLists()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to create list',
        severity: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEditOpen = (list: List) => {
    setEditingList(list)
    setNewList({
      name: list.name,
      type: list.type as 'public' | 'private',
      optin: list.optin,
      description: list.description || ''
    })
    setEditDialogOpen(true)
  }

  const handleEditSave = async () => {
    if (!editingList || !newList.name.trim()) return

    try {
      setSaving(true)

      await listService.update(editingList.id, {
        name: newList.name.trim(),
        type: newList.type,
        optin: newList.optin,
        description: newList.description
      })

      setEditDialogOpen(false)
      setEditingList(null)
      setSnackbar({ open: true, message: 'List updated successfully', severity: 'success' })
      fetchLists()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to update list',
        severity: 'error'
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingList) return

    try {
      await listService.delete(deletingList.id)
      setDeleteDialogOpen(false)
      setDeletingList(null)
      setSnackbar({ open: true, message: 'List deleted', severity: 'success' })
      fetchLists()
    } catch (err: any) {
      setSnackbar({
        open: true,
        message: err.response?.data?.message || 'Failed to delete list',
        severity: 'error'
      })
    }
  }

  // Client-side search filter on fetched data
  const filteredLists = useMemo(() => {
    if (!globalFilter.trim()) return lists

    const q = globalFilter.toLowerCase()

    return lists.filter(l =>
      l.name.toLowerCase().includes(q) || (l.description || '').toLowerCase().includes(q)
    )
  }, [lists, globalFilter])

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
            {(row.original.subscriber_count || 0).toLocaleString()}
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
              <IconButton size='small' onClick={() => handleEditOpen(row.original)}>
                <i className='tabler-pencil text-[22px] text-textSecondary' />
              </IconButton>
            </Tooltip>
            <Tooltip title='Delete'>
              <IconButton
                size='small'
                onClick={() => {
                  setDeletingList(row.original)
                  setDeleteDialogOpen(true)
                }}
              >
                <i className='tabler-trash text-[22px] text-textSecondary' />
              </IconButton>
            </Tooltip>
          </div>
        )
      })
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const table = useReactTable({
    data: filteredLists,
    columns,
    filterFns: {
      fuzzy: () => true
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  })

  return (
    <>
      <Card>
        <CardHeader
          title='Subscriber Lists'
          sx={{ flexWrap: 'wrap', rowGap: 2 }}
          action={
            <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => {
              setNewList({ name: '', type: 'public', optin: 'double', description: '' })
              setAddDialogOpen(true)
            }}>
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

        {loading && lists.length === 0 ? (
          <div className='flex justify-center items-center py-16'>
            <CircularProgress size={32} />
            <Typography className='ml-3' color='text.secondary'>Loading lists...</Typography>
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
                {filteredLists.length === 0 ? (
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

      {/* Create List Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth='sm' fullWidth fullScreen={isMobile}>
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
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
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
          <Button onClick={handleCreate} variant='contained' disabled={!newList.name.trim() || saving}>
            {saving ? 'Creating...' : 'Create List'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit List Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth='sm' fullWidth fullScreen={isMobile}>
        <DialogTitle>Edit List</DialogTitle>
        <DialogContent>
          <Grid container spacing={4} className='pt-2'>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='List Name'
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
                value={newList.description}
                onChange={e => setNewList({ ...newList, description: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)} color='secondary'>
            Cancel
          </Button>
          <Button onClick={handleEditSave} variant='contained' disabled={!newList.name.trim() || saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete List</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deletingList?.name}</strong>? All subscribers in this list will be
            unlinked. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDelete} color='error' variant='contained'>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity} variant='filled'>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default ListTable
