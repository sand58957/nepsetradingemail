'use client'

import { useEffect, useState } from 'react'

import { useRouter, useParams } from 'next/navigation'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Avatar from '@mui/material/Avatar'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import CircularProgress from '@mui/material/CircularProgress'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'

import { useSession } from 'next-auth/react'

import CustomTextField from '@core/components/mui/TextField'
import Alert from '@mui/material/Alert'

import accountsService from '@/services/accounts'
import type { Account } from '@/services/accounts'
import { clearTokenCache } from '@/services/api'
import { getLocalizedUrl } from '@/utils/i18n'
import type { Locale } from '@/configs/i18n'

const ChooseAccount = () => {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newAccountName, setNewAccountName] = useState('')
  const [creating, setCreating] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [menuAccount, setMenuAccount] = useState<Account | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const router = useRouter()
  const { lang: locale } = useParams()
  const { update: updateSession } = useSession()

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      setError('')
      const res = await accountsService.list()

      setAccounts(res.data?.data || [])
    } catch (_err) {
      setError('Failed to load accounts. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSwitchAccount = async (accountId: number) => {
    setSwitching(accountId)
    setError('')

    try {
      const res = await accountsService.switch(accountId)
      const data = res.data?.data

      if (!data?.access_token || !data?.account) {
        throw new Error('Invalid server response')
      }

      const { access_token, account } = data

      // Update NextAuth session with new account info
      await updateSession({
        accessToken: access_token,
        accountId: account.id,
        accountName: account.name,
        accountPlan: account.plan,
        accountLogoUrl: account.logo_url,
        accountDomain: account.domain
      })

      // Clear cached API token so next request uses new JWT
      clearTokenCache()

      // Navigate to dashboard
      router.push(getLocalizedUrl('/dashboards/email-marketing', locale as Locale))
    } catch (_err) {
      setError('Failed to switch account. Please try again.')
    } finally {
      setSwitching(null)
    }
  }

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return

    setCreating(true)
    setError('')

    try {
      const res = await accountsService.create(newAccountName.trim())
      const data = res.data?.data

      if (!data?.access_token || !data?.account) {
        throw new Error('Invalid server response')
      }

      const { access_token, account } = data

      // Update NextAuth session
      await updateSession({
        accessToken: access_token,
        accountId: account.id,
        accountName: account.name,
        accountPlan: account.plan,
        accountLogoUrl: account.logo_url,
        accountDomain: account.domain
      })

      clearTokenCache()
      setDialogOpen(false)
      setNewAccountName('')

      router.push(getLocalizedUrl('/dashboards/email-marketing', locale as Locale))
    } catch (_err) {
      setError('Failed to create account. Please try again.')
    } finally {
      setCreating(false)
    }
  }

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>, account: Account) => {
    e.stopPropagation()
    setMenuAnchor(e.currentTarget)
    setMenuAccount(account)
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
    // Don't clear menuAccount here — it's needed if delete dialog is opening
  }

  const handleDeleteClick = () => {
    setMenuAnchor(null)
    setDeleteDialogOpen(true)
  }

  const handleDeleteAccount = async () => {
    if (!menuAccount) return

    setDeleting(true)
    setError('')

    try {
      const res = await accountsService.delete(menuAccount.id)
      const nextAccountId = res.data?.data?.next_account_id

      // Update session if we deleted the current account
      if (nextAccountId) {
        // Switch to the next available account
        const switchRes = await accountsService.switch(nextAccountId)
        const switchData = switchRes.data?.data

        if (switchData?.access_token && switchData?.account) {
          await updateSession({
            accessToken: switchData.access_token,
            accountId: switchData.account.id,
            accountName: switchData.account.name,
            accountPlan: switchData.account.plan,
            accountLogoUrl: switchData.account.logo_url,
            accountDomain: switchData.account.domain
          })
        }
      } else {
        await updateSession({
          accountId: null,
          accountName: null,
          accountPlan: null,
          accountLogoUrl: null,
          accountDomain: null
        })
      }

      clearTokenCache()
      setDeleteDialogOpen(false)
      setMenuAccount(null)
      loadAccounts()
    } catch (_err) {
      setError('Failed to delete account. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const getInitials = (name: string) => {
    if (!name?.trim()) return '?'

    return name.trim()
      .split(' ')
      .filter(w => w.length > 0)
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  }

  return (
    <Box
      sx={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 4
      }}
    >
      <Card sx={{ maxWidth: 560, width: '100%' }}>
        <CardContent sx={{ p: { xs: 4, sm: 6 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
            <Typography variant='h4'>Choose account</Typography>
            <Button variant='contained' color='success' startIcon={<i className='tabler-plus' />} onClick={() => setDialogOpen(true)}>
              New account
            </Button>
          </Box>

          {error && <Alert severity='error' sx={{ mb: 3 }}>{error}</Alert>}

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : accounts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography color='text.secondary' sx={{ mb: 2 }}>
                You don&apos;t have any accounts yet.
              </Typography>
              <Button variant='contained' onClick={() => setDialogOpen(true)}>
                Create your first account
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {accounts.map(account => (
                <Card
                  key={account.id}
                  variant='outlined'
                  sx={{
                    cursor: switching ? 'default' : 'pointer',
                    transition: 'all 0.2s',
                    '&:hover': switching ? {} : { borderColor: 'primary.main', boxShadow: 1 }
                  }}
                  onClick={() => !switching && handleSwitchAccount(account.id)}
                >
                  <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3, py: 3, '&:last-child': { pb: 3 } }}>
                    {account.logo_url ? (
                      <Avatar src={account.logo_url} sx={{ width: 48, height: 48 }} />
                    ) : (
                      <Avatar sx={{ width: 48, height: 48, bgcolor: 'primary.main', fontSize: '1rem' }}>
                        {getInitials(account.name)}
                      </Avatar>
                    )}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant='subtitle1' fontWeight={600} noWrap>
                        {account.name}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        Plan: {account.plan}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {switching === account.id ? (
                        <CircularProgress size={24} />
                      ) : (
                        <>
                          <Chip label={account.member_role || 'member'} size='small' variant='tonal' color='primary' />
                          <IconButton size='small' onClick={e => handleMenuOpen(e, account)}>
                            <i className='tabler-dots-vertical' />
                          </IconButton>
                        </>
                      )}
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Account context menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem
          onClick={handleDeleteClick}
          sx={{ color: 'error.main' }}
          disabled={menuAccount?.member_role !== 'owner'}
        >
          <ListItemIcon sx={{ color: 'inherit' }}>
            <i className='tabler-trash' />
          </ListItemIcon>
          <ListItemText>Delete account</ListItemText>
        </MenuItem>
      </Menu>

      {/* Create Account Dialog */}
      <Dialog open={dialogOpen} onClose={() => !creating && setDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Create new account</DialogTitle>
        <DialogContent>
          <CustomTextField
            autoFocus
            fullWidth
            label='Account name'
            placeholder='e.g. My Company'
            value={newAccountName}
            onChange={e => setNewAccountName(e.target.value)}
            sx={{ mt: 1 }}
            onKeyDown={e => e.key === 'Enter' && handleCreateAccount()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button variant='contained' onClick={handleCreateAccount} disabled={creating || !newAccountName.trim()}>
            {creating ? <CircularProgress size={20} /> : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => !deleting && setDeleteDialogOpen(false)} maxWidth='xs' fullWidth>
        <DialogTitle>Delete account</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{menuAccount?.name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant='contained' color='error' onClick={handleDeleteAccount} disabled={deleting}>
            {deleting ? <CircularProgress size={20} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ChooseAccount
