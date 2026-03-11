'use client'

import { useState, useMemo, useEffect } from 'react'

// MUI Imports
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogContent from '@mui/material/DialogContent'
import Divider from '@mui/material/Divider'
import Grid from '@mui/material/Grid'
import Link from '@mui/material/Link'
import Typography from '@mui/material/Typography'

// Data
import { DNS_PROVIDERS, getProviderDnsUrl } from '@/data/dnsProviders'
import type { DnsProvider } from '@/data/dnsProviders'

// Services
import accountSettingsService from '@/services/accountSettings'

// Hook Imports
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'

// Types
import type { DnsRecordResult } from '@/types/email'

interface Props {
  open: boolean
  onClose: () => void
  domain: string
  onVerificationComplete?: (domain: string, status: 'verified' | 'failed') => void
}

interface DnsRecord {
  label: string
  type: string
  name: string
  value: string
}

const DomainVerificationDialog = ({ open, onClose, domain, onVerificationComplete }: Props) => {
  const [selectedProvider, setSelectedProvider] = useState<DnsProvider | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verificationResults, setVerificationResults] = useState<DnsRecordResult[] | null>(null)
  const [verificationError, setVerificationError] = useState<string | null>(null)

  const isMobile = useMobileBreakpoint()

  // Reset all state when domain changes (e.g. dialog reopened for different domain)
  useEffect(() => {
    setSelectedProvider(null)
    setVerificationResults(null)
    setVerificationError(null)
    setCopiedField(null)
    setVerifying(false)
  }, [domain])

  const verificationHash = useMemo(() => {
    let hash = 0

    for (let i = 0; i < domain.length; i++) {
      const char = domain.charCodeAt(i)

      hash = (hash << 5) - hash + char
      hash |= 0
    }

    const hex = Math.abs(hash).toString(16).padStart(8, '0')

    return `${hex}${hex.split('').reverse().join('')}${hex}cfa4334fc1`
  }, [domain])

  const dnsRecords: DnsRecord[] = [
    {
      label: 'TXT Record (DKIM)',
      type: 'txt',
      name: 'mail._domainkey',
      value: 'v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3djCDl+eiseykwRr6PoYI98t2JZRhScMrWAJB7RtRkxp+M2KlwRKHEIYyetyu+lDc85pdVbZmgIn8VZPA1P0eVd2d7GtqdQ7fWRxuv9ph+f57p0P75j/rD+EjsrqvzzFwxBK3/VaXuijR625rhk3/HIaK64kcQiTqTcmGjVj9hQCs98XIXSN4oASSW37dMK4ijPmWXG8RL8gu5EOWYVa3qnCvRo519Q22KMSasEFyijgVXh+cKslbI846Gv4D7WoqFn3Ff0Bnaj4kj+HPlNlcuW9WP4gvytX5xT0OMxJ0d6DvlMvbPJld9NI6TpRD0dJGsupX56O6O/V11f/wWVnuQIDAQAB'
    },
    {
      label: 'TXT Record (SPF)',
      type: 'txt',
      name: '@',
      value: 'v=spf1 ip4:194.180.176.91 include:_spf.google.com ~all'
    },
    {
      label: 'TXT Record (Domain Verification)',
      type: 'txt',
      name: '@',
      value: `nepsefilling-domain-verification=${verificationHash}`
    }
  ]

  const handleClose = () => {
    setSelectedProvider(null)
    setVerificationResults(null)
    setVerificationError(null)
    setVerifying(false)
    onClose()
  }

  const handleBack = () => {
    setSelectedProvider(null)
    setVerificationResults(null)
    setVerificationError(null)
  }

  const handleCopy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      const textarea = document.createElement('textarea')

      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setVerificationError(null)

    try {
      const result = await accountSettingsService.verifyDomain(domain)
      const data = result.data

      setVerificationResults(data.records)

      if (data.all_passed) {
        onVerificationComplete?.(domain, 'verified')
      }
    } catch (err: any) {
      setVerificationError(err?.response?.data?.message || 'Failed to verify domain. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  const getRecordStatus = (recordType: string): 'pass' | 'fail' | null => {
    if (!verificationResults) return null
    const result = verificationResults.find(r => r.record_type === recordType)

    return result ? result.status : null
  }

  const allPassed = verificationResults?.every(r => r.status === 'pass') ?? false

  const DnsValueBox = ({ label, value, fieldId }: { label: string; value: string; fieldId: string }) => (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant='body2' fontWeight={600} sx={{ mb: 1 }}>
        {label}
      </Typography>
      <Box
        sx={{
          backgroundColor: '#2d2d2d',
          borderRadius: 1,
          p: 2,
          position: 'relative',
          minHeight: 60,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between'
        }}
      >
        <Typography
          variant='body2'
          sx={{
            color: '#fff',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            pr: 8
          }}
        >
          {value}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
          <Button
            size='small'
            variant='contained'
            onClick={() => handleCopy(value, fieldId)}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.15)',
              color: '#fff',
              textTransform: 'none',
              fontSize: '0.75rem',
              minWidth: 'auto',
              px: 1.5,
              py: 0.5,
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.25)' }
            }}
            startIcon={<i className='tabler-copy text-[14px]' />}
          >
            {copiedField === fieldId ? 'Copied!' : 'Copy'}
          </Button>
        </Box>
      </Box>
    </Box>
  )

  // ===== PHASE 1: Provider Selection =====
  const renderProviderSelection = () => (
    <>
      <Typography variant='h5' fontWeight={700} sx={{ mb: 1 }}>
        Select your DNS provider
      </Typography>
      <Typography variant='body2' color='text.secondary' sx={{ mb: 4 }}>
        Choose your DNS provider so we can show you step-by-step instructions for setting up your domain records.
      </Typography>

      <Grid container spacing={2}>
        {DNS_PROVIDERS.map(provider => (
          <Grid key={provider.id} size={{ xs: 6, sm: 4 }}>
            <Card
              variant='outlined'
              sx={{
                transition: 'all 0.2s',
                '&:hover': {
                  borderColor: provider.color,
                  boxShadow: `0 0 0 1px ${provider.color}40`
                }
              }}
            >
              <CardActionArea
                onClick={() => setSelectedProvider(provider)}
                sx={{ p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}
              >
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    backgroundColor: `${provider.color}15`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <i className={`${provider.icon} text-[22px]`} style={{ color: provider.color }} />
                </Box>
                <Typography variant='body2' fontWeight={600} textAlign='center'>
                  {provider.name}
                </Typography>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
        <Button variant='outlined' onClick={handleClose}>
          Cancel
        </Button>
      </Box>
    </>
  )

  // ===== PHASE 2 & 3: Instructions + Records + Verification =====
  const renderInstructions = () => {
    if (!selectedProvider) return null

    const dnsUrl = getProviderDnsUrl(selectedProvider, domain)

    // Map each dns record index to its backend record_type key
    const getRecordTypeKey = (index: number): string => {
      if (index === 0) return 'TXT_DKIM'
      if (index === 1) return 'TXT_SPF'

      return 'TXT_VERIFY'
    }

    return (
      <>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Button
            size='small'
            startIcon={<i className='tabler-arrow-left text-[16px]' />}
            onClick={handleBack}
            sx={{ textTransform: 'none' }}
          >
            Back
          </Button>
        </Box>

        <Typography variant='h5' fontWeight={700} sx={{ mb: 1 }}>
          Configure DNS records for {domain}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <i className={`${selectedProvider.icon} text-[18px]`} style={{ color: selectedProvider.color }} />
            <Typography variant='body2' fontWeight={600}>
              {selectedProvider.name}
            </Typography>
          </Box>
          {dnsUrl && (
            <Button
              variant='outlined'
              size='small'
              startIcon={<i className='tabler-external-link text-[14px]' />}
              href={dnsUrl}
              target='_blank'
              rel='noopener noreferrer'
              sx={{ textTransform: 'none' }}
            >
              Open DNS Dashboard
            </Button>
          )}
        </Box>

        {selectedProvider.notes && (
          <Alert severity='info' sx={{ mb: 3 }}>
            {selectedProvider.notes}
          </Alert>
        )}

        {/* DNS Records with Instructions */}
        {dnsRecords.map((record, index) => {
          const recordTypeKey = getRecordTypeKey(index)
          const status = getRecordStatus(recordTypeKey)
          // All records are now TXT records (DKIM, SPF, Verification)
          const instructions = selectedProvider.instructions.txt

          return (
            <Box key={index} sx={{ mb: 3 }}>
              {/* Record header with status */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                {status === 'pass' ? (
                  <i className='tabler-circle-check-filled text-[24px]' style={{ color: '#4caf50' }} />
                ) : status === 'fail' ? (
                  <i className='tabler-circle-x-filled text-[24px]' style={{ color: '#f44336' }} />
                ) : (
                  <i className='tabler-circle text-[24px]' style={{ color: '#bdbdbd' }} />
                )}
                <Typography variant='body1' fontWeight={600}>
                  {record.label}
                </Typography>
              </Box>

              {/* Status alert */}
              {status === 'fail' && (
                <Alert severity='error' sx={{ mb: 2 }}>
                  {record.label} was not found. Make sure you have added it to your DNS settings.
                </Alert>
              )}
              {status === 'pass' && (
                <Alert severity='success' sx={{ mb: 2 }}>
                  {record.label} verified successfully!
                </Alert>
              )}

              {/* Provider-specific instructions (show before verification and on fail) */}
              {status !== 'pass' && (
                <Box sx={{ mb: 2, pl: 5 }}>
                  {instructions.map((step, stepIdx) => (
                    <Typography key={stepIdx} variant='body2' color='text.secondary' sx={{ mb: 0.5 }}>
                      {stepIdx + 1}. {step}
                    </Typography>
                  ))}
                </Box>
              )}

              {/* DNS record values */}
              <Box sx={{ display: 'flex', gap: 2, mb: 1, flexDirection: { xs: 'column', sm: 'row' }, pl: { sm: 5 } }}>
                <DnsValueBox label='Name' value={record.name} fieldId={`${index}-name`} />
                <DnsValueBox label='Value' value={record.value} fieldId={`${index}-value`} />
              </Box>

              {index < dnsRecords.length - 1 && <Divider sx={{ mt: 3 }} />}
            </Box>
          )
        })}

        {/* Verification Results Summary */}
        {verificationResults && allPassed && (
          <Alert severity='success' sx={{ mb: 3 }}>
            <Typography fontWeight={600}>All DNS records verified successfully!</Typography>
            <Typography variant='body2'>Your domain is now authenticated for sending emails.</Typography>
          </Alert>
        )}

        {verificationResults && !allPassed && (
          <Alert severity='warning' sx={{ mb: 3 }}>
            <Typography fontWeight={600}>Some records are missing or incorrect</Typography>
            <Typography variant='body2'>
              DNS changes can take up to 48 hours to propagate. You can check again later.
            </Typography>
          </Alert>
        )}

        {verificationError && (
          <Alert severity='error' sx={{ mb: 3 }}>
            {verificationError}
          </Alert>
        )}

        {/* Action buttons */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 4 }}>
          <Button variant='outlined' onClick={handleClose}>
            {allPassed ? 'Done' : 'Close'}
          </Button>
          {!allPassed && (
            <Button
              variant='contained'
              color='success'
              onClick={handleVerify}
              disabled={verifying}
              startIcon={
                verifying ? (
                  <CircularProgress size={18} color='inherit' />
                ) : (
                  <i className='tabler-check text-[18px]' />
                )
              }
            >
              {verifying ? 'Verifying...' : verificationResults ? 'Check Again' : 'Verify Records'}
            </Button>
          )}
        </Box>
      </>
    )
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth='md' fullWidth scroll='paper' fullScreen={isMobile}>
      <DialogContent sx={{ p: { xs: 3, sm: 5 } }}>
        {selectedProvider ? renderInstructions() : renderProviderSelection()}
      </DialogContent>
    </Dialog>
  )
}

export default DomainVerificationDialog
