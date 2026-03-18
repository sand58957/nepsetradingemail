'use client'

import { useState, useEffect } from 'react'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardHeader from '@mui/material/CardHeader'
import Grid from '@mui/material/Grid'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import Switch from '@mui/material/Switch'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Paper from '@mui/material/Paper'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Tooltip from '@mui/material/Tooltip'
import Divider from '@mui/material/Divider'

import { apiKeyService } from '@/services/apikeys'
import { creditService } from '@/services/apicredits'
import type { APIKey, CreditBalance, CreditTransaction } from '@/types/api'

const APIKeyManager = () => {
  const [keys, setKeys] = useState<APIKey[]>([])
  const [credits, setCredits] = useState<CreditBalance[]>([])
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [channelFilter, setChannelFilter] = useState<string>('')

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false)
  const [createChannel, setCreateChannel] = useState<'sms' | 'whatsapp' | 'email' | 'telegram' | 'messenger'>('sms')
  const [createName, setCreateName] = useState('')
  const [createIsTest, setCreateIsTest] = useState(false)
  const [createWebhook, setCreateWebhook] = useState('')

  // Key reveal dialog
  const [revealKey, setRevealKey] = useState<string | null>(null)
  const [revealSecret, setRevealSecret] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  useEffect(() => {
    loadData()
  }, [channelFilter])

  const loadData = async () => {
    try {
      setLoading(true)
      const [keysRes, creditsRes, txnRes] = await Promise.all([
        apiKeyService.list(channelFilter || undefined),
        creditService.getMyCredits(),
        creditService.getMyTransactions(channelFilter || undefined)
      ])
      setKeys(keysRes.data)
      setCredits(creditsRes.data)
      setTransactions(txnRes.data || [])
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to load API data', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      const res = await apiKeyService.create({
        channel: createChannel,
        name: createName || 'Default',
        is_test: createIsTest,
        webhook_url: createWebhook || undefined
      })
      setRevealKey(res.data.key)
      setRevealSecret(res.data.webhook_secret)
      setCreateOpen(false)
      setCreateName('')
      setCreateWebhook('')
      setCreateIsTest(false)
      loadData()
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to create key', severity: 'error' })
    }
  }

  const handleToggle = async (id: number) => {
    try {
      await apiKeyService.toggle(id)
      loadData()
    } catch {
      setSnackbar({ open: true, message: 'Failed to toggle key', severity: 'error' })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this API key? This cannot be undone.')) return
    try {
      await apiKeyService.delete(id)
      loadData()
      setSnackbar({ open: true, message: 'API key deleted', severity: 'success' })
    } catch {
      setSnackbar({ open: true, message: 'Failed to delete key', severity: 'error' })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getChannelColor = (channel: string): 'primary' | 'success' | 'warning' | 'info' | 'secondary' => {
    if (channel === 'sms') return 'primary'
    if (channel === 'whatsapp') return 'success'
    if (channel === 'telegram') return 'info'
    if (channel === 'messenger') return 'secondary'
    return 'warning'
  }

  const getCreditForChannel = (channel: string) => {
    return credits.find(c => c.channel === channel)
  }

  return (
    <Grid container spacing={6}>
      {/* Credit Balances */}
      <Grid size={{ xs: 12 }}>
        <Grid container spacing={4}>
          {['sms', 'whatsapp', 'email', 'telegram', 'messenger'].map(ch => {
            const credit = getCreditForChannel(ch)
            return (
              <Grid size={{ xs: 12, sm: 6, md: 2.4 }} key={ch}>
                <Card>
                  <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <Chip
                      label={ch.toUpperCase()}
                      color={getChannelColor(ch)}
                      size='small'
                      sx={{ mb: 2 }}
                    />
                    <Typography variant='h4' fontWeight='bold'>
                      {credit ? credit.balance.toLocaleString() : '0'}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      Credits Available
                    </Typography>
                    {credit && credit.reserved > 0 && (
                      <Typography variant='caption' color='warning.main'>
                        {credit.reserved} reserved
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
      </Grid>

      {/* Tabs */}
      <Grid size={{ xs: 12 }}>
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
              <Tab label='API Keys' />
              <Tab label='Transaction History' />
              <Tab label='Documentation' />
            </Tabs>
          </Box>

          {/* API Keys Tab */}
          {activeTab === 0 && (
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
                <FormControl size='small' sx={{ minWidth: 150 }}>
                  <InputLabel>Channel</InputLabel>
                  <Select value={channelFilter} label='Channel' onChange={e => setChannelFilter(e.target.value)}>
                    <MenuItem value=''>All Channels</MenuItem>
                    <MenuItem value='sms'>SMS</MenuItem>
                    <MenuItem value='whatsapp'>WhatsApp</MenuItem>
                    <MenuItem value='email'>Email</MenuItem>
                    <MenuItem value='telegram'>Telegram</MenuItem>
                    <MenuItem value='messenger'>Messenger</MenuItem>
                  </Select>
                </FormControl>
                <Button variant='contained' startIcon={<i className='tabler-plus' />} onClick={() => setCreateOpen(true)}>
                  Create API Key
                </Button>
              </Box>

              <TableContainer component={Paper} variant='outlined'>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Channel</TableCell>
                      <TableCell>Key Prefix</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Last Used</TableCell>
                      <TableCell align='right'>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {keys.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align='center' sx={{ py: 4 }}>
                          <Typography color='text.secondary'>No API keys yet. Create one to get started.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      keys.map(key => (
                        <TableRow key={key.id}>
                          <TableCell>{key.name}</TableCell>
                          <TableCell>
                            <Chip label={key.channel.toUpperCase()} color={getChannelColor(key.channel)} size='small' />
                          </TableCell>
                          <TableCell>
                            <Typography variant='body2' fontFamily='monospace' fontSize={12}>
                              {key.key_prefix}...
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={key.is_test ? 'Test' : 'Live'}
                              color={key.is_test ? 'default' : 'success'}
                              size='small'
                              variant='outlined'
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={key.is_active ? 'Active' : 'Inactive'}
                              color={key.is_active ? 'success' : 'default'}
                              size='small'
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant='body2' color='text.secondary'>
                              {key.last_used_at ? new Date(key.last_used_at).toLocaleDateString() : 'Never'}
                            </Typography>
                          </TableCell>
                          <TableCell align='right'>
                            <Tooltip title={key.is_active ? 'Disable' : 'Enable'}>
                              <IconButton size='small' onClick={() => handleToggle(key.id)}>
                                <i className={key.is_active ? 'tabler-toggle-right' : 'tabler-toggle-left'} />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title='Delete'>
                              <IconButton size='small' color='error' onClick={() => handleDelete(key.id)}>
                                <i className='tabler-trash' />
                              </IconButton>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          )}

          {/* Transaction History Tab */}
          {activeTab === 1 && (
            <CardContent>
              <TableContainer component={Paper} variant='outlined'>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Channel</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align='right'>Amount</TableCell>
                      <TableCell align='right'>Balance After</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align='center' sx={{ py: 4 }}>
                          <Typography color='text.secondary'>No transactions yet.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map(txn => (
                        <TableRow key={txn.id}>
                          <TableCell>{new Date(txn.created_at).toLocaleString()}</TableCell>
                          <TableCell>
                            <Chip label={txn.channel.toUpperCase()} color={getChannelColor(txn.channel)} size='small' />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={txn.type.replace('_', ' ')}
                              size='small'
                              variant='outlined'
                              color={txn.amount > 0 ? 'success' : 'error'}
                            />
                          </TableCell>
                          <TableCell align='right'>
                            <Typography color={txn.amount > 0 ? 'success.main' : 'error.main'} fontWeight='bold'>
                              {txn.amount > 0 ? '+' : ''}{txn.amount}
                            </Typography>
                          </TableCell>
                          <TableCell align='right'>{txn.balance_after}</TableCell>
                          <TableCell>{txn.description || '-'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          )}

          {/* Documentation Tab */}
          {activeTab === 2 && (
            <CardContent>
              <Typography variant='h6' gutterBottom>API Endpoints</Typography>
              <Divider sx={{ mb: 3 }} />

              {[
                {
                  title: 'SMS API (Aakash SMS)',
                  base: '/api/v1/sms',
                  endpoints: [
                    { method: 'GET', path: '/settings', desc: 'Get SMS settings (sender ID, send rate)' },
                    { method: 'PUT', path: '/settings', desc: 'Update SMS settings (auth token, sender ID)' },
                    { method: 'POST', path: '/settings/test', desc: 'Test Aakash SMS connection' },
                    { method: 'POST', path: '/send', desc: 'Send single SMS message' },
                    { method: 'POST', path: '/send/bulk', desc: 'Send bulk SMS (max 100 recipients)' },
                    { method: 'GET', path: '/contacts', desc: 'List all SMS contacts (paginated)' },
                    { method: 'POST', path: '/contacts', desc: 'Add a new SMS contact' },
                    { method: 'PUT', path: '/contacts/:id', desc: 'Update contact details & groups' },
                    { method: 'DELETE', path: '/contacts/:id', desc: 'Delete a contact' },
                    { method: 'POST', path: '/contacts/import', desc: 'Import contacts from CSV' },
                    { method: 'GET', path: '/contacts/export', desc: 'Export contacts to CSV' },
                    { method: 'GET', path: '/contacts/tags', desc: 'List all contact tags with counts' },
                    { method: 'GET', path: '/groups', desc: 'List contact groups with member counts' },
                    { method: 'POST', path: '/groups', desc: 'Create a new contact group' },
                    { method: 'PUT', path: '/groups/:id', desc: 'Update group name/description' },
                    { method: 'DELETE', path: '/groups/:id', desc: 'Delete a group (cascade members)' },
                    { method: 'POST', path: '/groups/:id/members', desc: 'Add contacts to group' },
                    { method: 'DELETE', path: '/groups/:id/members', desc: 'Remove contacts from group' },
                    { method: 'GET', path: '/campaigns', desc: 'List all SMS campaigns' },
                    { method: 'POST', path: '/campaigns', desc: 'Create a new campaign' },
                    { method: 'POST', path: '/campaigns/:id/send', desc: 'Send/schedule a campaign' },
                    { method: 'GET', path: '/campaigns/:id', desc: 'Get campaign details & stats' },
                    { method: 'GET', path: '/messages', desc: 'List sent messages with status' },
                    { method: 'GET', path: '/messages/:id', desc: 'Get single message status' },
                    { method: 'GET', path: '/balance', desc: 'Check SMS credit balance' },
                    { method: 'GET', path: '/overview', desc: 'Dashboard overview stats' }
                  ]
                },
                {
                  title: 'WhatsApp API (Gupshup)',
                  base: '/api/v1/whatsapp',
                  endpoints: [
                    { method: 'GET', path: '/settings', desc: 'Get WhatsApp settings (app ID, phone, WABA ID)' },
                    { method: 'PUT', path: '/settings', desc: 'Update WhatsApp settings (API key, app name)' },
                    { method: 'POST', path: '/settings/test', desc: 'Test Gupshup connection & check balance' },
                    { method: 'POST', path: '/send', desc: 'Send WhatsApp message (text or template)' },
                    { method: 'POST', path: '/send/bulk', desc: 'Send bulk WhatsApp messages (max 100)' },
                    { method: 'GET', path: '/contacts', desc: 'List all WhatsApp contacts (paginated)' },
                    { method: 'POST', path: '/contacts', desc: 'Add a new WhatsApp contact' },
                    { method: 'PUT', path: '/contacts/:id', desc: 'Update contact details & groups' },
                    { method: 'DELETE', path: '/contacts/:id', desc: 'Delete a contact' },
                    { method: 'POST', path: '/contacts/import', desc: 'Import contacts from CSV' },
                    { method: 'GET', path: '/contacts/export', desc: 'Export contacts to CSV' },
                    { method: 'GET', path: '/contacts/tags', desc: 'List all contact tags with counts' },
                    { method: 'GET', path: '/groups', desc: 'List contact groups with member counts' },
                    { method: 'POST', path: '/groups', desc: 'Create a new contact group' },
                    { method: 'PUT', path: '/groups/:id', desc: 'Update group name/description' },
                    { method: 'DELETE', path: '/groups/:id', desc: 'Delete a group (cascade members)' },
                    { method: 'POST', path: '/groups/:id/members', desc: 'Add contacts to group' },
                    { method: 'DELETE', path: '/groups/:id/members', desc: 'Remove contacts from group' },
                    { method: 'GET', path: '/campaigns', desc: 'List all WhatsApp campaigns' },
                    { method: 'POST', path: '/campaigns', desc: 'Create a new campaign' },
                    { method: 'POST', path: '/campaigns/:id/send', desc: 'Send/schedule a campaign' },
                    { method: 'GET', path: '/campaigns/:id', desc: 'Get campaign details & stats' },
                    { method: 'GET', path: '/templates', desc: 'List approved WhatsApp templates' },
                    { method: 'POST', path: '/templates/sync', desc: 'Sync templates from Gupshup' },
                    { method: 'GET', path: '/messages', desc: 'List sent messages with delivery status' },
                    { method: 'GET', path: '/messages/:id', desc: 'Get single message status' },
                    { method: 'GET', path: '/balance', desc: 'Check WhatsApp credit balance' },
                    { method: 'GET', path: '/overview', desc: 'Dashboard overview stats' }
                  ]
                },
                {
                  title: 'Email API (Listmonk)',
                  base: '/api/v1/email',
                  endpoints: [
                    { method: 'POST', path: '/send', desc: 'Send single email' },
                    { method: 'POST', path: '/send/bulk', desc: 'Send bulk emails (max 100)' },
                    { method: 'GET', path: '/messages', desc: 'List sent messages' },
                    { method: 'GET', path: '/messages/:id', desc: 'Get message status' },
                    { method: 'GET', path: '/balance', desc: 'Check email credit balance' },
                    { method: 'GET', path: '/domains', desc: 'List verified domains' }
                  ]
                },
                {
                  title: 'Telegram Bot API',
                  base: '/api/v1/telegram',
                  endpoints: [
                    { method: 'GET', path: '/settings', desc: 'Get bot settings (token, username, webhook)' },
                    { method: 'PUT', path: '/settings', desc: 'Update bot settings (token, send rate)' },
                    { method: 'POST', path: '/settings/test', desc: 'Test bot connection' },
                    { method: 'GET', path: '/contacts', desc: 'List all subscribers (paginated)' },
                    { method: 'POST', path: '/contacts', desc: 'Add a new contact manually' },
                    { method: 'PUT', path: '/contacts/:id', desc: 'Update contact details & groups' },
                    { method: 'DELETE', path: '/contacts/:id', desc: 'Delete a contact' },
                    { method: 'POST', path: '/contacts/import', desc: 'Import contacts from CSV' },
                    { method: 'GET', path: '/contacts/export', desc: 'Export contacts to CSV' },
                    { method: 'GET', path: '/contacts/stats', desc: 'Get subscriber statistics' },
                    { method: 'GET', path: '/groups', desc: 'List contact groups' },
                    { method: 'POST', path: '/groups', desc: 'Create a new group' },
                    { method: 'PUT', path: '/groups/:id', desc: 'Update group details' },
                    { method: 'DELETE', path: '/groups/:id', desc: 'Delete a group' },
                    { method: 'POST', path: '/groups/:id/members', desc: 'Add members to group' },
                    { method: 'DELETE', path: '/groups/:id/members', desc: 'Remove members from group' },
                    { method: 'GET', path: '/campaigns', desc: 'List campaigns' },
                    { method: 'POST', path: '/campaigns', desc: 'Create a new campaign' },
                    { method: 'POST', path: '/campaigns/:id/send', desc: 'Send a campaign' },
                    { method: 'GET', path: '/overview', desc: 'Dashboard overview stats' }
                  ]
                },
                {
                  title: 'Messenger API (Facebook Page)',
                  base: '/api/v1/messenger',
                  endpoints: [
                    { method: 'GET', path: '/settings', desc: 'Get Messenger settings (page ID, app ID, webhook)' },
                    { method: 'PUT', path: '/settings', desc: 'Update settings (page token, app secret, opt-in keyword)' },
                    { method: 'POST', path: '/settings/test', desc: 'Test Facebook Page connection' },
                    { method: 'POST', path: '/settings/generate-keyword', desc: 'Generate random opt-in keyword' },
                    { method: 'POST', path: '/settings/qr', desc: 'Upload QR code image' },
                    { method: 'DELETE', path: '/settings/qr', desc: 'Remove QR code image' },
                    { method: 'GET', path: '/contacts', desc: 'List all Messenger contacts (paginated)' },
                    { method: 'POST', path: '/contacts', desc: 'Add contact manually by PSID' },
                    { method: 'PUT', path: '/contacts/:id', desc: 'Update contact details & groups' },
                    { method: 'DELETE', path: '/contacts/:id', desc: 'Delete a contact' },
                    { method: 'POST', path: '/contacts/import', desc: 'Import contacts from CSV' },
                    { method: 'GET', path: '/contacts/export', desc: 'Export contacts to CSV' },
                    { method: 'GET', path: '/contacts/tags', desc: 'List all contact tags with counts' },
                    { method: 'GET', path: '/groups', desc: 'List contact groups with member counts' },
                    { method: 'POST', path: '/groups', desc: 'Create a new contact group' },
                    { method: 'PUT', path: '/groups/:id', desc: 'Update group name/description' },
                    { method: 'DELETE', path: '/groups/:id', desc: 'Delete a group (cascade members)' },
                    { method: 'POST', path: '/groups/:id/members', desc: 'Add contacts to group' },
                    { method: 'DELETE', path: '/groups/:id/members', desc: 'Remove contacts from group' },
                    { method: 'GET', path: '/campaigns', desc: 'List all Messenger campaigns' },
                    { method: 'POST', path: '/campaigns', desc: 'Create a new campaign (text + image)' },
                    { method: 'POST', path: '/campaigns/:id/send', desc: 'Send/schedule a campaign' },
                    { method: 'GET', path: '/campaigns/:id', desc: 'Get campaign details & delivery stats' },
                    { method: 'GET', path: '/overview', desc: 'Dashboard overview stats' }
                  ]
                }
              ].map(section => (
                <Box key={section.title} sx={{ mb: 4 }}>
                  <Typography variant='subtitle1' fontWeight='bold' gutterBottom>{section.title}</Typography>
                  <Typography variant='body2' color='text.secondary' gutterBottom>
                    Base URL: <code>https://nepalfillings.com{section.base}</code>
                  </Typography>
                  <TableContainer component={Paper} variant='outlined' sx={{ mt: 1 }}>
                    <Table size='small'>
                      <TableBody>
                        {section.endpoints.map((ep, i) => (
                          <TableRow key={i}>
                            <TableCell sx={{ width: 80 }}>
                              <Chip label={ep.method} size='small' color={ep.method === 'POST' ? 'primary' : 'default'} />
                            </TableCell>
                            <TableCell>
                              <Typography variant='body2' fontFamily='monospace'>{ep.path}</Typography>
                            </TableCell>
                            <TableCell>{ep.desc}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ))}

              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>Authentication</Typography>
              <Alert severity='info' sx={{ mb: 2 }}>
                Include your API key in the Authorization header:
                <Box component='pre' sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto' }}>
                  {`Authorization: Bearer nf_sms_your_api_key_here`}
                </Box>
              </Alert>

              <Typography variant='h6' gutterBottom>Send SMS Example</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl -X POST https://nepalfillings.com/api/v1/sms/send \\
  -H "Authorization: Bearer nf_sms_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "9812345678",
    "message": "Hello from API!"
  }'`}
              </Box>

              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>Telegram Bot Integration</Typography>

              <Alert severity='info' sx={{ mb: 3 }}>
                <Typography variant='subtitle2' gutterBottom>Subscription Method (Password-Gated)</Typography>
                <Typography variant='body2'>
                  Users subscribe to your Telegram bot by sending <strong>/start PAID4283</strong> (with the subscription code).
                  Without the correct code, the bot will reject the subscription. They are automatically added to your contact list upon valid code.
                  When they send <strong>/stop</strong>, they are automatically opted out.
                </Typography>
              </Alert>

              <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                  <i className='tabler-settings' style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  Bot Setup Details
                </Typography>
                <Table size='small'>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 180 }}>Bot Username</TableCell>
                      <TableCell><code>@nepsemarket_alert_bot</code></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Bot Link</TableCell>
                      <TableCell><a href='https://t.me/nepsemarket_alert_bot' target='_blank' rel='noopener'>https://t.me/nepsemarket_alert_bot</a></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Webhook Endpoint</TableCell>
                      <TableCell><code>POST /telegram/:webhook_secret</code></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Subscribe Command</TableCell>
                      <TableCell><code>/start PAID4283</code> — Requires valid code to subscribe</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Subscription Code</TableCell>
                      <TableCell><code>PAID4283</code> — Required access code for new subscribers</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Unsubscribe Command</TableCell>
                      <TableCell><code>/stop</code> — Opts out user from campaigns</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Auto-Captured Data</TableCell>
                      <TableCell>Chat ID, Username, First Name, Last Name</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom>Send Telegram Message Example</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl -X POST https://nepalfillings.com/api/v1/telegram/campaigns \\
  -H "Authorization: Bearer nf_telegram_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Market Alert",
    "message_text": "NEPSE is up 2.5% today! 📈",
    "message_type": "text",
    "target_filter": {
      "opted_in": true
    }
  }'`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>List Subscribers Example</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl https://nepalfillings.com/api/v1/telegram/contacts \\
  -H "Authorization: Bearer nf_telegram_your_key"

# Response:
{
  "results": [
    {
      "chat_id": 5835919308,
      "username": "tarkaraj",
      "name": "Tarka Raj",
      "opted_in": true,
      "opted_in_at": "2025-12-15T10:30:00Z"
    }
  ],
  "total": 2,
  "page": 1,
  "per_page": 50
}`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>Add Contact to Group Example</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl -X POST https://nepalfillings.com/api/v1/telegram/groups/1/members \\
  -H "Authorization: Bearer nf_telegram_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contact_ids": [1, 2, 3]
  }'`}
              </Box>

              {/* ============== SMS Integration ============== */}
              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>SMS Integration (Aakash SMS)</Typography>

              <Alert severity='info' sx={{ mb: 3 }}>
                <Typography variant='subtitle2' gutterBottom>How SMS Works</Typography>
                <Typography variant='body2'>
                  SMS messages are sent through <strong>Aakash SMS</strong>, Nepal&apos;s leading bulk SMS provider.
                  You need to configure your Aakash SMS credentials (auth token &amp; sender ID) in Settings before sending.
                  Each SMS consumes <strong>1 credit</strong> per message. Bulk sending supports up to 100 recipients per request.
                  Messages are queued and sent at the configured rate limit to avoid throttling.
                </Typography>
              </Alert>

              <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                  <i className='tabler-settings' style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  SMS Setup Details
                </Typography>
                <Table size='small'>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 180 }}>Provider</TableCell>
                      <TableCell>Aakash SMS (<a href='https://aakashsms.com' target='_blank' rel='noopener'>aakashsms.com</a>)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Auth Token</TableCell>
                      <TableCell>Obtained from your Aakash SMS dashboard → API section</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Sender ID</TableCell>
                      <TableCell>Your registered sender ID (e.g., <code>InfoAlert</code>, <code>NepseTrade</code>)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Credit Cost</TableCell>
                      <TableCell><strong>1 credit</strong> per SMS message (160 characters max per segment)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Bulk Limit</TableCell>
                      <TableCell>Max <strong>100 recipients</strong> per bulk API call</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Rate Limit</TableCell>
                      <TableCell>Configurable per API key (default: 60 requests/minute)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Contact Fields</TableCell>
                      <TableCell>Phone number (required), Name, Tags, Groups</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>API Key Format</TableCell>
                      <TableCell><code>nf_sms_xxxxxxxx...</code> (live) or <code>nf_test_sms_xxxxxxxx...</code> (test)</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom>Send Single SMS</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl -X POST https://nepalfillings.com/api/v1/sms/send \\
  -H "Authorization: Bearer nf_sms_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "9812345678",
    "message": "Hello from NEPSE Trading! Your portfolio is up 5% today."
  }'

# Response:
{
  "id": 123,
  "status": "sent",
  "credits_charged": 1,
  "message": "SMS sent successfully"
}`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>Send Bulk SMS</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl -X POST https://nepalfillings.com/api/v1/sms/send/bulk \\
  -H "Authorization: Bearer nf_sms_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipients": ["9812345678", "9823456789", "9834567890"],
    "message": "NEPSE Market Alert: Banking sector up 3.2%!"
  }'

# Response:
{
  "total": 3,
  "sent": 3,
  "failed": 0,
  "credits_charged": 3
}`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>Create SMS Campaign</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl -X POST https://nepalfillings.com/api/v1/sms/campaigns \\
  -H "Authorization: Bearer nf_sms_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Weekly Market Update",
    "message": "NEPSE closed at 2,450 (+1.5%). Top gainers: NABIL, SCB, HBL.",
    "target_filter": {
      "tags": ["premium"],
      "groups": [1, 2]
    }
  }'`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>Manage SMS Contacts</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`# Add a contact
curl -X POST https://nepalfillings.com/api/v1/sms/contacts \\
  -H "Authorization: Bearer nf_sms_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "9812345678",
    "name": "Ram Bahadur",
    "tags": ["investor", "premium"]
  }'

# List contacts
curl https://nepalfillings.com/api/v1/sms/contacts?page=1 \\
  -H "Authorization: Bearer nf_sms_your_key"

# Import from CSV
curl -X POST https://nepalfillings.com/api/v1/sms/contacts/import \\
  -H "Authorization: Bearer nf_sms_your_key" \\
  -F "file=@contacts.csv"

# Check balance
curl https://nepalfillings.com/api/v1/sms/balance \\
  -H "Authorization: Bearer nf_sms_your_key"

# Response:
{
  "channel": "sms",
  "balance": 5000,
  "reserved": 0
}`}
              </Box>

              {/* ============== WhatsApp Integration ============== */}
              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>WhatsApp Integration (Gupshup)</Typography>

              <Alert severity='info' sx={{ mb: 3 }}>
                <Typography variant='subtitle2' gutterBottom>How WhatsApp Works</Typography>
                <Typography variant='body2'>
                  WhatsApp messages are sent through <strong>Gupshup</strong>, a Meta-approved Business Solution Provider (BSP).
                  You must configure your Gupshup credentials (API key, App Name, Source Phone) in Settings.
                  WhatsApp requires <strong>pre-approved templates</strong> for outbound messages outside the 24-hour conversation window.
                  Use the template sync feature to pull your approved templates from Gupshup.
                  Each message consumes <strong>1 credit</strong>.
                </Typography>
              </Alert>

              <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                  <i className='tabler-settings' style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  WhatsApp Setup Details
                </Typography>
                <Table size='small'>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 180 }}>Provider</TableCell>
                      <TableCell>Gupshup (<a href='https://www.gupshup.io' target='_blank' rel='noopener'>gupshup.io</a>)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>API Key</TableCell>
                      <TableCell>Obtained from Gupshup Dashboard → API Keys</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>App Name</TableCell>
                      <TableCell>Your Gupshup app name (created in Gupshup dashboard)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Source Phone</TableCell>
                      <TableCell>Your WhatsApp Business phone number (e.g., <code>9779800000000</code>)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>WABA ID</TableCell>
                      <TableCell>WhatsApp Business Account ID from Meta Business Manager</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Templates</TableCell>
                      <TableCell>Pre-approved message templates required for outbound messages (sync from Gupshup)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Credit Cost</TableCell>
                      <TableCell><strong>1 credit</strong> per WhatsApp message</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Bulk Limit</TableCell>
                      <TableCell>Max <strong>100 recipients</strong> per bulk API call</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Rate Limit</TableCell>
                      <TableCell>Configurable per API key (default: 60 requests/minute)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Contact Fields</TableCell>
                      <TableCell>Phone number (required), Name, Tags, Groups, Opt-in status</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>API Key Format</TableCell>
                      <TableCell><code>nf_whatsapp_xxxxxxxx...</code> (live) or <code>nf_test_whatsapp_xxxxxxxx...</code> (test)</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom>Send WhatsApp Template Message</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl -X POST https://nepalfillings.com/api/v1/whatsapp/send \\
  -H "Authorization: Bearer nf_whatsapp_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "9779812345678",
    "template_id": "market_alert_v1",
    "params": {
      "1": "NEPSE Index",
      "2": "2,450.30",
      "3": "+1.5%"
    }
  }'

# Response:
{
  "id": 456,
  "status": "sent",
  "provider_message_id": "gupshup_msg_abc123",
  "credits_charged": 1
}`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>Send Bulk WhatsApp Messages</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl -X POST https://nepalfillings.com/api/v1/whatsapp/send/bulk \\
  -H "Authorization: Bearer nf_whatsapp_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recipients": ["9779812345678", "9779823456789"],
    "template_id": "daily_update",
    "params": {
      "1": "March 17, 2026",
      "2": "2,450.30"
    }
  }'`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>Create WhatsApp Campaign</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl -X POST https://nepalfillings.com/api/v1/whatsapp/campaigns \\
  -H "Authorization: Bearer nf_whatsapp_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "IPO Alert Campaign",
    "template_id": "ipo_alert",
    "params": {
      "1": "Global IME Bank",
      "2": "2026-03-20",
      "3": "Rs. 100"
    },
    "target_filter": {
      "tags": ["ipo-interested"],
      "groups": [1]
    }
  }'`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>Sync & List Templates</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`# Sync templates from Gupshup
curl -X POST https://nepalfillings.com/api/v1/whatsapp/templates/sync \\
  -H "Authorization: Bearer nf_whatsapp_your_key"

# List approved templates
curl https://nepalfillings.com/api/v1/whatsapp/templates \\
  -H "Authorization: Bearer nf_whatsapp_your_key"

# Response:
{
  "results": [
    {
      "id": "market_alert_v1",
      "name": "Market Alert",
      "category": "MARKETING",
      "status": "APPROVED",
      "language": "en",
      "components": [...]
    }
  ]
}`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>Manage WhatsApp Contacts</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`# Add a contact
curl -X POST https://nepalfillings.com/api/v1/whatsapp/contacts \\
  -H "Authorization: Bearer nf_whatsapp_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "phone": "9779812345678",
    "name": "Sita Sharma",
    "tags": ["investor", "premium"],
    "opted_in": true
  }'

# List contacts
curl https://nepalfillings.com/api/v1/whatsapp/contacts?page=1 \\
  -H "Authorization: Bearer nf_whatsapp_your_key"

# Check balance
curl https://nepalfillings.com/api/v1/whatsapp/balance \\
  -H "Authorization: Bearer nf_whatsapp_your_key"`}
              </Box>

              {/* ============== Messenger Integration ============== */}
              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>Messenger Integration (Facebook Page)</Typography>

              <Alert severity='info' sx={{ mb: 3 }}>
                <Typography variant='subtitle2' gutterBottom>How Messenger Works</Typography>
                <Typography variant='body2'>
                  Messenger contacts are collected when users message your <strong>Facebook Page</strong> with the opt-in keyword.
                  Each contact has a unique <strong>PSID (Page-Scoped ID)</strong> assigned by Facebook.
                  Due to Facebook&apos;s <strong>24-hour messaging policy</strong>, you can only send messages to users who interacted
                  with your page within the last 24 hours, unless you use approved <strong>Message Tags</strong> (e.g., account updates, confirmed events).
                  Each message consumes <strong>1 credit</strong>. Share the <code>m.me/PAGE_ID?ref=KEYWORD</code> link or QR code for easy subscription.
                </Typography>
              </Alert>

              <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                  <i className='tabler-settings' style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  Messenger Setup Details
                </Typography>
                <Table size='small'>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 180 }}>Platform</TableCell>
                      <TableCell>Facebook Messenger via Graph API</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Facebook Page</TableCell>
                      <TableCell>NEPSE Trading (ID: <code>104960767808713</code>)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Page Token</TableCell>
                      <TableCell>Long-lived Page Access Token from Facebook Developer Console</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>App Secret</TableCell>
                      <TableCell>Facebook App Secret for webhook signature verification</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Webhook Endpoint</TableCell>
                      <TableCell><code>POST /messenger/:account_id/webhook</code></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Opt-in Keyword</TableCell>
                      <TableCell>Users send this keyword to subscribe (e.g., <code>XYBJKJQ3</code>)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Subscribe Link</TableCell>
                      <TableCell><code>https://m.me/104960767808713?ref=XYBJKJQ3</code></TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>24-Hour Policy</TableCell>
                      <TableCell>Free messaging within 24h of user interaction; Message Tags required after</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Credit Cost</TableCell>
                      <TableCell><strong>1 credit</strong> per Messenger message</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Auto-Captured Data</TableCell>
                      <TableCell>PSID, Facebook Name, Profile Picture URL, Opt-in timestamp</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Contact Fields</TableCell>
                      <TableCell>PSID (required), Name, Tags, Groups, Opted-in status</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>API Key Format</TableCell>
                      <TableCell><code>nf_messenger_xxxxxxxx...</code> (live) or <code>nf_test_messenger_xxxxxxxx...</code> (test)</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom>Send Messenger Message</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl -X POST https://nepalfillings.com/api/v1/messenger/send \\
  -H "Authorization: Bearer nf_messenger_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "7835919308",
    "message": "NEPSE closed at 2,450 today! Your portfolio is up 3.2%."
  }'

# Response:
{
  "id": 789,
  "status": "sent",
  "provider_message_id": "mid.$cAABb...",
  "credits_charged": 1
}`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>Send Message with Image</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl -X POST https://nepalfillings.com/api/v1/messenger/send \\
  -H "Authorization: Bearer nf_messenger_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "7835919308",
    "message": "Today'"'"'s NEPSE Chart 📊",
    "image_url": "https://cdn.example.com/nepse-chart-2026-03-17.png"
  }'`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>Create Messenger Campaign</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl -X POST https://nepalfillings.com/api/v1/messenger/campaigns \\
  -H "Authorization: Bearer nf_messenger_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Daily Market Summary",
    "message_text": "📈 NEPSE Daily Update\\n\\nIndex: 2,450.30 (+1.5%)\\nTurnover: Rs. 5.2B\\nTop Gainer: NABIL (+5.2%)",
    "image_url": "https://cdn.example.com/daily-chart.png",
    "target_filter": {
      "tags": ["daily-subscriber"],
      "groups": [1, 3]
    }
  }'`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>Manage Messenger Contacts</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`# List contacts
curl https://nepalfillings.com/api/v1/messenger/contacts?page=1 \\
  -H "Authorization: Bearer nf_messenger_your_key"

# Response:
{
  "results": [
    {
      "id": 1,
      "psid": "7835919308",
      "name": "Tarka Raj Joshi",
      "profile_pic": "https://platform-lookaside.fbsbx.com/...",
      "opted_in": true,
      "opted_in_at": "2026-03-15T10:30:00Z",
      "tags": ["premium", "daily-subscriber"],
      "last_interaction": "2026-03-17T08:00:00Z"
    }
  ],
  "total": 150,
  "page": 1,
  "per_page": 50
}

# Add contact manually
curl -X POST https://nepalfillings.com/api/v1/messenger/contacts \\
  -H "Authorization: Bearer nf_messenger_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "psid": "7835919308",
    "name": "Tarka Raj Joshi",
    "tags": ["investor"]
  }'

# Check balance
curl https://nepalfillings.com/api/v1/messenger/balance \\
  -H "Authorization: Bearer nf_messenger_your_key"

# Get dashboard overview
curl https://nepalfillings.com/api/v1/messenger/overview \\
  -H "Authorization: Bearer nf_messenger_your_key"`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>QR Code & Opt-in Settings</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`# Generate a new opt-in keyword
curl -X POST https://nepalfillings.com/api/v1/messenger/settings/generate-keyword \\
  -H "Authorization: Bearer nf_messenger_your_key"

# Response:
{
  "keyword": "XYBJKJQ3",
  "subscribe_link": "https://m.me/104960767808713?ref=XYBJKJQ3"
}

# Upload QR code image
curl -X POST https://nepalfillings.com/api/v1/messenger/settings/qr \\
  -H "Authorization: Bearer nf_messenger_your_key" \\
  -F "file=@messenger-qr.png"

# Remove QR code
curl -X DELETE https://nepalfillings.com/api/v1/messenger/settings/qr \\
  -H "Authorization: Bearer nf_messenger_your_key"`}
              </Box>

              {/* ============== Email Integration ============== */}
              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>Email Integration</Typography>

              <Alert severity='info' sx={{ mb: 3 }}>
                <Typography variant='subtitle2' gutterBottom>How Email Works</Typography>
                <Typography variant='body2'>
                  Email campaigns are powered by <strong>Listmonk</strong> (self-hosted newsletter engine) with delivery through
                  your configured SMTP provider (SendGrid, Amazon SES, Mailgun, Postmark, etc.).
                  You must verify a <strong>sending domain</strong> with SPF, DKIM, and DMARC records before sending.
                  Each email consumes <strong>1 credit</strong>. Subscriber management happens through Listmonk lists.
                </Typography>
              </Alert>

              <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                  <i className='tabler-settings' style={{ marginRight: 8, verticalAlign: 'middle' }} />
                  Email Setup Details
                </Typography>
                <Table size='small'>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 180 }}>Engine</TableCell>
                      <TableCell>Listmonk (self-hosted, open-source)</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>SMTP Providers</TableCell>
                      <TableCell>SendGrid, Amazon SES, Mailgun, Postmark, or any SMTP server</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Domain Verification</TableCell>
                      <TableCell>Required: SPF, DKIM, and DMARC DNS records on your sending domain</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Credit Cost</TableCell>
                      <TableCell><strong>1 credit</strong> per email sent</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Bulk Limit</TableCell>
                      <TableCell>Max <strong>100 recipients</strong> per bulk API call</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>API Key Format</TableCell>
                      <TableCell><code>nf_email_xxxxxxxx...</code> (live) or <code>nf_test_email_xxxxxxxx...</code> (test)</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom>Send Email</Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`curl -X POST https://nepalfillings.com/api/v1/email/send \\
  -H "Authorization: Bearer nf_email_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "investor@example.com",
    "from": "alerts@yourdomain.com",
    "subject": "NEPSE Daily Market Summary - March 17, 2026",
    "html": "<h1>Market Summary</h1><p>NEPSE Index: 2,450.30 (+1.5%)</p>",
    "text": "Market Summary\\nNEPSE Index: 2,450.30 (+1.5%)"
  }'

# Response:
{
  "id": 101,
  "status": "queued",
  "credits_charged": 1
}`}
              </Box>

              {/* ============== Credit Management ============== */}
              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>Credit Management</Typography>

              <Alert severity='warning' sx={{ mb: 3 }}>
                <Typography variant='subtitle2' gutterBottom>How Credits Work</Typography>
                <Typography variant='body2'>
                  Each channel (SMS, WhatsApp, Email, Telegram, Messenger) has its own <strong>separate credit balance</strong>.
                  Credits are deducted when messages are sent successfully. In test mode, no credits are charged.
                  When sending a campaign, credits are <strong>reserved</strong> first, then confirmed after delivery, or <strong>refunded</strong> on failure.
                  Contact your administrator to purchase or adjust credit balances.
                </Typography>
              </Alert>

              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
{`# Check all credit balances
curl https://nepalfillings.com/api/v1/credits \\
  -H "Authorization: Bearer nf_sms_your_key"

# Response:
[
  { "channel": "sms", "balance": 5000, "reserved": 0 },
  { "channel": "whatsapp", "balance": 3000, "reserved": 100 },
  { "channel": "email", "balance": 10000, "reserved": 0 },
  { "channel": "telegram", "balance": 2000, "reserved": 0 },
  { "channel": "messenger", "balance": 1500, "reserved": 50 }
]

# Check transaction history
curl https://nepalfillings.com/api/v1/credits/transactions?channel=sms&page=1 \\
  -H "Authorization: Bearer nf_sms_your_key"

# Response:
{
  "results": [
    {
      "id": 1,
      "channel": "sms",
      "type": "purchase",
      "amount": 5000,
      "balance_after": 5000,
      "description": "Initial credit purchase",
      "created_at": "2026-03-01T10:00:00Z"
    },
    {
      "id": 2,
      "channel": "sms",
      "type": "deduct",
      "amount": -1,
      "balance_after": 4999,
      "message_id": 123,
      "created_at": "2026-03-17T08:30:00Z"
    }
  ],
  "total": 2,
  "page": 1,
  "per_page": 25
}`}
              </Box>

              <Box sx={{ mt: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant='subtitle1' fontWeight='bold' gutterBottom>Credit Flow</Typography>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Transaction Type</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Effect</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell><Chip label='purchase' size='small' color='success' /></TableCell>
                      <TableCell>Credits added by admin</TableCell>
                      <TableCell>Balance increases</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Chip label='deduct' size='small' color='error' /></TableCell>
                      <TableCell>Credits used for sending messages</TableCell>
                      <TableCell>Balance decreases</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Chip label='refund' size='small' color='info' /></TableCell>
                      <TableCell>Credits returned on send failure</TableCell>
                      <TableCell>Balance increases</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Chip label='bonus' size='small' color='warning' /></TableCell>
                      <TableCell>Promotional credits added</TableCell>
                      <TableCell>Balance increases</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><Chip label='admin adjust' size='small' color='secondary' /></TableCell>
                      <TableCell>Manual adjustment by admin</TableCell>
                      <TableCell>Balance increases or decreases</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>

              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>Rate Limits & Error Handling</Typography>

              <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>HTTP Code</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Meaning</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell><code>200</code></TableCell>
                      <TableCell>Success</TableCell>
                      <TableCell>Request processed successfully</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><code>201</code></TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Resource created successfully</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><code>400</code></TableCell>
                      <TableCell>Bad Request</TableCell>
                      <TableCell>Check request body and parameters</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><code>401</code></TableCell>
                      <TableCell>Unauthorized</TableCell>
                      <TableCell>Invalid or missing API key</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><code>402</code></TableCell>
                      <TableCell>Payment Required</TableCell>
                      <TableCell>Insufficient credits — top up your balance</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><code>404</code></TableCell>
                      <TableCell>Not Found</TableCell>
                      <TableCell>Resource does not exist</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><code>429</code></TableCell>
                      <TableCell>Rate Limited</TableCell>
                      <TableCell>Too many requests — wait and retry after the rate limit window</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><code>500</code></TableCell>
                      <TableCell>Server Error</TableCell>
                      <TableCell>Internal error — contact support</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>
            </CardContent>
          )}
        </Card>
      </Grid>

      {/* Create Key Dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Create API Key</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Channel</InputLabel>
                <Select value={createChannel} label='Channel' onChange={e => setCreateChannel(e.target.value as any)}>
                  <MenuItem value='sms'>SMS (Aakash SMS)</MenuItem>
                  <MenuItem value='whatsapp'>WhatsApp (Gupshup)</MenuItem>
                  <MenuItem value='email'>Email (SendGrid)</MenuItem>
                  <MenuItem value='telegram'>Telegram (Bot API)</MenuItem>
                  <MenuItem value='messenger'>Messenger (Facebook Page)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label='Key Name' value={createName} onChange={e => setCreateName(e.target.value)} placeholder='e.g. Production Key' />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField fullWidth label='Webhook URL (optional)' value={createWebhook} onChange={e => setCreateWebhook(e.target.value)} placeholder='https://your-app.com/webhooks/sms' />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={<Switch checked={createIsTest} onChange={e => setCreateIsTest(e.target.checked)} />}
                label='Test Mode (messages logged but not sent, no credits charged)'
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant='contained' onClick={handleCreate}>Create Key</Button>
        </DialogActions>
      </Dialog>

      {/* Key Reveal Dialog */}
      <Dialog open={!!revealKey} onClose={() => { setRevealKey(null); setRevealSecret(null) }} maxWidth='sm' fullWidth>
        <DialogTitle>API Key Created</DialogTitle>
        <DialogContent>
          <Alert severity='warning' sx={{ mb: 3 }}>
            Save this key now! It will not be shown again.
          </Alert>
          <Typography variant='subtitle2' gutterBottom>API Key:</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <TextField
              fullWidth
              value={revealKey || ''}
              InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 13 } }}
            />
            <IconButton onClick={() => copyToClipboard(revealKey || '')}>
              <i className={copied ? 'tabler-check' : 'tabler-copy'} />
            </IconButton>
          </Box>
          {revealSecret && (
            <>
              <Typography variant='subtitle2' gutterBottom>Webhook Secret:</Typography>
              <TextField
                fullWidth
                value={revealSecret}
                InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 13 } }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button variant='contained' onClick={() => { setRevealKey(null); setRevealSecret(null) }}>
            I've Saved the Key
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(s => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Grid>
  )
}

export default APIKeyManager
