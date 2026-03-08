'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Divider from '@mui/material/Divider'
import TextField from '@mui/material/TextField'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

interface SubscriberDetailProps {
  id: string
}

// Mock subscriber detail data
const subscriberData = {
  id: 1,
  uuid: 'a1b2c3',
  email: 'john.doe@example.com',
  name: 'John Doe',
  status: 'enabled' as const,
  lists: [
    { id: 1, name: 'Newsletter', subscriber_count: 500 },
    { id: 2, name: 'Product Updates', subscriber_count: 300 }
  ],
  attribs: {
    city: 'San Francisco',
    country: 'US',
    company: 'Acme Corp'
  },
  created_at: '2026-01-15T10:00:00Z',
  updated_at: '2026-02-20T14:30:00Z',
  campaigns: [
    { id: 1, name: 'March Newsletter', sent_at: '2026-03-01', opened: true, clicked: true },
    { id: 2, name: 'Product Launch', sent_at: '2026-02-15', opened: true, clicked: false },
    { id: 3, name: 'Weekly Tips #10', sent_at: '2026-02-08', opened: false, clicked: false }
  ]
}

const SubscriberDetail = ({ id }: SubscriberDetailProps) => {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(subscriberData.name)
  const [email, setEmail] = useState(subscriberData.email)

  return (
    <Grid container spacing={6}>
      {/* Subscriber Info Card */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardContent className='flex flex-col items-center gap-4 pt-8'>
            <CustomAvatar color='primary' skin='light' size={80}>
              <i className='tabler-user text-[40px]' />
            </CustomAvatar>
            <div className='text-center'>
              <Typography variant='h5'>{subscriberData.name}</Typography>
              <Typography color='text.secondary'>{subscriberData.email}</Typography>
            </div>
            <Chip label='Enabled' color='success' variant='tonal' />
          </CardContent>
          <Divider />
          <CardContent>
            <div className='flex flex-col gap-4'>
              <div className='flex justify-between'>
                <Typography color='text.secondary'>Created</Typography>
                <Typography className='font-medium'>
                  {new Date(subscriberData.created_at).toLocaleDateString()}
                </Typography>
              </div>
              <div className='flex justify-between'>
                <Typography color='text.secondary'>Updated</Typography>
                <Typography className='font-medium'>
                  {new Date(subscriberData.updated_at).toLocaleDateString()}
                </Typography>
              </div>
              <div className='flex justify-between'>
                <Typography color='text.secondary'>UUID</Typography>
                <Typography className='font-medium' variant='body2'>
                  {subscriberData.uuid}
                </Typography>
              </div>
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Edit / Details */}
      <Grid size={{ xs: 12, md: 8 }}>
        <Card>
          <CardHeader
            title='Subscriber Details'
            action={
              <Button
                variant={editing ? 'contained' : 'outlined'}
                onClick={() => setEditing(!editing)}
                startIcon={<i className={editing ? 'tabler-check' : 'tabler-pencil'} />}
              >
                {editing ? 'Save' : 'Edit'}
              </Button>
            }
          />
          <CardContent>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label='Name'
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={!editing}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  label='Email'
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  disabled={!editing}
                />
              </Grid>
            </Grid>
          </CardContent>
          <Divider />
          <CardHeader title='Attributes' />
          <CardContent>
            <Grid container spacing={4}>
              {Object.entries(subscriberData.attribs).map(([key, value]) => (
                <Grid size={{ xs: 12, sm: 6 }} key={key}>
                  <TextField fullWidth label={key.charAt(0).toUpperCase() + key.slice(1)} value={value} disabled={!editing} />
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      </Grid>

      {/* Lists */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Subscribed Lists' />
          <CardContent>
            <div className='flex flex-col gap-3'>
              {subscriberData.lists.map(list => (
                <div key={list.id} className='flex items-center justify-between p-3 rounded-lg border'>
                  <div className='flex items-center gap-3'>
                    <CustomAvatar color='primary' skin='light' variant='rounded' size={36}>
                      <i className='tabler-list text-[20px]' />
                    </CustomAvatar>
                    <div>
                      <Typography className='font-medium' color='text.primary'>
                        {list.name}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {list.subscriber_count} subscribers
                      </Typography>
                    </div>
                  </div>
                  <Chip label='Active' color='success' size='small' variant='tonal' />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </Grid>

      {/* Campaign History */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Card>
          <CardHeader title='Campaign History' />
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Campaign</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Opened</TableCell>
                  <TableCell>Clicked</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {subscriberData.campaigns.map(campaign => (
                  <TableRow key={campaign.id} hover>
                    <TableCell>
                      <Typography className='font-medium' color='text.primary'>
                        {campaign.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2'>{campaign.sent_at}</Typography>
                    </TableCell>
                    <TableCell>
                      <i
                        className={`tabler-${campaign.opened ? 'check' : 'x'} text-[20px]`}
                        style={{ color: campaign.opened ? 'var(--mui-palette-success-main)' : 'var(--mui-palette-text-secondary)' }}
                      />
                    </TableCell>
                    <TableCell>
                      <i
                        className={`tabler-${campaign.clicked ? 'check' : 'x'} text-[20px]`}
                        style={{ color: campaign.clicked ? 'var(--mui-palette-success-main)' : 'var(--mui-palette-text-secondary)' }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Grid>
    </Grid>
  )
}

export default SubscriberDetail
