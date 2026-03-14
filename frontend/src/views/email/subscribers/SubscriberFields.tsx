'use client'

import { useState, useEffect } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import Alert from '@mui/material/Alert'
import LinearProgress from '@mui/material/LinearProgress'

import subscriberService from '@/services/subscribers'

interface SystemField {
  name: string
  key: string
  type: string
  tag: string
  description: string
}

interface DiscoveredField {
  name: string
  type: string
  tag: string
  usageCount: number
  sampleValue: string
}

const systemFields: SystemField[] = [
  { name: 'Email', key: 'email', type: 'Email', tag: '{{ .Subscriber.Email }}', description: 'Primary email address' },
  { name: 'Name', key: 'name', type: 'Text', tag: '{{ .Subscriber.Name }}', description: 'Display name' },
  { name: 'Status', key: 'status', type: 'Enum', tag: '{{ .Subscriber.Status }}', description: 'enabled, blocklisted, or unsubscribed' },
  { name: 'UUID', key: 'uuid', type: 'Text', tag: '{{ .Subscriber.UUID }}', description: 'Unique identifier' },
  { name: 'Lists', key: 'lists', type: 'Array', tag: '{{ .Subscriber.Lists }}', description: 'Subscribed mailing lists' },
  { name: 'Created At', key: 'created_at', type: 'Timestamp', tag: '{{ .Subscriber.CreatedAt }}', description: 'Date subscriber was added' },
  { name: 'Updated At', key: 'updated_at', type: 'Timestamp', tag: '{{ .Subscriber.UpdatedAt }}', description: 'Last updated date' },
]

