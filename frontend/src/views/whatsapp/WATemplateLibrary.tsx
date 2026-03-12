'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import { useRouter, useParams } from 'next/navigation'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import TextField from '@mui/material/TextField'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import InputAdornment from '@mui/material/InputAdornment'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'

// Service Imports
import whatsappService from '@/services/whatsapp'

// ========== TEMPLATE LIBRARY DATA ==========
interface LibraryTemplate {
  id: string
  name: string
  displayName: string
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION'
  language: string
  description: string
  body: string
  example: string
  variables: string[]
  tags: string[]
  icon: string
}

const TEMPLATE_LIBRARY: LibraryTemplate[] = [
  // ===== MARKETING Templates =====
  {
    id: 'welcome_message',
    name: 'welcome_message',
    displayName: 'Welcome Message',
    category: 'MARKETING',
    language: 'en',
    description: 'Greet new contacts when they join your list',
    body: 'Welcome to NepseTrading {{1}}! We are excited to have you on board. Stay tuned for exclusive market insights and trading updates. Reply STOP to unsubscribe.',
    example: 'Welcome to NepseTrading John! We are excited to have you on board. Stay tuned for exclusive market insights and trading updates. Reply STOP to unsubscribe.',
    variables: ['Contact Name'],
    tags: ['onboarding', 'welcome'],
    icon: 'tabler-hand-wave'
  },
  {
    id: 'special_offer',
    name: 'special_offer',
    displayName: 'Special Offer / Promotion',
    category: 'MARKETING',
    language: 'en',
    description: 'Send promotions and discount offers to your audience',
    body: 'Hi {{1}}, great news! We have a special offer for you. {{2}}. This offer is valid until {{3}}. Do not miss out! Reply STOP to unsubscribe.',
    example: 'Hi John, great news! We have a special offer for you. Get 20 percent off on premium membership. This offer is valid until March 31 2026. Do not miss out! Reply STOP to unsubscribe.',
    variables: ['Contact Name', 'Offer Details', 'Expiry Date'],
    tags: ['promotion', 'offer', 'discount'],
    icon: 'tabler-discount-2'
  },
  {
    id: 'event_invitation',
    name: 'event_invitation',
    displayName: 'Event Invitation',
    category: 'MARKETING',
    language: 'en',
    description: 'Invite contacts to workshops, webinars, or events',
    body: 'Hello {{1}}, you are invited to our upcoming event {{2}} on {{3}}. Join us to learn about the latest market trends and strategies. Reply STOP to unsubscribe.',
    example: 'Hello John, you are invited to our upcoming event NEPSE Market Analysis Workshop on March 20 2026 at 3 PM. Join us to learn about the latest market trends and strategies. Reply STOP to unsubscribe.',
    variables: ['Contact Name', 'Event Name', 'Date & Time'],
    tags: ['event', 'invitation', 'webinar'],
    icon: 'tabler-calendar-event'
  },
  {
    id: 'newsletter_update',
    name: 'newsletter_update',
    displayName: 'Newsletter / Market Update',
    category: 'MARKETING',
    language: 'en',
    description: 'Share market updates and newsletters with subscribers',
    body: 'Hi {{1}}, here is your market update for {{2}}. {{3}}. Visit our website for detailed analysis. Reply STOP to unsubscribe.',
    example: 'Hi John, here is your market update for March 2026. NEPSE index closed at 2850 points with a gain of 15 points today. Visit our website for detailed analysis. Reply STOP to unsubscribe.',
    variables: ['Contact Name', 'Period', 'Update Summary'],
    tags: ['newsletter', 'market', 'update'],
    icon: 'tabler-news'
  },
  {
    id: 'product_launch',
    name: 'product_launch',
    displayName: 'Product / Service Launch',
    category: 'MARKETING',
    language: 'en',
    description: 'Announce new products or services to your audience',
    body: 'Hello {{1}}, we are thrilled to announce {{2}}! {{3}}. Be among the first to try it out. Visit {{4}} for more details. Reply STOP to unsubscribe.',
    example: 'Hello John, we are thrilled to announce our new Premium Trading Signals service! Get real-time buy and sell alerts directly on WhatsApp. Be among the first to try it out. Visit www.nepsetrading.com/premium for more details. Reply STOP to unsubscribe.',
    variables: ['Contact Name', 'Product Name', 'Description', 'URL'],
    tags: ['launch', 'product', 'announcement'],
    icon: 'tabler-rocket'
  },
  {
    id: 'feedback_request',
    name: 'feedback_request',
    displayName: 'Feedback Request',
    category: 'MARKETING',
    language: 'en',
    description: 'Ask customers for feedback on your services',
    body: 'Hi {{1}}, we value your opinion! How was your experience with {{2}}? Please take a moment to share your feedback. Reply with a rating from 1 to 5. Reply STOP to unsubscribe.',
    example: 'Hi John, we value your opinion! How was your experience with our Premium Membership? Please take a moment to share your feedback. Reply with a rating from 1 to 5. Reply STOP to unsubscribe.',
    variables: ['Contact Name', 'Service/Product Name'],
    tags: ['feedback', 'survey', 'review'],
    icon: 'tabler-message-star'
  },
  {
    id: 'seasonal_greeting',
    name: 'seasonal_greeting',
    displayName: 'Seasonal / Festival Greeting',
    category: 'MARKETING',
    language: 'en',
    description: 'Send festival or holiday greetings to your audience',
    body: 'Dear {{1}}, wishing you a very Happy {{2}} from the NepseTrading family! May this occasion bring you prosperity and success in all your ventures. Reply STOP to unsubscribe.',
    example: 'Dear John, wishing you a very Happy Dashain from the NepseTrading family! May this occasion bring you prosperity and success in all your ventures. Reply STOP to unsubscribe.',
    variables: ['Contact Name', 'Festival/Occasion'],
    tags: ['greeting', 'festival', 'holiday'],
    icon: 'tabler-confetti'
  },
  {
    id: 'referral_program',
    name: 'referral_program',
    displayName: 'Referral Program',
    category: 'MARKETING',
    language: 'en',
    description: 'Promote your referral program to existing customers',
    body: 'Hi {{1}}, share NepseTrading with your friends and earn rewards! Use your referral code {{2}} and both you and your friend get {{3}}. Start sharing today! Reply STOP to unsubscribe.',
    example: 'Hi John, share NepseTrading with your friends and earn rewards! Use your referral code REF-JOHN123 and both you and your friend get 1 month free premium access. Start sharing today! Reply STOP to unsubscribe.',
    variables: ['Contact Name', 'Referral Code', 'Reward'],
    tags: ['referral', 'rewards', 'invite'],
    icon: 'tabler-users-plus'
  },

  // ===== UTILITY Templates =====
  {
    id: 'order_confirmation',
    name: 'order_confirmation',
    displayName: 'Order Confirmation',
    category: 'UTILITY',
    language: 'en',
    description: 'Confirm customer orders with delivery details',
    body: 'Hello {{1}}, your order {{2}} has been confirmed. Expected delivery by {{3}}. Thank you for choosing NepseTrading!',
    example: 'Hello John, your order ORD-12345 has been confirmed. Expected delivery by March 15 2026. Thank you for choosing NepseTrading!',
    variables: ['Contact Name', 'Order ID', 'Delivery Date'],
    tags: ['order', 'confirmation', 'delivery'],
    icon: 'tabler-package'
  },
  {
    id: 'appointment_reminder',
    name: 'appointment_reminder',
    displayName: 'Appointment Reminder',
    category: 'UTILITY',
    language: 'en',
    description: 'Remind customers about their upcoming appointments',
    body: 'Hi {{1}}, this is a reminder about your upcoming appointment on {{2}} at {{3}}. Please reply YES to confirm or NO to reschedule.',
    example: 'Hi John, this is a reminder about your upcoming appointment on March 15 2026 at 2:30 PM. Please reply YES to confirm or NO to reschedule.',
    variables: ['Contact Name', 'Date', 'Time'],
    tags: ['appointment', 'reminder', 'schedule'],
    icon: 'tabler-calendar-check'
  },
  {
    id: 'account_update',
    name: 'account_update',
    displayName: 'Account Update Notification',
    category: 'UTILITY',
    language: 'en',
    description: 'Notify users about changes to their account',
    body: 'Hello {{1}}, your account has been updated successfully. If you did not make this change please contact our support team immediately.',
    example: 'Hello John, your account has been updated successfully. If you did not make this change please contact our support team immediately.',
    variables: ['Contact Name'],
    tags: ['account', 'security', 'notification'],
    icon: 'tabler-user-check'
  },
  {
    id: 'payment_confirmation',
    name: 'payment_confirmation',
    displayName: 'Payment Confirmation',
    category: 'UTILITY',
    language: 'en',
    description: 'Confirm payment receipt to customers',
    body: 'Hello {{1}}, we have received your payment of {{2}} for {{3}}. Transaction ID: {{4}}. Thank you!',
    example: 'Hello John, we have received your payment of NPR 5000 for Premium Membership. Transaction ID: TXN-789456. Thank you!',
    variables: ['Contact Name', 'Amount', 'Service', 'Transaction ID'],
    tags: ['payment', 'receipt', 'transaction'],
    icon: 'tabler-receipt'
  },
  {
    id: 'shipping_update',
    name: 'shipping_update',
    displayName: 'Shipping / Delivery Update',
    category: 'UTILITY',
    language: 'en',
    description: 'Update customers on shipping status',
    body: 'Hi {{1}}, your order {{2}} is now {{3}}. Tracking number: {{4}}. Contact us if you have any questions.',
    example: 'Hi John, your order ORD-12345 is now out for delivery. Tracking number: TRK-987654. Contact us if you have any questions.',
    variables: ['Contact Name', 'Order ID', 'Status', 'Tracking Number'],
    tags: ['shipping', 'delivery', 'tracking'],
    icon: 'tabler-truck-delivery'
  },
  {
    id: 'support_ticket_update',
    name: 'support_ticket_update',
    displayName: 'Support Ticket Update',
    category: 'UTILITY',
    language: 'en',
    description: 'Notify customers about support ticket status changes',
    body: 'Hello {{1}}, your support ticket {{2}} has been updated. Status: {{3}}. Our team is working to resolve your issue as quickly as possible.',
    example: 'Hello John, your support ticket TICKET-456 has been updated. Status: In Progress. Our team is working to resolve your issue as quickly as possible.',
    variables: ['Contact Name', 'Ticket ID', 'Status'],
    tags: ['support', 'ticket', 'helpdesk'],
    icon: 'tabler-headset'
  },
  {
    id: 'subscription_renewal',
    name: 'subscription_renewal',
    displayName: 'Subscription Renewal Reminder',
    category: 'UTILITY',
    language: 'en',
    description: 'Remind customers about upcoming subscription renewals',
    body: 'Hi {{1}}, your {{2}} subscription expires on {{3}}. Renew now to continue enjoying uninterrupted service. Contact us for any questions.',
    example: 'Hi John, your Premium Membership subscription expires on March 31 2026. Renew now to continue enjoying uninterrupted service. Contact us for any questions.',
    variables: ['Contact Name', 'Plan Name', 'Expiry Date'],
    tags: ['subscription', 'renewal', 'billing'],
    icon: 'tabler-refresh'
  },

  // ===== AUTHENTICATION Templates =====
  {
    id: 'otp_verification',
    name: 'otp_verification',
    displayName: 'OTP Verification',
    category: 'AUTHENTICATION',
    language: 'en',
    description: 'Send OTP codes for account verification',
    body: 'Your NepseTrading verification code is {{1}}. This code expires in 10 minutes. Do not share this code with anyone.',
    example: 'Your NepseTrading verification code is 456789. This code expires in 10 minutes. Do not share this code with anyone.',
    variables: ['OTP Code'],
    tags: ['otp', 'verification', 'security'],
    icon: 'tabler-shield-lock'
  },
  {
    id: 'password_reset',
    name: 'password_reset',
    displayName: 'Password Reset',
    category: 'AUTHENTICATION',
    language: 'en',
    description: 'Send password reset codes or links',
    body: 'Hello {{1}}, your password reset code is {{2}}. This code is valid for 15 minutes. If you did not request this please ignore this message.',
    example: 'Hello John, your password reset code is 123456. This code is valid for 15 minutes. If you did not request this please ignore this message.',
    variables: ['Contact Name', 'Reset Code'],
    tags: ['password', 'reset', 'security'],
    icon: 'tabler-key'
  }
]

