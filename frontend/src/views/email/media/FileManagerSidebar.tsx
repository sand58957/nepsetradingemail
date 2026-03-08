'use client'

import { useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Divider from '@mui/material/Divider'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'

// Services
import mediaService from '@/services/media'

// Types
import type { MediaFolder } from '@/types/email'

interface Props {
  folders: MediaFolder[]
  activeFolderId: number | null
  onSelectFolder: (id: number | null) => void
  onUploadClick: () => void
  onImportUrlClick: () => void
  onFoldersChanged: () => void
  totalMediaCount: number
}

const FileManagerSidebar = ({
  folders,
  activeFolderId,
  onSelectFolder,
  onUploadClick,
  onImportUrlClick,
  onFoldersChanged,
  totalMediaCount
}: Props) => {
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [editFolder, setEditFolder] = useState<MediaFolder | null>(null)
  const [folderName, setFolderName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return

    try {
      setSaving(true)
      await mediaService.createFolder({ name: folderName.trim() })
      setNewFolderOpen(false)
      setFolderName('')
      onFoldersChanged()
    } catch (err) {
      console.error('Failed to create folder:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleEditFolder = async () => {
    if (!editFolder || !folderName.trim()) return

    try {
      setSaving(true)
      await mediaService.updateFolder(editFolder.id, { name: folderName.trim() })
      setEditFolder(null)
      setFolderName('')
      onFoldersChanged()
    } catch (err) {
      console.error('Failed to update folder:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteFolder = async (id: number) => {
    try {
      await mediaService.deleteFolder(id)

      if (activeFolderId === id) {
        onSelectFolder(null)
      }

      onFoldersChanged()
    } catch (err) {
      console.error('Failed to delete folder:', err)
    }
  }

  const openEditDialog = (folder: MediaFolder) => {
    setEditFolder(folder)
    setFolderName(folder.name)
  }

  return (
    <>
      <Card>
        <CardContent sx={{ p: { xs: 0, sm: 0 }, '&:last-child': { pb: { xs: 1, sm: 1 } } }}>
          {/* Import from section */}
          <div className='px-3 sm:px-4 pt-3 sm:pt-4 pb-1 sm:pb-2'>
            <Typography variant='subtitle2' sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }} className='font-semibold mb-1'>
              Import from
            </Typography>
          </div>

          <List dense disablePadding>
            <ListItemButton onClick={onImportUrlClick} sx={{ py: { xs: 1, sm: 0.75 } }}>
              <ListItemIcon sx={{ minWidth: { xs: 40, sm: 36 } }}>
                <i className='tabler-link text-[20px]' />
              </ListItemIcon>
              <ListItemText primary='URL' primaryTypographyProps={{ fontSize: { xs: '0.9rem', sm: '0.875rem' } }} />
            </ListItemButton>

            <ListItemButton onClick={onUploadClick} sx={{ py: { xs: 1, sm: 0.75 } }}>
              <ListItemIcon sx={{ minWidth: { xs: 40, sm: 36 } }}>
                <i className='tabler-upload text-[20px]' />
              </ListItemIcon>
              <ListItemText primary='My device' primaryTypographyProps={{ fontSize: { xs: '0.9rem', sm: '0.875rem' } }} />
            </ListItemButton>

            <ListItemButton disabled sx={{ py: { xs: 1, sm: 0.75 } }}>
              <ListItemIcon sx={{ minWidth: { xs: 40, sm: 36 } }}>
                <i className='tabler-brand-google-drive text-[20px]' />
              </ListItemIcon>
              <ListItemText primary='Google Drive' primaryTypographyProps={{ fontSize: { xs: '0.9rem', sm: '0.875rem' } }} />
              <Chip label='Soon' size='small' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />
            </ListItemButton>

            <ListItemButton disabled sx={{ py: { xs: 1, sm: 0.75 } }}>
              <ListItemIcon sx={{ minWidth: { xs: 40, sm: 36 } }}>
                <i className='tabler-gif text-[20px]' />
              </ListItemIcon>
              <ListItemText primary='Tenor' primaryTypographyProps={{ fontSize: { xs: '0.9rem', sm: '0.875rem' } }} />
              <Chip label='Soon' size='small' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />
            </ListItemButton>

            <ListItemButton disabled sx={{ py: { xs: 1, sm: 0.75 } }}>
              <ListItemIcon sx={{ minWidth: { xs: 40, sm: 36 } }}>
                <i className='tabler-icons text-[20px]' />
              </ListItemIcon>
              <ListItemText primary='Flaticon' primaryTypographyProps={{ fontSize: { xs: '0.9rem', sm: '0.875rem' } }} />
              <Chip label='Soon' size='small' variant='outlined' sx={{ height: 20, fontSize: '0.7rem' }} />
            </ListItemButton>
          </List>

          <Divider sx={{ my: { xs: 1, sm: 1.5 } }} />

          {/* Folders section */}
          <div className='px-3 sm:px-4 pb-1 sm:pb-2'>
            <Box className='flex items-center justify-between mb-1'>
              <Typography variant='subtitle2' sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }} className='font-semibold'>
                Folders
              </Typography>
              <Button
                size='small'
                variant='outlined'
                startIcon={<i className='tabler-folder-plus text-[16px]' />}
                onClick={() => {
                  setFolderName('')
                  setNewFolderOpen(true)
                }}
                sx={{ textTransform: 'none', fontSize: { xs: '0.75rem', sm: '0.8rem' }, px: { xs: 1, sm: 1.5 } }}
              >
                New folder
              </Button>
            </Box>
          </div>

          <List dense disablePadding>
            {/* All files */}
            <ListItemButton
              selected={activeFolderId === null}
              onClick={() => onSelectFolder(null)}
              sx={{ py: { xs: 1, sm: 0.75 } }}
            >
              <ListItemIcon sx={{ minWidth: { xs: 40, sm: 36 } }}>
                <i className='tabler-folders text-[20px]' />
              </ListItemIcon>
              <ListItemText
                primary={`All (${totalMediaCount})`}
                primaryTypographyProps={{ fontSize: { xs: '0.9rem', sm: '0.875rem' } }}
              />
            </ListItemButton>

            {/* User folders */}
            {folders.map(folder => (
              <ListItemButton
                key={folder.id}
                selected={activeFolderId === folder.id}
                onClick={() => onSelectFolder(folder.id)}
                sx={{ py: { xs: 1, sm: 0.75 } }}
              >
                <ListItemIcon sx={{ minWidth: { xs: 40, sm: 36 } }}>
                  <i className='tabler-folder text-[20px]' />
                </ListItemIcon>
                <ListItemText
                  primary={`${folder.name} (${folder.item_count})`}
                  primaryTypographyProps={{
                    fontSize: { xs: '0.9rem', sm: '0.875rem' },
                    noWrap: true
                  }}
                />
                <div className='flex gap-0.5 shrink-0' onClick={e => e.stopPropagation()}>
                  <IconButton
                    size='small'
                    onClick={() => openEditDialog(folder)}
                    sx={{ p: { xs: 1, sm: 0.5 } }}
                  >
                    <i className='tabler-pencil text-[16px]' />
                  </IconButton>
                  <IconButton
                    size='small'
                    onClick={() => handleDeleteFolder(folder.id)}
                    sx={{ p: { xs: 1, sm: 0.5 } }}
                  >
                    <i className='tabler-trash text-[16px]' />
                  </IconButton>
                </div>
              </ListItemButton>
            ))}
          </List>
        </CardContent>
      </Card>

      {/* New Folder Dialog */}
      <Dialog open={newFolderOpen} onClose={() => setNewFolderOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>New folder</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label='Folder name'
            value={folderName}
            onChange={e => setFolderName(e.target.value)}
            placeholder='e.g. Product Images'
            autoFocus
            className='mt-2'
            onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderOpen(false)} color='secondary'>
            Cancel
          </Button>
          <Button onClick={handleCreateFolder} variant='contained' disabled={!folderName.trim() || saving}>
            {saving ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Folder Dialog */}
      <Dialog open={!!editFolder} onClose={() => setEditFolder(null)} maxWidth='xs' fullWidth>
        <DialogTitle>Rename folder</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label='Folder name'
            value={folderName}
            onChange={e => setFolderName(e.target.value)}
            autoFocus
            className='mt-2'
            onKeyDown={e => e.key === 'Enter' && handleEditFolder()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditFolder(null)} color='secondary'>
            Cancel
          </Button>
          <Button onClick={handleEditFolder} variant='contained' disabled={!folderName.trim() || saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default FileManagerSidebar
