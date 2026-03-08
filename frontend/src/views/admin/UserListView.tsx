'use client'

import { useEffect, useState } from 'react'

import { useParams, useRouter } from 'next/navigation'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Alert from '@mui/material/Alert'

import type { Locale } from '@configs/i18n'

import { userService } from '@/services/users'
import type { User } from '@/services/users'
import { getRoleLabel, getRoleColor } from '@/utils/roles'
import { getLocalizedUrl } from '@/utils/i18n'

const UserListView = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null
  })

  const [editDialog, setEditDialog] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null
  })

  const [editForm, setEditForm] = useState({ name: '', email: '', is_active: true, password: '', role: '' })

  const router = useRouter()
  const { lang: locale } = useParams()

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError('')

      const params: { role?: string; query?: string } = {}

      if (roleFilter) params.role = roleFilter
      if (searchQuery) params.query = searchQuery

      const result = await userService.list(params)

      setUsers(result.data || [])
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter, searchQuery])

  const handleDelete = async () => {
    if (!deleteDialog.user) return

    try {
      await userService.delete(deleteDialog.user.id)
      setDeleteDialog({ open: false, user: null })
      fetchUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete user')
      setDeleteDialog({ open: false, user: null })
    }
  }

  const handleEditOpen = (user: User) => {
    setEditForm({
      name: user.name,
      email: user.email,
      is_active: user.is_active,
      password: '',
      role: user.role
    })
    setEditDialog({ open: true, user })
  }

  const handleEditSave = async () => {
    if (!editDialog.user) return

    try {
      // Update user details
      const updatePayload: any = {}

      if (editForm.name !== editDialog.user.name) updatePayload.name = editForm.name
      if (editForm.email !== editDialog.user.email) updatePayload.email = editForm.email
      if (editForm.is_active !== editDialog.user.is_active) updatePayload.is_active = editForm.is_active
      if (editForm.password) updatePayload.password = editForm.password

      if (Object.keys(updatePayload).length > 0) {
        await userService.update(editDialog.user.id, updatePayload)
      }

      // Update role if changed
      if (editForm.role !== editDialog.user.role) {
        await userService.updateRole(editDialog.user.id, { role: editForm.role })
      }

      setEditDialog({ open: false, user: null })
      fetchUsers()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update user')
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title='User Management'
          action={
            <Button
              variant='contained'
              startIcon={<i className='tabler-plus' />}
              onClick={() => router.push(getLocalizedUrl('/admin/users/create', locale as Locale))}
            >
              Add User
            </Button>
          }
        />
        <CardContent>
          {/* Filters */}
          <Box className='flex gap-4 mb-6 flex-wrap'>
            <TextField
              size='small'
              placeholder='Search by name or email...'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              sx={{ minWidth: 250 }}
              InputProps={{
                startAdornment: <i className='tabler-search mr-2 text-textSecondary' />
              }}
            />
            <FormControl size='small' sx={{ minWidth: 150 }}>
              <InputLabel>Role</InputLabel>
              <Select value={roleFilter} label='Role' onChange={e => setRoleFilter(e.target.value)}>
                <MenuItem value=''>All Roles</MenuItem>
                <MenuItem value='admin'>Admin</MenuItem>
                <MenuItem value='user'>Staff</MenuItem>
                <MenuItem value='subscriber'>Subscriber</MenuItem>
              </Select>
            </FormControl>
          </Box>

          {error && (
            <Alert severity='error' className='mb-4'>
              {error}
            </Alert>
          )}

          {loading ? (
            <Box className='flex justify-center p-8'>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align='center'>
                        <Typography color='text.secondary' className='py-4'>
                          No users found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    users.map(user => (
                      <TableRow key={user.id} hover>
                        <TableCell>
                          <Typography className='font-medium'>{user.name}</Typography>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Chip
                            label={getRoleLabel(user.role)}
                            color={getRoleColor(user.role)}
                            size='small'
                            variant='tonal'
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={user.is_active ? 'Active' : 'Inactive'}
                            color={user.is_active ? 'success' : 'default'}
                            size='small'
                            variant='tonal'
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant='body2' color='text.secondary'>
                            {new Date(user.created_at).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                        <TableCell align='right'>
                          <IconButton size='small' color='primary' onClick={() => handleEditOpen(user)}>
                            <i className='tabler-edit text-lg' />
                          </IconButton>
                          <IconButton
                            size='small'
                            color='error'
                            onClick={() => setDeleteDialog({ open: true, user })}
                          >
                            <i className='tabler-trash text-lg' />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, user: null })}>
        <DialogTitle>Delete User</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete <strong>{deleteDialog.user?.name}</strong> ({deleteDialog.user?.email})? This
            action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, user: null })}>Cancel</Button>
          <Button onClick={handleDelete} color='error' variant='contained'>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialog.open} onClose={() => setEditDialog({ open: false, user: null })} maxWidth='sm' fullWidth>
        <DialogTitle>Edit User</DialogTitle>
        <DialogContent>
          <Box className='flex flex-col gap-4 mt-2'>
            <TextField
              label='Name'
              fullWidth
              value={editForm.name}
              onChange={e => setEditForm({ ...editForm, name: e.target.value })}
            />
            <TextField
              label='Email'
              fullWidth
              type='email'
              value={editForm.email}
              onChange={e => setEditForm({ ...editForm, email: e.target.value })}
            />
            <FormControl fullWidth>
              <InputLabel>Role</InputLabel>
              <Select
                value={editForm.role}
                label='Role'
                onChange={e => setEditForm({ ...editForm, role: e.target.value })}
              >
                <MenuItem value='admin'>Admin</MenuItem>
                <MenuItem value='user'>Staff</MenuItem>
                <MenuItem value='subscriber'>Subscriber</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={editForm.is_active ? 'active' : 'inactive'}
                label='Status'
                onChange={e => setEditForm({ ...editForm, is_active: e.target.value === 'active' })}
              >
                <MenuItem value='active'>Active</MenuItem>
                <MenuItem value='inactive'>Inactive</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label='New Password (leave blank to keep current)'
              fullWidth
              type='password'
              value={editForm.password}
              onChange={e => setEditForm({ ...editForm, password: e.target.value })}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog({ open: false, user: null })}>Cancel</Button>
          <Button onClick={handleEditSave} variant='contained'>
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default UserListView