// Category colors
const categoryColorMap: Record<string, 'primary' | 'info' | 'warning' | 'default'> = {
  MARKETING: 'primary',
  UTILITY: 'info',
  AUTHENTICATION: 'warning'
}

const WATemplateLibrary = () => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'

  // State
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState(0) // 0=All, 1=Marketing, 2=Utility, 3=Auth
  const [creating, setCreating] = useState<string | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<LibraryTemplate | null>(null)
  const [customBody, setCustomBody] = useState('')
  const [customExample, setCustomExample] = useState('')
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  // Filter templates
  const categoryFilters = ['ALL', 'MARKETING', 'UTILITY', 'AUTHENTICATION']
  const activeCategory = categoryFilters[activeTab]

  const filteredTemplates = TEMPLATE_LIBRARY.filter(t => {
    const matchesCategory = activeCategory === 'ALL' || t.category === activeCategory
    const matchesSearch = search === '' ||
      t.displayName.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(search.toLowerCase()))

    return matchesCategory && matchesSearch
  })

  // Use template directly
  const handleUseTemplate = async (template: LibraryTemplate, body?: string, example?: string) => {
    setCreating(template.id)

    try {
      await whatsappService.createTemplate({
        name: template.name,
        category: template.category,
        language: template.language,
        body: body || template.body,
        example: example || template.example
      })

      setSnackbar({
        open: true,
        message: `Template "${template.displayName}" created and submitted for Meta approval!`,
        severity: 'success'
      })

      setPreviewTemplate(null)

      // Navigate to templates page after short delay
      setTimeout(() => {
        router.push(`/${locale}/whatsapp/templates`)
      }, 1500)
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to create template'

      setSnackbar({ open: true, message: msg, severity: 'error' })
    } finally {
      setCreating(null)
    }
  }

  // Open preview/customize dialog
  const handlePreview = (template: LibraryTemplate) => {
    setPreviewTemplate(template)
    setCustomBody(template.body)
    setCustomExample(template.example)
  }

  return (
    <>
      <Grid container spacing={6}>
        {/* Header */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <div className='flex items-center justify-between flex-wrap gap-4'>
                <div>
                  <Typography variant='h5'>
                    <i className='tabler-books mr-2' style={{ verticalAlign: 'middle' }} />
                    Template Library
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    Browse pre-built WhatsApp message templates. Pick a template, customize it, and submit for Meta approval.
                  </Typography>
                </div>
                <div className='flex gap-2'>
                  <Button
                    variant='outlined'
                    startIcon={<i className='tabler-template' />}
                    onClick={() => router.push(`/${locale}/whatsapp/templates`)}
                  >
                    My Templates
                  </Button>
                  <Button
                    variant='outlined'
                    startIcon={<i className='tabler-arrow-left' />}
                    onClick={() => router.push(`/${locale}/whatsapp`)}
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Info Banner */}
        <Grid size={{ xs: 12 }}>
          <Alert severity='info' icon={<i className='tabler-info-circle' />}>
            <strong>How it works:</strong> Select a template from the library → Customize the message if needed → Click &quot;Use Template&quot; to submit it to Meta for approval.
            Templates are usually approved within a few minutes. Only approved templates can be used in campaigns.
          </Alert>
        </Grid>

        {/* Search & Filter */}
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <div className='flex flex-col gap-4'>
                <TextField
                  fullWidth
                  placeholder='Search templates by name, description, or tag...'
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position='start'>
                          <i className='tabler-search' />
                        </InputAdornment>
                      )
                    }
                  }}
                />
                <Tabs
                  value={activeTab}
                  onChange={(_, val) => setActiveTab(val)}
                  variant='scrollable'
                  scrollButtons='auto'
                >
                  <Tab label={`All (${TEMPLATE_LIBRARY.length})`} />
                  <Tab label={`Marketing (${TEMPLATE_LIBRARY.filter(t => t.category === 'MARKETING').length})`} />
                  <Tab label={`Utility (${TEMPLATE_LIBRARY.filter(t => t.category === 'UTILITY').length})`} />
                  <Tab label={`Authentication (${TEMPLATE_LIBRARY.filter(t => t.category === 'AUTHENTICATION').length})`} />
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Template Grid */}
        {filteredTemplates.length === 0 ? (
          <Grid size={{ xs: 12 }}>
            <Card>
              <CardContent className='text-center py-12'>
                <i className='tabler-search-off text-[48px] mb-4' style={{ color: 'var(--mui-palette-text-secondary)' }} />
                <Typography variant='h6' className='mb-2'>No templates found</Typography>
                <Typography color='text.secondary'>
                  Try adjusting your search or filter to find templates.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ) : (
          filteredTemplates.map(template => (
            <Grid key={template.id} size={{ xs: 12, sm: 6, lg: 4 }}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardHeader
                  avatar={
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'action.hover'
                      }}
                    >
                      <i className={`${template.icon} text-[24px]`} style={{ color: 'var(--mui-palette-primary-main)' }} />
                    </Box>
                  }
                  title={
                    <Typography variant='subtitle1' className='font-semibold'>
                      {template.displayName}
                    </Typography>
                  }
                  subheader={
                    <div className='flex items-center gap-1 mt-1'>
                      <Chip
                        label={template.category}
                        color={categoryColorMap[template.category] || 'default'}
                        size='small'
                        variant='outlined'
                      />
                      <Chip
                        label={template.language.toUpperCase()}
                        size='small'
                        variant='outlined'
                      />
                    </div>
                  }
                />
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant='body2' color='text.secondary' className='mb-3'>
                    {template.description}
                  </Typography>

                  {/* Preview Body */}
                  <Box
                    className='p-3 rounded mb-3'
                    sx={{ backgroundColor: 'action.hover', whiteSpace: 'pre-wrap' }}
                  >
                    <Typography variant='body2' sx={{ fontSize: '0.8rem' }}>
                      {template.body.length > 150
                        ? template.body.substring(0, 150) + '...'
                        : template.body}
                    </Typography>
                  </Box>

                  {/* Variables */}
                  {template.variables.length > 0 && (
                    <div className='flex gap-1 flex-wrap'>
                      <Typography variant='caption' color='text.secondary' className='mr-1'>
                        Variables:
                      </Typography>
                      {template.variables.map((v, i) => (
                        <Chip
                          key={i}
                          label={`{{${i + 1}}} ${v}`}
                          size='small'
                          variant='outlined'
                          color='secondary'
                          sx={{ fontSize: '0.7rem' }}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between', px: 3, pb: 3 }}>
                  <Button
                    size='small'
                    variant='outlined'
                    onClick={() => handlePreview(template)}
                    startIcon={<i className='tabler-eye' />}
                  >
                    Preview & Customize
                  </Button>
                  <Button
                    size='small'
                    variant='contained'
                    color='success'
                    onClick={() => handleUseTemplate(template)}
                    disabled={creating === template.id}
                    startIcon={
                      creating === template.id
                        ? <CircularProgress size={16} />
                        : <i className='tabler-plus' />
                    }
                  >
                    {creating === template.id ? 'Creating...' : 'Use Template'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {/* Preview & Customize Dialog */}
      <Dialog
        open={previewTemplate !== null}
        onClose={() => setPreviewTemplate(null)}
        maxWidth='md'
        fullWidth
      >
        {previewTemplate && (
          <>
            <DialogTitle>
              <div className='flex items-center gap-2'>
                <i className={previewTemplate.icon} style={{ color: 'var(--mui-palette-primary-main)' }} />
                {previewTemplate.displayName}
                <Chip
                  label={previewTemplate.category}
                  color={categoryColorMap[previewTemplate.category] || 'default'}
                  size='small'
                  variant='outlined'
                />
              </div>
            </DialogTitle>
            <DialogContent>
              <div className='flex flex-col gap-4 mt-2'>
                <Typography variant='body2' color='text.secondary'>
                  {previewTemplate.description}
                </Typography>

                <Alert severity='info' className='mb-2'>
                  <strong>Template Name:</strong> {previewTemplate.name} &nbsp;|&nbsp;
                  <strong>Language:</strong> {previewTemplate.language} &nbsp;|&nbsp;
                  <strong>Category:</strong> {previewTemplate.category}
                </Alert>

                {/* Variables Info */}
                {previewTemplate.variables.length > 0 && (
                  <Box>
                    <Typography variant='subtitle2' className='mb-2'>Template Variables</Typography>
                    <div className='flex gap-2 flex-wrap'>
                      {previewTemplate.variables.map((v, i) => (
                        <Chip
                          key={i}
                          label={`{{${i + 1}}} = ${v}`}
                          variant='outlined'
                          color='secondary'
                          size='small'
                        />
                      ))}
                    </div>
                  </Box>
                )}

                {/* Editable Body */}
                <TextField
                  fullWidth
                  multiline
                  minRows={4}
                  label='Message Body'
                  value={customBody}
                  onChange={e => setCustomBody(e.target.value)}
                  helperText='Use {{1}}, {{2}}, etc. for dynamic variables. Customize the message for your business.'
                />

                {/* Editable Example */}
                <TextField
                  fullWidth
                  multiline
                  minRows={2}
                  label='Example (with real values replacing variables)'
                  value={customExample}
                  onChange={e => setCustomExample(e.target.value)}
                  helperText='Meta requires an example with actual values. Make sure all {{N}} variables are replaced.'
                />

                {/* WhatsApp Preview */}
                <Box>
                  <Typography variant='subtitle2' className='mb-2'>WhatsApp Preview</Typography>
                  <Box
                    sx={{
                      backgroundColor: '#DCF8C6',
                      borderRadius: 2,
                      p: 2,
                      maxWidth: 360,
                      position: 'relative',
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        right: -8,
                        top: 0,
                        width: 0,
                        height: 0,
                        borderLeft: '8px solid #DCF8C6',
                        borderTop: '8px solid transparent',
                        borderBottom: '8px solid transparent'
                      }
                    }}
                  >
                    <Typography variant='body2' sx={{ whiteSpace: 'pre-wrap', color: '#303030', fontSize: '0.875rem' }}>
                      {customBody}
                    </Typography>
                    <Typography variant='caption' sx={{ color: '#667781', float: 'right', mt: 0.5 }}>
                      12:00 PM ✓✓
                    </Typography>
                  </Box>
                </Box>
              </div>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setPreviewTemplate(null)}>Cancel</Button>
              <Button
                variant='contained'
                color='success'
                onClick={() => handleUseTemplate(previewTemplate, customBody, customExample)}
                disabled={creating === previewTemplate.id}
                startIcon={
                  creating === previewTemplate.id
                    ? <CircularProgress size={18} />
                    : <i className='tabler-plus' />
                }
              >
                {creating === previewTemplate.id ? 'Creating...' : 'Create & Submit for Approval'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant='filled'
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  )
}

export default WATemplateLibrary
