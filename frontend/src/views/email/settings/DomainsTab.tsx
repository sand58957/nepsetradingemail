'use client'

import { useState, useEffect } from 'react'

// MUI Imports
import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogActions from '@mui/material/DialogActions'
import Link from '@mui/material/Link'

// Components
import DomainVerificationDialog from './DomainVerificationDialog'

// Services
import accountSettingsService from '@/services/accountSettings'

// Types
import type { DomainsConfig, SendingDomain, SiteDomain } from '@/types/email'

// Hook Imports
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'

interface Props {
  data: DomainsConfig
  onSaveSuccess: (message: string) => void
  onSaveError: (message: string) => void
}

const DomainsTab = ({ data, onSaveSuccess, onSaveError }: Props) => {
  const [form, setForm] = useState<DomainsConfig>({
    sending_domains: [],
    site_domains: []
  })

  const [addSendingOpen, setAddSendingOpen] = useState(false)
  const [addSiteOpen, setAddSiteOpen] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [verifyDomain, setVerifyDomain] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; type: 'sending' | 'site'; index: number; domain: string }>({
    open: false, type: 'sending', index: -1, domain: ''
  })

  const isMobile = useMobileBreakpoint()

  useEffect(() => {
    if (data) {
      setForm(data)
    }
  }, [data])

  const saveForm = async (updated: DomainsConfig, previous: DomainsConfig, silent = false): Promise<boolean> => {
    try {
      setSaving(true)
      await accountSettingsService.updateDomains(updated)

      if (!silent) {
        onSaveSuccess('Domain settings updated')
      }

      return true
    } catch (err) {
      console.error('Failed to save domain settings:', err)
      onSaveError('Failed to update domain settings')

      // Rollback to previous state on failure
      setForm(previous)

      return false
    } finally {
      setSaving(false)
    }
  }

  const isValidDomain = (d: string) => /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(d)

  const handleAddSendingDomain = async () => {
    if (!newDomain.trim()) return

    const domainName = newDomain.trim().toLowerCase()

    if (!isValidDomain(domainName)) {
      onSaveError('Please enter a valid domain name (e.g. mail.yourdomain.com)')
      return
    }

    if (form.sending_domains.some(d => d.domain.toLowerCase() === domainName)) {
      onSaveError('This domain has already been added')
      return
    }

    const domain: SendingDomain = {
      domain: domainName,
      status: 'pending',
      domain_alignment: false
    }

    const previous = form

    const updated = {
      ...form,
      sending_domains: [...form.sending_domains, domain]
    }

    setForm(updated)
    setNewDomain('')
    setAddSendingOpen(false)

    // Save silently (no parent refetch) so the verify dialog can open
    const ok = await saveForm(updated, previous, true)

    if (ok) {
      setVerifyDomain(domainName)
    }
  }

  const handleRemoveSendingDomain = async (index: number) => {
    const previous = form

    const updated = {
      ...form,
      sending_domains: form.sending_domains.filter((_, i) => i !== index)
    }

    setForm(updated)
    setDeleteConfirm({ open: false, type: 'sending', index: -1, domain: '' })
    await saveForm(updated, previous)
  }

  const handleAddSiteDomain = async () => {
    if (!newDomain.trim()) return

    const domainName = newDomain.trim().toLowerCase()

    if (!isValidDomain(domainName)) {
      onSaveError('Please enter a valid domain name (e.g. www.yourdomain.com)')
      return
    }

    if (form.site_domains.some(d => typeof d !== 'string' && d.domain.toLowerCase() === domainName)) {
      onSaveError('This domain has already been added')
      return
    }

    const domain: SiteDomain = {
      domain: domainName,
      status: 'pending',
      ssl: false,
      site: ''
    }

    const previous = form

    const updated = {
      ...form,
      site_domains: [...form.site_domains, domain]
    }

    setForm(updated)
    setNewDomain('')
    setAddSiteOpen(false)
    await saveForm(updated, previous)
  }

  const handleRemoveSiteDomain = async (index: number) => {
    const previous = form

    const updated = {
      ...form,
      site_domains: form.site_domains.filter((_, i) => i !== index)
    }

    setForm(updated)
    setDeleteConfirm({ open: false, type: 'sending', index: -1, domain: '' })
    await saveForm(updated, previous)
  }

  const handleDeleteConfirmed = async () => {
    if (deleteConfirm.type === 'sending') {
      await handleRemoveSendingDomain(deleteConfirm.index)
    } else {
      await handleRemoveSiteDomain(deleteConfirm.index)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'success'
      case 'pending':
        return 'warning'
      case 'failed':
        return 'error'
      default:
        return 'default'
    }
  }

  return (
    <div className='flex flex-col gap-6'>
      {/* Sending Domains */}
      <Card>
        <CardContent sx={{ p: { xs: 4, sm: 6 } }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant='h5' fontWeight={700}>
              Sending domains
            </Typography>
            <Button
              variant='contained'
              color='success'
              startIcon={<i className='tabler-plus' />}
              onClick={() => { setNewDomain(''); setAddSendingOpen(true) }}
              disabled={saving}
            >
              Add domain
            </Button>
          </Box>

          <Typography variant='body2' color='text.secondary' sx={{ mb: 4 }}>
            Manage your sending domains. Need help? Learn more{' '}
            <Link href='#' underline='hover' color='primary'>
              about verification and authentication
            </Link>{' '}
            or{' '}
            <Link href='#' underline='hover' color='primary'>
              custom domains
            </Link>
            .
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Domain</TableCell>
                  <TableCell>Status</TableCell>
                  {form.sending_domains.length > 0 && <TableCell align='right'>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {form.sending_domains.length > 0 ? (
                  form.sending_domains.map((domain, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography fontWeight={500}>{domain.domain}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={domain.status.charAt(0).toUpperCase() + domain.status.slice(1)}
                          color={getStatusColor(domain.status) as any}
                          size='small'
                          variant='tonal'
                        />
                      </TableCell>
                      <TableCell align='right'>
                        <div className='flex items-center justify-end gap-1'>
                          {domain.status === 'pending' && (
                            <Tooltip title='Verify DNS records'>
                              <IconButton size='small' onClick={() => setVerifyDomain(domain.domain)}>
                                <i className='tabler-settings text-[18px]' />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title='Remove'>
                            <IconButton size='small' onClick={() => setDeleteConfirm({ open: true, type: 'sending', index, domain: domain.domain })}>
                              <i className='tabler-trash text-[18px]' />
                            </IconButton>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={2}>
                      <Typography color='text.secondary'>No sending domains.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Sites */}
      <Card>
        <CardContent sx={{ p: { xs: 4, sm: 6 } }}>
          {/* Upgrade banner */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              px: 3,
              py: 2,
              mb: 4
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <i className='tabler-star text-[20px]' style={{ opacity: 0.6 }} />
              <Typography variant='body2' color='text.secondary'>
                Custom domains are included in Paid plans.
              </Typography>
            </Box>
            <Button variant='outlined' size='small'>
              Upgrade
            </Button>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant='h5' fontWeight={700}>
              Sites
            </Typography>
            <Button
              variant='contained'
              color='success'
              startIcon={<i className='tabler-plus' />}
              onClick={() => { setNewDomain(''); setAddSiteOpen(true) }}
              disabled={saving}
              sx={{ opacity: 0.6 }}
            >
              Add domain
            </Button>
          </Box>

          <Typography variant='body2' color='text.secondary' sx={{ mb: 4 }}>
            Create websites or landing pages using your own domain. Learn{' '}
            <Link href='#' underline='hover' color='primary'>
              how to add custom domains
            </Link>
            .
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Domain</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      SSL
                      <Tooltip title='SSL certificates are automatically provisioned for verified domains'>
                        <i className='tabler-help-circle text-[16px]' style={{ opacity: 0.5, cursor: 'help' }} />
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>Site</TableCell>
                  {form.site_domains.length > 0 && <TableCell align='right'>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {form.site_domains.length > 0 ? (
                  form.site_domains.map((domain, index) => (
                    <TableRow key={index} hover>
                      <TableCell>
                        <Typography fontWeight={500}>
                          {typeof domain === 'string' ? domain : domain.domain}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {typeof domain !== 'string' && (
                          <Chip
                            label={domain.status.charAt(0).toUpperCase() + domain.status.slice(1)}
                            color={getStatusColor(domain.status) as any}
                            size='small'
                            variant='tonal'
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        {typeof domain !== 'string' && (
                          <Chip
                            label={domain.ssl ? 'Active' : 'Inactive'}
                            color={domain.ssl ? 'success' : 'default'}
                            size='small'
                            variant='tonal'
                          />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant='body2' color='text.secondary'>
                          {typeof domain === 'string' ? '' : domain.site || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Tooltip title='Remove'>
                          <IconButton size='small' onClick={() => setDeleteConfirm({ open: true, type: 'site', index, domain: typeof domain === 'string' ? domain : domain.domain })}>
                            <i className='tabler-trash text-[18px]' />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography color='text.secondary'>No custom domains.</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add Sending Domain Dialog */}
      <Dialog open={addSendingOpen} onClose={() => setAddSendingOpen(false)} maxWidth='sm' fullWidth fullScreen={isMobile}>
        <DialogTitle>Add sending domain</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            Enter the domain you want to authenticate for sending emails. You will need to add DNS records to verify
            ownership.
          </Typography>
          <TextField
            fullWidth
            label='Domain'
            value={newDomain}
            onChange={e => setNewDomain(e.target.value)}
            placeholder='e.g. mail.yourdomain.com'
            autoFocus
            sx={{ mt: 1 }}
            onKeyDown={e => e.key === 'Enter' && handleAddSendingDomain()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddSendingOpen(false)} color='secondary'>
            Cancel
          </Button>
          <Button onClick={handleAddSendingDomain} variant='contained' disabled={!newDomain.trim() || saving}>
            Add domain
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Site Domain Dialog */}
      <Dialog open={addSiteOpen} onClose={() => setAddSiteOpen(false)} maxWidth='sm' fullWidth fullScreen={isMobile}>
        <DialogTitle>Add custom domain</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            Enter the custom domain for your website or landing page.
          </Typography>
          <TextField
            fullWidth
            label='Domain'
            value={newDomain}
            onChange={e => setNewDomain(e.target.value)}
            placeholder='e.g. www.yourdomain.com'
            autoFocus
            sx={{ mt: 1 }}
            onKeyDown={e => e.key === 'Enter' && handleAddSiteDomain()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddSiteOpen(false)} color='secondary'>
            Cancel
          </Button>
          <Button onClick={handleAddSiteDomain} variant='contained' disabled={!newDomain.trim() || saving}>
            Add domain
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Domain Confirmation */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm(prev => ({ ...prev, open: false }))} fullScreen={isMobile}>
        <DialogTitle>Remove Domain</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove <strong>{deleteConfirm.domain}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(prev => ({ ...prev, open: false }))}>Cancel</Button>
          <Button onClick={handleDeleteConfirmed} color='error' variant='contained'>
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* Domain Verification Wizard */}
      <DomainVerificationDialog
        open={!!verifyDomain}
        onClose={() => setVerifyDomain(null)}
        domain={verifyDomain || ''}
        onVerificationComplete={(domain, status) => {
          setForm(prev => ({
            ...prev,
            sending_domains: prev.sending_domains.map(d =>
              d.domain === domain ? { ...d, status } : d
            )
          }))

          if (status === 'verified') {
            onSaveSuccess('Domain verified successfully!')
          }
        }}
      />
    </div>
  )
}

export default DomainsTab
