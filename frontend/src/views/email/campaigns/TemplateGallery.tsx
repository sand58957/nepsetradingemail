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

// ─── "Start from scratch" block browser data ───
interface BlockPreview {
  name: string

  /** Render key – used to pick a mini-preview in the component */
  previewKey: string
}

interface BlockCategory {
  name: string
  icon: string
  blocks: BlockPreview[]
}

const scratchBlockCategories: BlockCategory[] = [
  {
    name: 'Saved blocks',
    icon: 'tabler-bookmark',
    blocks: []
  },
  {
    name: 'Navigation',
    icon: 'tabler-layout-navbar',
    blocks: [
      { name: 'Logo', previewKey: 'logo' },
      { name: 'Navigation', previewKey: 'nav' },
      { name: 'Logo + Navigation', previewKey: 'logo-nav-center' },
      { name: 'Logo + Navigation', previewKey: 'logo-nav-row' },
      { name: 'Logo + Button', previewKey: 'logo-btn' },
      { name: 'Logo + Social links', previewKey: 'logo-social' },
      { name: 'Logo + Text', previewKey: 'logo-text' }
    ]
  },
  {
    name: 'Hero',
    icon: 'tabler-photo',
    blocks: [
      { name: 'Hero image', previewKey: 'hero-img' },
      { name: 'Hero with text', previewKey: 'hero-text' },
      { name: 'Hero split', previewKey: 'hero-split' },
      { name: 'Hero gradient', previewKey: 'hero-gradient' },
      { name: 'Hero with CTA', previewKey: 'hero-cta' }
    ]
  },
  {
    name: 'Sections',
    icon: 'tabler-columns',
    blocks: [
      { name: '1 Column', previewKey: 'sec-1col' },
      { name: '2 Columns', previewKey: 'sec-2col' },
      { name: '3 Columns', previewKey: 'sec-3col' },
      { name: '1:2 Columns', previewKey: 'sec-1-2' },
      { name: '2:1 Columns', previewKey: 'sec-2-1' },
      { name: 'Sidebar left', previewKey: 'sec-sidebar-l' }
    ]
  },
  {
    name: 'Elements',
    icon: 'tabler-typography',
    blocks: [
      { name: 'Text', previewKey: 'el-text' },
      { name: 'Image', previewKey: 'el-image' },
      { name: 'Button', previewKey: 'el-button' },
      { name: 'Divider', previewKey: 'el-divider' },
      { name: 'Spacer', previewKey: 'el-spacer' },
      { name: 'Heading', previewKey: 'el-heading' }
    ]
  },
  {
    name: 'Content',
    icon: 'tabler-pencil',
    blocks: [
      { name: 'Text + Image', previewKey: 'cnt-text-img' },
      { name: 'Image + Text', previewKey: 'cnt-img-text' },
      { name: 'Feature list', previewKey: 'cnt-features' },
      { name: 'Testimonial', previewKey: 'cnt-testimonial' },
      { name: 'Stats', previewKey: 'cnt-stats' }
    ]
  },
  {
    name: 'Special',
    icon: 'tabler-star',
    blocks: [
      { name: 'Timer', previewKey: 'sp-timer' },
      { name: 'Countdown', previewKey: 'sp-countdown' },
      { name: 'Banner', previewKey: 'sp-banner' },
      { name: 'Coupon', previewKey: 'sp-coupon' }
    ]
  },
  {
    name: 'Products',
    icon: 'tabler-tag',
    blocks: [
      { name: 'Product card', previewKey: 'prod-card' },
      { name: 'Product grid', previewKey: 'prod-grid' },
      { name: 'Product + CTA', previewKey: 'prod-cta' }
    ]
  },
  {
    name: 'Gallery',
    icon: 'tabler-photo',
    blocks: [
      { name: '2-image gallery', previewKey: 'gal-2' },
      { name: '3-image gallery', previewKey: 'gal-3' },
      { name: '4-image grid', previewKey: 'gal-4' }
    ]
  },
  {
    name: 'Blog and RSS',
    icon: 'tabler-rss',
    blocks: [
      { name: 'Blog post', previewKey: 'blog-post' },
      { name: 'Blog list', previewKey: 'blog-list' },
      { name: 'RSS feed', previewKey: 'blog-rss' }
    ]
  },
  {
    name: 'Social and sharing',
    icon: 'tabler-brand-twitter',
    blocks: [
      { name: 'Social icons', previewKey: 'soc-icons' },
      { name: 'Share buttons', previewKey: 'soc-share' },
      { name: 'Follow us', previewKey: 'soc-follow' }
    ]
  },
  {
    name: 'Footer',
    icon: 'tabler-layout-bottombar',
    blocks: [
      { name: 'Simple footer', previewKey: 'ftr-simple' },
      { name: 'Footer + Social', previewKey: 'ftr-social' },
      { name: 'Footer + Links', previewKey: 'ftr-links' },
      { name: 'Full footer', previewKey: 'ftr-full' }
    ]
  }
]

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

