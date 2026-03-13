'use client'

import { useState, useEffect } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import LinearProgress from '@mui/material/LinearProgress'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Service Imports
import whatsappService from '@/services/whatsapp'

interface ContactStatsData {
  total_contacts: number
  opted_in: number
  opted_out: number
  tags: { tag: string; count: number }[]
  recent_30d: number
  with_attributes: number
}

const WAContactStats = () => {
  const [stats, setStats] = useState<ContactStatsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true)

      try {
        const response = await whatsappService.getContactStats()

        setStats(response.data)
      } catch {
        console.error('Failed to fetch stats')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  if (loading || !stats) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={28} />
        <Typography className='ml-3' color='text.secondary'>Loading statistics...</Typography>
      </div>
    )
  }

  const optInRate = stats.total_contacts > 0 ? ((stats.opted_in / stats.total_contacts) * 100).toFixed(1) : '0.0'

  return (
    <Grid container spacing={6}>
      {/* Stat Cards */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card variant='outlined'>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar color='primary' skin='light' variant='rounded' size={48}>
              <i className='tabler-users text-[26px]' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>{stats.total_contacts.toLocaleString()}</Typography>
              <Typography variant='body2' color='text.secondary'>Total Contacts</Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card variant='outlined'>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar color='success' skin='light' variant='rounded' size={48}>
              <i className='tabler-check text-[26px]' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>{stats.opted_in.toLocaleString()}</Typography>
              <Typography variant='body2' color='text.secondary'>Opted In</Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card variant='outlined'>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar color='error' skin='light' variant='rounded' size={48}>
              <i className='tabler-x text-[26px]' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>{stats.opted_out.toLocaleString()}</Typography>
              <Typography variant='body2' color='text.secondary'>Opted Out</Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <Card variant='outlined'>
          <CardContent className='flex items-center gap-4'>
            <CustomAvatar color='info' skin='light' variant='rounded' size={48}>
              <i className='tabler-user-plus text-[26px]' />
            </CustomAvatar>
            <div>
              <Typography variant='h5'>{stats.recent_30d.toLocaleString()}</Typography>
              <Typography variant='body2' color='text.secondary'>Added (30 days)</Typography>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Opt-in Rate */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card variant='outlined'>
          <CardHeader title='Opt-in Rate' />
          <CardContent>
            <div className='flex flex-col gap-3'>
              <div className='flex items-center justify-between'>
                <Typography variant='body2'>
                  {stats.opted_in} of {stats.total_contacts} contacts opted in
                </Typography>
                <Typography variant='h6' className='font-medium'>{optInRate}%</Typography>
              </div>
              <LinearProgress
                variant='determinate'
                value={parseFloat(optInRate)}
                color='success'
                sx={{ height: 10, borderRadius: 5 }}
              />
              <div className='flex gap-4 mt-1'>
                <div className='flex items-center gap-1'>
                  <div className='w-3 h-3 rounded-full bg-success' />
                  <Typography variant='caption'>Opted In ({stats.opted_in})</Typography>
                </div>
                <div className='flex items-center gap-1'>
                  <div className='w-3 h-3 rounded-full bg-error' />
                  <Typography variant='caption'>Opted Out ({stats.opted_out})</Typography>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Data Quality */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card variant='outlined'>
          <CardHeader title='Data Quality' />
          <CardContent>
            <div className='flex flex-col gap-3'>
              <div className='flex items-center justify-between'>
                <Typography variant='body2'>Contacts with custom attributes</Typography>
                <Typography variant='body2' className='font-medium'>
                  {stats.with_attributes} / {stats.total_contacts}
                </Typography>
              </div>
              <LinearProgress
                variant='determinate'
                value={stats.total_contacts > 0 ? (stats.with_attributes / stats.total_contacts) * 100 : 0}
                color='info'
                sx={{ height: 8, borderRadius: 4 }}
              />
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Tags Breakdown */}
      <Grid size={{ xs: 12 }}>
        <Card variant='outlined'>
          <CardHeader title='Contacts by Tag' />
          <CardContent>
            {stats.tags.length === 0 ? (
              <Typography color='text.secondary' className='text-center py-4'>
                No tags assigned to contacts yet.
              </Typography>
            ) : (
              <TableContainer>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Tag</TableCell>
                      <TableCell align='center'>Contacts</TableCell>
                      <TableCell>Distribution</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.tags.map(t => (
                      <TableRow key={t.tag}>
                        <TableCell>
                          <Chip label={t.tag} size='small' variant='tonal' color='primary' />
                        </TableCell>
                        <TableCell align='center'>
                          <Typography variant='body2' className='font-medium'>{t.count}</Typography>
                        </TableCell>
                        <TableCell sx={{ width: '40%' }}>
                          <LinearProgress
                            variant='determinate'
                            value={stats.total_contacts > 0 ? (t.count / stats.total_contacts) * 100 : 0}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  )
}

export default WAContactStats
