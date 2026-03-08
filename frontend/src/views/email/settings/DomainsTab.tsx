'use client'

import { useState, useEffect } from 'react'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Grid from '@mui/material/Grid'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
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
import DialogActions from '@mui/material/DialogActions'

// Services
import accountSettingsService from '@/services/accountSettings'

// Types
import type { DomainsConfig, SendingDomain } from '@/types/email'

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

  const [saving, setSaving] = useState(false)
  const [addDomainOpen, setAddDomainOpen] = useState(false)
  const [newDomain, setNewDomain] = useState('')

  useEffect(() => {
    if (data) {
      setForm(data)
    }
  }, [data])

  const handleAddDomain = () => {
    if (!newDomain.trim()) return

    const domain: SendingDomain = {
      domain: newDomain.trim(),
      status: 'pending',
      domain_alignment: false
    }

    setForm(prev => ({
      ...prev,
      sending_domains: [...prev.sending_domains, domain]
    }))

    setNewDomain('')
    setAddDomainOpen(false)
  }

  const handleRemoveDomain = (index: number) => {
    setForm(prev => ({
      ...prev,
      sending_domains: prev.sending_domains.filter((_, i) => i !== index)
    }))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      await accountSettingsService.updateDomains(form)
      onSaveSuccess('Domain settings updated successfully')
    } catch (err) {
      console.error('Failed to save domain settings:', err)
      onSaveError('Failed to update domain settings')
    } finally {
      setSaving(false)
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
        <CardContent>
          <div className='flex flex-col gap-4'>
            <div className='flex items-center justify-between'>
              <div>
                <Typography variant='h6' className='mb-1'>
                  Sending domains
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Authenticate your sending domains to improve deliverability and domain reputation
                </Typography>
              </div>
              <Button
                variant='contained'
                size='small'
                startIcon={<i className='tabler-plus' />}
                onClick={() => setAddDomainOpen(true)}
              >
                Add domain
              </Button>
            </div>

            {form.sending_domains.length > 0 ? (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Domain</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Domain alignment</TableCell>
                      <TableCell align='right'>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {form.sending_domains.map((domain, index) => (
                      <TableRow key={index} hover>
                        <TableCell>
                          <Typography className='font-medium' color='text.primary'>
                            {domain.domain}
                          </Typography>
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
                            label={domain.domain_alignment ? 'Aligned' : 'Not aligned'}
                            color={domain.domain_alignment ? 'success' : 'default'}
                            size='small'
                            variant='tonal'
                          />
                        </TableCell>
                        <TableCell align='right'>
                          <div className='flex items-center justify-end gap-1'>
                            <Tooltip title='Verify'>
                              <IconButton size='small'>
                                <i className='tabler-check text-[18px]' />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title='DNS Records'>
                              <IconButton size='small'>
                                <i className='tabler-file-text text-[18px]' />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title='Remove'>
                              <IconButton size='small' onClick={() => handleRemoveDomain(index)}>
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
            ) : (
              <Alert severity='info'>
                No sending domains configured. Add a domain to improve email deliverability.
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sites */}
      <Card>
        <CardContent>
          <div className='flex flex-col gap-4'>
            <div>
              <Typography variant='h6' className='mb-1'>
                Sites
              </Typography>
              <Typography variant='body2' color='text.secondary'>
                Custom domains for landing pages and forms
              </Typography>
            </div>

            <Alert severity='info' icon={<i className='tabler-info-circle text-[20px]' />}>
              Custom domains for landing pages and forms are included in Paid plans. Upgrade your plan to use custom
              site domains.
            </Alert>

            {form.site_domains.length > 0 && (
              <div className='flex flex-wrap gap-2'>
                {form.site_domains.map((domain, index) => (
                  <Chip
                    key={index}
                    label={domain}
                    onDelete={() => {
                      setForm(prev => ({
                        ...prev,
                        site_domains: prev.site_domains.filter((_, i) => i !== index)
                      }))
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className='flex justify-end'>
        <Button
          variant='contained'
          color='success'
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? null : <i className='tabler-device-floppy' />}
        >
          {saving ? 'Saving...' : 'Save changes'}
        </Button>
      </div>

      {/* Add Domain Dialog */}
      <Dialog open={addDomainOpen} onClose={() => setAddDomainOpen(false)} maxWidth='sm' fullWidth>
        <DialogTitle>Add sending domain</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' className='mb-4'>
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
            className='mt-2'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDomainOpen(false)} color='secondary'>
            Cancel
          </Button>
          <Button onClick={handleAddDomain} variant='contained' disabled={!newDomain.trim()}>
            Add domain
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default DomainsTab
