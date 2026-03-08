'use client'

import { useState, useCallback } from 'react'

// MUI Imports
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

// Third-party Imports
import { useDropzone } from 'react-dropzone'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Services
import mediaService from '@/services/media'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const UploadDialog = ({ open, onClose, onSuccess }: Props) => {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)

  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return

      try {
        setUploading(true)
        setError('')
        setProgress(0)

        for (let i = 0; i < acceptedFiles.length; i++) {
          await mediaService.upload(acceptedFiles[i])
          setProgress(Math.round(((i + 1) / acceptedFiles.length) * 100))
        }

        onSuccess()
      } catch (err: any) {
        console.error('Failed to upload file:', err)
        setError(err?.response?.data?.message || 'Failed to upload file')
      } finally {
        setUploading(false)
        setProgress(0)
      }
    },
    [onSuccess]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
      'application/pdf': ['.pdf'],
      'text/*': ['.txt', '.csv']
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    disabled: uploading
  })

  const handleClose = () => {
    if (!uploading) {
      setError('')
      onClose()
    }
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth fullScreen={isXs}>
      <DialogTitle sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>Upload from device</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
        <div className='flex flex-col gap-3'>
          <div
            {...getRootProps()}
            className='flex flex-col items-center justify-center gap-3 sm:gap-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors'
            style={{
              padding: isXs ? '24px 16px' : '32px',
              borderColor: isDragActive ? 'var(--mui-palette-primary-main)' : 'var(--mui-palette-divider)',
              backgroundColor: isDragActive ? 'var(--mui-palette-primary-lightOpacity)' : 'transparent',
              opacity: uploading ? 0.5 : 1
            }}
          >
            <input {...getInputProps()} />
            <CustomAvatar color='primary' skin='light' sx={{ width: { xs: 48, sm: 64 }, height: { xs: 48, sm: 64 } }}>
              <i className='tabler-cloud-upload text-[24px] sm:text-[32px]' />
            </CustomAvatar>
            <div className='text-center'>
              <Typography sx={{ fontSize: { xs: '1rem', sm: '1.15rem' }, fontWeight: 600 }}>
                {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
              </Typography>
              <Typography variant='body2' color='text.secondary' sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                or tap to browse
              </Typography>
            </div>
            <Typography variant='caption' color='text.secondary' sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
              Supported: PNG, JPG, GIF, SVG, WebP, PDF (Max 10MB)
            </Typography>
          </div>

          {uploading && (
            <div className='flex flex-col gap-1'>
              <LinearProgress variant='determinate' value={progress} />
              <Typography variant='caption' color='text.secondary' className='text-center'>
                Uploading... {progress}%
              </Typography>
            </div>
          )}

          {error && <Alert severity='error'>{error}</Alert>}
        </div>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 1.5 } }}>
        <Button onClick={handleClose} color='secondary' disabled={uploading} fullWidth={isXs}>
          {uploading ? 'Uploading...' : 'Cancel'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default UploadDialog
