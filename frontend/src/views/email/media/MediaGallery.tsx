'use client'

// React Imports
import { useState, useCallback } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'

// Third-party Imports
import { useDropzone } from 'react-dropzone'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'

// Mock media data
const mockMedia = [
  {
    id: 1,
    uuid: 'm1',
    filename: 'hero-banner.jpg',
    content_type: 'image/jpeg',
    thumb_url: '',
    url: '/api/media/1',
    size: '245 KB',
    dimensions: '1200 x 600',
    created_at: '2026-03-01T10:00:00Z'
  },
  {
    id: 2,
    uuid: 'm2',
    filename: 'logo-dark.png',
    content_type: 'image/png',
    thumb_url: '',
    url: '/api/media/2',
    size: '48 KB',
    dimensions: '400 x 100',
    created_at: '2026-02-28T14:00:00Z'
  },
  {
    id: 3,
    uuid: 'm3',
    filename: 'product-screenshot.png',
    content_type: 'image/png',
    thumb_url: '',
    url: '/api/media/3',
    size: '512 KB',
    dimensions: '1440 x 900',
    created_at: '2026-02-25T09:00:00Z'
  },
  {
    id: 4,
    uuid: 'm4',
    filename: 'team-photo.jpg',
    content_type: 'image/jpeg',
    thumb_url: '',
    url: '/api/media/4',
    size: '890 KB',
    dimensions: '1920 x 1080',
    created_at: '2026-02-20T16:00:00Z'
  },
  {
    id: 5,
    uuid: 'm5',
    filename: 'newsletter-header.png',
    content_type: 'image/png',
    thumb_url: '',
    url: '/api/media/5',
    size: '156 KB',
    dimensions: '600 x 200',
    created_at: '2026-02-18T11:00:00Z'
  },
  {
    id: 6,
    uuid: 'm6',
    filename: 'sale-banner.gif',
    content_type: 'image/gif',
    thumb_url: '',
    url: '/api/media/6',
    size: '1.2 MB',
    dimensions: '800 x 400',
    created_at: '2026-02-15T08:00:00Z'
  }
]

const fileTypeIcons: Record<string, string> = {
  'image/jpeg': 'tabler-photo',
  'image/png': 'tabler-photo',
  'image/gif': 'tabler-gif',
  'image/svg+xml': 'tabler-svg'
}

