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
import CircularProgress from '@mui/material/CircularProgress'

// Components
import DomainVerificationDialog from './DomainVerificationDialog'

// Services
import domainService from '@/services/domains'

// Types
import type { DomainRecord } from '@/types/email'

// Hook Imports
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'

interface Props {
  onSaveSuccess: (message: string) => void
  onSaveError: (message: string) => void
}

const DomainsTab = ({ onSaveSuccess, onSaveError }: Props) => {
  const [sendingDomains, setSendingDomains] = useState<DomainRecord[]>([])
  const [siteDomains, setSiteDomains] = useState<DomainRecord[]>([])
  const [loading, setLoading] = useState(true)

  const [addSendingOpen, setAddSendingOpen] = useState(false)
  const [addSiteOpen, setAddSiteOpen] = useState(false)
  const [newDomain, setNewDomain] = useState('')
  const [saving, setSaving] = useState(false)
  const [verifyDomain, setVerifyDomain] = useState<DomainRecord | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; domain: DomainRecord | null }>({
    open: false, domain: null
  })

  const isMobile = useMobileBreakpoint()

  const fetchDomains = async () => {
    try {
      setLoading(true)

      const response = await domainService.list()
      const all = response.data || []

      setSendingDomains(all.filter(d => d.type === 'sending'))
      setSiteDomains(all.filter(d => d.type === 'site'))
    } catch (err) {
      console.error('Failed to fetch domains:', err)
      onSaveError('Failed to load domains')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDomains()
  }, [])

  const isValidDomain = (d: string) => /^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/.test(d)

  const handleAddSendingDomain = async () => {
    if (!newDomain.trim()) return

    const domainName = newDomain.trim().toLowerCase()

    if (!isValidDomain(domainName)) {
      onSaveError('Please enter a valid domain name (e.g. mail.yourdomain.com)')
      return
    }

    try {
      setSaving(true)
      const response = await domainService.create(domainName, 'sending')

      setNewDomain('')
      setAddSendingOpen(false)

      // Add to local state immediately
      setSendingDomains(prev => [...prev, response.data])

      // Open verification dialog
      setVerifyDomain(response.data)
    } catch (err: any) {
      onSaveError(err?.response?.data?.message || 'Failed to add domain')
    } finally {
      setSaving(false)
    }
  }

  const handleAddSiteDomain = async () => {
    if (!newDomain.trim()) return

    const domainName = newDomain.trim().toLowerCase()

    if (!isValidDomain(domainName)) {
      onSaveError('Please enter a valid domain name (e.g. www.yourdomain.com)')
      return
    }

    try {
      setSaving(true)
      const response = await domainService.create(domainName, 'site')

      setNewDomain('')
      setAddSiteOpen(false)
      setSiteDomains(prev => [...prev, response.data])
      onSaveSuccess('Domain added')
    } catch (err: any) {
      onSaveError(err?.response?.data?.message || 'Failed to add domain')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteDomain = async () => {
    if (!deleteConfirm.domain) return

    try {
      await domainService.delete(deleteConfirm.domain.id)

      if (deleteConfirm.domain.type === 'sending') {
        setSendingDomains(prev => prev.filter(d => d.id !== deleteConfirm.domain!.id))
      } else {
        setSiteDomains(prev => prev.filter(d => d.id !== deleteConfirm.domain!.id))
      }

      setDeleteConfirm({ open: false, domain: null })
      onSaveSuccess('Domain removed')
    } catch (err: any) {
      onSaveError(err?.response?.data?.message || 'Failed to remove domain')
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

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-[200px]'>
        <CircularProgress />
      </div>
    )
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
            Manage your sending domains. Each domain gets its own DKIM keys auto-generated for email authentication.{' '}
            <Link href='#' underline='hover' color='primary'>
              Learn more
            </Link>
            .
          </Typography>

          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Domain</TableCell>
                  <TableCell>Status</TableCell>
                  {sendingDomains.length > 0 && <TableCell align='right'>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {sendingDomains.length > 0 ? (
                  sendingDomains.map(domain => (
                    <TableRow key={domain.id} hover>
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
                          {domain.status !== 'verified' && (
                            <Tooltip title='Verify DNS records'>
                              <IconButton size='small' onClick={() => setVerifyDomain(domain)}>
                                <i className='tabler-settings text-[18px]' />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title='Remove'>
                            <IconButton size='small' onClick={() => setDeleteConfirm({ open: true, domain })}>
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
                  {siteDomains.length > 0 && <TableCell align='right'>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {siteDomains.length > 0 ? (
                  siteDomains.map(domain => (
                    <TableRow key={domain.id} hover>
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
                      <TableCell>
                        <Chip
                          label={domain.ssl ? 'Active' : 'Inactive'}
                          color={domain.ssl ? 'success' : 'default'}
                          size='small'
                          variant='tonal'
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant='body2' color='text.secondary'>
                          {domain.site || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Tooltip title='Remove'>
                          <IconButton size='small' onClick={() => setDeleteConfirm({ open: true, domain })}>
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
            Enter the domain you want to authenticate for sending emails. DKIM keys will be automatically generated,
            and you will need to add DNS records to verify ownership.
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
            {saving ? 'Adding...' : 'Add domain'}
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
            {saving ? 'Adding...' : 'Add domain'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Domain Confirmation */}
      <Dialog open={deleteConfirm.open} onClose={() => setDeleteConfirm({ open: false, domain: null })} fullScreen={isMobile}>
        <DialogTitle>Remove Domain</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to remove <strong>{deleteConfirm.domain?.domain}</strong>? This will also remove its
            DKIM keys. This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm({ open: false, domain: null })}>Cancel</Button>
          <Button onClick={handleDeleteDomain} color='error' variant='contained'>
            Remove
          </Button>
        </DialogActions>
      </Dialog>

      {/* Domain Verification Wizard */}
      <DomainVerificationDialog
        open={!!verifyDomain}
        onClose={() => setVerifyDomain(null)}
        domainRecord={verifyDomain}
        onVerificationComplete={(domainId, status) => {
          setSendingDomains(prev =>
            prev.map(d => (d.id === domainId ? { ...d, status } : d))
          )

          if (status === 'verified') {
            onSaveSuccess('Domain verified successfully!')
          }
        }}
      />
    </div>
  )
}

export default DomainsTab
