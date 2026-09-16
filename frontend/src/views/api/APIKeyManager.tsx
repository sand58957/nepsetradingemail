'use client'

import { useState, useEffect } from 'react'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
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
  const [, setLoading] = useState(true)
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
    // loadData is redefined every render; depending on it would loop. Refetch on filter change only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    } catch (_err) {
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
                    <Chip label={ch.toUpperCase()} color={getChannelColor(ch)} size='small' sx={{ mb: 2 }} />
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
                <Button
                  variant='contained'
                  startIcon={<i className='tabler-plus' />}
                  onClick={() => setCreateOpen(true)}
                >
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
                              {txn.amount > 0 ? '+' : ''}
                              {txn.amount}
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
              <Typography variant='h6' gutterBottom>
                API Endpoints
              </Typography>
              <Divider sx={{ mb: 3 }} />

              {/* This list is the API-key surface at /api/v1 and nothing else.
                  It used to carry the dashboard's own routes under the same
                  prefix — settings, contacts, groups, campaigns — which do not
                  exist there. Readers called them and got 404s: one caller worked
                  through fifty guessed URLs trying to find what was real. Telegram
                  was listed with twenty endpoints and has no public API at all. */}
              {[
                {
                  title: 'WhatsApp',
                  base: '/api/v1/whatsapp',
                  endpoints: [
                    { method: 'POST', path: '/send', desc: 'Send one message. type: "text" with message, or type: "template" with template_name.' },
                    { method: 'POST', path: '/send/bulk', desc: 'Send to many recipients (max 100 per call)' },
                    { method: 'GET', path: '/messages', desc: 'List messages you have sent, with status' },
                    { method: 'GET', path: '/messages/:id', desc: 'Status of one message' },
                    { method: 'GET', path: '/balance', desc: 'WhatsApp credit balance' },
                    { method: 'GET', path: '/status', desc: 'Whether a number is linked and ready to send' },
                    { method: 'GET', path: '/templates', desc: 'Your approved templates, for use with type: "template"' }
                  ]
                },
                {
                  title: 'SMS',
                  base: '/api/v1/sms',
                  endpoints: [
                    { method: 'POST', path: '/send', desc: 'Send one SMS' },
                    { method: 'POST', path: '/send/bulk', desc: 'Send to many recipients (max 100 per call)' },
                    { method: 'GET', path: '/messages', desc: 'List messages you have sent, with status' },
                    { method: 'GET', path: '/messages/:id', desc: 'Status of one message' },
                    { method: 'GET', path: '/balance', desc: 'SMS credit balance' },
                    { method: 'GET', path: '/status', desc: 'Whether the channel is configured' }
                  ]
                },
                {
                  title: 'Email',
                  base: '/api/v1/email',
                  endpoints: [
                    { method: 'POST', path: '/send', desc: 'Send one email' },
                    { method: 'POST', path: '/send/bulk', desc: 'Send to many recipients (max 100 per call)' },
                    { method: 'GET', path: '/messages', desc: 'List messages you have sent, with status' },
                    { method: 'GET', path: '/messages/:id', desc: 'Status of one message' },
                    { method: 'GET', path: '/balance', desc: 'Email credit balance' },
                    { method: 'GET', path: '/status', desc: 'Whether the channel is configured' },
                    { method: 'GET', path: '/domains', desc: 'Your verified sending domains' }
                  ]
                },
                {
                  title: 'Messenger',
                  base: '/api/v1/messenger',
                  endpoints: [
                    { method: 'POST', path: '/send', desc: 'Send one message' },
                    { method: 'POST', path: '/send/bulk', desc: 'Send to many recipients (max 100 per call)' },
                    { method: 'GET', path: '/messages', desc: 'List messages you have sent, with status' },
                    { method: 'GET', path: '/messages/:id', desc: 'Status of one message' },
                    { method: 'GET', path: '/balance', desc: 'Messenger credit balance' },
                    { method: 'GET', path: '/status', desc: 'Whether the channel is configured' }
                  ]
                },
                {
                  title: 'Account',
                  base: '/api/v1',
                  endpoints: [
                    { method: 'GET', path: '/me', desc: 'The account this key belongs to, and its channel' }
                  ]
                }
              ].map(section => (
                <Box key={section.title} sx={{ mb: 4 }}>
                  <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                    {section.title}
                  </Typography>
                  <Typography variant='body2' color='text.secondary' gutterBottom>
                    Base URL: <code>https://nepalfillings.com{section.base}</code>
                  </Typography>
                  <TableContainer component={Paper} variant='outlined' sx={{ mt: 1 }}>
                    <Table size='small'>
                      <TableBody>
                        {section.endpoints.map((ep, i) => (
                          <TableRow key={i}>
                            <TableCell sx={{ width: 80 }}>
                              <Chip
                                label={ep.method}
                                size='small'
                                color={ep.method === 'POST' ? 'primary' : 'default'}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography variant='body2' fontFamily='monospace'>
                                {ep.path}
                              </Typography>
                            </TableCell>
                            <TableCell>{ep.desc}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              ))}

              {/* Everything below is checked against the /api/v1 handlers. An earlier
                  version documented request bodies the API rejects (string arrays for
                  bulk SMS, template_id/params for WhatsApp), response fields it never
                  returns, a per-key rate limit that isn't enforced, and one account's
                  own Telegram subscription code, Facebook Page ID and opt-in keyword,
                  shown to every account that opened this page. */}
              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>
                Authentication
              </Typography>
              <Alert severity='info' sx={{ mb: 2 }}>
                Each key belongs to one channel. Send it in the Authorization header:
                <Box component='pre' sx={{ mt: 1, p: 1, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto' }}>
                  {`Authorization: Bearer nf_sms_your_api_key_here`}
                </Box>
                Test keys (<code>nf_test_…</code>) accept the same requests but send nothing and use no credits.
              </Alert>

              <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                  Limits and responses
                </Typography>
                <Table size='small'>
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold', width: 180 }}>Credits</TableCell>
                      <TableCell>
                        Live sends use this account&apos;s prepaid API credits for the key&apos;s channel:{' '}
                        <strong>1 credit per message</strong>, reserved when the message is submitted and returned if the
                        submission fails. Credits are added by the Nepal Fillings team.
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Rate limit</TableCell>
                      <TableCell>
                        30 requests per second per IP address, with bursts up to 60. Above that the API answers HTTP 429.
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Bulk sends</TableCell>
                      <TableCell>
                        Up to <strong>100 recipients</strong> per call
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Response shape</TableCell>
                      <TableCell>
                        Success: <code>{`{"success": true, "data": {…}}`}</code>. Error:{' '}
                        <code>{`{"success": false, "error": {"code", "message", "field"}}`}</code>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>Which key is this?</TableCell>
                      <TableCell>
                        <code>GET /api/v1/me</code> returns the account and channel a key belongs to
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </Box>

              {/* ============== SMS ============== */}
              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>
                SMS
              </Typography>

              <Alert severity='info' sx={{ mb: 3 }}>
                SMS is sent through this account&apos;s <strong>own Aakash SMS account</strong>. Connect your Aakash auth
                token and approved sender ID under SMS &gt; Settings first; SMS credits themselves are bought from Aakash
                SMS. Each API send also uses 1 Nepal Fillings API credit.
              </Alert>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                Send one SMS
              </Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
                {`curl -X POST https://nepalfillings.com/api/v1/sms/send \\
  -H "Authorization: Bearer nf_sms_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "9812345678",
    "message": "Your order #1042 has shipped.",
    "reference": "order-1042"
  }'

# Response:
{
  "success": true,
  "data": {
    "message_id": "sms_msg_123",
    "to": "9812345678",
    "status": "sent",
    "credits_used": 1,
    "credits_remaining": 499
  }
}`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>
                Send to many numbers
              </Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
                {`# "message" is shared; a recipient's own "message" replaces it for that number.
curl -X POST https://nepalfillings.com/api/v1/sms/send/bulk \\
  -H "Authorization: Bearer nf_sms_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "message": "Our shop is closed on Saturday.",
    "recipients": [
      { "to": "9812345678" },
      { "to": "9823456789", "message": "Your pickup is moved to Sunday." }
    ]
  }'

# Response:
{
  "success": true,
  "data": { "total": 2, "sent": 2, "failed": 0, "credits_used": 2, "credits_remaining": 497 }
}`}
              </Box>

              <Typography variant='body2' sx={{ mt: 2 }}>
                Also: <code>GET /api/v1/sms/balance</code>, <code>GET /api/v1/sms/messages</code>,{' '}
                <code>GET /api/v1/sms/messages/:id</code> and <code>GET /api/v1/sms/status</code>.
              </Typography>

              {/* ============== WhatsApp ============== */}
              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>
                WhatsApp
              </Typography>

              <Alert severity='warning' sx={{ mb: 3 }}>
                Messages are sent from the WhatsApp number linked to this account under WhatsApp &gt; Settings (scan the
                QR code). This is <strong>not Meta&apos;s WhatsApp Business API</strong>: there is no template approval,
                and templates here are saved message bodies. WhatsApp can restrict a linked number, especially when people
                who did not opt in report your messages. Each message uses 1 credit.
              </Alert>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                Send a text message
              </Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
                {`curl -X POST https://nepalfillings.com/api/v1/whatsapp/send \\
  -H "Authorization: Bearer nf_whatsapp_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "9779812345678",
    "type": "text",
    "message": "Your appointment is confirmed for 3 PM tomorrow."
  }'

# Response:
{
  "success": true,
  "data": {
    "message_id": "wa_msg_456",
    "to": "9779812345678",
    "type": "text",
    "status": "sent",
    "credits_used": 1,
    "credits_remaining": 99
  }
}`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>
                Send a saved template
              </Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
                {`# template_data fills {{1}}, {{2}}, … in order. Omitting "type" with a
# template_name also works; without one, the message is sent as text.
curl -X POST https://nepalfillings.com/api/v1/whatsapp/send \\
  -H "Authorization: Bearer nf_whatsapp_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "9779812345678",
    "type": "template",
    "template_name": "order_update",
    "template_data": ["Sita", "#1042"]
  }'`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>
                Send to many numbers
              </Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
                {`# Shared fields at the top; per-recipient template_data or message override them.
# Messages go out one at a time, and a run that keeps failing stops early (see "skipped").
curl -X POST https://nepalfillings.com/api/v1/whatsapp/send/bulk \\
  -H "Authorization: Bearer nf_whatsapp_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "type": "template",
    "template_name": "order_update",
    "recipients": [
      { "to": "9779812345678", "template_data": ["Sita", "#1042"] },
      { "to": "9779823456789", "template_data": ["Ram", "#1043"] }
    ]
  }'

# Response:
{
  "success": true,
  "data": { "total": 2, "sent": 2, "failed": 0, "credits_used": 2, "credits_remaining": 97 }
}`}
              </Box>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom sx={{ mt: 2 }}>
                List templates
              </Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
                {`# Templates are created in the dashboard under WhatsApp > Templates.
curl https://nepalfillings.com/api/v1/whatsapp/templates \\
  -H "Authorization: Bearer nf_whatsapp_your_key"

# Response:
{
  "success": true,
  "data": [
    {
      "id": 7,
      "template_name": "order_update",
      "category": "UTILITY",
      "language": "en",
      "status": "approved",
      "header_type": "",
      "body": "Hi {{1}}, your order {{2}} is on its way."
    }
  ]
}`}
              </Box>

              <Typography variant='body2' sx={{ mt: 2 }}>
                Also: <code>GET /api/v1/whatsapp/status</code> (whether a number is linked and connected),{' '}
                <code>GET /api/v1/whatsapp/balance</code>, <code>GET /api/v1/whatsapp/messages</code> and{' '}
                <code>GET /api/v1/whatsapp/messages/:id</code>.
              </Typography>

              {/* ============== Email ============== */}
              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>
                Email
              </Typography>

              <Alert severity='info' sx={{ mb: 3 }}>
                The <code>from</code> address must use a sending domain verified for this account; otherwise the API
                answers 403 <code>DOMAIN_NOT_VERIFIED</code>. Each email uses 1 credit.
              </Alert>

              <Typography variant='subtitle1' fontWeight='bold' gutterBottom>
                Send an email
              </Typography>
              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
                {`curl -X POST https://nepalfillings.com/api/v1/email/send \\
  -H "Authorization: Bearer nf_email_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": "customer@example.com",
    "from": "orders@yourdomain.com",
    "from_name": "Your Shop",
    "subject": "Your order has shipped",
    "html": "<p>Your order #1042 is on its way.</p>",
    "text": "Your order #1042 is on its way."
  }'`}
              </Box>

              <Typography variant='body2' sx={{ mt: 2 }}>
                Bulk: <code>POST /api/v1/email/send/bulk</code> with shared <code>from</code>, <code>subject</code> and{' '}
                <code>html</code>, and <code>{`"recipients": [{"to": "…"}, {"to": "…", "subject": "…"}]`}</code>. Also:{' '}
                <code>GET /api/v1/email/domains</code>, <code>/balance</code>, <code>/messages</code>,{' '}
                <code>/messages/:id</code> and <code>/status</code>.
              </Typography>

              {/* ============== Messenger ============== */}
              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>
                Facebook Messenger
              </Typography>

              <Alert severity='info' sx={{ mb: 3 }}>
                Messages are sent from the Facebook Page connected under Messenger &gt; Settings, to people identified by
                their Page-scoped ID (PSID), which is recorded when they message your Page. Facebook limits when a Page may
                message someone, generally to 24 hours after their last message. Each message uses 1 credit.
              </Alert>

              <Box component='pre' sx={{ p: 2, bgcolor: 'grey.100', borderRadius: 1, overflow: 'auto', fontSize: 13 }}>
                {`curl -X POST https://nepalfillings.com/api/v1/messenger/send \\
  -H "Authorization: Bearer nf_messenger_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{ "to": "PSID_OF_THE_PERSON", "message": "Thanks for your message. We are open until 6 PM." }'

# Bulk: recipients is a list of PSIDs
curl -X POST https://nepalfillings.com/api/v1/messenger/send/bulk \\
  -H "Authorization: Bearer nf_messenger_your_key" \\
  -H "Content-Type: application/json" \\
  -d '{ "message": "New stock arrives on Friday.", "recipients": ["PSID_1", "PSID_2"] }'`}
              </Box>

              <Alert severity='info' sx={{ mt: 3 }}>
                Telegram is not available through the API. Send Telegram broadcasts from the dashboard.
              </Alert>

              {/* ============== Errors ============== */}
              <Divider sx={{ my: 3 }} />
              <Typography variant='h6' gutterBottom>
                Errors
              </Typography>

              <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflowX: 'auto' }}>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 'bold' }}>HTTP</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>error.code</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>What to do</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {[
                      ['400', 'TEMPLATE_NOT_FOUND', 'WhatsApp: check template_name against GET /whatsapp/templates.'],
                      ['401', 'AUTH_ERROR', 'The key is missing, wrong, revoked or for another channel.'],
                      ['402', 'INSUFFICIENT_CREDITS', 'Not enough API credits for this channel. Contact us to add credits.'],
                      ['403', 'CHANNEL_NOT_CONFIGURED', 'Set the channel up in the dashboard first (for example the Aakash SMS token).'],
                      ['403', 'DOMAIN_NOT_VERIFIED', 'Email: verify the domain of the from address.'],
                      ['404', 'NOT_FOUND', 'No message with that id for this key.'],
                      ['422', 'VALIDATION_ERROR', 'A field is missing or invalid; error.field names it.'],
                      ['422', 'UNDELIVERABLE', 'WhatsApp: the number cannot receive WhatsApp messages. Nothing was charged.'],
                      ['429', 'RATE_LIMITED', 'WhatsApp: the linked number reached its sending allowance. Wait for the Retry-After header.'],
                      ['429', '(none)', 'Too many requests from this IP address. Slow down and retry.'],
                      ['502', 'PROVIDER_ERROR or DELIVERY_FAILED', 'The provider refused or failed the send. Retry later.'],
                      ['503', 'CHANNEL_UNAVAILABLE', 'WhatsApp: no linked number is connected. Check WhatsApp > Settings.'],
                      ['500', 'PROVIDER_ERROR', 'Something failed on our side. Retry later, and contact us if it persists.']
                    ].map(([http, code, action]) => (
                      <TableRow key={http + code}>
                        <TableCell>
                          <code>{http}</code>
                        </TableCell>
                        <TableCell>
                          <code>{code}</code>
                        </TableCell>
                        <TableCell>{action}</TableCell>
                      </TableRow>
                    ))}
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
                  <MenuItem value='whatsapp'>WhatsApp</MenuItem>
                  <MenuItem value='email'>Email (SendGrid)</MenuItem>
                  <MenuItem value='telegram'>Telegram (Bot API)</MenuItem>
                  <MenuItem value='messenger'>Messenger (Facebook Page)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Key Name'
                value={createName}
                onChange={e => setCreateName(e.target.value)}
                placeholder='e.g. Production Key'
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Webhook URL (optional)'
                value={createWebhook}
                onChange={e => setCreateWebhook(e.target.value)}
                placeholder='https://your-app.com/webhooks/sms'
              />
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
          <Button variant='contained' onClick={handleCreate}>
            Create Key
          </Button>
        </DialogActions>
      </Dialog>

      {/* Key Reveal Dialog */}
      <Dialog
        open={!!revealKey}
        onClose={() => {
          setRevealKey(null)
          setRevealSecret(null)
        }}
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle>API Key Created</DialogTitle>
        <DialogContent>
          <Alert severity='warning' sx={{ mb: 3 }}>
            Save this key now! It will not be shown again.
          </Alert>
          <Typography variant='subtitle2' gutterBottom>
            API Key:
          </Typography>
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
              <Typography variant='subtitle2' gutterBottom>
                Webhook Secret:
              </Typography>
              <TextField
                fullWidth
                value={revealSecret}
                InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', fontSize: 13 } }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            variant='contained'
            onClick={() => {
              setRevealKey(null)
              setRevealSecret(null)
            }}
          >
            I&apos;ve Saved the Key
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
