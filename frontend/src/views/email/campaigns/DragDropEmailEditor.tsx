'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

import { useRouter, useParams, useSearchParams } from 'next/navigation'

import dynamic from 'next/dynamic'

import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import IconButton from '@mui/material/IconButton'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import CircularProgress from '@mui/material/CircularProgress'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'
import campaignService from '@/services/campaigns'
import subscriberService from '@/services/subscribers'
import listService from '@/services/lists'
import templateService from '@/services/templates'

import type { EditorRef } from 'react-email-editor'

import { blockCategories, BlockMiniPreview, blockRowTemplates } from './emailBlockData'

// Dynamic import to avoid SSR issues
const EmailEditor = dynamic(() => import('react-email-editor'), { ssr: false })

const DRAWER_WIDTH = 300

// ─── Main Editor Component ───
interface DragDropEmailEditorProps {
  campaignType: string
  onDone?: (html: string, json: object) => void
}

const DragDropEmailEditor = ({ campaignType }: DragDropEmailEditorProps) => {
  const router = useRouter()
  const { lang } = useParams()
  const searchParams = useSearchParams()
  const locale = (lang as string) || 'en'
  const emailEditorRef = useRef<any>(null)
  const unlayerRef = useRef<EditorRef | null>(null)
  const [activeCategory, setActiveCategory] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)
  const [previewMenuAnchor, setPreviewMenuAnchor] = useState<null | HTMLElement>(null)
  const [actionsMenuAnchor, setActionsMenuAnchor] = useState<null | HTMLElement>(null)
  const [testEmailOpen, setTestEmailOpen] = useState(false)
  const [testEmailAddress, setTestEmailAddress] = useState('')
  const [testEmailSending, setTestEmailSending] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const isMobile = useMobileBreakpoint()
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const fromCampaignId = searchParams.get('from_campaign')
  const fromTemplateId = searchParams.get('from_template')
  const fromUpload = searchParams.get('from_upload')
  const fromCampaignLoadedRef = useRef(false)
  const fromTemplateLoadedRef = useRef(false)
  const fromUploadLoadedRef = useRef(false)

  const onReady = useCallback((unlayer: EditorRef) => {
    unlayerRef.current = unlayer

    // Register custom image picker — opens media library instead of default file upload
    ;(unlayer as any).registerCallback('selectImage', (data: any, done: (result: { url: string }) => void) => {
      const w = Math.min(window.innerWidth - 40, 1100)
      const h = Math.min(window.innerHeight - 40, 700)
      const picker = window.open(`/${locale}/media?picker=true`, 'mediaPicker', `width=${w},height=${h},scrollbars=yes`)

      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return

        if (event.data?.type === 'media-picker-select' && event.data?.url) {
          done({ url: event.data.url })
          window.removeEventListener('message', handleMessage)
          if (checkClosed) clearInterval(checkClosed)
        }
      }

      window.addEventListener('message', handleMessage)

      let checkClosed: ReturnType<typeof setInterval> | null = null

      if (picker) {
        checkClosed = setInterval(() => {
          if (picker.closed) {
            clearInterval(checkClosed!)
            checkClosed = null
            window.removeEventListener('message', handleMessage)
          }
        }, 500)
      } else {
        window.removeEventListener('message', handleMessage)
      }
    })

    // Load uploaded HTML template from sessionStorage
    if (fromUpload && !fromUploadLoadedRef.current) {
      fromUploadLoadedRef.current = true
      const uploadedHtml = sessionStorage.getItem('campaign_email_html_upload')

      if (uploadedHtml) {
        ;(unlayer as any).loadDesign({
          html: uploadedHtml,
          classic: true
        })

        sessionStorage.removeItem('campaign_email_html_upload')
        setFeedbackMsg('Uploaded template loaded')
      }
    }

    // Load default design when starting from scratch (no campaign/template/upload source)
    if (!fromCampaignId && !fromTemplateId && !fromUpload) {
      // Unlayer will load with its own default starter template
      // No custom HTML injection needed — Unlayer's native editor handles it
    }

    // Load recent campaign content if from_campaign param is present
    if (fromCampaignId && !fromCampaignLoadedRef.current) {
      fromCampaignLoadedRef.current = true
      setLoadingTemplate(true)

      campaignService.getById(parseInt(fromCampaignId, 10))
        .then((response) => {
          const campaign = response.data

          if (campaign?.body) {
            ;(unlayer as any).loadDesign({
              html: campaign.body,
              classic: true
            })

            setFeedbackMsg('Template loaded from recent email')
          }
        })
        .catch((err) => {
          console.error('Failed to load campaign:', err)
          setFeedbackMsg('Failed to load campaign template')
        })
        .finally(() => {
          setLoadingTemplate(false)
        })
    }

    // Load template content if from_template param is present
    if (fromTemplateId && !fromTemplateLoadedRef.current) {
      fromTemplateLoadedRef.current = true
      setLoadingTemplate(true)

      templateService.getById(parseInt(fromTemplateId, 10))
        .then((response) => {
          const template = response.data

          if (template?.body) {
            ;(unlayer as any).loadDesign({
              html: template.body,
              classic: true
            })

            setFeedbackMsg('Template loaded successfully')
          }
        })
        .catch((err) => {
          console.error('Failed to load template:', err)
          setFeedbackMsg('Failed to load template')
        })
        .finally(() => {
          setLoadingTemplate(false)
        })
    }
  }, [fromCampaignId, fromTemplateId, fromUpload])

  const handleGoBack = () => {
    router.push(`/${locale}/campaigns/create?type=${campaignType}`)
  }

  const handleDoneEditing = () => {
    const unlayer = unlayerRef.current

    if (unlayer) {
      (unlayer as any).exportHtml((data: { design: object; html: string }) => {
        const { html } = data

        sessionStorage.setItem('campaign_email_html', html)
        sessionStorage.setItem('campaign_email_design', JSON.stringify(data.design))
        router.push(`/${locale}/campaigns/create?type=${campaignType}&template=scratch&editor=done`)
      })
    }
  }

  const handlePreview = () => {
    const unlayer = unlayerRef.current

    if (!unlayer) {
      setFeedbackMsg('Failed: Editor not ready yet')

      return
    }

    ;(unlayer as any).exportHtml((data: { html: string }) => {
      if (data?.html) {
        setPreviewHtml(data.html)
      } else {
        setFeedbackMsg('Failed: Could not export email HTML')
      }
    })
  }

  const handleSendTestEmail = () => {
    const unlayer = unlayerRef.current

    if (!unlayer) {
      setFeedbackMsg('Failed: Editor not ready yet')

      return
    }

    if (!testEmailAddress.trim()) return

    setTestEmailSending(true)

    ;(unlayer as any).exportHtml(async (data: { html: string }) => {
      const email = testEmailAddress.trim()
      let tempCampaignId: number | null = null
      let tempSubscriberId: number | null = null

      try {
        const listsRes = await listService.getAll({ per_page: 1 })
        const lists = listsRes.data?.results || []

        if (lists.length === 0) {
          setFeedbackMsg('Failed: No subscriber lists available')
          setTestEmailSending(false)

          return
        }

        const listId = lists[0].id

        let subscriberId: number | null = null

        try {
          const sanitizedEmail = email.replace(/'/g, "''").replace(/[;\-\\]/g, '').replace(/\/\*/g, '')

          const searchResult = await subscriberService.getAll({
            query: `subscribers.email='${sanitizedEmail}'`,
            per_page: 1
          })

          const results = searchResult.data?.results || []

          if (results.length > 0) subscriberId = results[0].id
        } catch { /* will create temp subscriber */ }

        if (!subscriberId) {
          const subResult = await subscriberService.create({
            email,
            name: 'Test Recipient',
            status: 'enabled',
            lists: [listId]
          })

          subscriberId = subResult.data.id
          tempSubscriberId = subscriberId
        }

        const tempResult = await campaignService.create({
          name: `Test Preview - ${new Date().toISOString()}`,
          subject: 'Test Email Preview',
          from_email: 'NEPSE Trading <noreply@nepsetrading.com>',
          type: campaignType as any,
          content_type: 'html',
          body: data.html,
          lists: [listId]
        })

        tempCampaignId = tempResult.data.id

        await campaignService.test(tempCampaignId, [email])

        setTestEmailOpen(false)
        setTestEmailAddress('')
        setFeedbackMsg('Test email sent')
      } catch (err: any) {
        console.error('Failed to send test email:', err)
        const msg = err?.response?.data?.message || err?.message || 'Failed to send test email'

        setFeedbackMsg(`Failed: ${msg}`)
      } finally {
        if (tempCampaignId) {
          try { await campaignService.delete(tempCampaignId) } catch { /* ignore */ }
        }

        if (tempSubscriberId) {
          try { await subscriberService.delete(tempSubscriberId) } catch { /* ignore */ }
        }

        setTestEmailSending(false)
      }
    })
  }

  const handleSaveAsTemplate = () => {
    const unlayer = unlayerRef.current

    if (!unlayer || !saveTemplateName.trim()) return

    setSavingTemplate(true)

    ;(unlayer as any).exportHtml(async (data: { design: object; html: string }) => {
      try {
        await templateService.create({
          name: saveTemplateName.trim(),
          type: 'html',
          body: data.html
        })

        setFeedbackMsg('Template saved successfully!')
        setSaveTemplateOpen(false)
        setSaveTemplateName('')
      } catch (err: any) {
        const msg = err?.response?.data?.message || err?.message || 'Failed to save template'
        console.error('Failed to save template:', err)
        setFeedbackMsg(`Failed: ${msg}`)
      } finally {
        setSavingTemplate(false)
      }
    })
  }

  // Add a block to the Unlayer editor
  const handleAddBlock = (previewKey: string, blockName?: string) => {
    const unlayer = unlayerRef.current
    const rowTemplate = blockRowTemplates[previewKey]

    if (!unlayer || !rowTemplate) return

    ;(unlayer as any).saveDesign((design: any) => {
      const updatedDesign = { ...design }

      if (!updatedDesign.body) updatedDesign.body = { rows: [] }
      if (!updatedDesign.body.rows) updatedDesign.body.rows = []

      updatedDesign.body.rows = [...updatedDesign.body.rows, JSON.parse(JSON.stringify(rowTemplate))]
      ;(unlayer as any).loadDesign(updatedDesign)

      const name = blockName || blockCategories.flatMap(c => c.blocks).find(b => b.previewKey === previewKey)?.name || 'Block'

      setFeedbackMsg(`${name} added to email`)
    })
  }

  const activeCat = blockCategories.find(c => c.name === activeCategory)

  const filteredBlocks = activeCat?.blocks.filter(b =>
    searchQuery ? b.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  ) || []

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)', mx: -6, mt: -6 }}>
      {/* Top Toolbar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
          px: 2,
          py: 0.75,
          bgcolor: '#1a1a2e',
          color: '#fff',
          minHeight: 48,
          zIndex: 1201
        }}
      >
        {/* Left: Go back */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant='outlined'
            size='small'
            onClick={handleGoBack}
            sx={{
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.3)',
              '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.08)' },
              textTransform: 'none',
              fontSize: '0.8rem'
            }}
            startIcon={<i className='tabler-arrow-left text-[16px]' />}
          >
            Go back
          </Button>
        </Box>

        {/* Right: Action buttons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Actions dropdown */}
          <Button
            size='small'
            onClick={(e) => setActionsMenuAnchor(e.currentTarget)}
            sx={{
              color: '#fff',
              bgcolor: 'rgba(255,255,255,0.1)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              textTransform: 'none',
              fontSize: '0.8rem',
              px: 2
            }}
            endIcon={<i className='tabler-chevron-down text-[12px]' />}
          >
            Actions
          </Button>
          <Menu
            anchorEl={actionsMenuAnchor}
            open={Boolean(actionsMenuAnchor)}
            onClose={() => setActionsMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={() => { setActionsMenuAnchor(null); setSaveTemplateOpen(true) }}>
              <ListItemIcon><i className='tabler-bookmark text-[18px]' /></ListItemIcon>
              <ListItemText>Save as template</ListItemText>
            </MenuItem>
          </Menu>

          {/* Preview and test dropdown */}
          <Button
            size='small'
            onClick={(e) => setPreviewMenuAnchor(e.currentTarget)}
            sx={{
              color: '#fff',
              bgcolor: 'rgba(255,255,255,0.1)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
              textTransform: 'none',
              fontSize: '0.8rem',
              px: 2
            }}
            startIcon={<i className='tabler-eye text-[16px]' />}
            endIcon={<i className='tabler-chevron-down text-[12px]' />}
          >
            <Box component='span' sx={{ display: { xs: 'none', sm: 'inline' } }}>Preview and test</Box>
          </Button>
          <Menu
            anchorEl={previewMenuAnchor}
            open={Boolean(previewMenuAnchor)}
            onClose={() => setPreviewMenuAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <MenuItem onClick={() => { setPreviewMenuAnchor(null); handlePreview() }}>
              <ListItemIcon><i className='tabler-eye text-[18px]' /></ListItemIcon>
              <ListItemText>Preview mode</ListItemText>
            </MenuItem>
            <MenuItem onClick={() => { setPreviewMenuAnchor(null); setTestEmailOpen(true) }}>
              <ListItemIcon><i className='tabler-send text-[18px]' /></ListItemIcon>
              <ListItemText>Send a test email</ListItemText>
            </MenuItem>
          </Menu>

          {/* Done editing */}
          <Button
            variant='contained'
            size='small'
            color='success'
            onClick={handleDoneEditing}
            startIcon={<i className='tabler-device-floppy text-[16px]' />}
            sx={{ textTransform: 'none', fontWeight: 600, px: 2.5 }}
          >
            Done editing
          </Button>
        </Box>
      </Box>

      {/* Editor area with right-side custom blocks panel */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Unlayer Editor — takes remaining space */}
        <Box sx={{ flex: 1, minWidth: 0, position: 'relative' }}>
          {/* Loading template overlay */}
          {loadingTemplate && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 20,
                bgcolor: 'rgba(255,255,255,0.85)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2
              }}
            >
              <CircularProgress size={36} />
              <Typography variant='body2' color='text.secondary' fontWeight={500}>
                Loading email template...
              </Typography>
            </Box>
          )}
          <EmailEditor
            ref={emailEditorRef as any}
            onReady={onReady as any}
            minHeight='100%'
            options={{
              displayMode: 'email',
              features: {
                textEditor: { spellChecker: true },
                userUploads: { enabled: true },
                stockImages: { enabled: true },
                undoRedo: { enabled: true },
                preview: { enabled: true }
              },
              appearance: {
                theme: 'modern_light',
                panels: {
                  tools: { dock: 'left' }
                }
              },
              tabs: {
                content: { enabled: true, active: true },
                blocks: { enabled: true },
                body: { enabled: true },
                images: { enabled: true },
                uploads: { enabled: true }
              },
              tools: {
                image: { enabled: true },
                button: { enabled: true },
                divider: { enabled: true },
                heading: { enabled: true },
                html: { enabled: true },
                menu: { enabled: true },
                social: { enabled: true },
                text: { enabled: true },
                timer: { enabled: true },
                video: { enabled: true }
              },
              mergeTags: [
                { name: 'Subscriber Name', value: '{{ .Subscriber.Name }}' },
                { name: 'Subscriber Email', value: '{{ .Subscriber.Email }}' },
                { name: 'Campaign Subject', value: '{{ .Campaign.Subject }}' },
                { name: 'Unsubscribe URL', value: '{{ UnsubscribeURL . }}' },
                { name: 'Message URL', value: '{{ MessageURL . }}' }
              ]
            } as any}
          />
        </Box>

        {/* Right-side toggle chevron */}
        <Box
          onClick={() => setDrawerOpen(!drawerOpen)}
          sx={{
            width: 20,
            minWidth: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            bgcolor: '#f0f0f0',
            borderLeft: '1px solid',
            borderColor: 'divider',
            '&:hover': { bgcolor: '#e0e0e0' },
            transition: 'background-color 0.2s'
          }}
        >
          <i
            className={`tabler-chevron-${drawerOpen ? 'right' : 'left'} text-[14px]`}
            style={{ color: '#757575' }}
          />
        </Box>

        {/* Right-side Custom Blocks Panel */}
        <Box
          sx={{
            width: drawerOpen ? { xs: '100%', sm: DRAWER_WIDTH } : 0,
            minWidth: drawerOpen ? { xs: '100%', sm: DRAWER_WIDTH } : 0,
            transition: 'width 0.3s, min-width 0.3s',
            overflow: 'hidden',
            display: 'flex',
            borderLeft: drawerOpen ? '1px solid' : 'none',
            borderColor: 'divider'
          }}
        >
          <Box
            sx={{
              width: DRAWER_WIDTH,
              minWidth: DRAWER_WIDTH,
              bgcolor: '#fff',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {activeCategory ? (
              <>
                {/* Block list header with back button */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.5, pt: 1.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <IconButton size='small' onClick={() => setActiveCategory('')} sx={{ color: 'text.secondary' }}>
                    <i className='tabler-arrow-left text-[18px]' />
                  </IconButton>
                  <Typography variant='subtitle2' fontWeight={600} sx={{ fontSize: '0.85rem', flex: 1 }}>
                    {activeCategory}
                  </Typography>
                  <IconButton size='small' onClick={() => setDrawerOpen(false)} sx={{ color: 'text.secondary' }}>
                    <i className='tabler-x text-[16px]' />
                  </IconButton>
                </Box>

                {/* Block items */}
                {filteredBlocks.length > 0 ? (
                  <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {filteredBlocks.map(block => (
                      <Box
                        key={block.previewKey}
                        onClick={() => handleAddBlock(block.previewKey, block.name)}
                        sx={{
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1.5,
                          p: 1.5,
                          cursor: 'pointer',
                          position: 'relative',
                          '&:hover': {
                            borderColor: '#4caf50',
                            boxShadow: '0 0 0 1px #4caf50',
                            '& .block-add-hint': { opacity: 1 }
                          },
                          transition: 'all 0.15s'
                        }}
                      >
                        <Box
                          className='block-add-hint'
                          sx={{
                            position: 'absolute',
                            top: 6,
                            right: 6,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            bgcolor: 'rgba(76,175,80,0.9)',
                            color: '#fff',
                            borderRadius: '12px',
                            px: 1,
                            py: 0.25,
                            fontSize: '0.65rem',
                            fontWeight: 600,
                            opacity: 0,
                            transition: 'opacity 0.15s',
                            zIndex: 1,
                            pointerEvents: 'none'
                          }}
                        >
                          <i className='tabler-plus text-[11px]' />
                          Add
                        </Box>
                        <Typography variant='body2' color='text.secondary' sx={{ mb: 0.5, fontSize: '0.8rem' }}>
                          {block.name}
                        </Typography>
                        <BlockMiniPreview previewKey={block.previewKey} />
                      </Box>
                    ))}
                  </Box>
                ) : activeCategory === 'Saved blocks' ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <i className='tabler-bookmark text-[32px]' style={{ color: '#bdbdbd' }} />
                    <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                      No saved blocks yet
                    </Typography>
                  </Box>
                ) : null}
              </>
            ) : (
              <>
                {/* Category list view */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, pt: 1.5, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant='subtitle2' fontWeight={600} sx={{ fontSize: '0.85rem' }}>
                    Blocks
                  </Typography>
                  <IconButton size='small' onClick={() => setDrawerOpen(false)} sx={{ color: 'text.secondary' }}>
                    <i className='tabler-x text-[16px]' />
                  </IconButton>
                </Box>

                {/* Search */}
                <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <TextField
                    fullWidth
                    size='small'
                    placeholder='Search blocks...'
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position='start'>
                          <i className='tabler-search text-[16px]' />
                        </InputAdornment>
                      )
                    }}
                    sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.85rem' } }}
                  />
                </Box>

                {/* Category items */}
                <Box sx={{ overflowY: 'auto', flex: 1 }}>
                  {blockCategories.filter(cat =>
                    !searchQuery ||
                    cat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    cat.blocks.some(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  ).map(cat => (
                    <Box
                      key={cat.name}
                      onClick={() => { setActiveCategory(cat.name); setSearchQuery('') }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        px: 2,
                        py: 1.25,
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: 1,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          bgcolor: '#f5f5f5'
                        }}
                      >
                        <i className={`${cat.icon} text-[17px]`} style={{ color: '#757575' }} />
                      </Box>
                      <Typography variant='body2' sx={{ flex: 1, fontSize: '0.85rem' }}>
                        {cat.name}
                      </Typography>
                      <Typography variant='caption' color='text.secondary' sx={{ mr: 0.5 }}>
                        {cat.blocks.length}
                      </Typography>
                      <i className='tabler-chevron-right text-[14px]' style={{ color: '#bdbdbd' }} />
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Box>
        </Box>
      </Box>

      {/* Feedback snackbar */}
      <Snackbar
        open={!!feedbackMsg}
        autoHideDuration={2500}
        onClose={() => setFeedbackMsg(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setFeedbackMsg(null)}
          severity={feedbackMsg?.startsWith('Failed') ? 'error' : 'success'}
          variant='filled'
          icon={<i className={`${feedbackMsg?.startsWith('Failed') ? 'tabler-x' : 'tabler-check'} text-[18px]`} />}
          sx={{ minWidth: 250 }}
        >
          {feedbackMsg}
        </Alert>
      </Snackbar>

      {/* Send test email dialog */}
      <Dialog open={testEmailOpen} onClose={() => setTestEmailOpen(false)} maxWidth='xs' fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <i className='tabler-send text-[20px]' />
          Send a test email
        </DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            Send a preview of this email to test how it looks in an inbox.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label='Email address'
            type='email'
            size='small'
            value={testEmailAddress}
            onChange={e => setTestEmailAddress(e.target.value)}
            placeholder='test@example.com'
            onKeyDown={e => { if (e.key === 'Enter' && testEmailAddress.trim()) handleSendTestEmail() }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setTestEmailOpen(false)} size='small'>
            Cancel
          </Button>
          <Button
            variant='contained'
            size='small'
            onClick={handleSendTestEmail}
            disabled={!testEmailAddress.trim() || testEmailSending}
            startIcon={testEmailSending ? <i className='tabler-loader-2 animate-spin text-[16px]' /> : <i className='tabler-send text-[16px]' />}
          >
            {testEmailSending ? 'Sending...' : 'Send test'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Email Preview dialog */}
      <Dialog
        open={!!previewHtml}
        onClose={() => setPreviewHtml(null)}
        maxWidth='md'
        fullWidth
        fullScreen={isMobile}
        PaperProps={{ sx: { height: isMobile ? '100%' : '85vh' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1.5, px: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <i className='tabler-eye text-[20px]' />
            Email Preview
          </Box>
          <IconButton onClick={() => setPreviewHtml(null)} size='small'>
            <i className='tabler-x text-[18px]' />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0, overflow: 'hidden' }}>
          {previewHtml && (
            <iframe
              srcDoc={previewHtml}
              sandbox='allow-same-origin'
              style={{ width: '100%', height: '100%', border: 'none' }}
              title='Email Preview'
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Save as Template dialog */}
      <Dialog open={saveTemplateOpen} onClose={() => setSaveTemplateOpen(false)} maxWidth='xs' fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <i className='tabler-bookmark text-[20px]' />
          Save as template
        </DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            Save this email design as a reusable template. You can find it under &ldquo;My templates&rdquo; in the Template gallery.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label='Template name'
            size='small'
            value={saveTemplateName}
            onChange={e => setSaveTemplateName(e.target.value)}
            placeholder='e.g. Monthly Newsletter'
            onKeyDown={e => { if (e.key === 'Enter' && saveTemplateName.trim()) handleSaveAsTemplate() }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSaveTemplateOpen(false)} size='small'>
            Cancel
          </Button>
          <Button
            variant='contained'
            size='small'
            onClick={handleSaveAsTemplate}
            disabled={!saveTemplateName.trim() || savingTemplate}
            startIcon={savingTemplate ? <i className='tabler-loader-2 animate-spin text-[16px]' /> : <i className='tabler-bookmark text-[16px]' />}
          >
            {savingTemplate ? 'Saving...' : 'Save template'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default DragDropEmailEditor
