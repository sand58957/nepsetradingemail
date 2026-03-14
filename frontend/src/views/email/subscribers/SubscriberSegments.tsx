'use client'

import { useState } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

import subscriberService from '@/services/subscribers'
import type { Subscriber } from '@/types/email'

interface Segment {
  name: string
  description: string
  query: string
  icon: string
}

const predefinedSegments: Segment[] = [
  {
    name: 'Active Subscribers',
    description: 'All subscribers with enabled status',
    query: "subscribers.status = 'enabled'",
    icon: 'tabler-user-check'
  },
  {
    name: 'Blocklisted',
    description: 'Subscribers who are blocklisted',
    query: "subscribers.status = 'blocklisted'",
    icon: 'tabler-user-x'
  },
  {
    name: 'Recent Signups (7 days)',
    description: 'Subscribers who joined in the last 7 days',
    query: "subscribers.created_at > NOW() - INTERVAL '7 days'",
    icon: 'tabler-user-plus'
  },
  {
    name: 'Recent Signups (30 days)',
    description: 'Subscribers who joined in the last 30 days',
    query: "subscribers.created_at > NOW() - INTERVAL '30 days'",
    icon: 'tabler-calendar-plus'
  },
  {
    name: 'Gmail Users',
    description: 'Subscribers with Gmail addresses',
    query: "subscribers.email LIKE '%@gmail.com'",
    icon: 'tabler-mail'
  },
  {
    name: 'No Name Set',
    description: "Subscribers who haven't provided their name",
    query: "subscribers.name = ''",
    icon: 'tabler-user-question'
  }
]

const SubscriberSegments = () => {
  const [customQuery, setCustomQuery] = useState('')
  const [results, setResults] = useState<Subscriber[] | null>(null)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeSegment, setActiveSegment] = useState('')

  const runQuery = async (query: string, segmentName?: string) => {
    if (!query.trim()) return

    setLoading(true)
    setError('')
    setActiveSegment(segmentName || 'Custom Query')

    try {
      const response = await subscriberService.getAll({
        query,
        per_page: 50,
        page: 1
      })

      setResults(response.data?.results || [])
      setTotalCount(response.data?.total || 0)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Query failed'

      setError(msg)
      setResults(null)
      setTotalCount(0)
    } finally {
      setLoading(false)
    }
  }

  const handleRunCustom = () => {
    runQuery(customQuery)
  }

  const handleSegmentClick = (segment: Segment) => {
    setCustomQuery(segment.query)
    runQuery(segment.query, segment.name)
  }

  return (
    <div className='flex flex-col gap-4'>
      {/* Predefined Segments */}
      <Card>
        <CardContent>
          <Typography variant='subtitle1' fontWeight={600} sx={{ mb: 2 }}>
            Quick Segments
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {predefinedSegments.map(segment => (
              <Chip
                key={segment.name}
                icon={<i className={`${segment.icon} text-[16px]`} />}
                label={segment.name}
                onClick={() => handleSegmentClick(segment)}
                variant={activeSegment === segment.name ? 'filled' : 'outlined'}
                color={activeSegment === segment.name ? 'primary' : 'default'}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Custom Query Builder */}
      <Card>
        <CardContent>
          <Typography variant='subtitle1' fontWeight={600} sx={{ mb: 1 }}>
            Custom Query
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            Use SQL-like queries to filter subscribers. Examples: <code>subscribers.email LIKE &apos;%@gmail.com&apos;</code>, <code>subscribers.attribs-&gt;&gt;&apos;city&apos; = &apos;Kathmandu&apos;</code>
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField
              fullWidth
              size='small'
              placeholder="subscribers.status = 'enabled'"
              value={customQuery}
              onChange={e => setCustomQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRunCustom() }}
              sx={{ fontFamily: 'monospace', '& input': { fontFamily: 'monospace', fontSize: '0.85rem' } }}
            />
            <Button
              variant='contained'
              onClick={handleRunCustom}
              disabled={!customQuery.trim() || loading}
              startIcon={loading ? <CircularProgress size={16} color='inherit' /> : <i className='tabler-filter text-[16px]' />}
              sx={{ whiteSpace: 'nowrap', minWidth: { sm: 140 } }}
            >
              {loading ? 'Running...' : 'Run Query'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <Alert severity='error' onClose={() => setError('')}>{error}</Alert>
      )}

      {/* Results */}
      {results !== null && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography variant='subtitle1' fontWeight={600}>
                  {activeSegment}
                </Typography>
                <Chip label={`${totalCount} subscriber${totalCount !== 1 ? 's' : ''}`} size='small' color='primary' variant='outlined' />
              </Box>
              <Tooltip title='Clear results'>
                <IconButton size='small' onClick={() => { setResults(null); setActiveSegment('') }}>
                  <i className='tabler-x text-[16px]' />
                </IconButton>
              </Tooltip>
            </Box>

            {results.length === 0 ? (
              <Typography color='text.secondary' className='text-center py-6'>
                No subscribers match this segment.
              </Typography>
            ) : (
              <TableContainer sx={{ overflowX: 'auto' }}>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600, minWidth: 180 }}>Email</TableCell>
                      <TableCell sx={{ fontWeight: 600, minWidth: 100, display: { xs: 'none', sm: 'table-cell' } }}>Name</TableCell>
                      <TableCell sx={{ fontWeight: 600, minWidth: 80 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600, minWidth: 50, display: { xs: 'none', md: 'table-cell' } }}>Lists</TableCell>
                      <TableCell sx={{ fontWeight: 600, minWidth: 90, display: { xs: 'none', md: 'table-cell' } }}>Joined</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map(sub => (
                      <TableRow key={sub.id} hover>
                        <TableCell>
                          <Typography variant='body2' noWrap sx={{ maxWidth: 250 }}>{sub.email}</Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', sm: 'table-cell' } }}>
                          <Typography variant='body2' color={sub.name ? 'text.primary' : 'text.disabled'}>
                            {sub.name || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={sub.status}
                            size='small'
                            color={sub.status === 'enabled' ? 'success' : sub.status === 'blocklisted' ? 'error' : 'default'}
                            variant='outlined'
                          />
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                          <Typography variant='body2' color='text.secondary'>
                            {sub.lists?.length || 0}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ display: { xs: 'none', md: 'table-cell' } }}>
                          <Typography variant='body2' color='text.secondary'>
                            {new Date(sub.created_at).toLocaleDateString()}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}

            {totalCount > 50 && (
              <Typography variant='body2' color='text.secondary' sx={{ mt: 2, textAlign: 'center' }}>
                Showing first 50 of {totalCount} matching subscribers.
              </Typography>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default SubscriberSegments
