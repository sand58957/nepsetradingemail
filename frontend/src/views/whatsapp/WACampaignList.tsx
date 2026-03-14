'use client'

// React Imports
import { useState, useEffect, useCallback } from 'react'

// Next Imports
import { useRouter, useParams } from 'next/navigation'

// MUI Imports
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
import LinearProgress from '@mui/material/LinearProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import InputAdornment from '@mui/material/InputAdornment'
import Grid from '@mui/material/Grid'

// Service Imports
import whatsappService from '@/services/whatsapp'

// Type Imports
import type { WACampaign } from '@/types/whatsapp'

const statusColorMap: Record<string, 'default' | 'success' | 'primary' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  scheduled: 'info',
  sending: 'warning',
  sent: 'success',
  paused: 'warning',
  cancelled: 'error',
  failed: 'error'
}

const WACampaignList = () => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  // State
  const [campaigns, setCampaigns] = useState<WACampaign[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [globalFilter, setGlobalFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  // Action menu
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [menuCampaign, setMenuCampaign] = useState<WACampaign | null>(null)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setGlobalFilter(searchTerm)
      setPage(0)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    setLoading(true)

    try {
      const response = await whatsappService.getCampaigns({
        page: page + 1,
        per_page: rowsPerPage,
        query: globalFilter || undefined,
        status: statusFilter || undefined
      })

      setCampaigns(response.data?.results || [])
      setTotalCount(response.data?.total || 0)
    } catch {
      setSnackbar({ open: true, message: 'Failed to fetch campaigns', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }, [page, rowsPerPage, globalFilter, statusFilter])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  // Delete
  const handleDelete = async () => {
    if (!deletingId) return

    try {
      await whatsappService.deleteCampaign(deletingId)
      setSnackbar({ open: true, message: 'Campaign deleted', severity: 'success' })
      setDeleteDialogOpen(false)
      setDeletingId(null)
      fetchCampaigns()
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete campaign', severity: 'error' })
    }
  }

  const getDeliveryRate = (campaign: WACampaign) => {
    if (campaign.sent_count <= 0) return '-'

    return `${((campaign.delivered_count / campaign.sent_count) * 100).toFixed(0)}%`
  }

  return (
    <>
      <Card>
        <CardHeader
          title='WhatsApp Campaigns'
          subheader={`${totalCount} total campaigns`}
          action={
            <Button
              variant='contained'
              color='success'
              startIcon={<i className='tabler-plus' />}
              onClick={() => router.push(`/${locale}/whatsapp/campaigns/create`)}
            >
              Create Campaign
            </Button>
          }
        />
        <CardContent>
          {/* Filters */}
          <Grid container spacing={4} className='mb-4'>
            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                fullWidth
                size='small'
                placeholder='Search campaigns...'
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
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size='small'>
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  label='Status'
                  onChange={e => { setStatusFilter(e.target.value); setPage(0) }}
                >
                  <MenuItem value=''>All</MenuItem>
                  <MenuItem value='draft'>Draft</MenuItem>
                  <MenuItem value='scheduled'>Scheduled</MenuItem>
                  <MenuItem value='sending'>Sending</MenuItem>
                  <MenuItem value='sent'>Sent</MenuItem>
                  <MenuItem value='paused'>Paused</MenuItem>
                  <MenuItem value='failed'>Failed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </CardContent>

        {/* Table */}
        {loading ? (
          <CardContent>
            <Box display='flex' justifyContent='center' p={4}>
              <CircularProgress />
            </Box>
          </CardContent>
        ) : campaigns.length === 0 ? (
          <CardContent>
            <Typography color='text.secondary' align='center' className='py-8'>
              {globalFilter || statusFilter ? 'No campaigns match your filters' : 'No campaigns yet. Create your first WhatsApp campaign.'}
            </Typography>
          </CardContent>
        ) : (
          <>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Campaign</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align='right'>Targets</TableCell>
                    <TableCell align='right'>Sent</TableCell>
                    <TableCell align='right'>Delivered</TableCell>
                    <TableCell align='right'>Read</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell align='center'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {campaigns.map(campaign => (
                    <TableRow key={campaign.id} hover>
                      <TableCell>
                        <Typography
                          className='font-medium cursor-pointer hover:underline'
                          color='text.primary'
                          onClick={() => router.push(`/${locale}/whatsapp/campaigns/${campaign.id}`)}
                        >
                          {campaign.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1)}
                          color={statusColorMap[campaign.status] || 'default'}
                          size='small'
                          variant='tonal'
                        />
                      </TableCell>
                      <TableCell align='right'>
                        <Typography>{campaign.total_targets > 0 ? campaign.total_targets.toLocaleString() : '-'}</Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Typography>{campaign.sent_count > 0 ? campaign.sent_count.toLocaleString() : '-'}</Typography>
                        {campaign.status === 'sending' && campaign.total_targets > 0 && (
                          <LinearProgress
                            variant='determinate'
                            value={(campaign.sent_count / campaign.total_targets) * 100}
                            className='mt-1'
                            color='success'
                          />
                        )}
                      </TableCell>
                      <TableCell align='right'>
                        <Typography>{getDeliveryRate(campaign)}</Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Typography>{campaign.read_count > 0 ? campaign.read_count.toLocaleString() : '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant='body2'>
                          {new Date(campaign.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell align='center'>
                        <IconButton
                          size='small'
                          onClick={(e) => {
                            setAnchorEl(e.currentTarget)
                            setMenuCampaign(campaign)
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
            <TablePagination
              component='div'
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(_, newPage) => setPage(newPage)}
              onRowsPerPageChange={e => {
                setRowsPerPage(parseInt(e.target.value, 10))
                setPage(0)
              }}
              rowsPerPageOptions={[10, 25, 50, 100]}
            />
          </>
        )}
      </Card>

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        <MenuItem onClick={() => {
          setAnchorEl(null)

          if (menuCampaign) {
            router.push(`/${locale}/whatsapp/campaigns/${menuCampaign.id}`)
          }
        }}>
          <i className='tabler-eye text-[18px] mr-2' />
          View Details
        </MenuItem>
        <MenuItem onClick={() => {
          setAnchorEl(null)

          if (menuCampaign) {
            setDeletingId(menuCampaign.id)
            setDeleteDialogOpen(true)
          }
        }}>
          <i className='tabler-trash text-[18px] mr-2' />
          Delete
        </MenuItem>
      </Menu>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Campaign</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this campaign? This action cannot be undone.</Typography>
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
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant='filled'
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default WACampaignList
