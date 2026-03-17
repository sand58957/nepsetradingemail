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
  const [createChannel, setCreateChannel] = useState<'sms' | 'whatsapp' | 'email' | 'telegram'>('sms')
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

  const getChannelColor = (channel: string): 'primary' | 'success' | 'warning' | 'info' => {
    if (channel === 'sms') return 'primary'
    if (channel === 'whatsapp') return 'success'
    if (channel === 'telegram') return 'info'
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
          {['sms', 'whatsapp', 'email', 'telegram'].map(ch => {
            const credit = getCreditForChannel(ch)
            return (
              <Grid size={{ xs: 12, sm: 3 }} key={ch}>
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
                  title: 'SMS API',
                  base: '/api/v1/sms',
                  endpoints: [
                    { method: 'POST', path: '/send', desc: 'Send single SMS' },
                    { method: 'POST', path: '/send/bulk', desc: 'Send bulk SMS (max 100)' },
                    { method: 'GET', path: '/messages', desc: 'List sent messages' },
                    { method: 'GET', path: '/messages/:id', desc: 'Get message status' },
                    { method: 'GET', path: '/balance', desc: 'Check credit balance' },
                    { method: 'GET', path: '/status', desc: 'Check if SMS is configured' }
                  ]
                },
                {
                  title: 'WhatsApp API',
                  base: '/api/v1/whatsapp',
                  endpoints: [
                    { method: 'POST', path: '/send', desc: 'Send WhatsApp message' },
                    { method: 'POST', path: '/send/bulk', desc: 'Send bulk messages (max 100)' },
                    { method: 'GET', path: '/messages', desc: 'List sent messages' },
                    { method: 'GET', path: '/messages/:id', desc: 'Get message status' },
                    { method: 'GET', path: '/balance', desc: 'Check credit balance' },
                    { method: 'GET', path: '/templates', desc: 'List available templates' }
                  ]
                },
                {
                  title: 'Email API',
                  base: '/api/v1/email',
                  endpoints: [
                    { method: 'POST', path: '/send', desc: 'Send single email' },
                    { method: 'POST', path: '/send/bulk', desc: 'Send bulk emails (max 100)' },
                    { method: 'GET', path: '/messages', desc: 'List sent messages' },
                    { method: 'GET', path: '/messages/:id', desc: 'Get message status' },
                    { method: 'GET', path: '/balance', desc: 'Check credit balance' },
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
