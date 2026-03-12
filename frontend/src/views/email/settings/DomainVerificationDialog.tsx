'use client'

import { useState, useEffect } from 'react'

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
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'

// Data
import { DNS_PROVIDERS, getProviderDnsUrl } from '@/data/dnsProviders'
import type { DnsProvider } from '@/data/dnsProviders'

// Services
import domainService from '@/services/domains'

// Hook Imports
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'

// Types
import type { DomainRecord, DnsRecord, DnsRecordResult } from '@/types/email'

interface Props {
  open: boolean
  onClose: () => void
  domainRecord: DomainRecord | null
  onVerificationComplete?: (domainId: number, status: 'verified' | 'failed') => void
}

const DomainVerificationDialog = ({ open, onClose, domainRecord, onVerificationComplete }: Props) => {
  const [selectedProvider, setSelectedProvider] = useState<DnsProvider | null>(null)
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verificationResults, setVerificationResults] = useState<DnsRecordResult[] | null>(null)
  const [verificationError, setVerificationError] = useState<string | null>(null)

  // DNS records fetched from API
  const [dnsRecords, setDnsRecords] = useState<DnsRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(false)

  const isMobile = useMobileBreakpoint()

  // Reset all state when domain changes
  useEffect(() => {
    setSelectedProvider(null)
    setVerificationResults(null)
    setVerificationError(null)
    setCopiedField(null)
    setVerifying(false)
    setDnsRecords([])
  }, [domainRecord?.id])

  // Fetch DNS records from API when provider is selected
  useEffect(() => {
    if (!selectedProvider || !domainRecord) return

    const fetchRecords = async () => {
      try {
        setLoadingRecords(true)
        const response = await domainService.getDnsRecords(domainRecord.id)

        setDnsRecords(response.data.records)
      } catch (err) {
        console.error('Failed to fetch DNS records:', err)
        setVerificationError('Failed to load DNS records. Please try again.')
      } finally {
        setLoadingRecords(false)
      }
    }

    fetchRecords()
  }, [selectedProvider, domainRecord?.id])

  const domain = domainRecord?.domain || ''
  const hasSendGrid = (domainRecord?.sendgrid_domain_id ?? 0) > 0

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
    if (!domainRecord) return

    setVerifying(true)
    setVerificationError(null)

    try {
      const result = await domainService.verify(domainRecord.id)
      const data = result.data

      setVerificationResults(data.records)

      if (data.all_passed) {
        onVerificationComplete?.(domainRecord.id, 'verified')
      }
    } catch (err: any) {
      setVerificationError(err?.response?.data?.message || 'Failed to verify domain. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  // Map DNS record to its verification result
  const getRecordStatusByLabel = (label: string): 'pass' | 'fail' | null => {
    if (!verificationResults) return null

    // Map label to record_type
    const labelMap: Record<string, string[]> = {
      'CNAME Record (DKIM 1)': ['CNAME_DKIM1'],
      'CNAME Record (DKIM 2)': ['CNAME_DKIM2'],
      'CNAME Record (Mail)': ['CNAME_MAIL'],
      'TXT Record (DKIM)': ['TXT_DKIM'],
      'TXT Record (SPF)': ['TXT_SPF'],
      'TXT Record (DMARC)': ['TXT_DMARC'],
      'TXT Record (Domain Verification)': ['TXT_VERIFY']
    }

    const types = labelMap[label] || []

    for (const t of types) {
      const result = verificationResults.find(r => r.record_type === t)

      if (result) return result.status as 'pass' | 'fail'
    }

    return null
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
      <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
        Choose your DNS provider so we can show you step-by-step instructions for setting up your domain records.
      </Typography>

      {hasSendGrid && domainRecord?.type === 'sending' && (
        <Alert severity='info' sx={{ mb: 3 }}>
          <strong>SendGrid Integration Active</strong> — Your domain is set up with SendGrid for email delivery.
          You&apos;ll need to add CNAME records (not TXT) for DKIM authentication.
        </Alert>
      )}

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

    if (loadingRecords) {
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6, gap: 2 }}>
          <CircularProgress />
          <Typography color='text.secondary'>Loading DNS records...</Typography>
        </Box>
      )
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

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <i className={`${selectedProvider.icon} text-[18px]`} style={{ color: selectedProvider.color }} />
            <Typography variant='body2' fontWeight={600}>
              {selectedProvider.name}
            </Typography>
          </Box>
          {hasSendGrid && (
            <Chip label='SendGrid' size='small' color='success' variant='outlined' />
          )}
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

        {hasSendGrid && (
          <Alert severity='warning' sx={{ mb: 3 }}>
            <strong>Important:</strong> For CNAME records, make sure proxy is set to <strong>&quot;DNS only&quot;</strong> (grey cloud icon in Cloudflare). Proxied CNAME records will not work for email authentication.
          </Alert>
        )}

        {/* DNS Records */}
        {dnsRecords.map((record, index) => {
          const status = getRecordStatusByLabel(record.label)
          const isCNAME = record.type === 'CNAME'

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
                <Chip
                  label={record.type}
                  size='small'
                  color={isCNAME ? 'info' : 'default'}
                  variant='outlined'
                />
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

              {/* Instructions */}
              {status !== 'pass' && (
                <Box sx={{ mb: 2, pl: 5 }}>
                  {isCNAME ? (
                    <>
                      <Typography variant='body2' color='text.secondary' sx={{ mb: 0.5 }}>
                        1. Go to your DNS provider&apos;s dashboard
                      </Typography>
                      <Typography variant='body2' color='text.secondary' sx={{ mb: 0.5 }}>
                        2. Add a new <strong>CNAME</strong> record
                      </Typography>
                      <Typography variant='body2' color='text.secondary' sx={{ mb: 0.5 }}>
                        3. Set the Name and Value as shown below
                      </Typography>
                      <Typography variant='body2' color='text.secondary' sx={{ mb: 0.5 }}>
                        4. Set Proxy to <strong>&quot;DNS only&quot;</strong> (not proxied)
                      </Typography>
                    </>
                  ) : (
                    selectedProvider.instructions.txt.map((step, stepIdx) => (
                      <Typography key={stepIdx} variant='body2' color='text.secondary' sx={{ mb: 0.5 }}>
                        {stepIdx + 1}. {step}
                      </Typography>
                    ))
                  )}
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
            <Typography variant='body2'>
              Your domain is now authenticated for sending emails via SendGrid.
            </Typography>
          </Alert>
        )}

        {verificationResults && !allPassed && (
          <Alert severity='warning' sx={{ mb: 3 }}>
            <Typography fontWeight={600}>Some records are missing or incorrect</Typography>
            <Typography variant='body2'>
              DNS changes can take up to 48 hours to propagate. You can check again later.
              Make sure CNAME records are set to &quot;DNS only&quot; (not proxied).
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
