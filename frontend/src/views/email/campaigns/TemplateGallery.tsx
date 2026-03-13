'use client'

import { useState, useEffect } from 'react'

import { useRouter, useParams } from 'next/navigation'

import Box from '@mui/material/Box'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Chip from '@mui/material/Chip'
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

// Category icon mapping for gallery templates
const categoryIconMap: Record<string, string> = {
  'Black Friday': 'tabler-tag',
  'Blog and updates': 'tabler-news',
  'Business': 'tabler-briefcase',
  'Deals and offers': 'tabler-discount-2',
  'E-commerce': 'tabler-shopping-cart',
  'Events': 'tabler-calendar-event',
  'Featured': 'tabler-star',
  'Health and wellness': 'tabler-heart',
  'Holiday': 'tabler-christmas-tree',
  'Nonprofit': 'tabler-heart-handshake',
  'Notifications': 'tabler-bell',
  'Products': 'tabler-package',
  'Survey and quizzes': 'tabler-clipboard-list'
}

// Helper: parse category from template subject field (format: "[Category] Name")
const parseCategory = (subject: string): string => {
  const match = subject.match(/^\[([^\]]+)\]/)

  return match ? match[1] : 'Featured'
}

// Helper: check if a template is a gallery template (has [Category] prefix in subject)
const isGalleryTemplate = (t: Template): boolean => /^\[.+\]/.test(t.subject)

