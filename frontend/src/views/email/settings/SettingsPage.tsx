'use client'

// React Imports
import { useState } from 'react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Tab from '@mui/material/Tab'
import TabContext from '@mui/lab/TabContext'
import TabList from '@mui/lab/TabList'
import TabPanel from '@mui/lab/TabPanel'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import Alert from '@mui/material/Alert'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import InputAdornment from '@mui/material/InputAdornment'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState('general')
  const [showPassword, setShowPassword] = useState(false)

  // General settings state
  const [siteName, setSiteName] = useState('My Email Platform')
  const [rootUrl, setRootUrl] = useState('https://mail.example.com')
  const [fromEmail, setFromEmail] = useState('noreply@example.com')
  const [notifyEmails, setNotifyEmails] = useState('admin@example.com')
  const [batchSize, setBatchSize] = useState('1000')
  const [concurrency, setConcurrency] = useState('5')
  const [maxSendErrors, setMaxSendErrors] = useState('1000')
  const [messageRate, setMessageRate] = useState('50')

  // SMTP settings state
  const [smtpHost, setSmtpHost] = useState('smtp.example.com')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUsername, setSmtpUsername] = useState('smtp_user')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [smtpAuthProtocol, setSmtpAuthProtocol] = useState('login')
  const [smtpTlsType, setSmtpTlsType] = useState('STARTTLS')
  const [smtpMaxConns, setSmtpMaxConns] = useState('5')
  const [smtpMaxRetries, setSmtpMaxRetries] = useState('2')

  // API Keys mock data
  const apiKeys = [
    {
      id: 1,
      name: 'Frontend App',
      key: 'lk-****-****-****-abc123',
      created_at: '2026-01-15',
      last_used: '2026-03-08',
      status: 'active'
    },
    {
      id: 2,
      name: 'Webhook Integration',
      key: 'lk-****-****-****-def456',
      created_at: '2026-02-20',
      last_used: '2026-03-05',
      status: 'active'
    },
    {
      id: 3,
      name: 'Old Integration',
      key: 'lk-****-****-****-ghi789',
      created_at: '2025-08-10',
      last_used: '2025-12-15',
      status: 'inactive'
    }
  ]

  return (
    <TabContext value={activeTab}>
      <Card>
        <CardHeader title='Settings' />
        <TabList onChange={(_, val) => setActiveTab(val)} className='border-be'>
          <Tab
            value='general'
            label='General'
            icon={<i className='tabler-settings text-[20px]' />}
            iconPosition='start'
          />
          <Tab
            value='smtp'
            label='SMTP'
            icon={<i className='tabler-mail-forward text-[20px]' />}
            iconPosition='start'
          />
          <Tab
            value='api'
            label='API Keys'
            icon={<i className='tabler-key text-[20px]' />}
            iconPosition='start'
          />
        </TabList>

        {/* General Settings Tab */}
        <TabPanel value='general'>
          <Grid container spacing={6}>
            <Grid size={{ xs: 12 }}>
              <Typography variant='h6' className='mb-4'>
                Application Settings
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='Site Name'
                value={siteName}
                onChange={e => setSiteName(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='Root URL'
                value={rootUrl}
                onChange={e => setRootUrl(e.target.value)}
                placeholder='https://your-domain.com'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='Default From Email'
                type='email'
                value={fromEmail}
                onChange={e => setFromEmail(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label='Notification Emails'
                value={notifyEmails}
                onChange={e => setNotifyEmails(e.target.value)}
                helperText='Comma-separated email addresses for admin notifications'
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Divider className='my-2' />
              <Typography variant='h6' className='mb-4 mt-4'>
                Performance Settings
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                label='Batch Size'
                type='number'
                value={batchSize}
                onChange={e => setBatchSize(e.target.value)}
                helperText='Emails per batch'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                label='Concurrency'
                type='number'
                value={concurrency}
                onChange={e => setConcurrency(e.target.value)}
                helperText='Parallel workers'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                label='Max Send Errors'
                type='number'
                value={maxSendErrors}
                onChange={e => setMaxSendErrors(e.target.value)}
                helperText='Before pausing campaign'
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                fullWidth
                label='Message Rate'
                type='number'
                value={messageRate}
                onChange={e => setMessageRate(e.target.value)}
                helperText='Messages per second'
              />
            </Grid>

            <Grid size={{ xs: 12 }}>
              <div className='flex justify-end gap-2'>
                <Button variant='outlined' color='secondary'>
                  Reset
                </Button>
                <Button variant='contained' startIcon={<i className='tabler-device-floppy' />}>
                  Save Settings
                </Button>
              </div>
            </Grid>
          </Grid>
        </TabPanel>

        {/* SMTP Settings Tab */}
        <TabPanel value='smtp'>
          <Grid container spacing={6}>
            <Grid size={{ xs: 12 }}>
              <Alert severity='info' className='mb-2'>
                Configure your SMTP server settings for sending emails. You can add multiple SMTP servers for failover.
              </Alert>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Card variant='outlined'>
                <CardHeader
                  title='Primary SMTP Server'
                  subheader='Main email delivery server'
                  action={
                    <Button
                      variant='outlined'
                      size='small'
                      startIcon={<i className='tabler-plug-connected' />}
                    >
                      Test Connection
                    </Button>
                  }
                />
                <CardContent>
                  <Grid container spacing={4}>
                    <Grid size={{ xs: 12, sm: 8 }}>
                      <TextField
                        fullWidth
                        label='SMTP Host'
                        value={smtpHost}
                        onChange={e => setSmtpHost(e.target.value)}
                        placeholder='smtp.example.com'
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        label='Port'
                        type='number'
                        value={smtpPort}
                        onChange={e => setSmtpPort(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label='Username'
                        value={smtpUsername}
                        onChange={e => setSmtpUsername(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        fullWidth
                        label='Password'
                        type={showPassword ? 'text' : 'password'}
                        value={smtpPassword}
                        onChange={e => setSmtpPassword(e.target.value)}
                        placeholder='Enter SMTP password'
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position='end'>
                              <IconButton onClick={() => setShowPassword(!showPassword)} edge='end' size='small'>
                                <i className={`tabler-${showPassword ? 'eye-off' : 'eye'} text-[20px]`} />
                              </IconButton>
                            </InputAdornment>
                          )
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormControl fullWidth>
                        <InputLabel>Auth Protocol</InputLabel>
                        <Select
                          value={smtpAuthProtocol}
                          label='Auth Protocol'
                          onChange={e => setSmtpAuthProtocol(e.target.value)}
                        >
                          <MenuItem value='login'>LOGIN</MenuItem>
                          <MenuItem value='cram'>CRAM-MD5</MenuItem>
                          <MenuItem value='plain'>PLAIN</MenuItem>
                          <MenuItem value='none'>None</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <FormControl fullWidth>
                        <InputLabel>TLS</InputLabel>
                        <Select
                          value={smtpTlsType}
                          label='TLS'
                          onChange={e => setSmtpTlsType(e.target.value)}
                        >
                          <MenuItem value='none'>None</MenuItem>
                          <MenuItem value='STARTTLS'>STARTTLS</MenuItem>
                          <MenuItem value='TLS'>TLS</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        label='Max Connections'
                        type='number'
                        value={smtpMaxConns}
                        onChange={e => setSmtpMaxConns(e.target.value)}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        fullWidth
                        label='Max Retries'
                        type='number'
                        value={smtpMaxRetries}
                        onChange={e => setSmtpMaxRetries(e.target.value)}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <div className='flex justify-between'>
                <Button variant='outlined' startIcon={<i className='tabler-plus' />}>
                  Add SMTP Server
                </Button>
                <div className='flex gap-2'>
                  <Button variant='outlined' color='secondary'>
                    Reset
                  </Button>
                  <Button variant='contained' startIcon={<i className='tabler-device-floppy' />}>
                    Save SMTP Settings
                  </Button>
                </div>
              </div>
            </Grid>
          </Grid>
        </TabPanel>

        {/* API Keys Tab */}
        <TabPanel value='api'>
          <Grid container spacing={6}>
            <Grid size={{ xs: 12 }}>
              <Alert severity='info'>
                API keys are used to authenticate with the email marketing API. Keep your keys secure and never share them publicly.
              </Alert>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <div className='flex justify-between items-center mb-4'>
                <Typography variant='h6'>API Keys</Typography>
                <Button variant='contained' startIcon={<i className='tabler-plus' />} size='small'>
                  Generate New Key
                </Button>
              </div>
              <Card variant='outlined'>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Key</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell>Last Used</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align='right'>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {apiKeys.map(key => (
                        <TableRow key={key.id} hover>
                          <TableCell>
                            <Typography className='font-medium' color='text.primary'>
                              {key.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <code className='text-sm'>{key.key}</code>
                          </TableCell>
                          <TableCell>
                            <Typography variant='body2'>{key.created_at}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant='body2'>{key.last_used}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={key.status === 'active' ? 'Active' : 'Inactive'}
                              color={key.status === 'active' ? 'success' : 'default'}
                              size='small'
                              variant='tonal'
                            />
                          </TableCell>
                          <TableCell align='right'>
                            <div className='flex items-center justify-end gap-1'>
                              <Tooltip title='Copy Key'>
                                <IconButton size='small'>
                                  <i className='tabler-copy text-[18px]' />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title={key.status === 'active' ? 'Revoke' : 'Activate'}>
                                <IconButton size='small'>
                                  <i className={`tabler-${key.status === 'active' ? 'ban' : 'check'} text-[18px]`} />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title='Delete'>
                                <IconButton size='small'>
                                  <i className='tabler-trash text-[18px]' />
                                </IconButton>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            </Grid>

            <Grid size={{ xs: 12 }}>
              <Card variant='outlined'>
                <CardHeader title='API Endpoint' />
                <CardContent>
                  <div className='flex flex-col gap-2'>
                    <Typography variant='body2' color='text.secondary'>
                      Base URL for all API requests:
                    </Typography>
                    <div className='flex items-center gap-2 p-3 rounded-lg bg-actionHover'>
                      <code className='grow'>{rootUrl}/api</code>
                      <Tooltip title='Copy'>
                        <IconButton size='small'>
                          <i className='tabler-copy text-[18px]' />
                        </IconButton>
                      </Tooltip>
                    </div>
                    <Typography variant='caption' color='text.secondary' className='mt-2'>
                      Include your API key in the Authorization header: <code>Authorization: token YOUR_API_KEY</code>
                    </Typography>
                  </div>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Card>
    </TabContext>
  )
}

export default SettingsPage
