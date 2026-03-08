'use client'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

// Component Imports
import FileCard from './FileCard'

// Types
import type { MediaItem } from '@/types/email'

interface Props {
  media: MediaItem[]
  filterTab: 'all' | 'images' | 'files'
  onFilterTabChange: (tab: 'all' | 'images' | 'files') => void
  search: string
  onSearchChange: (search: string) => void
  loading: boolean
  onDelete: (id: number) => void
}

const FileManagerContent = ({ media, filterTab, onFilterTabChange, search, onSearchChange, loading, onDelete }: Props) => {
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    const tabs: ('all' | 'images' | 'files')[] = ['all', 'images', 'files']

    onFilterTabChange(tabs[newValue])
  }

  const tabIndex = filterTab === 'all' ? 0 : filterTab === 'images' ? 1 : 2

  return (
    <Card>
      <CardContent sx={{ p: { xs: 2.5, sm: 3, md: 4 }, '&:last-child': { pb: { xs: 2.5, sm: 3, md: 4 } } }}>
        <div className='flex flex-col gap-3 sm:gap-4'>
          {/* Header with search + count */}
          <div className='flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4'>
            <TextField
              size='small'
              placeholder='Search files...'
              value={search}
              onChange={e => onSearchChange(e.target.value)}
              fullWidth
              sx={{ maxWidth: { sm: 300 } }}
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
            <Typography variant='body2' color='text.secondary' sx={{ whiteSpace: 'nowrap' }}>
              {media.length} file{media.length !== 1 ? 's' : ''}
            </Typography>
          </div>

          {/* Filter tabs */}
          <Box sx={{ borderBottom: 1, borderColor: 'divider', mx: { xs: -1, sm: 0 } }}>
            <Tabs
              value={tabIndex}
              onChange={handleTabChange}
              variant='scrollable'
              scrollButtons='auto'
              allowScrollButtonsMobile
              sx={{
                minHeight: { xs: 40, sm: 48 },
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: { xs: '0.8rem', sm: '0.875rem' },
                  minWidth: 'auto',
                  minHeight: { xs: 40, sm: 48 },
                  px: { xs: 1.5, sm: 3 },
                  gap: 0.5
                }
              }}
            >
              <Tab label='All' icon={<i className='tabler-folders text-[18px]' />} iconPosition='start' />
              <Tab label='Images' icon={<i className='tabler-photo text-[18px]' />} iconPosition='start' />
              <Tab label='Files' icon={<i className='tabler-file text-[18px]' />} iconPosition='start' />
            </Tabs>
          </Box>

          {/* Content */}
          {loading ? (
            <div className='flex items-center justify-center py-8 sm:py-12'>
              <CircularProgress />
            </div>
          ) : media.length === 0 ? (
            <div className='flex flex-col items-center justify-center py-8 sm:py-12 gap-2 sm:gap-3'>
              <i className='tabler-cloud-off text-[36px] sm:text-[48px] text-gray-400' />
              <Typography variant='subtitle1' sx={{ fontSize: { xs: '0.95rem', sm: '1.1rem' } }} color='text.secondary'>
                No files found
              </Typography>
              <Typography variant='body2' color='text.secondary' className='text-center' sx={{ fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                Upload files or import from a URL to get started
              </Typography>
            </div>
          ) : (
            <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
              {media.map(item => (
                <Grid key={item.id} size={{ xs: 6, sm: 6, md: 4, lg: 4 }}>
                  <FileCard media={item} onDelete={onDelete} />
                </Grid>
              ))}
            </Grid>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default FileManagerContent