const MediaGallery = () => {
  const [search, setSearch] = useState('')
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<(typeof mockMedia)[0] | null>(null)
  const [copiedUrl, setCopiedUrl] = useState<number | null>(null)
  const isMobile = useMobileBreakpoint()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // In a real app, this would upload files via the API
    console.log('Uploading files:', acceptedFiles)
    setUploadDialogOpen(false)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']
    }
  })

  const filteredMedia = mockMedia.filter(m =>
    m.filename.toLowerCase().includes(search.toLowerCase())
  )

  const handleCopyUrl = (media: (typeof mockMedia)[0]) => {
    const fullUrl = `${window.location.origin}${media.url}`

    navigator.clipboard.writeText(fullUrl)
    setCopiedUrl(media.id)
    setTimeout(() => setCopiedUrl(null), 2000)
  }

  return (
    <>
      <Card className='mb-6'>
        <CardHeader
          title='Media Manager'
          subheader={`${mockMedia.length} files`}
          sx={{ flexWrap: 'wrap', rowGap: 2 }}
          action={
            <Button
              variant='contained'
              startIcon={<i className='tabler-upload' />}
              onClick={() => setUploadDialogOpen(true)}
            >
              Upload Files
            </Button>
          }
        />
        <CardContent>
          <TextField
            size='small'
            placeholder='Search media files...'
            value={search}
            onChange={e => setSearch(e.target.value)}
            className='max-sm:is-full min-is-[300px]'
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <i className='tabler-search' />
                </InputAdornment>
              )
            }}
          />
        </CardContent>
      </Card>

      <Grid container spacing={6}>
        {filteredMedia.map(media => (
          <Grid key={media.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <Card className='h-full flex flex-col'>
              {/* Image Placeholder */}
              <div
                className='flex items-center justify-center'
                style={{
                  height: 180,
                  backgroundColor: 'var(--mui-palette-action-hover)',
                  cursor: 'pointer'
                }}
                onClick={() => setSelectedMedia(media)}
              >
                <CustomAvatar color='primary' skin='light' variant='rounded' size={64}>
                  <i className={`${fileTypeIcons[media.content_type] || 'tabler-file'} text-[32px]`} />
                </CustomAvatar>
              </div>
              <CardContent className='grow pb-2'>
                <Typography className='font-medium truncate' color='text.primary' title={media.filename}>
                  {media.filename}
                </Typography>
                <div className='flex gap-2 mt-1'>
                  <Typography variant='caption' color='text.secondary'>
                    {media.size}
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    {media.dimensions}
                  </Typography>
                </div>
                <Typography variant='caption' color='text.secondary' display='block'>
                  {new Date(media.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </Typography>
              </CardContent>
              <Divider />
              <CardActions className='flex justify-between'>
                <Tooltip title={copiedUrl === media.id ? 'Copied!' : 'Copy URL'}>
                  <IconButton size='small' onClick={() => handleCopyUrl(media)}>
                    <i className={`tabler-${copiedUrl === media.id ? 'check' : 'link'} text-[18px]`} />
                  </IconButton>
                </Tooltip>
                <div className='flex gap-1'>
                  <Tooltip title='Download'>
                    <IconButton size='small'>
                      <i className='tabler-download text-[18px]' />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title='Delete'>
                    <IconButton size='small'>
                      <i className='tabler-trash text-[18px]' />
                    </IconButton>
                  </Tooltip>
                </div>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth='sm' fullWidth fullScreen={isMobile}>
        <DialogTitle>Upload Media</DialogTitle>
        <DialogContent>
          <div
            {...getRootProps()}
            className='flex flex-col items-center justify-center gap-4 p-8 rounded-lg border-2 border-dashed cursor-pointer transition-colors'
            style={{
              borderColor: isDragActive ? 'var(--mui-palette-primary-main)' : 'var(--mui-palette-divider)',
              backgroundColor: isDragActive ? 'var(--mui-palette-primary-lightOpacity)' : 'transparent'
            }}
          >
            <input {...getInputProps()} />
            <CustomAvatar color='primary' skin='light' size={64}>
              <i className='tabler-cloud-upload text-[32px]' />
            </CustomAvatar>
            <div className='text-center'>
              <Typography variant='h6'>
                {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                or click to browse
              </Typography>
            </div>
            <Typography variant='caption' color='text.secondary'>
              Supported formats: PNG, JPG, GIF, SVG, WebP (Max 10MB)
            </Typography>
          </div>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialogOpen(false)} color='secondary'>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Media Detail Dialog */}
      <Dialog open={!!selectedMedia} onClose={() => setSelectedMedia(null)} maxWidth='sm' fullWidth fullScreen={isMobile}>
        {selectedMedia && (
          <>
            <DialogTitle>{selectedMedia.filename}</DialogTitle>
            <DialogContent>
              <div
                className='flex items-center justify-center rounded-lg mb-4'
                style={{
                  height: 250,
                  backgroundColor: 'var(--mui-palette-action-hover)'
                }}
              >
                <CustomAvatar color='primary' skin='light' variant='rounded' size={80}>
                  <i className={`${fileTypeIcons[selectedMedia.content_type] || 'tabler-file'} text-[40px]`} />
                </CustomAvatar>
              </div>
              <div className='flex flex-col gap-2'>
                <div className='flex justify-between'>
                  <Typography color='text.secondary'>File name</Typography>
                  <Typography className='font-medium'>{selectedMedia.filename}</Typography>
                </div>
                <div className='flex justify-between'>
                  <Typography color='text.secondary'>Size</Typography>
                  <Typography className='font-medium'>{selectedMedia.size}</Typography>
                </div>
                <div className='flex justify-between'>
                  <Typography color='text.secondary'>Dimensions</Typography>
                  <Typography className='font-medium'>{selectedMedia.dimensions}</Typography>
                </div>
                <div className='flex justify-between'>
                  <Typography color='text.secondary'>Type</Typography>
                  <Typography className='font-medium'>{selectedMedia.content_type}</Typography>
                </div>
                <div className='flex justify-between'>
                  <Typography color='text.secondary'>Uploaded</Typography>
                  <Typography className='font-medium'>
                    {new Date(selectedMedia.created_at).toLocaleDateString()}
                  </Typography>
                </div>
                <Divider className='my-2' />
                <Alert severity='info' className='text-sm'>
                  Use this URL in your templates: <code>{selectedMedia.url}</code>
                </Alert>
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedMedia(null)} color='secondary'>
                Close
              </Button>
              <Button
                variant='contained'
                onClick={() => handleCopyUrl(selectedMedia)}
                startIcon={<i className='tabler-link' />}
              >
                Copy URL
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </>
  )
}

export default MediaGallery
