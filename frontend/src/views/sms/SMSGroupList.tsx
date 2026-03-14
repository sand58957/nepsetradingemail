'use client'

import { useState, useEffect } from 'react'
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

import smsService from '@/services/sms'
import type { SMSContactGroupWithCount } from '@/types/sms'

const COLOR_OPTIONS = ['#1976d2', '#388e3c', '#d32f2f', '#f57c00', '#7b1fa2', '#0097a7', '#455a64', '#c2185b']

const SMSGroupList = () => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  const [groups, setGroups] = useState<SMSContactGroupWithCount[]>([])
  const [loading, setLoading] = useState(true)

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formColor, setFormColor] = useState('#1976d2')
  const [saving, setSaving] = useState(false)

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Action menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [menuGroup, setMenuGroup] = useState<SMSContactGroupWithCount | null>(null)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false, message: '', severity: 'success'
  })

  const fetchGroups = async () => {
    setLoading(true)
    try {
      const response = await smsService.getGroups()
      setGroups(response.data || [])
    } catch {
      setSnackbar({ open: true, message: 'Failed to fetch groups', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchGroups() }, [])

  const handleSave = async () => {
    if (!formName.trim()) {
      setSnackbar({ open: true, message: 'Group name is required', severity: 'error' })
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await smsService.updateGroup(editingId, { name: formName.trim(), description: formDescription, color: formColor })
        setSnackbar({ open: true, message: 'Group updated', severity: 'success' })
      } else {
        await smsService.createGroup({ name: formName.trim(), description: formDescription, color: formColor })
        setSnackbar({ open: true, message: 'Group created', severity: 'success' })
      }
      setDialogOpen(false)
      resetForm()
      fetchGroups()
    } catch {
      setSnackbar({ open: true, message: 'Failed to save group', severity: 'error' })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    try {
      await smsService.deleteGroup(deletingId)
      setSnackbar({ open: true, message: 'Group deleted', severity: 'success' })
      setDeleteDialogOpen(false)
      setDeletingId(null)
      fetchGroups()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete group', severity: 'error' })
    }
  }

  const resetForm = () => {
    setFormName('')
    setFormDescription('')
    setFormColor('#1976d2')
    setEditingId(null)
  }

  const openCreate = () => {
    resetForm()
    setDialogOpen(true)
  }

  const openEdit = (group: SMSContactGroupWithCount) => {
    setEditingId(group.id)
    setFormName(group.name)
    setFormDescription(group.description)
    setFormColor(group.color)
    setDialogOpen(true)
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Contact Groups'
          subheader='Organize your SMS contacts into groups for targeted campaigns'
          action={
            <Button variant='contained' size='small' startIcon={<i className='tabler-plus' />} onClick={openCreate}>
              Create Group
            </Button>
          }
        />

        {loading ? (
          <CardContent>
            <Box display='flex' justifyContent='center' p={4}><CircularProgress /></Box>
          </CardContent>
        ) : groups.length === 0 ? (
          <CardContent>
            <Typography color='text.secondary' align='center' className='py-8'>
              No groups yet. Create a group to organize your contacts.
            </Typography>
          </CardContent>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Group Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell align='center'>Members</TableCell>
                  <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>Created</TableCell>
                  <TableCell align='center'>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {groups.map(group => (
                  <TableRow
                    key={group.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/${locale}/sms/groups/${group.id}`)}
                  >
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: group.color, flexShrink: 0 }} />
                        <Typography className='font-medium'>{group.name}</Typography>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2' color='text.secondary'>
                        {group.description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell align='center'>
                      <Chip label={group.member_count} size='small' variant='tonal' color='primary' />
                    </TableCell>
                    <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                      <Typography variant='body2'>
                        {new Date(group.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </Typography>
                    </TableCell>
                    <TableCell align='center'>
                      <IconButton
                        size='small'
                        onClick={(e) => {
                          e.stopPropagation()
                          setAnchorEl(e.currentTarget)
                          setMenuGroup(group)
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
        )}
      </Card>

      {/* Action Menu */}
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        <MenuItem onClick={() => {
          setAnchorEl(null)
          if (menuGroup) router.push(`/${locale}/sms/groups/${menuGroup.id}`)
        }}>
          <i className='tabler-eye text-[18px] mr-2' /> View Members
        </MenuItem>
        <MenuItem onClick={() => {
          setAnchorEl(null)
          if (menuGroup) openEdit(menuGroup)
        }}>
          <i className='tabler-edit text-[18px] mr-2' /> Edit
        </MenuItem>
        <MenuItem onClick={() => {
          setAnchorEl(null)
          if (menuGroup) {
            setDeletingId(menuGroup.id)
            setDeleteDialogOpen(true)
          }
        }}>
          <i className='tabler-trash text-[18px] mr-2' /> Delete
        </MenuItem>
      </Menu>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>{editingId ? 'Edit Group' : 'Create Group'}</DialogTitle>
        <DialogContent>
          <div className='flex flex-col gap-4 mt-2'>
            <TextField
              fullWidth
              label='Group Name *'
              placeholder='e.g. VIP Customers'
              value={formName}
              onChange={e => setFormName(e.target.value)}
            />
            <TextField
              fullWidth
              label='Description'
              placeholder='Optional description'
              value={formDescription}
              onChange={e => setFormDescription(e.target.value)}
              multiline
              rows={2}
            />
            <div>
              <Typography variant='body2' className='mb-2'>Color</Typography>
              <div className='flex gap-2 flex-wrap'>
                {COLOR_OPTIONS.map(color => (
                  <Box
                    key={color}
                    onClick={() => setFormColor(color)}
                    sx={{
                      width: 32, height: 32, borderRadius: '50%', backgroundColor: color, cursor: 'pointer',
                      border: formColor === color ? '3px solid' : '2px solid transparent',
                      borderColor: formColor === color ? 'text.primary' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant='contained'
            onClick={handleSave}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} /> : undefined}
          >
            {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Group</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this group? Contacts in the group will not be deleted.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant='contained' color='error' onClick={handleDelete}>Delete</Button>
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

export default SMSGroupList
