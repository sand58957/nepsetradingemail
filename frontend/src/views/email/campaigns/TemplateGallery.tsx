'use client'

import { useState, useEffect, useRef } from 'react'

import { useRouter, useParams } from 'next/navigation'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import CircularProgress from '@mui/material/CircularProgress'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import IconButton from '@mui/material/IconButton'

import type { Template } from '@/types/email'
import templateService from '@/services/templates'
import campaignService from '@/services/campaigns'
import { useMobileBreakpoint } from '@/hooks/useMobileBreakpoint'

// Helper: get display name (strip [Category] prefix if present)
const getDisplayName = (name: string): string => {
  return name.replace(/^\[[^\]]+\]\s*/, '')
}

// Helper: check if a template is a gallery template (has [Category] prefix in name)
const isGalleryTemplate = (t: Template): boolean => /^\[.+\]/.test(t.name)

// Helper: check if a template is a Listmonk default/system template (should be hidden)
const isDefaultTemplate = (t: Template): boolean => {
  const defaultNames = [
    'default campaign template',
    'default archive template',
    'sample transactional template',
    'sample visual template'
  ]

  return defaultNames.includes(t.name.toLowerCase())
}

interface TemplateGalleryProps {
  campaignType: string
}

const TemplateGallery = ({ campaignType }: TemplateGalleryProps) => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'
  const [activeTab, setActiveTab] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [loadedRecent, setLoadedRecent] = useState(false)
  const [previewDialog, setPreviewDialog] = useState<Template | null>(null)
  const [deleteDialog, setDeleteDialog] = useState<any>(null)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const isMobile = useMobileBreakpoint()

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true)

      try {
        const response = await templateService.getAll()

        setTemplates(response.data || [])
      } catch {
        console.error('Failed to fetch templates')
      } finally {
        setLoading(false)
      }
    }

    fetchTemplates()
  }, [])

  useEffect(() => {
    if (activeTab === 1 && !loadedRecent) {
      const fetchRecent = async () => {
        setLoadingRecent(true)

        try {
          const response = await campaignService.getAll({ per_page: 10 })

          setRecentCampaigns(response.data?.results || [])
        } catch {
          console.error('Failed to fetch recent campaigns')
        } finally {
          setLoadingRecent(false)
          setLoadedRecent(true)
        }
      }

      fetchRecent()
    }
  }, [activeTab, loadedRecent])

  const handleStartFromScratch = () => {
    router.push(`/${locale}/campaigns/create?type=${campaignType}&template=scratch`)
  }

  const handleSelectTemplate = (templateId: number) => {
    router.push(`/${locale}/campaigns/create?type=${campaignType}&template=scratch&from_template=${templateId}`)
  }

  const handleUseRecentCampaign = (campaign: any) => {
    router.push(`/${locale}/campaigns/create?type=${campaignType}&template=scratch&from_campaign=${campaign.id}`)
  }

  const handleDeleteCampaign = async () => {
    if (!deleteDialog) return

    setDeleting(true)

    try {
      await campaignService.delete(deleteDialog.id)
      setRecentCampaigns(prev => prev.filter(c => c.id !== deleteDialog.id))
    } catch {
      console.error('Failed to delete campaign')
    } finally {
      setDeleting(false)
      setDeleteDialog(null)
    }
  }

  const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]

    if (!file) return

    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.zip')) {
      // Handle ZIP file - extract HTML and images
      try {
        const JSZip = (await import('jszip')).default
        const zip = await JSZip.loadAsync(file)
        const files = Object.keys(zip.files)

        // Find HTML file in the ZIP
        const htmlFile = files.find(f => f.toLowerCase().endsWith('.html') || f.toLowerCase().endsWith('.htm'))

        if (!htmlFile) {
          alert('No HTML file found in the ZIP archive. Please include an .html or .htm file.')

          return
        }

        let html = await zip.files[htmlFile].async('string')

        // Find and convert images to base64 data URIs
        const imageFiles = files.filter(f => {
          const ext = f.toLowerCase()

          return ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') ||
                 ext.endsWith('.gif') || ext.endsWith('.svg') || ext.endsWith('.webp') || ext.endsWith('.ico')
        })

        for (const imgPath of imageFiles) {
          const imgData = await zip.files[imgPath].async('base64')
          const ext = imgPath.split('.').pop()?.toLowerCase() || 'png'
          const mimeMap: Record<string, string> = {
            png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
            gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp', ico: 'image/x-icon'
          }
          const mime = mimeMap[ext] || 'image/png'
          const dataUri = `data:${mime};base64,${imgData}`

          // Replace all references to this image file (relative paths, with or without folder)
          const imgFileName = imgPath.split('/').pop() || imgPath
          const escapedPath = imgPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const escapedName = imgFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

          // Replace full path references
          html = html.replace(new RegExp(escapedPath, 'g'), dataUri)

          // Replace filename-only references (e.g., src="image.png" or src="images/image.png")
          html = html.replace(new RegExp(`(?<=[\"'])([^\"']*/?)?${escapedName}(?=[\"'])`, 'g'), dataUri)
        }

        sessionStorage.setItem('campaign_email_html_upload', html)
        router.push(`/${locale}/campaigns/create?type=${campaignType}&template=scratch&from_upload=true`)
      } catch (err) {
        console.error('Failed to process ZIP file:', err)
        alert('Failed to process the ZIP file. Please ensure it contains a valid HTML template.')
      }
    } else {
      // Handle regular HTML file
      const reader = new FileReader()

      reader.onload = (event) => {
        const html = event.target?.result as string

        if (html) {
          sessionStorage.setItem('campaign_email_html_upload', html)
          router.push(`/${locale}/campaigns/create?type=${campaignType}&template=scratch&from_upload=true`)
        }
      }

      reader.readAsText(file)
    }

    // Reset input so same file can be re-uploaded
    e.target.value = ''
  }

  // Only show user-created templates (exclude gallery templates and default Listmonk templates)
  const userTemplates = templates.filter(t => !isGalleryTemplate(t) && !isDefaultTemplate(t))

  const filteredUserTemplates = userTemplates.filter(t =>
    searchQuery ? t.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  )

  // Template card component for user templates
  const TemplateCard = ({ template }: { template: Template }) => {
    const displayName = getDisplayName(template.name)

    return (
      <Card
        sx={{
          cursor: 'pointer',
          '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' },
          transition: 'all 0.2s'
        }}
        onClick={() => handleSelectTemplate(template.id)}
      >
        <Box
          sx={{
            height: 220,
            bgcolor: '#f8f9fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative'
          }}
        >
          {template.body ? (
            <iframe
              srcDoc={template.body}
              sandbox='allow-same-origin'
              loading='lazy'
              style={{
                width: '600px',
                height: '800px',
                transform: 'scale(0.35)',
                transformOrigin: 'top center',
                position: 'absolute',
                top: 0,
                left: '50%',
                marginLeft: '-300px',
                pointerEvents: 'none',
                border: 'none'
              }}
              title={`Preview of ${displayName}`}
            />
          ) : (
            <i className='tabler-mail text-[40px]' style={{ color: 'var(--mui-palette-text-disabled)' }} />
          )}
        </Box>
        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
          <Typography variant='body2' fontWeight={500} noWrap>
            {displayName}
          </Typography>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className='flex flex-col gap-4'>
      {/* Tab Bar */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{
            '& .MuiTab-root': { textTransform: 'none', fontWeight: 500, fontSize: '0.9rem' }
          }}
        >
          <Tab
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Template gallery
                <i className='tabler-layout-grid text-[16px]' />
              </Box>
            }
          />
          <Tab label='Recent emails' />
        </Tabs>
      </Box>

      {/* Tab 0: Template Gallery */}
      {activeTab === 0 && (
        <Box>
          {/* Search */}
          {userTemplates.length > 0 && (
            <Box sx={{ maxWidth: 400, mb: 3 }}>
              <TextField
                fullWidth
                size='small'
                placeholder='Search your templates...'
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position='start'>
                      <i className='tabler-search text-[18px]' />
                    </InputAdornment>
                  )
                }}
              />
            </Box>
          )}

          {/* Template Grid — always show Start from scratch + Upload cards */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
              gap: 3
            }}
          >
              {/* Start from scratch Card */}
              <Card
                sx={{
                  cursor: 'pointer',
                  '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' },
                  transition: 'all 0.2s',
                  overflow: 'hidden',
                  borderRadius: 3
                }}
                onClick={handleStartFromScratch}
              >
                <Box
                  sx={{
                    bgcolor: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 2,
                    py: 5,
                    px: 3
                  }}
                >
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <i className='tabler-layout-dashboard text-[40px]' style={{ color: '#555' }} />
                  </Box>
                  <Typography variant='subtitle1' fontWeight={700} sx={{ color: '#333' }}>
                    Start from scratch
                  </Typography>
                  <Typography variant='body2' color='text.secondary' sx={{ textAlign: 'center', lineHeight: 1.5 }}>
                    Create a custom design or<br />use ready-made blocks.
                  </Typography>
                  <Button
                    variant='contained'
                    color='success'
                    sx={{
                      mt: 1,
                      px: 5,
                      py: 1,
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.95rem'
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleStartFromScratch()
                    }}
                  >
                    Choose
                  </Button>
                </Box>
              </Card>

              {/* Upload Email Template Card */}
              <Card
                sx={{
                  border: '2px dashed',
                  borderColor: 'divider',
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main', boxShadow: 4, transform: 'translateY(-2px)' },
                  transition: 'all 0.2s'
                }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Box
                  sx={{
                    height: 220,
                    bgcolor: '#f8f9fa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 1.5
                  }}
                >
                  <Box
                    sx={{
                      width: 64,
                      height: 64,
                      borderRadius: 2,
                      bgcolor: 'action.hover',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <i className='tabler-upload text-[32px]' style={{ color: 'var(--mui-palette-primary-main)' }} />
                  </Box>
                  <Typography variant='body2' color='text.secondary' fontWeight={500}>
                    .html, .htm or .zip file
                  </Typography>
                </Box>
                <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 }, textAlign: 'center' }}>
                  <Typography variant='subtitle2' fontWeight={600}>
                    Upload Email Template
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    Import HTML or ZIP with images
                  </Typography>
                </CardContent>
              </Card>

              {/* Hidden file input for template upload */}
              <input
                ref={fileInputRef}
                type='file'
                accept='.html,.htm,.zip'
                style={{ display: 'none' }}
                onChange={handleUploadTemplate}
              />

              {/* User Templates */}
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4, gridColumn: '1 / -1' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : (
                filteredUserTemplates.map(template => (
                  <TemplateCard key={`user-${template.id}`} template={template} />
                ))
              )}
            </Box>
        </Box>
      )}

      {/* Tab 1: Recent Emails */}
      {activeTab === 1 && (
        <Box>
          {loadingRecent ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : recentCampaigns.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography color='text.secondary'>No recent campaigns found.</Typography>
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
                gap: 3
              }}
            >
              {recentCampaigns.map(campaign => (
                <Card
                  key={campaign.id}
                  sx={{
                    cursor: 'pointer',
                    position: 'relative',
                    '&:hover': { boxShadow: 4 },
                    '&:hover .delete-btn': { opacity: 1 },
                    transition: 'box-shadow 0.2s'
                  }}
                  onClick={() => handleUseRecentCampaign(campaign)}
                >
                  <IconButton
                    className='delete-btn'
                    size='small'
                    sx={{
                      position: 'absolute',
                      top: 6,
                      right: 6,
                      zIndex: 2,
                      opacity: 0,
                      transition: 'opacity 0.2s',
                      bgcolor: 'background.paper',
                      boxShadow: 2,
                      '&:hover': { bgcolor: 'error.lightOpacity', color: 'error.main' }
                    }}
                    onClick={e => {
                      e.stopPropagation()
                      setDeleteDialog(campaign)
                    }}
                  >
                    <i className='tabler-trash text-[16px]' />
                  </IconButton>
                  <Box
                    sx={{
                      height: 180,
                      bgcolor: 'action.hover',
                      overflow: 'hidden',
                      position: 'relative'
                    }}
                  >
                    {campaign.body ? (
                      <iframe
                        srcDoc={campaign.body}
                        sandbox=''
                        style={{
                          width: '200%',
                          height: '360px',
                          border: 'none',
                          transform: 'scale(0.5)',
                          transformOrigin: 'top left',
                          pointerEvents: 'none'
                        }}
                        title={campaign.name}
                      />
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                        <i className='tabler-mail text-[40px]' style={{ color: 'var(--mui-palette-text-disabled)' }} />
                      </Box>
                    )}
                  </Box>
                  <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                    <Typography variant='body2' fontWeight={500} noWrap>
                      {campaign.name}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {campaign.status} &middot; {new Date(campaign.created_at).toLocaleDateString()}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Delete Campaign Confirmation Dialog */}
      <Dialog open={!!deleteDialog} onClose={() => setDeleteDialog(null)} maxWidth='xs' fullWidth>
        <DialogTitle>Delete Campaign</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{deleteDialog?.name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)} color='secondary' disabled={deleting}>
            Cancel
          </Button>
          <Button
            variant='contained'
            color='error'
            onClick={handleDeleteCampaign}
            disabled={deleting}
            startIcon={deleting ? <CircularProgress size={16} /> : <i className='tabler-trash' />}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Template Preview Dialog */}
      <Dialog open={!!previewDialog} onClose={() => setPreviewDialog(null)} maxWidth='md' fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant='h6' fontWeight={600}>{previewDialog?.name}</Typography>
          <IconButton onClick={() => setPreviewDialog(null)} size='small'>
            <i className='tabler-x' />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {previewDialog?.body && (
            <iframe
              srcDoc={previewDialog.body}
              sandbox=''
              style={{ width: '100%', height: '60vh', border: 'none' }}
              title={`Preview of ${previewDialog.name}`}
            />
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreviewDialog(null)} color='secondary'>
            Cancel
          </Button>
          <Button
            variant='contained'
            color='success'
            startIcon={<i className='tabler-check' />}
            onClick={() => {
              if (previewDialog) {
                handleSelectTemplate(previewDialog.id)
              }
            }}
          >
            Use Template
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default TemplateGallery
