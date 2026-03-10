'use client'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import LinearProgress from '@mui/material/LinearProgress'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'

// Campaign status color mapping
const statusColorMap: Record<string, 'default' | 'success' | 'primary' | 'warning' | 'error' | 'info'> = {
  draft: 'default',
  running: 'success',
  scheduled: 'info',
  paused: 'warning',
  cancelled: 'error',
  finished: 'primary'
}

interface RecentCampaignsTableProps {
  campaigns: any[]
  loading: boolean
}

const RecentCampaignsTable = ({ campaigns, loading }: RecentCampaignsTableProps) => {
  return (
    <Card>
      <CardHeader title='Recent Campaigns' />
      {loading ? (
        <CardContent>
          <Box display='flex' justifyContent='center' p={4}>
            <CircularProgress />
          </Box>
        </CardContent>
      ) : campaigns.length === 0 ? (
        <CardContent>
          <Typography color='text.secondary' align='center'>
            No campaigns yet. Create your first campaign to get started.
          </Typography>
        </CardContent>
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Campaign</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align='right'>Sent</TableCell>
                <TableCell align='right'>Opens</TableCell>
                <TableCell align='right'>Clicks</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {campaigns.map((campaign: any) => (
                <TableRow key={campaign.id} hover>
                  <TableCell>
                    <div className='flex flex-col'>
                      <Typography className='font-medium' color='text.primary'>
                        {campaign.name}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {campaign.subject}
                      </Typography>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={campaign.status ? campaign.status.charAt(0).toUpperCase() + campaign.status.slice(1) : 'Unknown'}
                      color={statusColorMap[campaign.status] || 'default'}
                      size='small'
                      variant='tonal'
                    />
                  </TableCell>
                  <TableCell align='right'>
                    <Typography>{(campaign.sent || 0) > 0 ? campaign.sent.toLocaleString() : '-'}</Typography>
                    {campaign.status === 'running' && (campaign.to_send || 0) > 0 && (
                      <LinearProgress
                        variant='determinate'
                        value={((campaign.sent || 0) / campaign.to_send) * 100}
                        className='mt-1'
                        color='success'
                      />
                    )}
                  </TableCell>
                  <TableCell align='right'>
                    <Typography>{(campaign.views || 0) > 0 ? campaign.views.toLocaleString() : '-'}</Typography>
                  </TableCell>
                  <TableCell align='right'>
                    <Typography>{(campaign.clicks || 0) > 0 ? campaign.clicks.toLocaleString() : '-'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant='body2'>
                      {campaign.created_at
                        ? new Date(campaign.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })
                        : '-'}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Card>
  )
}

export default RecentCampaignsTable