interface TemplateGalleryProps {
  campaignType: string
}

const TemplateGallery = ({ campaignType }: TemplateGalleryProps) => {
  const router = useRouter()
  const { lang } = useParams()
  const locale = (lang as string) || 'en'
  const [activeTab, setActiveTab] = useState(1)
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingRecent, setLoadingRecent] = useState(false)
  const [loadedRecent, setLoadedRecent] = useState(false)
  const [previewDialog, setPreviewDialog] = useState<Template | null>(null)
  const [scratchCategory, setScratchCategory] = useState('Navigation')
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
    if (activeTab === 2 && !loadedRecent) {
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

  const handleSelectTemplate = (templateId: number | 'scratch') => {
    router.push(`/${locale}/campaigns/create?type=${campaignType}&template=scratch&from_template=${templateId}`)
  }

  const handleUseRecentCampaign = (campaign: any) => {
    router.push(`/${locale}/campaigns/create?type=${campaignType}&template=scratch&from_campaign=${campaign.id}`)
  }

  // Split templates into user-created (no category prefix) and gallery (with [Category] prefix)
  const userTemplates = templates.filter(t => !isGalleryTemplate(t))
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

  // Mini-preview component for scratch blocks
  const BlockMiniPreview = ({ previewKey }: { previewKey: string }) => {
    const pillStyle = {
      bgcolor: '#e0e0e0',
      borderRadius: 0.5,
      height: 8,
      display: 'inline-block'
    }

    const logoEl = (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box sx={{ width: 10, height: 10, bgcolor: '#4caf50', borderRadius: 0.5 }} />
        <Box sx={{ ...pillStyle, width: 50 }} />
      </Box>
    )

    const navLinks = (
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ ...pillStyle, width: 30 }} />
        <Box sx={{ ...pillStyle, width: 26 }} />
        <Box sx={{ ...pillStyle, width: 28 }} />
      </Box>
    )

    const btnEl = (
      <Box sx={{ bgcolor: '#4caf50', borderRadius: 0.5, height: 14, width: 40, display: 'inline-block' }} />
    )

    const socialDots = (
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Box sx={{ width: 10, height: 10, bgcolor: '#616161', borderRadius: '50%' }} />
        <Box sx={{ width: 10, height: 10, bgcolor: '#616161', borderRadius: '50%' }} />
        <Box sx={{ width: 10, height: 10, bgcolor: '#616161', borderRadius: '50%' }} />
      </Box>
    )

    const imgPlaceholder = (
      <Box sx={{ width: '100%', height: 40, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <i className='tabler-photo text-[16px]' style={{ color: '#bdbdbd' }} />
      </Box>
    )

    const textLines = (n: number) => (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {Array.from({ length: n }).map((_, i) => (
          <Box key={i} sx={{ ...pillStyle, width: i === n - 1 ? '60%' : '100%' }} />
        ))}
      </Box>
    )

    switch (previewKey) {
      // Navigation blocks
      case 'logo':
        return <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>{logoEl}</Box>
      case 'nav':
        return <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>{navLinks}</Box>
      case 'logo-nav-center':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, py: 0.5 }}>
            {logoEl}
            {navLinks}
          </Box>
        )
      case 'logo-nav-row':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            {logoEl}
            {navLinks}
          </Box>
        )
      case 'logo-btn':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            {logoEl}
            {btnEl}
          </Box>
        )
      case 'logo-social':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            {logoEl}
            {socialDots}
          </Box>
        )
      case 'logo-text':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
            {logoEl}
            <Typography variant='caption' sx={{ color: '#9e9e9e', fontSize: '0.65rem' }}>Weekly Newsletter</Typography>
          </Box>
        )

      // Hero blocks
      case 'hero-img':
        return <Box sx={{ height: 50, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className='tabler-photo text-[20px]' style={{ color: '#bdbdbd' }} /></Box>
      case 'hero-text':
        return (
          <Box sx={{ py: 1 }}>
            <Box sx={{ ...pillStyle, width: '70%', height: 10, mb: 0.5 }} />
            {textLines(2)}
          </Box>
        )
      case 'hero-split':
        return (
          <Box sx={{ display: 'flex', gap: 1, py: 0.5 }}>
            <Box sx={{ flex: 1 }}>{textLines(3)}<Box sx={{ mt: 0.5 }}>{btnEl}</Box></Box>
            <Box sx={{ flex: 1, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 40 }}><i className='tabler-photo text-[16px]' style={{ color: '#bdbdbd' }} /></Box>
          </Box>
        )
      case 'hero-gradient':
        return <Box sx={{ height: 50, background: 'linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%)', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Box sx={{ ...pillStyle, width: 80, height: 10 }} /></Box>
      case 'hero-cta':
        return (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Box sx={{ ...pillStyle, width: '50%', height: 10, mx: 'auto', mb: 0.5 }} />
            <Box sx={{ ...pillStyle, width: '70%', mx: 'auto', mb: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>{btnEl}</Box>
          </Box>
        )

      // Section blocks
      case 'sec-1col':
        return <Box sx={{ border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>1 Column</Typography></Box>
      case 'sec-2col':
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box sx={{ flex: 1, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>1</Typography></Box>
            <Box sx={{ flex: 1, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>2</Typography></Box>
          </Box>
        )
      case 'sec-3col':
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {[1, 2, 3].map(n => <Box key={n} sx={{ flex: 1, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>{n}</Typography></Box>)}
          </Box>
        )
      case 'sec-1-2':
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box sx={{ flex: 1, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>1</Typography></Box>
            <Box sx={{ flex: 2, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>2</Typography></Box>
          </Box>
        )
      case 'sec-2-1':
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box sx={{ flex: 2, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>1</Typography></Box>
            <Box sx={{ flex: 1, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>2</Typography></Box>
          </Box>
        )
      case 'sec-sidebar-l':
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box sx={{ width: 60, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>Side</Typography></Box>
            <Box sx={{ flex: 1, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>Main</Typography></Box>
          </Box>
        )

      // Element blocks
      case 'el-text':
        return <Box sx={{ py: 0.5 }}>{textLines(3)}</Box>
      case 'el-image':
        return imgPlaceholder
      case 'el-button':
        return <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>{btnEl}</Box>
      case 'el-divider':
        return <Box sx={{ py: 1.5 }}><Box sx={{ borderTop: '1px solid #e0e0e0' }} /></Box>
      case 'el-spacer':
        return <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}><Typography variant='caption' color='text.disabled'>↕ Spacer</Typography></Box>
      case 'el-heading':
        return <Box sx={{ py: 0.5 }}><Box sx={{ ...pillStyle, width: '50%', height: 12 }} /></Box>

      // Content blocks
      case 'cnt-text-img':
        return (
          <Box sx={{ display: 'flex', gap: 1, py: 0.5 }}>
            <Box sx={{ flex: 1 }}>{textLines(3)}</Box>
            <Box sx={{ width: 60, height: 40, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className='tabler-photo text-[14px]' style={{ color: '#bdbdbd' }} /></Box>
          </Box>
        )
      case 'cnt-img-text':
        return (
          <Box sx={{ display: 'flex', gap: 1, py: 0.5 }}>
            <Box sx={{ width: 60, height: 40, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className='tabler-photo text-[14px]' style={{ color: '#bdbdbd' }} /></Box>
            <Box sx={{ flex: 1 }}>{textLines(3)}</Box>
          </Box>
        )
      case 'cnt-features':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5 }}>
            {[1, 2, 3].map(n => (
              <Box key={n} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 8, height: 8, bgcolor: '#4caf50', borderRadius: '50%' }} />
                <Box sx={{ ...pillStyle, width: `${60 + n * 10}px` }} />
              </Box>
            ))}
          </Box>
        )
      case 'cnt-testimonial':
        return (
          <Box sx={{ textAlign: 'center', py: 0.5 }}>
            <Typography variant='caption' sx={{ color: '#bdbdbd', fontSize: '1.2rem', lineHeight: 1 }}>&ldquo;</Typography>
            {textLines(2)}
            <Box sx={{ ...pillStyle, width: 40, mx: 'auto', mt: 0.5 }} />
          </Box>
        )
      case 'cnt-stats':
        return (
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', py: 0.5 }}>
            {['100+', '50K', '99%'].map(s => (
              <Box key={s} sx={{ textAlign: 'center' }}>
                <Typography variant='caption' fontWeight={700} sx={{ fontSize: '0.7rem' }}>{s}</Typography>
                <Box sx={{ ...pillStyle, width: 30, mx: 'auto' }} />
              </Box>
            ))}
          </Box>
        )

      // Special blocks
      case 'sp-timer':
        return (
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', py: 1 }}>
            {['00', '12', '30', '45'].map((v, i) => (
              <Box key={i} sx={{ textAlign: 'center' }}>
                <Box sx={{ bgcolor: '#f5f5f5', borderRadius: 0.5, px: 1, py: 0.5 }}>
                  <Typography variant='caption' fontWeight={700}>{v}</Typography>
                </Box>
                <Typography variant='caption' sx={{ fontSize: '0.5rem', color: '#9e9e9e' }}>{['Days', 'Hrs', 'Min', 'Sec'][i]}</Typography>
              </Box>
            ))}
          </Box>
        )
      case 'sp-countdown':
        return (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Box sx={{ ...pillStyle, width: '40%', mx: 'auto', mb: 0.5 }} />
            <Typography variant='caption' fontWeight={700} color='error'>Ends in 2 days!</Typography>
          </Box>
        )
      case 'sp-banner':
        return <Box sx={{ bgcolor: '#fff3e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Box sx={{ ...pillStyle, width: '60%', mx: 'auto' }} /></Box>
      case 'sp-coupon':
        return <Box sx={{ border: '2px dashed #e0e0e0', borderRadius: 1, p: 1, textAlign: 'center' }}><Typography variant='caption' fontWeight={700} color='text.secondary'>SAVE20</Typography></Box>

      // Product blocks
      case 'prod-card':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, py: 0.5 }}>
            <Box sx={{ width: 60, height: 40, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className='tabler-package text-[16px]' style={{ color: '#bdbdbd' }} /></Box>
            <Box sx={{ ...pillStyle, width: 50 }} />
            <Typography variant='caption' fontWeight={600} sx={{ fontSize: '0.6rem' }}>$29.99</Typography>
          </Box>
        )
      case 'prod-grid':
        return (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {[1, 2].map(n => (
              <Box key={n} sx={{ flex: 1, textAlign: 'center' }}>
                <Box sx={{ height: 30, bgcolor: '#f5f5f5', borderRadius: 0.5, mb: 0.5 }} />
                <Box sx={{ ...pillStyle, width: '70%', mx: 'auto' }} />
              </Box>
            ))}
          </Box>
        )
      case 'prod-cta':
        return (
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 0.5 }}>
            <Box sx={{ width: 50, height: 40, bgcolor: '#f5f5f5', borderRadius: 0.5 }} />
            <Box sx={{ flex: 1 }}>
              <Box sx={{ ...pillStyle, width: '80%', mb: 0.5 }} />
              <Box sx={{ ...pillStyle, width: '50%', mb: 0.5 }} />
              {btnEl}
            </Box>
          </Box>
        )

      // Gallery blocks
      case 'gal-2':
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {[1, 2].map(n => <Box key={n} sx={{ flex: 1, height: 35, bgcolor: '#f5f5f5', borderRadius: 0.5 }} />)}
          </Box>
        )
      case 'gal-3':
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {[1, 2, 3].map(n => <Box key={n} sx={{ flex: 1, height: 35, bgcolor: '#f5f5f5', borderRadius: 0.5 }} />)}
          </Box>
        )
      case 'gal-4':
        return (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
            {[1, 2, 3, 4].map(n => <Box key={n} sx={{ height: 25, bgcolor: '#f5f5f5', borderRadius: 0.5 }} />)}
          </Box>
        )

      // Blog blocks
      case 'blog-post':
        return (
          <Box sx={{ py: 0.5 }}>
            <Box sx={{ height: 30, bgcolor: '#f5f5f5', borderRadius: 0.5, mb: 0.5 }} />
            <Box sx={{ ...pillStyle, width: '60%', height: 10, mb: 0.5 }} />
            {textLines(2)}
          </Box>
        )
      case 'blog-list':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, py: 0.5 }}>
            {[1, 2].map(n => (
              <Box key={n} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <Box sx={{ width: 30, height: 24, bgcolor: '#f5f5f5', borderRadius: 0.5 }} />
                <Box sx={{ flex: 1 }}><Box sx={{ ...pillStyle, width: '90%' }} /></Box>
              </Box>
            ))}
          </Box>
        )
      case 'blog-rss':
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
            <i className='tabler-rss text-[16px]' style={{ color: '#ff9800' }} />
            <Box sx={{ flex: 1 }}><Box sx={{ ...pillStyle, width: '70%' }} /></Box>
          </Box>
        )

      // Social blocks
      case 'soc-icons':
        return <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>{socialDots}</Box>
      case 'soc-share':
        return (
          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', py: 1 }}>
            {['Share', 'Tweet', 'Pin'].map(t => (
              <Box key={t} sx={{ bgcolor: '#e0e0e0', borderRadius: 0.5, px: 1, py: 0.25 }}>
                <Typography variant='caption' sx={{ fontSize: '0.55rem' }}>{t}</Typography>
              </Box>
            ))}
          </Box>
        )
      case 'soc-follow':
        return (
          <Box sx={{ textAlign: 'center', py: 0.5 }}>
            <Typography variant='caption' color='text.secondary' sx={{ fontSize: '0.6rem' }}>Follow us</Typography>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 0.5 }}>{socialDots}</Box>
          </Box>
        )

      // Footer blocks
      case 'ftr-simple':
        return (
          <Box sx={{ textAlign: 'center', py: 0.5, borderTop: '1px solid #f0f0f0', pt: 1 }}>
            <Box sx={{ ...pillStyle, width: '50%', mx: 'auto' }} />
          </Box>
        )
      case 'ftr-social':
        return (
          <Box sx={{ textAlign: 'center', py: 0.5, borderTop: '1px solid #f0f0f0', pt: 1 }}>
            <Box sx={{ ...pillStyle, width: '40%', mx: 'auto', mb: 0.5 }} />
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>{socialDots}</Box>
          </Box>
        )
      case 'ftr-links':
        return (
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, py: 0.5, borderTop: '1px solid #f0f0f0', pt: 1 }}>
            {navLinks}
          </Box>
        )
      case 'ftr-full':
        return (
          <Box sx={{ borderTop: '1px solid #f0f0f0', pt: 1, py: 0.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
              {logoEl}
              {socialDots}
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>{navLinks}</Box>
          </Box>
        )

      default:
        return <Box sx={{ py: 1, textAlign: 'center' }}><Box sx={{ ...pillStyle, width: '60%', mx: 'auto' }} /></Box>
    }
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
          <Tab label='Start from scratch' />
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

      {/* Tab 0: Start from scratch – Block browser */}
      {activeTab === 0 && (
        <Box sx={{ display: 'flex', gap: 0 }}>
          {/* Left Sidebar – Block categories */}
          <Box sx={{ width: 260, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider', pr: 0 }}>
            <TextField
              fullWidth
              size='small'
              placeholder='Search..'
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              sx={{ mb: 2, px: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position='start'>
                    <i className='tabler-search text-[18px]' />
                  </InputAdornment>
                )
              }}
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {scratchBlockCategories.map(cat => (
                <Box
                  key={cat.name}
                  onClick={() => setScratchCategory(cat.name)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    px: 2,
                    py: 1.5,
                    cursor: 'pointer',
                    bgcolor: scratchCategory === cat.name ? 'success.lightOpacity' : 'transparent',
                    '&:hover': { bgcolor: scratchCategory === cat.name ? 'success.lightOpacity' : 'action.hover' }
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        bgcolor: scratchCategory === cat.name ? 'success.main' : 'action.hover',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <i
                        className={`${cat.icon} text-[18px]`}
                        style={{ color: scratchCategory === cat.name ? '#fff' : 'inherit' }}
                      />
                    </Box>
                    <Typography
                      variant='body2'
                      fontWeight={scratchCategory === cat.name ? 600 : 400}
                      sx={{ color: scratchCategory === cat.name ? 'success.main' : 'text.primary' }}
                    >
                      {cat.name}
                    </Typography>
                  </Box>
                  <i className='tabler-chevron-right text-[16px]' style={{ opacity: 0.4 }} />
                </Box>
              ))}
            </Box>
          </Box>

          {/* Right Content – Block previews */}
          <Box sx={{ flex: 1, pl: 3 }}>
            {(() => {
              const activeCat = scratchBlockCategories.find(c => c.name === scratchCategory)
              const blocks = activeCat?.blocks || []

              const filtered = searchQuery
                ? blocks.filter(b => b.name.toLowerCase().includes(searchQuery.toLowerCase()))
                : blocks

              if (scratchCategory === 'Saved blocks') {
                return (
                  <Box sx={{ textAlign: 'center', py: 8 }}>
                    <i className='tabler-bookmark text-[40px]' style={{ color: 'var(--mui-palette-text-disabled)' }} />
                    <Typography color='text.secondary' sx={{ mt: 2 }}>
                      No saved blocks yet. Build your email and save sections for reuse.
                    </Typography>
                    <Button
                      variant='contained'
                      color='success'
                      sx={{ mt: 3 }}
                      onClick={() => handleSelectTemplate('scratch')}
                      startIcon={<i className='tabler-plus' />}
                    >
                      Start building
                    </Button>
                  </Box>
                )
              }

              return (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {filtered.map((block, idx) => (
                    <Box key={idx}>
                      <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                        {block.name}
                      </Typography>
                      <Card
                        variant='outlined'
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { borderColor: 'success.main', boxShadow: 2 },
                          transition: 'all 0.2s'
                        }}
                        onClick={() => handleSelectTemplate('scratch')}
                      >
                        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                          <BlockMiniPreview previewKey={block.previewKey} />
                        </CardContent>
                      </Card>
                    </Box>
                  ))}
                </Box>
              )
            })()}
          </Box>
        </Box>
      )}

      {/* Tab 1: Template Gallery */}
      {activeTab === 1 && (
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
                {/* Blank Canvas Card — always first */}
                <Card
                  sx={{
                    border: '2px dashed',
                    borderColor: 'divider',
                    '&:hover': { borderColor: 'primary.main', boxShadow: 4 },
                    transition: 'all 0.2s'
                  }}
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
                    <Button variant='contained' color='success' size='small' onClick={() => setActiveTab(0)}>
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

      {/* Tab 2: Recent Emails */}
      {activeTab === 2 && (
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