const SubscriberFields = () => {
  const [customFields, setCustomFields] = useState<DiscoveredField[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [totalSubscribers, setTotalSubscribers] = useState(0)
  const [scannedCount, setScannedCount] = useState(0)
  const [systemOpen, setSystemOpen] = useState(true)
  const [customOpen, setCustomOpen] = useState(true)
  const [systemFieldStats, setSystemFieldStats] = useState<Record<string, number>>({})

  useEffect(() => {
    const fetchFields = async () => {
      setLoading(true)
      setError('')

      try {
        // Fetch subscribers to discover custom attribute fields from live data
        const response = await subscriberService.getAll({ per_page: 100, page: 1 })
        const subscribers = response.data?.results || []
        const total = response.data?.total || 0

        setTotalSubscribers(total)
        setScannedCount(subscribers.length)

        // Count system field usage
        const stats: Record<string, number> = {}
        let withName = 0
        let withEmail = 0

        // Discover custom attribute fields
        const fieldMap = new Map<string, { type: string; count: number; sample: string }>()

        for (const sub of subscribers) {
          if (sub.email) withEmail++
          if (sub.name) withName++

          if (sub.attribs && typeof sub.attribs === 'object') {
            for (const [key, value] of Object.entries(sub.attribs)) {
              const existing = fieldMap.get(key)
              const type = typeof value === 'number' ? 'Number' :
                typeof value === 'boolean' ? 'Boolean' :
                  Array.isArray(value) ? 'Array' :
                    (value && typeof value === 'object') ? 'JSON' : 'Text'

              const sampleStr = value === null || value === undefined ? '' :
                typeof value === 'object' ? JSON.stringify(value) : String(value)

              if (existing) {
                existing.count++
                if (!existing.sample && sampleStr) existing.sample = sampleStr
              } else {
                fieldMap.set(key, { type, count: 1, sample: sampleStr })
              }
            }
          }
        }

        stats['email'] = withEmail
        stats['name'] = withName
        setSystemFieldStats(stats)

        const fieldList: DiscoveredField[] = Array.from(fieldMap.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .map(([name, info]) => ({
            name,
            type: info.type,
            tag: `{{ .Subscriber.Attribs.${name} }}`,
            usageCount: info.count,
            sampleValue: info.sample.length > 50 ? info.sample.slice(0, 50) + '...' : info.sample
          }))

        setCustomFields(fieldList)
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || 'Failed to fetch subscriber data'
        setError(msg)
      } finally {
        setLoading(false)
      }
    }

    fetchFields()
  }, [])

  if (loading) {
    return (
      <div className='flex justify-center items-center py-16'>
        <CircularProgress size={32} />
        <Typography className='ml-3' color='text.secondary'>Scanning subscriber data...</Typography>
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      {/* Header */}
      <Box>
        <Typography variant='h6' fontWeight={600}>
          Subscriber Fields
        </Typography>
        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
          All available fields for your subscribers. Use merge tags to personalize your email templates.
          {totalSubscribers > 0 && (
            <> Scanned {scannedCount} of {totalSubscribers} subscribers to discover custom attributes.</>
          )}
        </Typography>
      </Box>

      {error && (
        <Alert severity='error' onClose={() => setError('')}>{error}</Alert>
      )}

      {/* System Fields */}
      <Card variant='outlined'>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2.5,
            py: 1.5,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' }
          }}
          onClick={() => setSystemOpen(!systemOpen)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <i className={`tabler-chevron-${systemOpen ? 'down' : 'right'} text-[16px]`} />
            <Typography variant='subtitle1' fontWeight={600}>
              System Fields
            </Typography>
            <Chip label={`${systemFields.length} fields`} size='small' variant='outlined' sx={{ height: 22, fontSize: '0.7rem' }} />
          </Box>
          <Chip label='BUILT-IN' size='small' sx={{ bgcolor: 'primary.main', color: 'white', fontWeight: 600, fontSize: '0.65rem', height: 22 }} />
        </Box>
        <Collapse in={systemOpen}>
          <TableContainer>
            <Table size='medium'>
              <TableBody>
                {systemFields.map(field => (
                  <TableRow key={field.key} hover>
                    <TableCell sx={{ minWidth: 100 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <i className='tabler-lock text-[14px] text-gray-500' />
                        <Typography variant='body2' fontWeight={500}>{field.name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell sx={{ minWidth: 80, display: { xs: 'none', sm: 'table-cell' } }}>
                      <Chip label={field.type} size='small' variant='outlined' sx={{ height: 22, fontSize: '0.7rem' }} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Typography
                        variant='body2'
                        sx={{
                          fontFamily: 'monospace',
                          bgcolor: 'action.hover',
                          px: 1,
                          py: 0.25,
                          borderRadius: 0.5,
                          display: 'inline-block',
                          fontSize: '0.75rem',
                          wordBreak: 'break-all'
                        }}
                      >
                        {field.tag}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 120, display: { xs: 'none', md: 'table-cell' } }}>
                      <Typography variant='body2' color='text.secondary' fontSize='0.8rem'>
                        {field.description}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Collapse>
      </Card>

      {/* Custom Attribute Fields — Live from subscriber data */}
      <Card variant='outlined'>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2.5,
            py: 1.5,
            cursor: 'pointer',
            '&:hover': { bgcolor: 'action.hover' }
          }}
          onClick={() => setCustomOpen(!customOpen)}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <i className={`tabler-chevron-${customOpen ? 'down' : 'right'} text-[16px]`} />
            <Typography variant='subtitle1' fontWeight={600}>
              Custom Attributes
            </Typography>
            <Chip
              label={`${customFields.length} field${customFields.length !== 1 ? 's' : ''} found`}
              size='small'
              variant='outlined'
              sx={{ height: 22, fontSize: '0.7rem' }}
            />
          </Box>
          <Chip label='FROM DATA' size='small' sx={{ bgcolor: 'success.main', color: 'white', fontWeight: 600, fontSize: '0.65rem', height: 22 }} />
        </Box>
        <Collapse in={customOpen}>
          {customFields.length === 0 ? (
            <Box sx={{ px: 2.5, py: 4, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>
              <i className='tabler-database-off text-[32px] text-gray-500 mb-2' />
              <Typography color='text.secondary'>
                No custom attributes found in your subscriber data.
              </Typography>
              <Typography variant='body2' color='text.disabled' sx={{ mt: 0.5 }}>
                Add attributes when creating subscribers or via CSV import.
                <br />
                Example: <code style={{ fontSize: '0.8rem' }}>{'{"city": "Kathmandu", "company": "NepseTrading"}'}</code>
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table size='medium'>
                <TableBody>
                  {customFields.map(field => (
                    <TableRow key={field.name} hover>
                      <TableCell sx={{ minWidth: 100 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <i className='tabler-variable text-[14px] text-gray-500' />
                          <Typography variant='body2' fontWeight={500}>{field.name}</Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ minWidth: 70, display: { xs: 'none', sm: 'table-cell' } }}>
                        <Chip label={field.type} size='small' variant='outlined' sx={{ height: 22, fontSize: '0.7rem' }} />
                      </TableCell>
                      <TableCell sx={{ minWidth: 180 }}>
                        <Typography
                          variant='body2'
                          sx={{
                            fontFamily: 'monospace',
                            bgcolor: 'action.hover',
                            px: 1,
                            py: 0.25,
                            borderRadius: 0.5,
                            display: 'inline-block',
                            fontSize: '0.75rem',
                            wordBreak: 'break-all'
                          }}
                        >
                          {field.tag}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 120, display: { xs: 'none', md: 'table-cell' } }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant='determinate'
                            value={scannedCount > 0 ? (field.usageCount / scannedCount) * 100 : 0}
                            sx={{ flex: 1, height: 6, borderRadius: 3 }}
                          />
                          <Typography variant='body2' color='text.secondary' fontSize='0.75rem' sx={{ whiteSpace: 'nowrap' }}>
                            {field.usageCount}/{scannedCount}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell sx={{ minWidth: 100, display: { xs: 'none', lg: 'table-cell' } }}>
                        {field.sampleValue && (
                          <Typography variant='body2' color='text.disabled' fontSize='0.75rem' noWrap>
                            e.g. {field.sampleValue}
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Collapse>
      </Card>

      {/* Merge Tag Help */}
      <Card variant='outlined'>
        <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
          <Typography variant='subtitle2' fontWeight={600} sx={{ mb: 1 }}>
            <i className='tabler-info-circle text-[16px] mr-1' style={{ verticalAlign: 'middle' }} />
            Using Merge Tags
          </Typography>
          <Typography variant='body2' color='text.secondary'>
            Copy any merge tag above and paste it into your email template. For example, use{' '}
            <code style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>
              {'{{ .Subscriber.Name }}'}
            </code>{' '}
            to personalize with the subscriber&apos;s name. Custom attributes use{' '}
            <code style={{ fontSize: '0.8rem', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: 4 }}>
              {'{{ .Subscriber.Attribs.<key> }}'}
            </code>{' '}
            format.
          </Typography>
        </CardContent>
      </Card>
    </div>
  )
}

export default SubscriberFields
