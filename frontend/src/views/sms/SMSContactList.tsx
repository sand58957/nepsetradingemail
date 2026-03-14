'use client'

// React Imports
import { useState, useEffect, useCallback } from 'react'

// Next Imports
import { useRouter, useParams } from 'next/navigation'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TablePagination from '@mui/material/TablePagination'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import InputAdornment from '@mui/material/InputAdornment'
import Grid from '@mui/material/Grid'
import Checkbox from '@mui/material/Checkbox'

// Service Imports
import smsService from '@/services/sms'

// Type Imports
import type { SMSContact, SMSContactGroup } from '@/types/sms'

const SMSContactList = () => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  // State
  const [contacts, setContacts] = useState<SMSContact[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [globalFilter, setGlobalFilter] = useState('')
  const [optedInFilter, setOptedInFilter] = useState<string>('')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [availableTags, setAvailableTags] = useState<{ tag: string; count: number }[]>([])

  // Selected contacts for bulk actions
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // Dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<SMSContact | null>(null)
  const [newContact, setNewContact] = useState({ phone: '', name: '', email: '' })
  const [addingContact, setAddingContact] = useState(false)
  const [availableGroups, setAvailableGroups] = useState<SMSContactGroup[]>([])
  const [selectedGroupIds, setSelectedGroupIds] = useState<number[]>([])
  const [savingEdit, setSavingEdit] = useState(false)

  // Bulk delete
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  // Action menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [menuContactId, setMenuContactId] = useState<number | null>(null)
  const [menuContact, setMenuContact] = useState<SMSContact | null>(null)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm)
      setPage(0)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch tags
  useEffect(() => {
    const fetchTags = async () => {
      try {
        const response = await smsService.getContactTags()

        setAvailableTags(response.data || [])
      } catch {
        // Silently fail
      }
    }

    fetchTags()
  }, [])

  // Fetch groups
  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const response = await smsService.getGroups()

        setAvailableGroups(response.data || [])
      } catch {
        // Silently fail
      }
    }

    fetchGroups()
  }, [])

  // Fetch contacts
  const fetchContacts = useCallback(async () => {
    setLoading(true)

    try {
      const response = await smsService.getContacts({
        page: page + 1,
        per_page: rowsPerPage,
        query: globalFilter || undefined,
        opted_in: optedInFilter || undefined,
        tag: tagFilter || undefined
      })

      setContacts(response.data?.results || [])
      setTotalCount(response.data?.total || 0)
    } catch {
      setSnackbar({ open: true, message: 'Failed to fetch contacts', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, globalFilter, optedInFilter, tagFilter])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  // Delete contact
  const handleDelete = async () => {
    if (!deletingId) return

    try {
      await smsService.deleteContact(deletingId)
      setSnackbar({ open: true, message: 'Contact deleted', severity: 'success' })
      setDeleteDialogOpen(false)
      setDeletingId(null)
      fetchContacts()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete contact', severity: 'error' })
    }
  }

  // Bulk delete
  const handleBulkDelete = async () => {
    setBulkDeleting(true)

    try {
      let deleted = 0

      for (const id of selectedIds) {
        try {
          await smsService.deleteContact(id)
          deleted++
        } catch {
          // Continue with others
        }
      }

      setSnackbar({ open: true, message: `${deleted} contacts deleted`, severity: 'success' })
      setBulkDeleteDialogOpen(false)
      setSelectedIds([])
      fetchContacts()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete contacts', severity: 'error' })
    } finally {
      setBulkDeleting(false)
    }
  }

  // Add contact
  const handleAddContact = async () => {
    if (!newContact.phone) {
      setSnackbar({ open: true, message: 'Phone number is required', severity: 'error' })

      return
    }

    setAddingContact(true)

    try {
      await smsService.createContact({ ...newContact, group_ids: selectedGroupIds.length > 0 ? selectedGroupIds : undefined })
      setSnackbar({ open: true, message: 'Contact added', severity: 'success' })
      setAddDialogOpen(false)
      setNewContact({ phone: '', name: '', email: '' })
      setSelectedGroupIds([])
      fetchContacts()
    } catch {
      setSnackbar({ open: true, message: 'Failed to add contact', severity: 'error' })
    } finally {
      setAddingContact(false)
    }
  }

  // Edit contact
  const handleEditContact = async () => {
    if (!editingContact) return

    setSavingEdit(true)

    try {
      await smsService.updateContact(editingContact.id, {
        phone: editingContact.phone,
        name: editingContact.name,
        email: editingContact.email
      })

      setSnackbar({ open: true, message: 'Contact updated', severity: 'success' })
      setEditDialogOpen(false)
      setEditingContact(null)
      fetchContacts()
    } catch {
      setSnackbar({ open: true, message: 'Failed to update contact', severity: 'error' })
    } finally {
      setSavingEdit(false)
    }
  }

  // Export contacts
  const handleExport = async () => {
    try {
      const blob = await smsService.exportContacts()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')

      a.href = url
      a.download = 'sms_contacts.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      setSnackbar({ open: true, message: 'Contacts exported', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to export contacts', severity: 'error' })
    }
  }

  // Select all visible
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(contacts.map(c => c.id))
    } else {
      setSelectedIds([])
    }
  }

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id])
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id))
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title={`${totalCount} contacts`}
          action={
            <div className='flex gap-2 flex-wrap'>
              {selectedIds.length > 0 && (
                <Button
                  variant='outlined'
                  color='error'
                  size='small'
                  startIcon={<i className='tabler-trash' />}
                  onClick={() => setBulkDeleteDialogOpen(true)}
                >
                  Delete ({selectedIds.length})
                </Button>
              )}
              <Button
                variant='contained'
                size='small'
                startIcon={<i className='tabler-plus' />}
                onClick={() => setAddDialogOpen(true)}
              >
                Add Contact
              </Button>
              <Button
                variant='outlined'
                size='small'
                startIcon={<i className='tabler-upload' />}
                onClick={() => router.push(`/${locale}/sms/contacts/import`)}
              >
                Import CSV
              </Button>
              <Button
                variant='outlined'
                size='small'
                startIcon={<i className='tabler-download' />}
                onClick={handleExport}
              >
                Export CSV
              </Button>
            </div>
          }
        />
        <CardContent>
          {/* Filters */}
          <Grid container spacing={4} className='mb-4'>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                fullWidth
                size='small'
                placeholder='Search by phone, name, or email...'
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position='start'>
                        <i className='tabler-search text-[18px]' />
                      </InputAdornment>
                    )
                  }
                }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Opt-in Status</InputLabel>
                <Select
                  value={optedInFilter}
                  label='Opt-in Status'
                  onChange={e => { setOptedInFilter(e.target.value); setPage(0) }}
                >
                  <MenuItem value=''>All</MenuItem>
                  <MenuItem value='true'>Opted In</MenuItem>
                  <MenuItem value='false'>Opted Out</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Tag</InputLabel>
                <Select
                  value={tagFilter}
                  label='Tag'
                  onChange={e => { setTagFilter(e.target.value); setPage(0) }}
                >
                  <MenuItem value=''>All Tags</MenuItem>
                  {availableTags.map(t => (
                    <MenuItem key={t.tag} value={t.tag}>
                      {t.tag} ({t.count})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>

        {/* Table */}
        {loading ? (
          <CardContent>
            <Box display='flex' justifyContent='center' p={4}>
              <CircularProgress />
            </Box>
          </CardContent>
        ) : contacts.length === 0 ? (
          <CardContent>
            <Typography color='text.secondary' align='center' className='py-8'>
              {globalFilter || optedInFilter || tagFilter ? 'No contacts match your search' : 'No contacts yet. Add or import contacts to get started.'}
            </Typography>
          </CardContent>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding='checkbox'>
                      <Checkbox
                        checked={selectedIds.length === contacts.length && contacts.length > 0}
                        indeterminate={selectedIds.length > 0 && selectedIds.length < contacts.length}
                        onChange={e => handleSelectAll(e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>Email</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Tags</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Added</TableCell>
                    <TableCell align='center'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {contacts.map(contact => (
                    <TableRow key={contact.id} hover selected={selectedIds.includes(contact.id)}>
                      <TableCell padding='checkbox'>
                        <Checkbox
                          checked={selectedIds.includes(contact.id)}
                          onChange={e => handleSelectOne(contact.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography className='font-medium'>{contact.phone}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography>{contact.name || '-'}</Typography>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                        <Typography variant='body2' color='text.secondary'>{contact.email || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={contact.opted_in ? 'Opted In' : 'Opted Out'}
                          color={contact.opted_in ? 'success' : 'default'}
                          size='small'
                          variant='tonal'
                        />
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        <div className='flex gap-1 flex-wrap'>
                          {contact.tags && contact.tags.length > 0
                            ? contact.tags.slice(0, 3).map((tag, i) => (
                              <Chip key={i} label={tag} size='small' variant='outlined' />
                            ))
                            : <Typography variant='body2' color='text.secondary'>-</Typography>
                          }
                          {contact.tags && contact.tags.length > 3 && (
                            <Chip label={`+${contact.tags.length - 3}`} size='small' variant='outlined' />
                          )}
                        </div>
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        <Typography variant='body2'>
                          {new Date(contact.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell align='center'>
                        <IconButton
                          size='small'
                          onClick={(e) => {
                            setAnchorEl(e.currentTarget)
                            setMenuContactId(contact.id)
                            setMenuContact(contact)
                          }}
                        >
                          <i className='tabler-dots-vertical' />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component='div'
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={e => {
                setRowsPerPage(parseInt(e.target.value, 10))
                setPage(0)
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          setAnchorEl(null)

          if (menuContact) {
            setEditingContact({ ...menuContact })
            setEditDialogOpen(true)
          }
        }}>
          <i className='tabler-edit text-[18px] mr-2' />
          Edit
        </MenuItem>
        <MenuItem onClick={() => {
          setAnchorEl(null)
          setDeletingId(menuContactId)
          setDeleteDialogOpen(true)
        }}>
          <i className='tabler-trash text-[18px] mr-2' />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Contact</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this contact? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant='contained' color='error' onClick={handleDelete}>Delete</Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onClose={() => setBulkDeleteDialogOpen(false)}>
        <DialogTitle>Delete {selectedIds.length} Contacts</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete {selectedIds.length} selected contacts? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            color='error'
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            startIcon={bulkDeleting ? <CircularProgress size={18} /> : undefined}
          >
            {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.length} Contacts`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Contact Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Add Contact</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 mt-2'>
            <TextField
              fullWidth
              label='Phone Number *'
              placeholder='e.g. 9779812345678'
              value={newContact.phone}
              onChange={e => setNewContact({ ...newContact, phone: e.target.value })}
              helperText='Enter phone number with country code (no + prefix)'
            />
            <TextField
              fullWidth
              label='Name'
              placeholder='Contact name'
              value={newContact.name}
              onChange={e => setNewContact({ ...newContact, name: e.target.value })}
            />
            <TextField
              fullWidth
              label='Email'
              placeholder='email@example.com'
              value={newContact.email}
              onChange={e => setNewContact({ ...newContact, email: e.target.value })}
            />
            {availableGroups.length > 0 && (
              <FormControl fullWidth size='small'>
                <InputLabel>Groups</InputLabel>
                <Select
                  multiple
                  value={selectedGroupIds}
                  label='Groups'
                  onChange={e => setSelectedGroupIds(e.target.value as number[])}
                  renderValue={(selected) => (
                    <div className='flex gap-1 flex-wrap'>
                      {(selected as number[]).map(id => {
                        const group = availableGroups.find(g => g.id === id)

                        return group ? <Chip key={id} label={group.name} size='small' /> : null
                      })}
                    </div>
                  )}
                >
                  {availableGroups.map(group => (
                    <MenuItem key={group.id} value={group.id}>
                      <Checkbox checked={selectedGroupIds.includes(group.id)} />
                      {group.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            onClick={handleAddContact}
            disabled={addingContact}
            startIcon={addingContact ? <CircularProgress size={18} /> : undefined}
          >
            {addingContact ? 'Adding...' : 'Add Contact'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Contact Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Edit Contact</DialogTitle>
        <DialogContent>
          {editingContact && (
            <div className='flex flex-col gap-4 mt-2'>
              <TextField
                fullWidth
                label='Phone Number *'
                value={editingContact.phone}
                onChange={e => setEditingContact({ ...editingContact, phone: e.target.value })}
              />
              <TextField
                fullWidth
                label='Name'
                value={editingContact.name || ''}
                onChange={e => setEditingContact({ ...editingContact, name: e.target.value })}
              />
              <TextField
                fullWidth
                label='Email'
                value={editingContact.email || ''}
                onChange={e => setEditingContact({ ...editingContact, email: e.target.value })}
              />
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            onClick={handleEditContact}
            disabled={savingEdit}
            startIcon={savingEdit ? <CircularProgress size={18} /> : undefined}
          >
            {savingEdit ? 'Saving...' : 'Save Changes'}
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

export default SMSContactList
