'use client'

import { useState } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'
import Box from '@mui/material/Box'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Utils
import { isImageFile } from '@/utils/media'

// Types
import type { MediaItem } from '@/types/email'

interface Props {
  media: MediaItem
  onDelete: (id: number) => void
  pickerMode?: boolean
  onSelect?: (media: MediaItem) => void
}

const fileTypeIcons: Record<string, string> = {
  'image/jpeg': 'tabler-photo',
  'image/jpg': 'tabler-photo',
  'image/png': 'tabler-photo',
  'image/gif': 'tabler-gif',
  'image/svg+xml': 'tabler-svg',
  'image/webp': 'tabler-photo',
  'application/pdf': 'tabler-file-type-pdf',
  'text/plain': 'tabler-file-text',
  'text/csv': 'tabler-file-spreadsheet'
}

const FileCard = ({ media, onDelete, pickerMode, onSelect }: Props) => {
  const [copiedUrl, setCopiedUrl] = useState(false)

  const handleCopyUrl = async () => {
    const url = media.url || media.thumb_url

    if (url) {
      try {
        await navigator.clipboard.writeText(url)
        setCopiedUrl(true)
        setTimeout(() => setCopiedUrl(false), 2000)
      } catch {
        // Clipboard API may fail in non-HTTPS or denied permission contexts
      }
    }
  }

  const isImage = isImageFile(media)

  return (
    <Card
      className='h-full flex flex-col'
      sx={pickerMode ? { cursor: 'pointer', '&:hover': { boxShadow: 6, outline: '2px solid', outlineColor: 'primary.main' }, transition: 'all 0.15s' } : {}}
      onClick={pickerMode ? () => onSelect?.(media) : undefined}
    >
      {/* Thumbnail / Preview — responsive height */}
      <Box
        className='flex items-center justify-center'
        sx={{
          height: { xs: 120, sm: 140, md: 160 },
          backgroundColor: 'action.hover',
          overflow: 'hidden'
        }}
      >
        {isImage && (media.thumb_url || media.url) ? (
          <img
            src={media.thumb_url || media.url}
            alt={media.filename}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <CustomAvatar
            color='primary'
            skin='light'
            variant='rounded'
            sx={{ width: { xs: 40, sm: 56 }, height: { xs: 40, sm: 56 } }}
          >
            <i className={`${fileTypeIcons[media.content_type] || 'tabler-file'} text-[22px] sm:text-[28px]`} />
          </CustomAvatar>
        )}
      </Box>

      {/* File Info */}
      <CardContent sx={{ flexGrow: 1, pb: 1, px: { xs: 1.5, sm: 2 }, pt: { xs: 1.5, sm: 2 } }}>
        <Typography
          sx={{
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: { xs: '0.8rem', sm: '0.875rem' }
          }}
          color='text.primary'
          title={media.filename}
        >
          {media.filename}
        </Typography>
        <Typography variant='caption' color='text.secondary' display='block' sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
          {media.content_type}
        </Typography>
        <Typography
          variant='caption'
          color='text.secondary'
          display='block'
          sx={{ fontSize: { xs: '0.65rem', sm: '0.75rem' }, display: { xs: 'none', sm: 'block' } }}
        >
          {new Date(media.created_at).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })}
        </Typography>
      </CardContent>

      <Divider />

      {/* Actions — bigger touch targets on mobile */}
      {pickerMode ? (
        <CardActions sx={{ justifyContent: 'center', px: { xs: 0.5, sm: 1 }, py: { xs: 0.5, sm: 0.5 } }}>
          <Typography variant='caption' color='primary' fontWeight={600}>
            Click to select
          </Typography>
        </CardActions>
      ) : (
        <CardActions sx={{ justifyContent: 'space-between', px: { xs: 0.5, sm: 1 }, py: { xs: 0.5, sm: 0.5 } }}>
          <Tooltip title={copiedUrl ? 'Copied!' : 'Copy URL'}>
            <IconButton onClick={handleCopyUrl} sx={{ p: { xs: 1, sm: 0.75 } }}>
              <i className={`tabler-${copiedUrl ? 'check' : 'link'} text-[16px] sm:text-[18px]`} />
            </IconButton>
          </Tooltip>
          <div className='flex'>
            <Tooltip title='Download'>
              <IconButton component='a' href={media.url} download={media.filename} target='_blank' rel='noopener' sx={{ p: { xs: 1, sm: 0.75 } }}>
                <i className='tabler-download text-[16px] sm:text-[18px]' />
              </IconButton>
            </Tooltip>
            <Tooltip title='Delete'>
              <IconButton onClick={() => onDelete(media.id)} sx={{ p: { xs: 1, sm: 0.75 } }}>
                <i className='tabler-trash text-[16px] sm:text-[18px]' />
              </IconButton>
            </Tooltip>
          </div>
        </CardActions>
      )}
    </Card>
  )
}

export default FileCard