// Helper: check if a template is a Listmonk default/system template (should be hidden)
const isDefaultTemplate = (t: Template): boolean => {
  // Check for Listmonk Go template syntax in body
  if (
    t.body &&
    (t.body.includes('{{ template "content"') ||
      t.body.includes('{{ .Tx.Body }}') ||
      t.body.includes('{{.Tx.Body}}') ||
      t.body.includes('{{ template "content" .'))
  ) {
    return true
  }

  // Also check for known default template names
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
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [loadedRecent, setLoadedRecent] = useState(false)
  const [previewDialog, setPreviewDialog] = useState<Template | null>(null)
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

  // Split templates: exclude gallery templates AND default Listmonk templates from user list
  const userTemplates = templates.filter(t => !isGalleryTemplate(t) && !isDefaultTemplate(t))
  const galleryTemplates = templates.filter(t => isGalleryTemplate(t))

  // Build dynamic gallery categories from real templates
  const galleryByCategory: Record<string, Template[]> = {}

  galleryTemplates.forEach(t => {
    const cat = parseCategory(t.subject)

    if (!galleryByCategory[cat]) galleryByCategory[cat] = []
    galleryByCategory[cat].push(t)
  })

  const galleryCategories = Object.keys(galleryByCategory).sort().map(name => ({
    name,
    count: galleryByCategory[name].length,
    icon: categoryIconMap[name] || 'tabler-template'
  }))

  const totalGalleryTemplates = galleryTemplates.length

  const filteredUserTemplates = userTemplates.filter(t =>
    searchQuery ? t.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  )

  // Get gallery templates for selected category
  const getDisplayedGalleryTemplates = (): Template[] => {
    if (selectedCategory === 'all' || selectedCategory === 'my') return galleryTemplates

    return galleryByCategory[selectedCategory] || []
  }

  const filteredGalleryTemplates = getDisplayedGalleryTemplates().filter(t =>
    searchQuery ? t.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  )

  // Template card component for both user and gallery templates
  const TemplateCard = ({ template, showCategory }: { template: Template; showCategory?: boolean }) => {
    const displayName = template.name
    const category = showCategory ? parseCategory(template.subject) : ''

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
          {showCategory && category && (
            <Chip
              label={category}
              size='small'
              sx={{
                position: 'absolute',
                top: 8,
                right: 8,
                bgcolor: 'rgba(255,255,255,0.9)',
                fontWeight: 600,
                fontSize: '0.65rem',
                height: 20,
                zIndex: 1
              }}
            />
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
        <Box sx={{ display: 'flex', gap: 3 }}>
          {/* Left Sidebar */}
          <Box sx={{ width: 250, flexShrink: 0 }}>
            <TextField
              fullWidth
              size='small'
              placeholder='Search'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>
                    <i className='tabler-search text-[18px]' />
                  </InputAdornment>
                )
              }}
            />

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {/* All templates */}
              <Box
                onClick={() => setSelectedCategory('all')}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 2,
                  py: 1,
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: selectedCategory === 'all' ? 'primary.lightOpacity' : 'transparent',
                  borderLeft: selectedCategory === 'all' ? '3px solid var(--mui-palette-primary-main)' : '3px solid transparent',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <i className='tabler-template text-[18px]' />
                  <Typography variant='body2' fontWeight={selectedCategory === 'all' ? 600 : 400}>
                    All templates
                  </Typography>
                </Box>
                <Typography variant='caption' color='text.secondary'>
                  {totalGalleryTemplates}
                </Typography>
              </Box>

              {/* My templates */}
              <Box
                onClick={() => setSelectedCategory('my')}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  px: 2,
                  py: 1,
                  borderRadius: 1,
                  cursor: 'pointer',
                  bgcolor: selectedCategory === 'my' ? 'primary.lightOpacity' : 'transparent',
                  borderLeft: selectedCategory === 'my' ? '3px solid var(--mui-palette-primary-main)' : '3px solid transparent',
                  '&:hover': { bgcolor: 'action.hover' }
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <i className='tabler-folder text-[18px]' />
                  <Typography variant='body2' fontWeight={selectedCategory === 'my' ? 600 : 400}>
                    My templates
                  </Typography>
                </Box>
                <Chip label={userTemplates.length} size='small' color='primary' sx={{ height: 22, fontSize: '0.75rem' }} />
              </Box>

              {/* Gallery Categories */}
              {galleryCategories.map(cat => (
                <Box
                  key={cat.name}
                  onClick={() => setSelectedCategory(cat.name)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    bgcolor: selectedCategory === cat.name ? 'primary.lightOpacity' : 'transparent',
                    borderLeft: selectedCategory === cat.name ? '3px solid var(--mui-palette-primary-main)' : '3px solid transparent',
                    '&:hover': { bgcolor: 'action.hover' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <i className={`${cat.icon} text-[18px]`} />
                    <Typography variant='body2' fontWeight={selectedCategory === cat.name ? 600 : 400}>
                      {cat.name}
                    </Typography>
                  </Box>
                  <Typography variant='caption' color='text.secondary'>
                    {cat.count}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Box>

          {/* Right Content */}
          <Box sx={{ flex: 1 }}>
            {/* Template Count */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Typography variant='body2' color='text.secondary'>
                {selectedCategory === 'my'
                  ? `${filteredUserTemplates.length} templates listed`
                  : selectedCategory === 'all'
                    ? `${filteredGalleryTemplates.length + filteredUserTemplates.length} templates listed`
                    : `${filteredGalleryTemplates.length} templates listed`}
              </Typography>
            </Box>

            {/* Template Grid */}
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(4, 1fr)' },
                  gap: 3
                }}
              >
                {/* Start from scratch Card — always first, goes directly to editor */}
                <Card
                  sx={{
                    border: '2px dashed',
                    borderColor: 'divider',
                    cursor: 'pointer',
                    '&:hover': { borderColor: 'success.main', boxShadow: 4 },
                    transition: 'all 0.2s'
                  }}
                  onClick={handleStartFromScratch}
                >
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 4, height: '100%', justifyContent: 'center' }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 2,
                        bgcolor: 'action.hover',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 2
                      }}
                    >
                      <i className='tabler-file-text text-[28px]' style={{ color: 'var(--mui-palette-text-secondary)' }} />
                    </Box>
                    <Typography variant='subtitle1' fontWeight={600} gutterBottom>
                      Start from scratch
                    </Typography>
                    <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                      Create a custom design or use ready-made blocks.
                    </Typography>
                    <Button variant='contained' color='success' size='small' onClick={handleStartFromScratch}>
                      Choose
                    </Button>
                  </CardContent>
                </Card>

                {/* User Templates (show in 'my' and 'all') */}
                {(selectedCategory === 'my' || selectedCategory === 'all') &&
                  filteredUserTemplates.map(template => (
                    <TemplateCard key={`user-${template.id}`} template={template} />
                  ))}

                {/* Gallery Templates (show in category or 'all') */}
                {selectedCategory !== 'my' &&
                  filteredGalleryTemplates.map(template => (
                    <TemplateCard key={`gallery-${template.id}`} template={template} showCategory />
                  ))}
              </Box>
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
                    '&:hover': { boxShadow: 4 },
                    transition: 'box-shadow 0.2s'
                  }}
                  onClick={() => handleUseRecentCampaign(campaign)}
                >
                  <Box
                    sx={{
                      height: 140,
                      bgcolor: 'action.hover',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <i className='tabler-mail text-[40px]' style={{ color: 'var(--mui-palette-text-disabled)' }} />
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
