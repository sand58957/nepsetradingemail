'use client'

import { useState } from 'react'

// MUI Imports
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useTheme } from '@mui/material/styles'

// Services
import mediaService from '@/services/media'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

const ImportUrlDialog = ({ open, onClose, onSuccess }: Props) => {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const theme = useTheme()
  const isXs = useMediaQuery(theme.breakpoints.down('sm'))

  const handleImport = async () => {
    if (!url.trim()) return

    try {
      setLoading(true)
      setError('')
      await mediaService.uploadFromURL({ url: url.trim() })
      setUrl('')
      onSuccess()
    } catch (err: any) {
      console.error('Failed to import from URL:', err)
      setError(err?.response?.data?.message || 'Failed to import file from URL')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setUrl('')
    setError('')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth='sm' fullWidth fullScreen={isXs}>
      <DialogTitle sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' } }}>Import from URL</DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
        <div className='flex flex-col gap-3 mt-1'>
          <Typography variant='body2' color='text.secondary' sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
            Paste a direct link to an image or file to import it into your media library.
          </Typography>
          <TextField
            fullWidth
            label='File URL'
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder='https://example.com/image.png'
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleImport()}
            size={isXs ? 'medium' : 'medium'}
          />
          <Typography variant='caption' color='text.secondary' sx={{ fontSize: { xs: '0.7rem', sm: '0.75rem' } }}>
            Supported: images (PNG, JPG, GIF, SVG, WebP), PDFs, and other files up to 10MB
          </Typography>
          {error && <Alert severity='error'>{error}</Alert>}
        </div>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: { xs: 2, sm: 1.5 }, flexDirection: { xs: 'column', sm: 'row' }, gap: { xs: 1, sm: 0 } }}>
        <Button onClick={handleClose} color='secondary' fullWidth={isXs}>
          Cancel
        </Button>
        <Button onClick={handleImport} variant='contained' disabled={!url.trim() || loading} fullWidth={isXs}>
          {loading ? 'Importing...' : 'Import'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ImportUrlDialog
