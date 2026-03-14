'use client'

import { useState, useEffect } from 'react'

import { useParams, useRouter } from 'next/navigation'

import { useSession } from 'next-auth/react'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import Divider from '@mui/material/Divider'
import Collapse from '@mui/material/Collapse'

import { getLocalizedUrl } from '@/utils/i18n'
import type { Locale } from '@/configs/i18n'

interface ChecklistStep {
  id: string
  title: string
  description: string
  buttonLabel: string
  buttonUrl: string
  icon: string
}

const steps: ChecklistStep[] = [
  {
    id: 'connect_whatsapp',
    title: 'Connect your WhatsApp Business API',
    description: 'Set up your Gupshup API credentials to start sending WhatsApp messages to your contacts.',
    buttonLabel: 'Configure API',
    buttonUrl: '/whatsapp/settings',
    icon: 'tabler-brand-whatsapp'
  },
  {
    id: 'import_contacts',
    title: 'Import your contacts',
    description: 'Upload your contact list via CSV or add contacts manually to build your WhatsApp audience.',
    buttonLabel: 'Import contacts',
    buttonUrl: '/whatsapp/contacts/import',
    icon: 'tabler-users-plus'
  },
  {
    id: 'create_template',
    title: 'Create a message template',
    description: 'Design your first WhatsApp message template for campaigns. Choose from our template library or create your own.',
    buttonLabel: 'Browse templates',
    buttonUrl: '/whatsapp/templates/library',
    icon: 'tabler-template'
  },
  {
    id: 'send_campaign',
    title: 'Send your first campaign',
    description: 'Create and send your first WhatsApp marketing campaign to engage with your audience.',
    buttonLabel: 'Create campaign',
    buttonUrl: '/whatsapp/campaigns/create',
    icon: 'tabler-send'
  }
]

const getStorageKey = (accountId: number | null) => `wa_onboarding_${accountId || 'default'}`

const WAOnboardingChecklist = () => {
  const [completedSteps, setCompletedSteps] = useState<string[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [expandedStep, setExpandedStep] = useState<string | null>(null)

  const router = useRouter()
  const { lang: locale } = useParams()
  const { data: session } = useSession()

  const accountId = session?.accountId ?? null

  // Load saved state from localStorage (SSR-safe)
  useEffect(() => {
    if (accountId === null || typeof window === 'undefined') return

    const key = getStorageKey(accountId)
    const saved = localStorage.getItem(key)

    if (saved) {
      try {
        const data = JSON.parse(saved)
        const completed: string[] = data.completed || []

        setCompletedSteps(completed)
        setDismissed(data.dismissed || false)

        // Auto-expand first incomplete step based on loaded data
        const firstIncomplete = steps.find(s => !completed.includes(s.id))

        setExpandedStep(firstIncomplete?.id || null)
      } catch (_e) {
        // ignore
      }
    } else {
      // No saved data — expand first step
      setExpandedStep(steps[0]?.id || null)
    }
  }, [accountId])

  // Persist state to localStorage when it changes (SSR-safe)
  useEffect(() => {
    if (accountId === null || typeof window === 'undefined') return

    const key = getStorageKey(accountId)

    localStorage.setItem(key, JSON.stringify({ completed: completedSteps, dismissed }))
  }, [completedSteps, dismissed, accountId])

  // Auto-expand first incomplete step when completedSteps changes
  useEffect(() => {
    const firstIncomplete = steps.find(s => !completedSteps.includes(s.id))

    setExpandedStep(firstIncomplete?.id || null)
  }, [completedSteps])

  const handleComplete = (stepId: string) => {
    if (!completedSteps.includes(stepId)) {
      setCompletedSteps(prev => [...prev, stepId])
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
  }

  const progress = (completedSteps.length / steps.length) * 100

  if (dismissed || completedSteps.length === steps.length) return null

  return (
    <Card sx={{ bgcolor: 'action.hover', border: 'none', boxShadow: 'none' }}>
      <CardContent sx={{ p: { xs: 4, sm: 6 } }}>
        <Box sx={{ display: 'flex', gap: { xs: 4, md: 8 }, flexDirection: { xs: 'column', md: 'row' } }}>
          {/* Left side - Header */}
          <Box sx={{ flex: '0 0 auto', maxWidth: { md: 280 } }}>
            <Typography variant='h5' fontWeight={700} sx={{ mb: 1 }}>
              Let&apos;s get you started WhatsApp Marketing
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
              Use this personalised guide to start your WhatsApp marketing journey.
            </Typography>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
              {completedSteps.length} / {steps.length} steps
            </Typography>
            <LinearProgress
              variant='determinate'
              value={progress}
              sx={{ height: 6, borderRadius: 3, bgcolor: 'divider' }}
              color='success'
            />
          </Box>

          {/* Right side - Steps */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {steps.map((step, index) => {
              const isCompleted = completedSteps.includes(step.id)
              const isExpanded = expandedStep === step.id

              return (
                <Box key={step.id}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 2,
                      py: 2.5,
                      cursor: isCompleted ? 'default' : 'pointer',
                      opacity: isCompleted ? 0.5 : 1
                    }}
                    onClick={() => !isCompleted && setExpandedStep(isExpanded ? null : step.id)}
                  >
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        bgcolor: isCompleted ? 'success.main' : 'action.selected',
                        color: isCompleted ? 'success.contrastText' : 'text.secondary',
                        fontSize: '0.875rem',
                        fontWeight: 600
                      }}
                    >
                      {isCompleted ? <i className='tabler-check' style={{ fontSize: 16 }} /> : index + 1}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography
                        variant='subtitle1'
                        fontWeight={600}
                        sx={{ textDecoration: isCompleted ? 'line-through' : 'none' }}
                      >
                        {step.title}
                      </Typography>
                      <Collapse in={isExpanded && !isCompleted}>
                        <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5, mb: 2 }}>
                          {step.description}
                        </Typography>
                        <Button
                          variant='contained'
                          color='success'
                          size='small'
                          onClick={e => {
                            e.stopPropagation()
                            router.push(getLocalizedUrl(step.buttonUrl, locale as Locale))
                          }}
                        >
                          {step.buttonLabel}
                        </Button>
                      </Collapse>
                    </Box>
                    {!isCompleted && (
                      <Typography
                        variant='body2'
                        color='text.secondary'
                        sx={{
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          '&:hover': { color: 'text.primary' }
                        }}
                        onClick={e => {
                          e.stopPropagation()
                          handleComplete(step.id)
                        }}
                      >
                        <i className='tabler-check' style={{ fontSize: 14, marginRight: 4 }} />
                        Mark completed
                      </Typography>
                    )}
                  </Box>
                  {index < steps.length - 1 && <Divider />}
                </Box>
              )
            })}
          </Box>
        </Box>

        {/* Dismiss */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
          <Typography
            variant='body2'
            color='text.secondary'
            sx={{ cursor: 'pointer', '&:hover': { color: 'text.primary' } }}
            onClick={handleDismiss}
          >
            <i className='tabler-x' style={{ fontSize: 14, marginRight: 4 }} />
            Dismiss checklist
          </Typography>
        </Box>
      </CardContent>
    </Card>
  )
}

export default WAOnboardingChecklist
