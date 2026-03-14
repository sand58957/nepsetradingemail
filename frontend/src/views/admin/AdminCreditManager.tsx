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
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'

import { creditService } from '@/services/apicredits'
import type { AdminCreditEntry, CreditTransaction } from '@/types/api'

const AdminCreditManager = () => {
  const [credits, setCredits] = useState<AdminCreditEntry[]>([])
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)

  // Adjust dialog
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustAccountId, setAdjustAccountId] = useState(0)
  const [adjustAccountName, setAdjustAccountName] = useState('')
  const [adjustChannel, setAdjustChannel] = useState<'sms' | 'whatsapp' | 'email'>('sms')
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustDescription, setAdjustDescription] = useState('')

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [creditsRes, txnRes, msgRes] = await Promise.all([
        creditService.adminListCredits(),
        creditService.adminListTransactions({ page: 1 }),
        creditService.adminListMessages({ page: 1 })
      ])
      setCredits(creditsRes.data)
      setTransactions(txnRes.data || [])
      setMessages(msgRes.data || [])
    } catch (err) {
      setSnackbar({ open: true, message: 'Failed to load credit data', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleAdjust = async () => {
    const amount = parseFloat(adjustAmount)
    if (isNaN(amount) || amount === 0) {
      setSnackbar({ open: true, message: 'Enter a valid non-zero amount', severity: 'error' })
      return
    }
    if (!adjustDescription.trim()) {
      setSnackbar({ open: true, message: 'Description is required', severity: 'error' })
      return
    }

    try {
      const res = await creditService.adminAdjustCredits(adjustAccountId, {
        channel: adjustChannel,
        amount,
        description: adjustDescription
      })
      setSnackbar({ open: true, message: `Credits adjusted. New balance: ${res.data.new_balance}`, severity: 'success' })
      setAdjustOpen(false)
      setAdjustAmount('')
      setAdjustDescription('')
      loadData()
    } catch (err: any) {
      setSnackbar({ open: true, message: err.response?.data?.message || 'Failed to adjust credits', severity: 'error' })
    }
  }

  const handleToggleAPI = async (accountId: number) => {
    try {
      const res = await creditService.adminToggleAPI(accountId)
      setSnackbar({
        open: true,
        message: `API access ${res.data.api_enabled ? 'enabled' : 'disabled'} for account ${accountId}`,
        severity: 'success'
      })
      loadData()
    } catch {
      setSnackbar({ open: true, message: 'Failed to toggle API access', severity: 'error' })
    }
  }

  const openAdjust = (accountId: number, accountName: string, channel: 'sms' | 'whatsapp' | 'email') => {
    setAdjustAccountId(accountId)
    setAdjustAccountName(accountName)
    setAdjustChannel(channel)
    setAdjustOpen(true)
  }

  const getChannelColor = (channel: string): 'primary' | 'success' | 'warning' => {
    if (channel === 'sms') return 'primary'
    if (channel === 'whatsapp') return 'success'
    return 'warning'
  }

  // Group credits by account
  const accountMap = new Map<number, { name: string; credits: AdminCreditEntry[] }>()
  credits.forEach(c => {
    if (!accountMap.has(c.account_id)) {
      accountMap.set(c.account_id, { name: c.account_name, credits: [] })
    }
    accountMap.get(c.account_id)!.credits.push(c)
  })

  return (
    <Grid container spacing={6}>
      <Grid size={{ xs: 12 }}>
        <Card>
          <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3 }}>
            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
              <Tab label='Credit Balances' />
              <Tab label='Transactions' />
              <Tab label='API Messages' />
            </Tabs>
          </Box>

          {/* Credit Balances Tab */}
          {activeTab === 0 && (
            <CardContent>
              <Typography variant='h6' gutterBottom>Account Credit Balances</Typography>
              {accountMap.size === 0 ? (
                <Typography color='text.secondary' sx={{ py: 4, textAlign: 'center' }}>
                  No accounts with API credits yet.
                </Typography>
              ) : (
                Array.from(accountMap.entries()).map(([accountId, { name, credits: acCredits }]) => (
                  <Card key={accountId} variant='outlined' sx={{ mb: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant='subtitle1' fontWeight='bold'>
                          {name} <Typography component='span' variant='body2' color='text.secondary'>(ID: {accountId})</Typography>
                        </Typography>
                      </Box>
                      <Grid container spacing={2}>
                        {acCredits.map(credit => (
                          <Grid size={{ xs: 12, sm: 4 }} key={credit.channel}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
                              <Box>
                                <Chip label={credit.channel.toUpperCase()} color={getChannelColor(credit.channel)} size='small' />
                                <Typography variant='h6' sx={{ mt: 0.5 }}>{credit.balance.toLocaleString()}</Typography>
                                {credit.reserved > 0 && (
                                  <Typography variant='caption' color='warning.main'>({credit.reserved} reserved)</Typography>
                                )}
                              </Box>
                              <Tooltip title='Adjust Credits'>
                                <IconButton
                                  color='primary'
                                  onClick={() => openAdjust(accountId, name, credit.channel as any)}
                                >
                                  <i className='tabler-plus-minus' />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Grid>
                        ))}
                      </Grid>
                    </CardContent>
                  </Card>
                ))
              )}
            </CardContent>
          )}

          {/* Transactions Tab */}
          {activeTab === 1 && (
            <CardContent>
              <TableContainer component={Paper} variant='outlined'>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Account</TableCell>
                      <TableCell>Channel</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell align='right'>Amount</TableCell>
                      <TableCell align='right'>Balance</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {transactions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align='center' sx={{ py: 4 }}>
                          <Typography color='text.secondary'>No transactions yet.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      transactions.map(txn => (
                        <TableRow key={txn.id}>
                          <TableCell>{new Date(txn.created_at).toLocaleString()}</TableCell>
                          <TableCell>{txn.account_id}</TableCell>
                          <TableCell>
                            <Chip label={txn.channel.toUpperCase()} color={getChannelColor(txn.channel)} size='small' />
                          </TableCell>
                          <TableCell>
                            <Chip label={txn.type.replace('_', ' ')} size='small' variant='outlined' />
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

          {/* API Messages Tab */}
          {activeTab === 2 && (
            <CardContent>
              <TableContainer component={Paper} variant='outlined'>
                <Table size='small'>
                  <TableHead>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Account</TableCell>
                      <TableCell>Channel</TableCell>
                      <TableCell>To</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Credits</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {messages.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} align='center' sx={{ py: 4 }}>
                          <Typography color='text.secondary'>No API messages yet.</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      messages.map((msg, i) => (
                        <TableRow key={i}>
                          <TableCell>{msg.created_at ? new Date(msg.created_at).toLocaleString() : '-'}</TableCell>
                          <TableCell>{msg.account_name || msg.account_id}</TableCell>
                          <TableCell>
                            <Chip label={(msg.channel || '').toUpperCase()} size='small' />
                          </TableCell>
                          <TableCell>{msg.to}</TableCell>
                          <TableCell>
                            <Chip
                              label={msg.status}
                              size='small'
                              color={msg.status === 'sent' ? 'success' : msg.status === 'failed' ? 'error' : 'default'}
                            />
                          </TableCell>
                          <TableCell>{msg.credits_charged}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          )}
        </Card>
      </Grid>

      {/* Adjust Credits Dialog */}
      <Dialog open={adjustOpen} onClose={() => setAdjustOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Adjust Credits — {adjustAccountName}</DialogTitle>
        <DialogContent>
          <Grid container spacing={3} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 12 }}>
              <FormControl fullWidth>
                <InputLabel>Channel</InputLabel>
                <Select value={adjustChannel} label='Channel' onChange={e => setAdjustChannel(e.target.value as any)}>
                  <MenuItem value='sms'>SMS</MenuItem>
                  <MenuItem value='whatsapp'>WhatsApp</MenuItem>
                  <MenuItem value='email'>Email</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Amount'
                type='number'
                value={adjustAmount}
                onChange={e => setAdjustAmount(e.target.value)}
                helperText='Positive to add, negative to deduct'
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                label='Description (required)'
                value={adjustDescription}
                onChange={e => setAdjustDescription(e.target.value)}
                placeholder='e.g. Monthly credit purchase, Bonus credits'
                multiline
                rows={2}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustOpen(false)}>Cancel</Button>
          <Button variant='contained' onClick={handleAdjust}>
            {parseFloat(adjustAmount) >= 0 ? 'Add Credits' : 'Deduct Credits'}
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

export default AdminCreditManager
