'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import IconButton from '@mui/material/IconButton'
import Drawer from '@mui/material/Drawer'
import { useTheme } from '@mui/material/styles'

// Component Imports
import FileManagerSidebar from './FileManagerSidebar'
import FileManagerContent from './FileManagerContent'
import ImportUrlDialog from './ImportUrlDialog'
import UploadDialog from './UploadDialog'

// Services
import mediaService from '@/services/media'

// Utils
import { isImageFile } from '@/utils/media'

// Types
import type { MediaItem, MediaFolder } from '@/types/email'

const FileManagerPage = () => {
  const [media, setMedia] = useState<MediaItem[]>([])
  const [folders, setFolders] = useState<MediaFolder[]>([])
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null)
  const [folderItemIds, setFolderItemIds] = useState<number[]>([])
  const [filterTab, setFilterTab] = useState<'all' | 'images' | 'files'>('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [importUrlDialogOpen, setImportUrlDialogOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  const fetchMedia = useCallback(async () => {
    try {
      setLoading(true)

      const response = await mediaService.getAll()

      setMedia(response.data?.results || [])
    } catch (err) {
      console.error('Failed to fetch media:', err)
      setSnackbar({ open: true, message: 'Failed to load media files', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchFolders = useCallback(async () => {
    try {
      const response = await mediaService.listFolders()

      setFolders(response.data || [])
    } catch (err) {
      console.error('Failed to fetch folders:', err)
    }
  }, [])

  const fetchFolderItems = useCallback(async (folderId: number) => {
    try {
      const response = await mediaService.getFolderItems(folderId)

      setFolderItemIds(response.data || [])
    } catch (err) {
      console.error('Failed to fetch folder items:', err)
      setFolderItemIds([])
    }
  }, [])

  useEffect(() => {
    fetchMedia()
    fetchFolders()
  }, [fetchMedia, fetchFolders])

  useEffect(() => {
    if (activeFolderId !== null) {
      fetchFolderItems(activeFolderId)
    } else {
      setFolderItemIds([])
    }
  }, [activeFolderId, fetchFolderItems])

  // Filter media by folder, type, and search
  const filteredMedia = useMemo(() => {
    let result = media

    // Filter by folder
    if (activeFolderId !== null) {
      result = result.filter(m => folderItemIds.includes(m.id))
    }

    // Filter by type (uses helper since Listmonk may return generic content_type)
    if (filterTab === 'images') {
      result = result.filter(m => isImageFile(m))
    } else if (filterTab === 'files') {
      result = result.filter(m => !isImageFile(m))
    }

    // Filter by search
    if (search.trim()) {
      const q = search.toLowerCase()

      result = result.filter(m => m.filename.toLowerCase().includes(q))
    }

    return result
  }, [media, activeFolderId, folderItemIds, filterTab, search])

  const handleDelete = async (id: number) => {
    try {
      await mediaService.delete(id)
      setSnackbar({ open: true, message: 'File deleted successfully', severity: 'success' })
      fetchMedia()
      fetchFolders()
    } catch (err) {
      console.error('Failed to delete media:', err)
      setSnackbar({ open: true, message: 'Failed to delete file', severity: 'error' })
    }
  }

  const handleUploadSuccess = () => {
    setUploadDialogOpen(false)
    setSnackbar({ open: true, message: 'File uploaded successfully', severity: 'success' })
    fetchMedia()
  }

  const handleImportSuccess = () => {
    setImportUrlDialogOpen(false)
    setSnackbar({ open: true, message: 'File imported successfully from URL', severity: 'success' })
    fetchMedia()
  }

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }))
  }

  const sidebarContent = (
    <FileManagerSidebar
      folders={folders}
      activeFolderId={activeFolderId}
      onSelectFolder={id => {
        setActiveFolderId(id)

        if (isMobile) setSidebarOpen(false)
      }}
      onUploadClick={() => {
        setUploadDialogOpen(true)

        if (isMobile) setSidebarOpen(false)
      }}
      onImportUrlClick={() => {
        setImportUrlDialogOpen(true)

        if (isMobile) setSidebarOpen(false)
      }}
      onFoldersChanged={fetchFolders}
      totalMediaCount={media.length}
    />
  )

  if (loading && media.length === 0) {
    return (
      <div className='flex flex-col gap-4 sm:gap-6'>
        <Typography variant='h5' sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} className='font-bold'>
          File manager
        </Typography>
        <div className='flex items-center justify-center min-h-[300px] sm:min-h-[400px]'>
          <CircularProgress />
        </div>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4 sm:gap-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <Typography variant='h5' sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }} className='font-bold'>
          File manager
        </Typography>
        {isMobile && (
          <IconButton onClick={() => setSidebarOpen(true)} color='primary'>
            <i className='tabler-menu-2 text-[22px]' />
          </IconButton>
        )}
      </div>

      <Grid container spacing={{ xs: 4, sm: 6 }}>
        {/* Sidebar — hidden on mobile, shown in drawer */}
        {!isMobile && (
          <Grid size={{ xs: 12, md: 3 }}>
            {sidebarContent}
          </Grid>
        )}

        {/* Content */}
        <Grid size={{ xs: 12, md: 9 }}>
          <FileManagerContent
            media={filteredMedia}
            filterTab={filterTab}
            onFilterTabChange={setFilterTab}
            search={search}
            onSearchChange={setSearch}
            loading={loading}
            onDelete={handleDelete}
          />
        </Grid>
      </Grid>

      {/* Mobile sidebar drawer */}
      {isMobile && (
        <Drawer
          anchor='left'
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          PaperProps={{
            sx: { width: { xs: '85vw', sm: 320 }, p: 2 }
          }}
        >
          {sidebarContent}
        </Drawer>
      )}

      {/* Dialogs */}
      <ImportUrlDialog
        open={importUrlDialogOpen}
        onClose={() => setImportUrlDialogOpen(false)}
        onSuccess={handleImportSuccess}
      />

      <UploadDialog
        open={uploadDialogOpen}
        onClose={() => setUploadDialogOpen(false)}
        onSuccess={handleUploadSuccess}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant='filled'>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  )
}

export default FileManagerPage
