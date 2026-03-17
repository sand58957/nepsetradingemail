'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'

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
import Checkbox from '@mui/material/Checkbox'
import InputAdornment from '@mui/material/InputAdornment'
import Grid from '@mui/material/Grid'

import messengerService from '@/services/messenger'
import type { MessengerContactGroup, MessengerContact } from '@/types/messenger'

export interface MessengerGroupDetailProps {
  id: string
}

const MessengerGroupDetail = ({ id }: MessengerGroupDetailProps) => {
  const groupId = Number(id)
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  // Group info
  const [group, setGroup] = useState<MessengerContactGroup | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [loadingGroup, setLoadingGroup] = useState(true)

  // Members list
  const [members, setMembers] = useState<MessengerContact[]>([])
  const [totalMembers, setTotalMembers] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [loadingMembers, setLoadingMembers] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // Selected for removal
  const [selectedIds, setSelectedIds] = useState<number[]>([])

  // Add members dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [allContacts, setAllContacts] = useState<MessengerContact[]>([])
  const [allContactsTotal, setAllContactsTotal] = useState(0)
  const [addPage, setAddPage] = useState(0)
  const [addSearch, setAddSearch] = useState('')
  const [addDebouncedSearch, setAddDebouncedSearch] = useState('')
  const [loadingAllContacts, setLoadingAllContacts] = useState(false)
  const [addSelectedIds, setAddSelectedIds] = useState<number[]>([])
  const [addingMembers, setAddingMembers] = useState(false)

  // Remove dialog
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => { setDebouncedSearch(searchTerm); setPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm])

  useEffect(() => {
    const timer = setTimeout(() => { setAddDebouncedSearch(addSearch); setAddPage(0) }, 300)
    return () => clearTimeout(timer)
  }, [addSearch])

  // Fetch group info
  useEffect(() => {
    const fetchGroup = async () => {
      setLoadingGroup(true)
      try {
        const response = await messengerService.getGroup(groupId)
        setGroup(response.data.group)
        setMemberCount(response.data.member_count)
      } catch {
        setSnackbar({ open: true, message: 'Failed to fetch group', severity: 'error' })
      } finally {
        setLoadingGroup(false)
      }
    }
    fetchGroup()
  }, [groupId])

  // Fetch members
  const fetchMembers = useCallback(async () => {
    setLoadingMembers(true)
    try {
      const response = await messengerService.getGroupMembers(groupId, {
        page: page + 1,
        per_page: rowsPerPage,
        query: debouncedSearch || undefined
      })
      setMembers(response.data?.results || [])
      setTotalMembers(response.data?.total || 0)
    } catch {
      setSnackbar({ open: true, message: 'Failed to fetch members', severity: 'error' })
    } finally {
      setLoadingMembers(false)
    }
  }, [groupId, page, rowsPerPage, debouncedSearch])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  // Fetch all contacts for add dialog
  const fetchAllContacts = useCallback(async () => {
    setLoadingAllContacts(true)
    try {
      const response = await messengerService.getContacts({
        page: addPage + 1,
        per_page: 25,
        query: addDebouncedSearch || undefined
      })
      setAllContacts(response.data?.results || [])
      setAllContactsTotal(response.data?.total || 0)
    } catch {
      // silent
    } finally {
      setLoadingAllContacts(false)
    }
  }, [addPage, addDebouncedSearch])

  useEffect(() => {
    if (addDialogOpen) fetchAllContacts()
  }, [addDialogOpen, fetchAllContacts])

  // Add members
  const handleAddMembers = async () => {
    if (addSelectedIds.length === 0) return
    setAddingMembers(true)
    try {
      const response = await messengerService.addGroupMembers(groupId, addSelectedIds)
      setSnackbar({ open: true, message: `${response.data.added} contacts added to group`, severity: 'success' })
      setAddDialogOpen(false)
      setAddSelectedIds([])
      setAddSearch('')
      fetchMembers()
      // Update member count
      const groupRes = await messengerService.getGroup(groupId)
      setMemberCount(groupRes.data.member_count)
    } catch {
      setSnackbar({ open: true, message: 'Failed to add members', severity: 'error' })
    } finally {
      setAddingMembers(false)
    }
  }

  // Remove members
  const handleRemoveMembers = async () => {
    if (selectedIds.length === 0) return
    try {
      const response = await messengerService.removeGroupMembers(groupId, selectedIds)
      setSnackbar({ open: true, message: `${response.data.removed} contacts removed from group`, severity: 'success' })
      setRemoveDialogOpen(false)
      setSelectedIds([])
      fetchMembers()
      const groupRes = await messengerService.getGroup(groupId)
      setMemberCount(groupRes.data.member_count)
    } catch {
      setSnackbar({ open: true, message: 'Failed to remove members', severity: 'error' })
    }
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedIds(checked ? members.map(m => m.id) : [])
  }

  const handleSelectOne = (id: number, checked: boolean) => {
    setSelectedIds(prev => checked ? [...prev, id] : prev.filter(i => i !== id))
  }

  const getDisplayName = (contact: MessengerContact) => {
    return contact.name || '-'
  }

  if (loadingGroup) {
    return (
      <Card>
        <CardContent>
          <Box display='flex' justifyContent='center' p={4}><CircularProgress /></Box>
        </CardContent>
      </Card>
    )
  }

  if (!group) {
    return (
      <Card>
        <CardContent>
          <Typography color='text.secondary' align='center' className='py-8'>Group not found</Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Group Header */}
      <Card className='mb-6'>
        <CardContent>
          <div className='flex items-center justify-between flex-wrap gap-4'>
            <div className='flex items-center gap-3'>
              <Box sx={{ width: 16, height: 16, borderRadius: '50%', backgroundColor: group.color }} />
              <div>
                <Typography variant='h5'>{group.name}</Typography>
                {group.description && (
                  <Typography variant='body2' color='text.secondary'>{group.description}</Typography>
                )}
              </div>
              <Chip label={`${memberCount} members`} size='small' variant='tonal' color='primary' />
            </div>
            <Button
              variant='outlined'
              startIcon={<i className='tabler-arrow-left' />}
              onClick={() => router.push(`/${locale}/messenger/groups`)}
            >
              Back to Groups
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader
          title='Members'
          action={
            <div className='flex gap-2 flex-wrap'>
              {selectedIds.length > 0 && (
                <Button
                  variant='outlined'
                  color='error'
                  size='small'
                  startIcon={<i className='tabler-user-minus' />}
                  onClick={() => setRemoveDialogOpen(true)}
                >
                  Remove ({selectedIds.length})
                </Button>
              )}
              <Button
                variant='contained'
                size='small'
                startIcon={<i className='tabler-user-plus' />}
                onClick={() => setAddDialogOpen(true)}
              >
                Add Members
              </Button>
            </div>
          }
        />
        <CardContent>
          <Grid container spacing={4} className='mb-4'>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                fullWidth
                size='small'
                placeholder='Search members...'
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
          </Grid>
        </CardContent>

        {loadingMembers ? (
          <CardContent>
            <Box display='flex' justifyContent='center' p={4}><CircularProgress /></Box>
          </CardContent>
        ) : members.length === 0 ? (
          <CardContent>
            <Typography color='text.secondary' align='center' className='py-8'>
              {debouncedSearch ? 'No members match your search' : 'No members in this group yet. Click "Add Members" to get started.'}
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
                        checked={selectedIds.length === members.length && members.length > 0}
                        indeterminate={selectedIds.length > 0 && selectedIds.length < members.length}
                        onChange={e => handleSelectAll(e.target.checked)}
                      />
                    </TableCell>
                    <TableCell>PSID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Tags</TableCell>
                    <TableCell align='center'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {members.map(contact => (
                    <TableRow key={contact.id} hover selected={selectedIds.includes(contact.id)}>
                      <TableCell padding='checkbox'>
                        <Checkbox
                          checked={selectedIds.includes(contact.id)}
                          onChange={e => handleSelectOne(contact.id, e.target.checked)}
                        />
                      </TableCell>
                      <TableCell><Typography className='font-medium'>{contact.psid}</Typography></TableCell>
                      <TableCell><Typography>{getDisplayName(contact)}</Typography></TableCell>
                      <TableCell>
                        <Chip
                          label={contact.opted_in ? 'Opted In' : 'Opted Out'}
                          color={contact.opted_in ? 'success' : 'default'}
                          size='small' variant='tonal'
                        />
                      </TableCell>
                      <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                        <div className='flex gap-1 flex-wrap'>
                          {contact.tags && contact.tags.length > 0
                            ? contact.tags.slice(0, 3).map((tag, i) => <Chip key={i} label={tag} size='small' variant='outlined' />)
                            : <Typography variant='body2' color='text.secondary'>-</Typography>
                          }
                        </div>
                      </TableCell>
                      <TableCell align='center'>
                        <IconButton
                          size='small'
                          color='error'
                          onClick={() => {
                            setSelectedIds([contact.id])
                            setRemoveDialogOpen(true)
                          }}
                        >
                          <i className='tabler-user-minus' />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <TablePagination
              component='div'
              count={totalMembers}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={e => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0) }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </Card>

      {/* Add Members Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth='md' fullWidth>
        <DialogTitle>Add Members to {group.name}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            size='small'
            placeholder='Search contacts...'
            value={addSearch}
            onChange={e => setAddSearch(e.target.value)}
            className='mt-2 mb-4'
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
          {addSelectedIds.length > 0 && (
            <Alert severity='info' className='mb-3'>
              {addSelectedIds.length} contacts selected
            </Alert>
          )}
          {loadingAllContacts ? (
            <Box display='flex' justifyContent='center' p={4}><CircularProgress /></Box>
          ) : (
            <>
              <TableContainer>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell padding='checkbox'>
                        <Checkbox
                          checked={allContacts.length > 0 && allContacts.every(c => addSelectedIds.includes(c.id))}
                          indeterminate={allContacts.some(c => addSelectedIds.includes(c.id)) && !allContacts.every(c => addSelectedIds.includes(c.id))}
                          onChange={e => {
                            if (e.target.checked) {
                              setAddSelectedIds(prev => [...new Set([...prev, ...allContacts.map(c => c.id)])])
                            } else {
                              setAddSelectedIds(prev => prev.filter(id => !allContacts.some(c => c.id === id)))
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>PSID</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {allContacts.map(contact => (
                      <TableRow key={contact.id} hover>
                        <TableCell padding='checkbox'>
                          <Checkbox
                            checked={addSelectedIds.includes(contact.id)}
                            onChange={e => {
                              if (e.target.checked) {
                                setAddSelectedIds(prev => [...prev, contact.id])
                              } else {
                                setAddSelectedIds(prev => prev.filter(id => id !== contact.id))
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>{contact.psid}</TableCell>
                        <TableCell>{getDisplayName(contact)}</TableCell>
                        <TableCell>
                          <Chip
                            label={contact.opted_in ? 'Opted In' : 'Opted Out'}
                            color={contact.opted_in ? 'success' : 'default'}
                            size='small' variant='tonal'
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component='div'
                count={allContactsTotal}
                rowsPerPage={25}
                page={addPage}
                onPageChange={(_, newPage) => setAddPage(newPage)}
                rowsPerPageOptions={[25]}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            onClick={handleAddMembers}
            disabled={addingMembers || addSelectedIds.length === 0}
            startIcon={addingMembers ? <CircularProgress size={18} /> : <i className='tabler-user-plus' />}
          >
            {addingMembers ? 'Adding...' : `Add ${addSelectedIds.length} Contact${addSelectedIds.length !== 1 ? 's' : ''}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Remove Members Dialog */}
      <Dialog open={removeDialogOpen} onClose={() => setRemoveDialogOpen(false)}>
        <DialogTitle>Remove Members</DialogTitle>
        <DialogContent>
          <Typography>
            Remove {selectedIds.length} selected contact{selectedIds.length !== 1 ? 's' : ''} from this group?
            The contacts will not be deleted, only removed from the group.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRemoveDialogOpen(false)}>Cancel</Button>
          <Button variant='contained' color='error' onClick={handleRemoveMembers}>Remove</Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} variant='filled'>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default MessengerGroupDetail
