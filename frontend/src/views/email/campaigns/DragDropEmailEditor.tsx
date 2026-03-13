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

// Dynamic import to avoid SSR issues
const EmailEditor = dynamic(() => import('react-email-editor'), { ssr: false })

// ─── Block category data with blocks ───
interface BlockPreview {
  name: string
  previewKey: string
}

interface BlockCategory {
  name: string
  icon: string
  blocks: BlockPreview[]
}

const blockCategories: BlockCategory[] = [
  {
    name: 'Elements', icon: 'tabler-typography',
    blocks: [
      { name: 'Spacer', previewKey: 'el-spacer' },
      { name: 'Divider', previewKey: 'el-divider' },
      { name: 'Title', previewKey: 'el-title' },
      { name: 'Title with button', previewKey: 'el-title-btn' },
      { name: 'Text', previewKey: 'el-text' },
      { name: 'Quote', previewKey: 'el-quote' },
      { name: 'Button', previewKey: 'el-button' },
      { name: 'Two buttons', previewKey: 'el-two-btn' },
      { name: 'Three buttons', previewKey: 'el-three-btn' },
      { name: 'Image', previewKey: 'el-image' },
      { name: 'Video', previewKey: 'el-video' },
      { name: 'Audio', previewKey: 'el-audio' },
      { name: 'Table', previewKey: 'el-table' },
      { name: 'Links', previewKey: 'el-links' }
    ]
  },
  {
    name: 'Content', icon: 'tabler-pencil',
    blocks: [
      { name: 'Message', previewKey: 'cnt-message' },
      { name: 'Mini box CTA', previewKey: 'cnt-mini-box-cta' },
      { name: 'Basic CTA', previewKey: 'cnt-basic-cta' },
      { name: 'Box CTA', previewKey: 'cnt-box-cta' },
      { name: 'Simple content', previewKey: 'cnt-simple' },
      { name: 'Box content', previewKey: 'cnt-box' },
      { name: 'Image + simple content', previewKey: 'cnt-img-simple' },
      { name: 'Title + image content', previewKey: 'cnt-title-img' },
      { name: 'Title + image', previewKey: 'cnt-title-image' }
    ]
  },
  { name: 'Saved blocks', icon: 'tabler-bookmark', blocks: [] },
  {
    name: 'Navigation', icon: 'tabler-layout-navbar',
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
    name: 'Hero', icon: 'tabler-photo',
    blocks: [
      { name: 'Standard hero', previewKey: 'hero-standard' },
      { name: 'Extended hero', previewKey: 'hero-extended' },
      { name: 'Title + image', previewKey: 'hero-title-img' },
      { name: 'Side-by-side image + text', previewKey: 'hero-side-by-side' },
      { name: 'Image below text', previewKey: 'hero-img-below' }
    ]
  },
  {
    name: 'Sections', icon: 'tabler-columns',
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
    name: 'Special', icon: 'tabler-star',
    blocks: [
      { name: 'Timer', previewKey: 'sp-timer' },
      { name: 'Countdown', previewKey: 'sp-countdown' },
      { name: 'Banner', previewKey: 'sp-banner' },
      { name: 'Coupon', previewKey: 'sp-coupon' }
    ]
  },
  {
    name: 'Products', icon: 'tabler-tag',
    blocks: [
      { name: 'Import products from stores', previewKey: 'prod-import' },
      { name: 'Create 1 product vertical', previewKey: 'prod-1-vert' },
      { name: 'Create 1 product horizontal', previewKey: 'prod-1-horiz' },
      { name: 'Create 2 products', previewKey: 'prod-2' },
      { name: 'Create 3 products', previewKey: 'prod-3' },
      { name: 'Create Coupon vertical', previewKey: 'prod-coupon-vert' },
      { name: 'Create Coupon horizontal', previewKey: 'prod-coupon-horiz' }
    ]
  },
  {
    name: 'Gallery', icon: 'tabler-photo',
    blocks: [
      { name: 'Single image', previewKey: 'gal-1' },
      { name: '2 images', previewKey: 'gal-2' },
      { name: '3 images', previewKey: 'gal-3' },
      { name: '4 images', previewKey: 'gal-4' },
      { name: '5 images', previewKey: 'gal-5' },
      { name: 'Carousel', previewKey: 'gal-carousel' }
    ]
  },
  {
    name: 'Blog and RSS', icon: 'tabler-rss',
    blocks: [
      { name: 'Extended blog feature', previewKey: 'blog-extended' },
      { name: 'Basic blog feature', previewKey: 'blog-basic' },
      { name: 'Double blog post highlight', previewKey: 'blog-double' },
      { name: 'Mini blog highlight', previewKey: 'blog-mini' },
      { name: 'Author bio 1', previewKey: 'blog-author1' },
      { name: 'Author bio 2', previewKey: 'blog-author2' },
      { name: 'RSS featured article', previewKey: 'blog-rss' }
    ]
  },
  {
    name: 'Social and sharing', icon: 'tabler-brand-twitter',
    blocks: [
      { name: 'Social links', previewKey: 'soc-links' },
      { name: 'Social share', previewKey: 'soc-share' },
      { name: 'Facebook post', previewKey: 'soc-facebook' },
      { name: 'Instagram post', previewKey: 'soc-instagram' }
    ]
  },
  {
    name: 'Footer', icon: 'tabler-layout-bottombar',
    blocks: [
      { name: 'Centered footer', previewKey: 'ftr-centered' },
      { name: 'Basic footer', previewKey: 'ftr-basic' },
      { name: 'Aligned footer', previewKey: 'ftr-aligned' },
      { name: 'Footer + navigation', previewKey: 'ftr-nav' },
      { name: 'Footer + app download', previewKey: 'ftr-app' }
    ]
  }
]

// ─── Block Mini Preview Component ───
const BlockMiniPreview = ({ previewKey }: { previewKey: string }) => {
  const pillStyle = { bgcolor: '#e0e0e0', borderRadius: 0.5, height: 8, display: 'inline-block' }

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

  const btnEl = <Box sx={{ bgcolor: '#4caf50', borderRadius: 0.5, height: 14, width: 40, display: 'inline-block' }} />

  const socialDots = (
    <Box sx={{ display: 'flex', gap: 0.5 }}>
      {[1, 2, 3].map(n => <Box key={n} sx={{ width: 10, height: 10, bgcolor: '#616161', borderRadius: '50%' }} />)}
    </Box>
  )

  switch (previewKey) {
    case 'logo':
      return <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>{logoEl}</Box>
    case 'nav':
      return <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>{navLinks}</Box>
    case 'logo-nav-center':
      return <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, py: 0.5 }}>{logoEl}{navLinks}</Box>
    case 'logo-nav-row':
      return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>{logoEl}{navLinks}</Box>
    case 'logo-btn':
      return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>{logoEl}{btnEl}</Box>
    case 'logo-social':
      return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>{logoEl}{socialDots}</Box>
    case 'logo-text':
      return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>{logoEl}<Typography variant='caption' sx={{ color: '#9e9e9e', fontSize: '0.65rem' }}>Weekly Newsletter</Typography></Box>
    case 'hero-standard':
      return (
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ height: 70, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
            <i className='tabler-photo text-[24px]' style={{ color: '#c0c0c0' }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', mb: 0.3 }}>Introduce your concept</Typography>
          <Typography sx={{ fontSize: '0.55rem', color: '#999', lineHeight: 1.3, mb: 0.8, px: 0.5 }}>
            Use this space to introduce subscribers to the topic of this newsletter.
          </Typography>
          {btnEl}
        </Box>
      )
    case 'hero-extended':
      return (
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ height: 55, bgcolor: '#f0f0f0', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.8 }}>
            <i className='tabler-photo text-[22px]' style={{ color: '#c0c0c0' }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', mb: 0.3 }}>Product name</Typography>
          <Typography sx={{ fontSize: '0.5rem', color: '#999', lineHeight: 1.3, mb: 0.5, px: 1 }}>
            Describe your product in a way that highlights how it will benefit your readers.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.65rem' }}>$99</Typography>
            <Typography sx={{ fontSize: '0.55rem', color: '#999', textDecoration: 'line-through' }}>$199</Typography>
          </Box>
          {btnEl}
        </Box>
      )
    case 'hero-title-img':
      return (
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', mb: 0.8 }}>Introduce your concept</Typography>
          <Box sx={{ height: 50, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.8 }}>
            <i className='tabler-photo text-[20px]' style={{ color: '#c0c0c0' }} />
          </Box>
          <Typography sx={{ fontWeight: 600, fontSize: '0.65rem', mb: 0.3 }}>Compelling headline</Typography>
          <Typography sx={{ fontSize: '0.5rem', color: '#999', lineHeight: 1.3, mb: 0.8, px: 0.5 }}>
            Get your creative juices flowing. Write engaging and informative content.
          </Typography>
          {btnEl}
        </Box>
      )
    case 'hero-side-by-side':
      return (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Box sx={{ width: 80, minHeight: 80, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className='tabler-photo text-[20px]' style={{ color: '#c0c0c0' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.5rem', color: '#999', mb: 0.2 }}>Subtitle</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', lineHeight: 1.2, mb: 0.3 }}>Introduce your concept</Typography>
            <Typography sx={{ fontSize: '0.5rem', color: '#999', lineHeight: 1.3, mb: 0.5 }}>
              Use this space to introduce subscribers to the topic of this newsletter.
            </Typography>
            {btnEl}
          </Box>
        </Box>
      )
    case 'hero-img-below':
      return (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 0.8 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', lineHeight: 1.2 }}>Introduce your concept</Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.5rem', color: '#999', lineHeight: 1.3 }}>
                Use this space to introduce subscribers to the topic of this newsletter!
              </Typography>
            </Box>
          </Box>
          <Box sx={{ height: 50, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className='tabler-photo text-[20px]' style={{ color: '#c0c0c0' }} />
          </Box>
        </Box>
      )
    case 'sec-1col':
      return <Box sx={{ border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>1 Column</Typography></Box>
    case 'sec-2col':
      return <Box sx={{ display: 'flex', gap: 1 }}><Box sx={{ flex: 1, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>1</Typography></Box><Box sx={{ flex: 1, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>2</Typography></Box></Box>
    case 'sec-3col':
      return <Box sx={{ display: 'flex', gap: 1 }}>{[1, 2, 3].map(n => <Box key={n} sx={{ flex: 1, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>{n}</Typography></Box>)}</Box>
    case 'sec-1-2':
      return <Box sx={{ display: 'flex', gap: 1 }}><Box sx={{ flex: 1, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>1</Typography></Box><Box sx={{ flex: 2, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>2</Typography></Box></Box>
    case 'sec-2-1':
      return <Box sx={{ display: 'flex', gap: 1 }}><Box sx={{ flex: 2, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>1</Typography></Box><Box sx={{ flex: 1, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>2</Typography></Box></Box>
    case 'sec-sidebar-l':
      return <Box sx={{ display: 'flex', gap: 1 }}><Box sx={{ width: 60, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>Side</Typography></Box><Box sx={{ flex: 1, border: '1px dashed #e0e0e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Typography variant='caption' color='text.disabled'>Main</Typography></Box></Box>
    case 'el-spacer':
      return (
        <Box sx={{ py: 1.5, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: '0.6rem', color: '#bdbdbd' }}>↑</Typography>
          <Typography sx={{ fontSize: '0.6rem', color: '#bdbdbd' }}>↓</Typography>
        </Box>
      )
    case 'el-divider':
      return <Box sx={{ py: 1.5 }}><Box sx={{ borderTop: '1px solid #e0e0e0' }} /></Box>
    case 'el-title':
      return <Box sx={{ py: 0.5 }}><Typography sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Compelling headline</Typography></Box>
    case 'el-title-btn':
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Compelling headline</Typography>
          <Box sx={{ bgcolor: '#333', borderRadius: 0.5, px: 1, py: 0.3 }}><Typography sx={{ color: '#fff', fontSize: '0.5rem' }}>More</Typography></Box>
        </Box>
      )
    case 'el-text':
      return (
        <Box sx={{ py: 0.5 }}>
          <Typography sx={{ fontSize: '0.5rem', color: '#999', lineHeight: 1.4 }}>
            Write engaging and informative content that will help your readers understand your message.
          </Typography>
        </Box>
      )
    case 'el-quote':
      return (
        <Box sx={{ borderLeft: '2px solid #ccc', pl: 1, py: 0.5 }}>
          <Typography sx={{ fontSize: '0.5rem', color: '#777', fontStyle: 'italic', lineHeight: 1.4 }}>
            Write your quote here.
          </Typography>
        </Box>
      )
    case 'el-button':
      return <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>{btnEl}</Box>
    case 'el-two-btn':
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, py: 1 }}>
          <Box sx={{ bgcolor: '#4caf50', borderRadius: 0.5, height: 14, width: 50, display: 'inline-block' }} />
          <Box sx={{ bgcolor: '#4caf50', borderRadius: 0.5, height: 14, width: 50, display: 'inline-block' }} />
        </Box>
      )
    case 'el-three-btn':
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.8, py: 1 }}>
          <Box sx={{ bgcolor: '#4caf50', borderRadius: 0.5, height: 14, width: 42, display: 'inline-block' }} />
          <Box sx={{ bgcolor: '#4caf50', borderRadius: 0.5, height: 14, width: 42, display: 'inline-block' }} />
          <Box sx={{ bgcolor: '#4caf50', borderRadius: 0.5, height: 14, width: 42, display: 'inline-block' }} />
        </Box>
      )
    case 'el-image':
      return <Box sx={{ width: '100%', height: 60, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className='tabler-photo text-[22px]' style={{ color: '#c0c0c0' }} /></Box>
    case 'el-video':
      return <Box sx={{ width: '100%', height: 60, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className='tabler-player-play text-[22px]' style={{ color: '#c0c0c0' }} /></Box>
    case 'el-audio':
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
          <Box sx={{ width: 28, height: 28, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className='tabler-music text-[14px]' style={{ color: '#c0c0c0' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.6rem' }}>Artist name</Typography>
            <Typography sx={{ fontSize: '0.45rem', color: '#999' }}>Audio title</Typography>
          </Box>
          <i className='tabler-player-play-filled text-[14px]' style={{ color: '#333' }} />
        </Box>
      )
    case 'el-table':
      return (
        <Box sx={{ py: 0.5 }}>
          <Typography sx={{ fontWeight: 600, fontSize: '0.6rem', textAlign: 'center', mb: 0.5 }}>Last month statistics</Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {['60%', '40%', '25%'].map((v, i) => (
              <Box key={i} sx={{ flex: 1, textAlign: 'center' }}>
                <Box sx={{ height: [18, 12, 8][i], bgcolor: ['#4caf50', '#66bb6a', '#81c784'][i], borderRadius: 0.5, mb: 0.3 }} />
                <Typography sx={{ fontSize: '0.45rem', color: '#999' }}>{v}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )
    case 'el-links':
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, py: 0.5 }}>
          {['Read article', 'Read article', 'Read article'].map((t, i) => (
            <Typography key={i} sx={{ fontSize: '0.55rem', color: '#4caf50', textDecoration: 'underline' }}>{t}</Typography>
          ))}
        </Box>
      )
    case 'cnt-message':
      return (
        <Box sx={{ bgcolor: '#4caf50', borderRadius: 0.5, px: 1.5, py: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.5rem', color: '#fff', fontWeight: 500 }}>Don&apos;t miss our Cyber Week Sale!</Typography>
          <Typography sx={{ fontSize: '0.45rem', color: '#fff', textDecoration: 'underline' }}>learn more</Typography>
        </Box>
      )
    case 'cnt-mini-box-cta':
      return (
        <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 0.5, px: 1.5, py: 0.8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography sx={{ fontSize: '0.5rem', color: '#333' }}>Don&apos;t miss our Cyber Week Sale!</Typography>
          <Box sx={{ bgcolor: '#333', borderRadius: 0.5, px: 1, py: 0.3 }}>
            <Typography sx={{ fontSize: '0.4rem', color: '#fff' }}>Button</Typography>
          </Box>
        </Box>
      )
    case 'cnt-basic-cta':
      return (
        <Box sx={{ textAlign: 'center', py: 0.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.65rem', mb: 0.3 }}>Sign up for the full experience</Typography>
          <Typography sx={{ fontSize: '0.45rem', color: '#999', lineHeight: 1.3, mb: 0.6, px: 0.5 }}>
            You&apos;re on the free list for The Line Between. For the full experience, become a paying member.
          </Typography>
          {btnEl}
        </Box>
      )
    case 'cnt-box-cta':
      return (
        <Box sx={{ border: '1px solid #e8e8e8', borderRadius: 1, p: 1.2, textAlign: 'center' }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.65rem', mb: 0.3 }}>Sign up for the full experience</Typography>
          <Typography sx={{ fontSize: '0.45rem', color: '#999', lineHeight: 1.3, mb: 0.6, px: 0.5 }}>
            You&apos;re on the free list for The Line Between. For the full experience, become a paying member.
          </Typography>
          {btnEl}
        </Box>
      )
    case 'cnt-simple':
      return (
        <Box sx={{ py: 0.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.65rem', mb: 0.3 }}>Compelling headline</Typography>
          <Typography sx={{ fontSize: '0.45rem', color: '#999', lineHeight: 1.3, mb: 0.6 }}>
            Get your creative juices flowing. Write engaging and informative content that will help your readers understand your message.
          </Typography>
          {btnEl}
        </Box>
      )
    case 'cnt-box':
      return (
        <Box sx={{ border: '1px solid #e8e8e8', borderRadius: 1, p: 1.2 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.65rem', mb: 0.3 }}>Compelling headline</Typography>
          <Typography sx={{ fontSize: '0.45rem', color: '#999', lineHeight: 1.3, mb: 0.6 }}>
            Get your creative juices flowing. Write engaging and informative content that will help your readers understand your message.
          </Typography>
          {btnEl}
        </Box>
      )
    case 'cnt-img-simple':
      return (
        <Box sx={{ py: 0.5 }}>
          <Box sx={{ height: 50, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.8 }}>
            <i className='tabler-photo text-[18px]' style={{ color: '#c0c0c0' }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.65rem', mb: 0.3 }}>Compelling headline</Typography>
          <Typography sx={{ fontSize: '0.45rem', color: '#999', lineHeight: 1.3, mb: 0.6 }}>
            Get your creative juices flowing. Write engaging and informative content that will help your readers understand your message.
          </Typography>
          {btnEl}
        </Box>
      )
    case 'cnt-title-img':
      return (
        <Box sx={{ py: 0.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.65rem', mb: 0.5 }}>Compelling headline</Typography>
          <Box sx={{ height: 50, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.8 }}>
            <i className='tabler-photo text-[18px]' style={{ color: '#c0c0c0' }} />
          </Box>
          <Typography sx={{ fontSize: '0.45rem', color: '#999', lineHeight: 1.3, mb: 0.6 }}>
            Get your creative juices flowing. Write engaging and informative content that will help your readers understand your message.
          </Typography>
          {btnEl}
        </Box>
      )
    case 'cnt-title-image':
      return (
        <Box sx={{ py: 0.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.65rem', mb: 0.3 }}>Compelling headline</Typography>
          <Typography sx={{ fontSize: '0.45rem', color: '#999', lineHeight: 1.3, mb: 0.8 }}>
            Get your creative juices flowing. Write engaging and informative content that will help your readers understand your message.
          </Typography>
          <Box sx={{ height: 55, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className='tabler-photo text-[18px]' style={{ color: '#c0c0c0' }} />
          </Box>
        </Box>
      )
    case 'sp-timer':
      return <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', py: 1 }}>{['00', '12', '30', '45'].map((v, i) => <Box key={i} sx={{ textAlign: 'center' }}><Box sx={{ bgcolor: '#f5f5f5', borderRadius: 0.5, px: 1, py: 0.5 }}><Typography variant='caption' fontWeight={700}>{v}</Typography></Box><Typography variant='caption' sx={{ fontSize: '0.5rem', color: '#9e9e9e' }}>{['Days', 'Hrs', 'Min', 'Sec'][i]}</Typography></Box>)}</Box>
    case 'sp-countdown':
      return <Box sx={{ textAlign: 'center', py: 1 }}><Box sx={{ ...pillStyle, width: '40%', mx: 'auto', mb: 0.5 }} /><Typography variant='caption' fontWeight={700} color='error'>Ends in 2 days!</Typography></Box>
    case 'sp-banner':
      return <Box sx={{ bgcolor: '#fff3e0', borderRadius: 0.5, p: 1, textAlign: 'center' }}><Box sx={{ ...pillStyle, width: '60%', mx: 'auto' }} /></Box>
    case 'sp-coupon':
      return <Box sx={{ border: '2px dashed #e0e0e0', borderRadius: 1, p: 1, textAlign: 'center' }}><Typography variant='caption' fontWeight={700} color='text.secondary'>SAVE20</Typography></Box>
    case 'prod-import':
      return (
        <Box>
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', mb: 0.5 }}>
            {[1, 2, 3].map(n => (
              <Box key={n} sx={{ width: 42, height: 42, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className='tabler-shirt text-[16px]' style={{ color: '#c0c0c0' }} />
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center', mb: 0.5 }}>
            {[1, 2, 3].map(n => (
              <Box key={n} sx={{ display: 'flex', gap: 0.3, justifyContent: 'center' }}>
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#ccc' }} />
                <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#ccc' }} />
              </Box>
            ))}
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
            {[1, 2, 3].map(n => (
              <Box key={n} sx={{ bgcolor: '#4caf50', borderRadius: 0.5, px: 1.2, py: 0.3 }}>
                <Typography sx={{ fontSize: '0.35rem', color: '#fff' }}>Button</Typography>
              </Box>
            ))}
          </Box>
        </Box>
      )
    case 'prod-1-vert':
      return (
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ height: 55, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.5 }}>
            <i className='tabler-shirt text-[20px]' style={{ color: '#c0c0c0' }} />
          </Box>
          <Typography sx={{ fontWeight: 700, fontSize: '0.6rem', mb: 0.2 }}>Product name</Typography>
          <Typography sx={{ fontSize: '0.4rem', color: '#999', lineHeight: 1.3, mb: 0.3, px: 1 }}>
            Describe your product in way that highlights how it will benefit your readers.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, mb: 0.5 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.55rem' }}>$99</Typography>
            <Typography sx={{ fontSize: '0.45rem', color: '#999', textDecoration: 'line-through' }}>$149</Typography>
          </Box>
          {btnEl}
        </Box>
      )
    case 'prod-1-horiz':
      return (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Box sx={{ width: 60, height: 60, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className='tabler-shirt text-[18px]' style={{ color: '#c0c0c0' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.6rem', mb: 0.2 }}>Product name</Typography>
            <Typography sx={{ fontSize: '0.4rem', color: '#999', lineHeight: 1.3, mb: 0.3 }}>
              Describe your product in way that highlights how it will benefit your readers.
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.55rem' }}>$99</Typography>
              <Typography sx={{ fontSize: '0.45rem', color: '#999', textDecoration: 'line-through' }}>$149</Typography>
            </Box>
            {btnEl}
          </Box>
        </Box>
      )
    case 'prod-2':
      return (
        <Box sx={{ display: 'flex', gap: 0.8 }}>
          {[1, 2].map(n => (
            <Box key={n} sx={{ flex: 1, textAlign: 'center' }}>
              <Box sx={{ height: 35, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.3 }}>
                <i className='tabler-shirt text-[14px]' style={{ color: '#c0c0c0' }} />
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.5rem', mb: 0.1 }}>Product name</Typography>
              <Typography sx={{ fontSize: '0.35rem', color: '#999', mb: 0.2 }}>Describe your product.</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.3, mb: 0.3 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.45rem' }}>$99</Typography>
                <Typography sx={{ fontSize: '0.35rem', color: '#999', textDecoration: 'line-through' }}>$149</Typography>
              </Box>
              <Box sx={{ bgcolor: '#4caf50', borderRadius: 0.5, px: 0.8, py: 0.2, display: 'inline-block' }}>
                <Typography sx={{ fontSize: '0.35rem', color: '#fff' }}>Button</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )
    case 'prod-3':
      return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[1, 2, 3].map(n => (
            <Box key={n} sx={{ flex: 1, textAlign: 'center' }}>
              <Box sx={{ height: 28, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.2 }}>
                <i className='tabler-shirt text-[12px]' style={{ color: '#c0c0c0' }} />
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.4rem', mb: 0.1 }}>Product name</Typography>
              <Typography sx={{ fontSize: '0.3rem', color: '#999', mb: 0.1 }}>Describe your product.</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.2, mb: 0.2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.4rem' }}>$99</Typography>
                <Typography sx={{ fontSize: '0.3rem', color: '#999', textDecoration: 'line-through' }}>$149</Typography>
              </Box>
              <Box sx={{ bgcolor: '#4caf50', borderRadius: 0.5, px: 0.5, py: 0.15, display: 'inline-block' }}>
                <Typography sx={{ fontSize: '0.3rem', color: '#fff' }}>Button</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )
    case 'prod-coupon-vert':
      return (
        <Box sx={{ bgcolor: '#f5f5f5', borderRadius: 1, p: 1, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.4rem', color: '#999', letterSpacing: 1, mb: 0.2 }}>DISCOUNT</Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '0.7rem', mb: 0.2 }}>GET 50% OFF</Typography>
          <Typography sx={{ fontSize: '0.4rem', color: '#999', mb: 0.5 }}>On your next order. Use code:</Typography>
          <Box sx={{ bgcolor: '#4caf50', borderRadius: 0.5, px: 1.5, py: 0.3, display: 'inline-block', mb: 0.3 }}>
            <Typography sx={{ fontSize: '0.5rem', color: '#fff', fontWeight: 700, letterSpacing: 1 }}>DISC50</Typography>
          </Box>
          <Typography sx={{ fontSize: '0.35rem', color: '#bbb' }}>*T&Cs apply*</Typography>
        </Box>
      )
    case 'prod-coupon-horiz':
      return (
        <Box sx={{ bgcolor: '#f5f5f5', borderRadius: 1, p: 0.8, display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '0.4rem', color: '#999', letterSpacing: 1, mb: 0.1 }}>DISCOUNT</Typography>
            <Typography sx={{ fontWeight: 700, fontSize: '0.6rem', mb: 0.1 }}>GET 50% OFF</Typography>
            <Typography sx={{ fontSize: '0.35rem', color: '#999' }}>On your next order.</Typography>
            <Typography sx={{ fontSize: '0.3rem', color: '#bbb', mt: 0.2 }}>*T&Cs apply*</Typography>
          </Box>
          <Box sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.35rem', color: '#999', mb: 0.2 }}>Use code:</Typography>
            <Box sx={{ bgcolor: '#4caf50', borderRadius: 0.5, px: 1, py: 0.3 }}>
              <Typography sx={{ fontSize: '0.45rem', color: '#fff', fontWeight: 700, letterSpacing: 1 }}>DISC50</Typography>
            </Box>
          </Box>
        </Box>
      )
    case 'gal-1':
      return (
        <Box sx={{ height: 80, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className='tabler-photo text-[24px]' style={{ color: '#c0c0c0' }} />
        </Box>
      )
    case 'gal-2':
      return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[1, 2].map(n => (
            <Box key={n} sx={{ flex: 1, height: 55, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className='tabler-photo text-[16px]' style={{ color: '#c0c0c0' }} />
            </Box>
          ))}
        </Box>
      )
    case 'gal-3':
      return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[1, 2, 3].map(n => (
            <Box key={n} sx={{ flex: 1, height: 40, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className='tabler-photo text-[14px]' style={{ color: '#c0c0c0' }} />
            </Box>
          ))}
        </Box>
      )
    case 'gal-4':
      return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[1, 2, 3, 4].map(n => (
            <Box key={n} sx={{ flex: 1, height: 35, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className='tabler-photo text-[12px]' style={{ color: '#c0c0c0' }} />
            </Box>
          ))}
        </Box>
      )
    case 'gal-5':
      return (
        <Box sx={{ display: 'flex', gap: 0.4 }}>
          {[1, 2, 3, 4, 5].map(n => (
            <Box key={n} sx={{ flex: 1, height: 30, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className='tabler-photo text-[10px]' style={{ color: '#c0c0c0' }} />
            </Box>
          ))}
        </Box>
      )
    case 'gal-carousel':
      return (
        <Box>
          <Box sx={{ display: 'flex', gap: 0.3, mb: 0.5 }}>
            {[1, 2, 3, 4, 5].map(n => (
              <Box key={n} sx={{ flex: 1, height: 22, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className='tabler-photo text-[8px]' style={{ color: '#c0c0c0' }} />
              </Box>
            ))}
          </Box>
          <Box sx={{ height: 55, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className='tabler-photo text-[20px]' style={{ color: '#c0c0c0' }} />
          </Box>
        </Box>
      )
    case 'blog-extended':
      return (
        <Box sx={{ py: 0.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.65rem', mb: 0.2 }}>Introduce your concept</Typography>
          <Typography sx={{ fontSize: '0.4rem', color: '#999', mb: 0.4 }}>Use this space to introduce subscribers to the topic of this newsletter.</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#e0e0e0' }} />
            <Box><Typography sx={{ fontSize: '0.35rem', fontWeight: 600 }}>Author name</Typography><Typography sx={{ fontSize: '0.3rem', color: '#999' }}>Jan 18</Typography></Box>
          </Box>
          <Box sx={{ height: 40, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.4 }}>
            <i className='tabler-photo text-[16px]' style={{ color: '#c0c0c0' }} />
          </Box>
          <Typography sx={{ fontSize: '0.35rem', color: '#999', lineHeight: 1.3, mb: 0.3 }}>Get your creative juices flowing. Write engaging and informative content that will help your readers understand your message.</Typography>
          <Typography sx={{ fontSize: '0.4rem', color: '#4caf50', textDecoration: 'underline' }}>Read more</Typography>
        </Box>
      )
    case 'blog-basic':
      return (
        <Box sx={{ display: 'flex', gap: 0.8 }}>
          <Box sx={{ width: 55, height: 50, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className='tabler-photo text-[14px]' style={{ color: '#c0c0c0' }} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.55rem', mb: 0.2 }}>Compelling headline</Typography>
            <Typography sx={{ fontSize: '0.35rem', color: '#999', lineHeight: 1.3, mb: 0.3 }}>Write engaging and informative content that will help your readers understand your message.</Typography>
            <Typography sx={{ fontSize: '0.4rem', color: '#4caf50', textDecoration: 'underline' }}>Read more</Typography>
          </Box>
        </Box>
      )
    case 'blog-double':
      return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[1, 2].map(n => (
            <Box key={n} sx={{ flex: 1 }}>
              <Box sx={{ height: 32, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 0.3 }}>
                <i className='tabler-photo text-[12px]' style={{ color: '#c0c0c0' }} />
              </Box>
              <Typography sx={{ fontWeight: 700, fontSize: '0.45rem', mb: 0.1 }}>Compelling headline</Typography>
              <Typography sx={{ fontSize: '0.3rem', color: '#999', lineHeight: 1.3, mb: 0.2 }}>Write engaging and informative content that will help your readers understand your message.</Typography>
              <Typography sx={{ fontSize: '0.35rem', color: '#4caf50', textDecoration: 'underline' }}>Read more</Typography>
            </Box>
          ))}
        </Box>
      )
    case 'blog-mini':
      return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {[1, 2].map(n => (
            <Box key={n} sx={{ flex: 1, display: 'flex', gap: 0.5 }}>
              <Box sx={{ width: 28, height: 28, bgcolor: '#f5f5f5', borderRadius: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className='tabler-photo text-[10px]' style={{ color: '#c0c0c0' }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.4rem', mb: 0.1 }}>Compelling headline</Typography>
                <Typography sx={{ fontSize: '0.28rem', color: '#999', lineHeight: 1.2, mb: 0.1 }}>Write engaging and informative content.</Typography>
                <Typography sx={{ fontSize: '0.3rem', color: '#4caf50', textDecoration: 'underline' }}>Read more</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )
    case 'blog-author1':
      return (
        <Box sx={{ py: 0.5 }}>
          <Typography sx={{ fontSize: '0.38rem', color: '#555', fontStyle: 'italic', lineHeight: 1.3, mb: 0.5 }}>
            &ldquo;Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam platea fusce eget viverra integer et.&rdquo;
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: '#e0e0e0' }} />
            <Box><Typography sx={{ fontSize: '0.4rem', fontWeight: 600 }}>Fabricio Texeira</Typography><Typography sx={{ fontSize: '0.3rem', color: '#999' }}>Jan 18</Typography></Box>
          </Box>
        </Box>
      )
    case 'blog-author2':
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, py: 0.5 }}>
          <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: '#e0e0e0', flexShrink: 0 }} />
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.5rem', mb: 0.1 }}>Author name</Typography>
            <Typography sx={{ fontSize: '0.35rem', color: '#999', lineHeight: 1.3 }}>Write engaging and informative content that will help your readers understand your message.</Typography>
          </Box>
        </Box>
      )
    case 'blog-rss':
      return (
        <Box sx={{ py: 0.5 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.5rem', mb: 0.2 }}>NASA, Rocket Lab Announce Coverage for Second TROPICS Launch</Typography>
          <Typography sx={{ fontSize: '0.35rem', color: '#999', lineHeight: 1.3 }}>After successfully launching the first pair of small satellites earlier this month from New Zealand, NASA and Rocket Lab are now targeting no earlier than...</Typography>
        </Box>
      )
    case 'soc-links':
      return (
        <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fafafa', borderRadius: 0.5 }}>
          <Typography sx={{ fontSize: '0.55rem', fontWeight: 600, mb: 0.5 }}>Follow us on social</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
            {[
              { icon: 'tabler-brand-facebook', color: '#1877f2' },
              { icon: 'tabler-brand-twitter', color: '#1da1f2' },
              { icon: 'tabler-brand-instagram', color: '#e4405f' }
            ].map((s, i) => (
              <Box key={i} sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`${s.icon} text-[7px]`} style={{ color: '#fff' }} />
              </Box>
            ))}
          </Box>
        </Box>
      )
    case 'soc-share':
      return (
        <Box sx={{ textAlign: 'center', py: 1, bgcolor: '#fafafa', borderRadius: 0.5 }}>
          <Typography sx={{ fontSize: '0.5rem', mb: 0.5 }}>Do you like the newsletter? Share it!</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
            {[
              { icon: 'tabler-brand-facebook', color: '#1877f2' },
              { icon: 'tabler-brand-twitter', color: '#1da1f2' }
            ].map((s, i) => (
              <Box key={i} sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className={`${s.icon} text-[7px]`} style={{ color: '#fff' }} />
              </Box>
            ))}
          </Box>
        </Box>
      )
    case 'soc-facebook':
      return (
        <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 0.5, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.8, py: 0.4, bgcolor: '#f5f5f5' }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className='tabler-brand-facebook text-[7px]' style={{ color: '#fff' }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '0.4rem', fontWeight: 700 }}>MailerLite</Typography>
              <Typography sx={{ fontSize: '0.3rem', color: '#999' }}>2,558 PM - Sep 16, 2019</Typography>
            </Box>
          </Box>
          <Typography sx={{ fontSize: '0.35rem', color: '#555', px: 0.8, py: 0.3, lineHeight: 1.3 }}>Our team is so scattered across the globe, it&apos;s hard to keep track of where we&apos;re all working from!</Typography>
          <Box sx={{ height: 45, bgcolor: '#e8f4e8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className='tabler-map text-[16px]' style={{ color: '#4caf50' }} />
          </Box>
          <Box sx={{ display: 'flex', gap: 1, px: 0.8, py: 0.3 }}>
            {['Like', 'Comment', 'Share'].map(a => (
              <Typography key={a} sx={{ fontSize: '0.3rem', color: '#999' }}>{a}</Typography>
            ))}
          </Box>
        </Box>
      )
    case 'soc-instagram':
      return (
        <Box sx={{ border: '1px solid #e0e0e0', borderRadius: 0.5, overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.8, py: 0.4 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: '#e4405f', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <i className='tabler-brand-instagram text-[7px]' style={{ color: '#fff' }} />
            </Box>
            <Typography sx={{ fontSize: '0.4rem', fontWeight: 700 }}>mailerlite</Typography>
          </Box>
          <Box sx={{ height: 60, bgcolor: '#e8f0e8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className='tabler-photo text-[18px]' style={{ color: '#a0a0a0' }} />
          </Box>
          <Box sx={{ px: 0.8, py: 0.3 }}>
            <Typography sx={{ fontSize: '0.35rem', color: '#4caf50', mb: 0.2 }}>View More on Instagram</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, mb: 0.2 }}>
              <i className='tabler-heart text-[8px]' style={{ color: '#999' }} />
              <i className='tabler-message-circle text-[8px]' style={{ color: '#999' }} />
            </Box>
            <Typography sx={{ fontSize: '0.3rem', color: '#555' }}>72 likes 2 comments</Typography>
            <Typography sx={{ fontSize: '0.3rem', color: '#999', mt: 0.2 }}>Add a comment...</Typography>
          </Box>
        </Box>
      )
    case 'ftr-centered':
      return (
        <Box sx={{ textAlign: 'center', bgcolor: '#f5f5f5', borderRadius: 0.5, p: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.3, mb: 0.4 }}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#4caf50' }} />
            <Typography sx={{ fontSize: '0.45rem', fontWeight: 700 }}>Company</Typography>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.3, mb: 0.4 }}>{socialDots}</Box>
          <Typography sx={{ fontSize: '0.4rem', fontWeight: 600, mb: 0.2 }}>Company name</Typography>
          <Typography sx={{ fontSize: '0.3rem', color: '#999', lineHeight: 1.3, mb: 0.2 }}>Add your company postal address here</Typography>
          <Typography sx={{ fontSize: '0.3rem', color: '#999', lineHeight: 1.3, mb: 0.3 }}>You received this email because you signed up on our website or made a purchase from us.</Typography>
          <Typography sx={{ fontSize: '0.3rem', color: '#4caf50', textDecoration: 'underline' }}>Unsubscribe</Typography>
        </Box>
      )
    case 'ftr-basic':
      return (
        <Box sx={{ bgcolor: '#f5f5f5', borderRadius: 0.5, p: 1 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.4rem', fontWeight: 600, mb: 0.2 }}>Company name</Typography>
              <Typography sx={{ fontSize: '0.3rem', color: '#999', lineHeight: 1.3, mb: 0.3 }}>Add your company postal address here</Typography>
              <Box sx={{ display: 'flex', gap: 0.3 }}>{socialDots}</Box>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.3rem', color: '#999', lineHeight: 1.3, mb: 0.2 }}>You received this email because you signed up on our website or made a purchase from us.</Typography>
              <Typography sx={{ fontSize: '0.3rem', color: '#4caf50', textDecoration: 'underline' }}>Unsubscribe</Typography>
            </Box>
          </Box>
        </Box>
      )
    case 'ftr-aligned':
      return (
        <Box sx={{ bgcolor: '#f5f5f5', borderRadius: 0.5, p: 1 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#4caf50' }} />
              <Typography sx={{ fontSize: '0.45rem', fontWeight: 700 }}>Company</Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.3 }}>{socialDots}</Box>
          </Box>
          <Typography sx={{ fontSize: '0.4rem', fontWeight: 600, mb: 0.2 }}>Company name</Typography>
          <Typography sx={{ fontSize: '0.3rem', color: '#999', lineHeight: 1.3, mb: 0.2 }}>Add your company postal address here</Typography>
          <Typography sx={{ fontSize: '0.3rem', color: '#999', lineHeight: 1.3, mb: 0.3 }}>You received this email because you signed up on our website or made a purchase from us.</Typography>
          <Typography sx={{ fontSize: '0.3rem', color: '#4caf50', textDecoration: 'underline' }}>Unsubscribe</Typography>
        </Box>
      )
    case 'ftr-nav':
      return (
        <Box sx={{ bgcolor: '#f5f5f5', borderRadius: 0.5, overflow: 'hidden' }}>
          <Box sx={{ bgcolor: '#333', px: 1, py: 0.5, display: 'flex', justifyContent: 'center', gap: 0.3, mb: 0 }}>
            <Box sx={{ display: 'flex', gap: 0.3 }}>{socialDots}</Box>
          </Box>
          <Box sx={{ bgcolor: '#333', px: 1, py: 0.3, display: 'flex', justifyContent: 'center', gap: 1 }}>
            {['About', 'News', 'Shop'].map(t => (
              <Typography key={t} sx={{ fontSize: '0.35rem', color: '#fff' }}>{t}</Typography>
            ))}
          </Box>
          <Box sx={{ p: 1, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '0.4rem', fontWeight: 600, mb: 0.2 }}>Company name</Typography>
            <Typography sx={{ fontSize: '0.3rem', color: '#999', lineHeight: 1.3, mb: 0.2 }}>Add your company postal address here</Typography>
            <Typography sx={{ fontSize: '0.3rem', color: '#999', lineHeight: 1.3, mb: 0.3 }}>You received this email because you signed up on our website or made a purchase from us.</Typography>
            <Typography sx={{ fontSize: '0.3rem', color: '#4caf50', textDecoration: 'underline' }}>Unsubscribe</Typography>
          </Box>
        </Box>
      )
    case 'ftr-app':
      return (
        <Box sx={{ bgcolor: '#f5f5f5', borderRadius: 0.5, p: 1, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '0.4rem', fontWeight: 600, mb: 0.2 }}>Company name</Typography>
          <Typography sx={{ fontSize: '0.3rem', color: '#999', lineHeight: 1.3, mb: 0.2 }}>Add your company postal address here</Typography>
          <Typography sx={{ fontSize: '0.3rem', color: '#999', lineHeight: 1.3, mb: 0.4 }}>You received this email because you signed up on our website or made a purchase from us.</Typography>
          <Typography sx={{ fontSize: '0.35rem', fontWeight: 600, mb: 0.3 }}>Use our app on the go</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mb: 0.4 }}>
            <Box sx={{ bgcolor: '#333', borderRadius: 0.5, px: 1, py: 0.3, display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <i className='tabler-brand-apple text-[8px]' style={{ color: '#fff' }} />
              <Typography sx={{ fontSize: '0.3rem', color: '#fff' }}>App Store</Typography>
            </Box>
            <Box sx={{ bgcolor: '#333', borderRadius: 0.5, px: 1, py: 0.3, display: 'flex', alignItems: 'center', gap: 0.3 }}>
              <i className='tabler-brand-google-play text-[8px]' style={{ color: '#fff' }} />
              <Typography sx={{ fontSize: '0.3rem', color: '#fff' }}>Google Play</Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '0.3rem', color: '#4caf50', textDecoration: 'underline' }}>Unsubscribe</Typography>
            <Box sx={{ display: 'flex', gap: 0.3 }}>{socialDots}</Box>
          </Box>
        </Box>
      )
    default:
      return <Box sx={{ py: 1, textAlign: 'center' }}><Box sx={{ ...pillStyle, width: '60%', mx: 'auto' }} /></Box>
  }
}

// ─── Unlayer row templates for each block type ───
const blockRowTemplates: Record<string, any> = {
  // Navigation
  'logo': { cells: [1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Logo', width: '120px', action: { name: 'web', values: { href: '', target: '_blank' } }, textAlign: 'center' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'nav': { cells: [1], columns: [{ contents: [{ type: 'menu', values: { layout: 'horizontal', separator: '|', align: 'center', fontSize: '14px', padding: '10px 20px' } }] }], values: { backgroundColor: '#ffffff', padding: '5px 20px' } },
  'logo-nav-center': { cells: [1, 1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Logo', width: '120px' } }] }, { contents: [{ type: 'menu', values: { layout: 'horizontal', align: 'right', fontSize: '14px' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'logo-nav-row': { cells: [1, 2], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Logo', width: '120px' } }] }, { contents: [{ type: 'menu', values: { layout: 'horizontal', align: 'right', fontSize: '14px' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'logo-btn': { cells: [1, 1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Logo', width: '120px' } }] }, { contents: [{ type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px', padding: '10px 20px' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'logo-social': { cells: [1, 1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Logo', width: '120px' } }] }, { contents: [{ type: 'social', values: { align: 'right', icons: { iconType: 'circle' } } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'logo-text': { cells: [1, 1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Logo', width: '120px' } }] }, { contents: [{ type: 'text', values: { text: '<p style="text-align:right;font-size:14px;color:#666;">Weekly Newsletter</p>' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },

  // Hero
  'hero-standard': { cells: [1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Hero Image', width: '100%', fullWidth: true } }, { type: 'heading', values: { text: 'Introduce your concept', fontSize: '28px', textAlign: 'center', padding: '10px 20px 5px' } }, { type: 'text', values: { text: '<p style="text-align:center;color:#666;">Use this space to introduce subscribers to the topic of this newsletter. If you\'re selling something, write informative and persuasive copy to effectively communicate your message.</p>', padding: '0px 40px 10px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px', padding: '10px 25px' } }] }], values: { backgroundColor: '#ffffff', padding: '0px 0px 20px' } },
  'hero-extended': { cells: [1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Product Image', width: '100%', fullWidth: true } }, { type: 'heading', values: { text: 'Product name', fontSize: '24px', textAlign: 'center', padding: '10px 20px 5px' } }, { type: 'text', values: { text: '<p style="text-align:center;color:#666;">Describe your product in a way that highlights how it will benefit your readers.</p>', padding: '0px 40px 5px' } }, { type: 'text', values: { text: '<p style="text-align:center;"><strong style="font-size:20px;">$99</strong> <span style="text-decoration:line-through;color:#999;">$199</span></p>', padding: '0px 20px 5px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px', padding: '10px 25px' } }] }], values: { backgroundColor: '#ffffff', padding: '0px 0px 20px' } },
  'hero-title-img': { cells: [1], columns: [{ contents: [{ type: 'heading', values: { text: 'Introduce your concept', fontSize: '28px', textAlign: 'center', fontWeight: 700, padding: '20px 20px 10px' } }, { type: 'image', values: { src: { url: '' }, alt: 'Hero Image', width: '100%' } }, { type: 'heading', values: { text: 'Compelling headline', fontSize: '20px', textAlign: 'center', padding: '10px 20px 5px' } }, { type: 'text', values: { text: '<p style="text-align:center;color:#666;">Get your creative juices flowing. Write engaging and informative content that will help your readers understand your message.</p>', padding: '0px 40px 10px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px', padding: '10px 25px' } }] }], values: { backgroundColor: '#ffffff', padding: '0px 0px 20px' } },
  'hero-side-by-side': { cells: [1, 1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Hero Image', width: '100%' } }] }, { contents: [{ type: 'text', values: { text: '<p style="color:#999;font-size:13px;">Subtitle</p>', padding: '10px 20px 0px' } }, { type: 'heading', values: { text: 'Introduce your concept', fontSize: '22px', padding: '5px 20px' } }, { type: 'text', values: { text: '<p style="color:#666;">Use this space to introduce subscribers to the topic of this newsletter.</p>', padding: '0px 20px 10px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px', padding: '10px 25px' } }] }], values: { backgroundColor: '#ffffff', padding: '20px' } },
  'hero-img-below': { cells: [1, 1], columns: [{ contents: [{ type: 'heading', values: { text: 'Introduce your concept', fontSize: '24px', fontWeight: 700, padding: '10px 20px' } }] }, { contents: [{ type: 'text', values: { text: '<p style="color:#666;">Use this space to introduce subscribers to the topic of this newsletter!</p>', padding: '10px 20px' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 0px 0px' } },

  // Sections
  'sec-1col': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<p>Content goes here</p>' } }] }], values: { backgroundColor: '#ffffff', padding: '20px' } },
  'sec-2col': { cells: [1, 1], columns: [{ contents: [{ type: 'text', values: { text: '<p>Column 1</p>' } }] }, { contents: [{ type: 'text', values: { text: '<p>Column 2</p>' } }] }], values: { backgroundColor: '#ffffff', padding: '20px' } },
  'sec-3col': { cells: [1, 1, 1], columns: [{ contents: [{ type: 'text', values: { text: '<p>Col 1</p>' } }] }, { contents: [{ type: 'text', values: { text: '<p>Col 2</p>' } }] }, { contents: [{ type: 'text', values: { text: '<p>Col 3</p>' } }] }], values: { backgroundColor: '#ffffff', padding: '20px' } },
  'sec-1-2': { cells: [1, 2], columns: [{ contents: [{ type: 'text', values: { text: '<p>Narrow</p>' } }] }, { contents: [{ type: 'text', values: { text: '<p>Wide column</p>' } }] }], values: { backgroundColor: '#ffffff', padding: '20px' } },
  'sec-2-1': { cells: [2, 1], columns: [{ contents: [{ type: 'text', values: { text: '<p>Wide column</p>' } }] }, { contents: [{ type: 'text', values: { text: '<p>Narrow</p>' } }] }], values: { backgroundColor: '#ffffff', padding: '20px' } },
  'sec-sidebar-l': { cells: [1, 2], columns: [{ contents: [{ type: 'text', values: { text: '<p>Sidebar</p>' } }] }, { contents: [{ type: 'text', values: { text: '<p>Main content area</p>' } }] }], values: { backgroundColor: '#ffffff', padding: '20px' } },

  // Elements
  'el-spacer': { cells: [1], columns: [{ contents: [{ type: 'divider', values: { width: '100%', border: { borderTopWidth: '0px' }, padding: '30px 0px' } }] }], values: { backgroundColor: 'transparent', padding: '0px' } },
  'el-divider': { cells: [1], columns: [{ contents: [{ type: 'divider', values: { width: '100%', border: { borderTopWidth: '1px', borderTopStyle: 'solid', borderTopColor: '#e0e0e0' }, padding: '10px 0px' } }] }], values: { backgroundColor: '#ffffff', padding: '5px 20px' } },
  'el-title': { cells: [1], columns: [{ contents: [{ type: 'heading', values: { text: 'Compelling headline', fontSize: '24px', fontWeight: 700 } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'el-title-btn': { cells: [1, 1], columns: [{ contents: [{ type: 'heading', values: { text: 'Compelling headline', fontSize: '24px', fontWeight: 700 } }] }, { contents: [{ type: 'button', values: { text: 'More', backgroundColor: '#333333', color: '#ffffff', borderRadius: '4px', padding: '8px 20px' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'el-text': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<p style="color:#666;">Write engaging and informative content that will help your readers understand your message.</p>' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'el-quote': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<blockquote style="border-left:3px solid #ccc;padding-left:15px;margin:0;color:#555;font-style:italic;">Write your quote here.</blockquote>' } }] }], values: { backgroundColor: '#ffffff', padding: '15px 20px' } },
  'el-button': { cells: [1], columns: [{ contents: [{ type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px', padding: '10px 25px' } }] }], values: { backgroundColor: '#ffffff', padding: '15px 20px' } },
  'el-two-btn': { cells: [1, 1], columns: [{ contents: [{ type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px', padding: '10px 25px' } }] }, { contents: [{ type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px', padding: '10px 25px' } }] }], values: { backgroundColor: '#ffffff', padding: '15px 20px' } },
  'el-three-btn': { cells: [1, 1, 1], columns: [{ contents: [{ type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px', padding: '8px 15px' } }] }, { contents: [{ type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px', padding: '8px 15px' } }] }, { contents: [{ type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px', padding: '8px 15px' } }] }], values: { backgroundColor: '#ffffff', padding: '15px 20px' } },
  'el-image': { cells: [1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image', width: '100%' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'el-video': { cells: [1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Video thumbnail - click to add video URL', width: '100%' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'el-audio': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:50px;"><div style="width:40px;height:40px;background:#f0f0f0;border-radius:4px;text-align:center;line-height:40px;">&#9835;</div></td><td style="padding-left:10px;"><strong>Artist name</strong><br/><span style="color:#999;font-size:13px;">Audio title</span></td><td style="width:40px;text-align:right;font-size:20px;">▶</td></tr></table>' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'el-table': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<table cellpadding="8" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e0e0e0;"><tr style="background:#f5f5f5;"><th style="border:1px solid #e0e0e0;text-align:left;">Column 1</th><th style="border:1px solid #e0e0e0;text-align:left;">Column 2</th><th style="border:1px solid #e0e0e0;text-align:left;">Column 3</th></tr><tr><td style="border:1px solid #e0e0e0;">Data</td><td style="border:1px solid #e0e0e0;">Data</td><td style="border:1px solid #e0e0e0;">Data</td></tr><tr><td style="border:1px solid #e0e0e0;">Data</td><td style="border:1px solid #e0e0e0;">Data</td><td style="border:1px solid #e0e0e0;">Data</td></tr></table>' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'el-links': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<p><a href="#" style="color:#4caf50;">Read article</a></p><p><a href="#" style="color:#4caf50;">Read article</a></p><p><a href="#" style="color:#4caf50;">Read article</a></p>' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },

  // Content
  'cnt-message': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<div style="background-color:#4caf50;padding:12px 20px;border-radius:4px;text-align:center;"><span style="color:#ffffff;font-size:14px;">Don\'t miss our Cyber Week Sale! <a href="#" style="color:#ffffff;text-decoration:underline;">learn more</a></span></div>' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'cnt-mini-box-cta': { cells: [1, 1], columns: [{ contents: [{ type: 'text', values: { text: '<p style="font-size:14px;">Don\'t miss our Cyber Week Sale!</p>' } }] }, { contents: [{ type: 'button', values: { text: 'Button', backgroundColor: '#333333', color: '#ffffff', borderRadius: '4px' } }] }], values: { backgroundColor: '#ffffff', padding: '15px 20px', border: { borderTopWidth: '1px', borderTopColor: '#e0e0e0', borderTopStyle: 'solid', borderBottomWidth: '1px', borderBottomColor: '#e0e0e0', borderBottomStyle: 'solid', borderLeftWidth: '1px', borderLeftColor: '#e0e0e0', borderLeftStyle: 'solid', borderRightWidth: '1px', borderRightColor: '#e0e0e0', borderRightStyle: 'solid' } } },
  'cnt-basic-cta': { cells: [1], columns: [{ contents: [{ type: 'heading', values: { text: 'Sign up for the full experience', fontSize: '22px', textAlign: 'center', padding: '10px 20px 5px' } }, { type: 'text', values: { text: '<p style="text-align:center;color:#666;font-size:14px;">You\'re on the free list for The Line Between. For the full experience, become a paying member.</p>', padding: '0 40px 10px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }], values: { backgroundColor: '#ffffff', padding: '20px' } },
  'cnt-box-cta': { cells: [1], columns: [{ contents: [{ type: 'heading', values: { text: 'Sign up for the full experience', fontSize: '22px', textAlign: 'center', padding: '10px 20px 5px' } }, { type: 'text', values: { text: '<p style="text-align:center;color:#666;font-size:14px;">You\'re on the free list for The Line Between. For the full experience, become a paying member.</p>', padding: '0 40px 10px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }], values: { backgroundColor: '#f9f9f9', padding: '30px 20px', borderRadius: '8px' } },
  'cnt-simple': { cells: [1], columns: [{ contents: [{ type: 'heading', values: { text: 'Compelling headline', fontSize: '24px', fontWeight: 700, padding: '10px 20px 5px' } }, { type: 'text', values: { text: '<p style="color:#666;font-size:14px;">Get your creative juices flowing. Write engaging and informative content that will help your readers understand your message.</p>', padding: '0 20px 10px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px 20px' } },
  'cnt-box': { cells: [1], columns: [{ contents: [{ type: 'heading', values: { text: 'Compelling headline', fontSize: '24px', fontWeight: 700, padding: '10px 20px 5px' } }, { type: 'text', values: { text: '<p style="color:#666;font-size:14px;">Get your creative juices flowing. Write engaging and informative content that will help your readers understand your message.</p>', padding: '0 20px 10px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }], values: { backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '8px' } },
  'cnt-img-simple': { cells: [1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image', width: '100%' } }, { type: 'heading', values: { text: 'Compelling headline', fontSize: '24px', fontWeight: 700, padding: '15px 20px 5px' } }, { type: 'text', values: { text: '<p style="color:#666;font-size:14px;">Get your creative juices flowing. Write engaging and informative content that will help your readers understand your message.</p>', padding: '0 20px 10px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }], values: { backgroundColor: '#ffffff', padding: '0px 0px 20px' } },
  'cnt-title-img': { cells: [1], columns: [{ contents: [{ type: 'heading', values: { text: 'Compelling headline', fontSize: '24px', fontWeight: 700, padding: '10px 20px 10px' } }, { type: 'image', values: { src: { url: '' }, alt: 'Image', width: '100%' } }, { type: 'text', values: { text: '<p style="color:#666;font-size:14px;">Get your creative juices flowing. Write engaging and informative content that will help your readers understand your message.</p>', padding: '10px 20px 10px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 0px 20px' } },
  'cnt-title-image': { cells: [1], columns: [{ contents: [{ type: 'heading', values: { text: 'Compelling headline', fontSize: '24px', fontWeight: 700, padding: '10px 20px 5px' } }, { type: 'text', values: { text: '<p style="color:#666;font-size:14px;">Get your creative juices flowing. Write engaging and informative content that will help your readers understand your message.</p>', padding: '0 20px 15px' } }, { type: 'image', values: { src: { url: '' }, alt: 'Image', width: '100%' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 0px 0px' } },

  // Special
  'sp-timer': { cells: [1], columns: [{ contents: [{ type: 'timer', values: { expireDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() } }] }], values: { backgroundColor: '#ffffff', padding: '20px' } },
  'sp-countdown': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<p style="text-align:center;font-size:14px;">Limited Time Offer</p><p style="text-align:center;color:#d32f2f;font-weight:bold;font-size:18px;">Ends in 2 days!</p>' } }] }], values: { backgroundColor: '#fff3e0', padding: '20px' } },
  'sp-banner': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<p style="text-align:center;font-weight:bold;font-size:16px;">Special Announcement Banner</p>' } }] }], values: { backgroundColor: '#fff3e0', padding: '15px 20px' } },
  'sp-coupon': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<p style="text-align:center;font-size:14px;">Use code:</p><p style="text-align:center;font-size:28px;font-weight:bold;letter-spacing:4px;">SAVE20</p><p style="text-align:center;font-size:12px;color:#666;">Valid until end of month</p>' } }] }], values: { backgroundColor: '#ffffff', padding: '20px', borderRadius: '8px' } },

  // Products
  'prod-import': { cells: [1, 1, 1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Product 1', width: '100%' } }, { type: 'text', values: { text: '<p style="text-align:center;font-size:12px;color:#999;">&#9679; &#9679;</p>' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Product 2', width: '100%' } }, { type: 'text', values: { text: '<p style="text-align:center;font-size:12px;color:#999;">&#9679; &#9679;</p>' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Product 3', width: '100%' } }, { type: 'text', values: { text: '<p style="text-align:center;font-size:12px;color:#999;">&#9679; &#9679;</p>' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }], values: { backgroundColor: '#ffffff', padding: '15px 10px' } },
  'prod-1-vert': { cells: [1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Product', width: '100%' } }, { type: 'heading', values: { text: 'Product name', fontSize: '20px', textAlign: 'center', padding: '10px 20px 5px' } }, { type: 'text', values: { text: '<p style="text-align:center;color:#666;font-size:14px;">Describe your product in way that highlights how it will benefit your readers.</p><p style="text-align:center;margin-top:8px;"><strong style="font-size:18px;">$99</strong> <span style="text-decoration:line-through;color:#999;">$149</span></p>', padding: '0 20px 10px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }], values: { backgroundColor: '#ffffff', padding: '0px 0px 20px' } },
  'prod-1-horiz': { cells: [1, 2], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Product', width: '100%' } }] }, { contents: [{ type: 'heading', values: { text: 'Product name', fontSize: '20px', padding: '5px 10px' } }, { type: 'text', values: { text: '<p style="color:#666;font-size:14px;">Describe your product in way that highlights how it will benefit your readers.</p><p style="margin-top:8px;"><strong style="font-size:18px;">$99</strong> <span style="text-decoration:line-through;color:#999;">$149</span></p>', padding: '0 10px 10px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }], values: { backgroundColor: '#ffffff', padding: '15px' } },
  'prod-2': { cells: [1, 1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Product 1', width: '100%' } }, { type: 'heading', values: { text: 'Product name', fontSize: '16px', textAlign: 'center', padding: '8px 5px 3px' } }, { type: 'text', values: { text: '<p style="text-align:center;color:#666;font-size:13px;">Describe your product.</p><p style="text-align:center;margin-top:5px;"><strong>$99</strong> <span style="text-decoration:line-through;color:#999;font-size:12px;">$149</span></p>', padding: '0 5px 8px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Product 2', width: '100%' } }, { type: 'heading', values: { text: 'Product name', fontSize: '16px', textAlign: 'center', padding: '8px 5px 3px' } }, { type: 'text', values: { text: '<p style="text-align:center;color:#666;font-size:13px;">Describe your product.</p><p style="text-align:center;margin-top:5px;"><strong>$99</strong> <span style="text-decoration:line-through;color:#999;font-size:12px;">$149</span></p>', padding: '0 5px 8px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }], values: { backgroundColor: '#ffffff', padding: '15px 10px' } },
  'prod-3': { cells: [1, 1, 1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Product 1', width: '100%' } }, { type: 'heading', values: { text: 'Product name', fontSize: '14px', textAlign: 'center', padding: '5px 3px 2px' } }, { type: 'text', values: { text: '<p style="text-align:center;color:#666;font-size:12px;">Describe your product.</p><p style="text-align:center;margin-top:4px;"><strong>$99</strong> <span style="text-decoration:line-through;color:#999;font-size:11px;">$149</span></p>', padding: '0 3px 5px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px', size: { width: '100%' } } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Product 2', width: '100%' } }, { type: 'heading', values: { text: 'Product name', fontSize: '14px', textAlign: 'center', padding: '5px 3px 2px' } }, { type: 'text', values: { text: '<p style="text-align:center;color:#666;font-size:12px;">Describe your product.</p><p style="text-align:center;margin-top:4px;"><strong>$99</strong> <span style="text-decoration:line-through;color:#999;font-size:11px;">$149</span></p>', padding: '0 3px 5px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Product 3', width: '100%' } }, { type: 'heading', values: { text: 'Product name', fontSize: '14px', textAlign: 'center', padding: '5px 3px 2px' } }, { type: 'text', values: { text: '<p style="text-align:center;color:#666;font-size:12px;">Describe your product.</p><p style="text-align:center;margin-top:4px;"><strong>$99</strong> <span style="text-decoration:line-through;color:#999;font-size:11px;">$149</span></p>', padding: '0 3px 5px' } }, { type: 'button', values: { text: 'Button', backgroundColor: '#4caf50', color: '#ffffff', borderRadius: '4px' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 5px' } },
  'prod-coupon-vert': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<div style="background:#f5f5f5;border-radius:8px;padding:25px 20px;text-align:center;"><p style="font-size:11px;color:#999;letter-spacing:2px;margin-bottom:5px;">DISCOUNT</p><p style="font-size:24px;font-weight:bold;margin-bottom:5px;">GET 50% OFF</p><p style="font-size:13px;color:#666;margin-bottom:12px;">On your next order. Use code:</p><div style="display:inline-block;background:#4caf50;color:#fff;font-weight:bold;padding:8px 24px;border-radius:4px;letter-spacing:2px;font-size:16px;">DISC50</div><p style="font-size:11px;color:#bbb;margin-top:10px;">*T&Cs apply*</p></div>' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },
  'prod-coupon-horiz': { cells: [2, 1], columns: [{ contents: [{ type: 'text', values: { text: '<div style="background:#f5f5f5;border-radius:8px 0 0 8px;padding:20px;"><p style="font-size:11px;color:#999;letter-spacing:2px;margin-bottom:4px;">DISCOUNT</p><p style="font-size:22px;font-weight:bold;margin-bottom:4px;">GET 50% OFF</p><p style="font-size:13px;color:#666;">On your next order.</p><p style="font-size:11px;color:#bbb;margin-top:6px;">*T&Cs apply*</p></div>' } }] }, { contents: [{ type: 'text', values: { text: '<div style="background:#f5f5f5;border-radius:0 8px 8px 0;padding:20px;text-align:center;display:flex;flex-direction:column;justify-content:center;height:100%;"><p style="font-size:12px;color:#999;margin-bottom:8px;">Use code:</p><div style="display:inline-block;background:#4caf50;color:#fff;font-weight:bold;padding:8px 20px;border-radius:4px;letter-spacing:2px;font-size:14px;">DISC50</div></div>' } }] }], values: { backgroundColor: '#ffffff', padding: '10px 20px' } },

  // Gallery
  'gal-1': { cells: [1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image', width: '100%', fullWidth: true } }] }], values: { backgroundColor: '#ffffff', padding: '10px' } },
  'gal-2': { cells: [1, 1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 1', width: '100%' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 2', width: '100%' } }] }], values: { backgroundColor: '#ffffff', padding: '10px' } },
  'gal-3': { cells: [1, 1, 1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 1', width: '100%' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 2', width: '100%' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 3', width: '100%' } }] }], values: { backgroundColor: '#ffffff', padding: '10px' } },
  'gal-4': { cells: [1, 1, 1, 1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 1', width: '100%' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 2', width: '100%' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 3', width: '100%' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 4', width: '100%' } }] }], values: { backgroundColor: '#ffffff', padding: '10px' } },
  'gal-5': { cells: [1, 1, 1, 1, 1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 1', width: '100%' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 2', width: '100%' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 3', width: '100%' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 4', width: '100%' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Image 5', width: '100%' } }] }], values: { backgroundColor: '#ffffff', padding: '10px' } },
  'gal-carousel': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<table cellpadding="0" cellspacing="4" style="width:100%;"><tr><td style="width:20%;"><div style="background:#f0f0f0;border-radius:4px;height:60px;"></div></td><td style="width:20%;"><div style="background:#f0f0f0;border-radius:4px;height:60px;"></div></td><td style="width:20%;"><div style="background:#f0f0f0;border-radius:4px;height:60px;"></div></td><td style="width:20%;"><div style="background:#f0f0f0;border-radius:4px;height:60px;"></div></td><td style="width:20%;"><div style="background:#f0f0f0;border-radius:4px;height:60px;"></div></td></tr></table>' } }, { type: 'image', values: { src: { url: '' }, alt: 'Featured Image', width: '100%' } }] }], values: { backgroundColor: '#ffffff', padding: '10px' } },

  // Blog
  'blog-extended': { cells: [1], columns: [{ contents: [{ type: 'heading', values: { text: 'Introduce your concept', fontSize: '24px', fontWeight: 700, padding: '10px 20px 5px' } }, { type: 'text', values: { text: '<p style="color:#666;font-size:14px;">Use this space to introduce subscribers to the topic of this newsletter.</p>', padding: '0 20px 10px' } }, { type: 'text', values: { text: '<table cellpadding="0" cellspacing="0"><tr><td style="width:30px;"><div style="width:24px;height:24px;background:#e0e0e0;border-radius:50%;"></div></td><td style="padding-left:8px;"><strong style="font-size:13px;">Author name</strong><br/><span style="color:#999;font-size:12px;">Jan 18</span></td></tr></table>', padding: '0 20px 10px' } }, { type: 'image', values: { src: { url: '' }, alt: 'Blog Image', width: '100%' } }, { type: 'text', values: { text: '<p style="color:#666;font-size:14px;">Get your creative juices flowing. Write engaging and informative content that will help your readers understand your message. Be concise, clear, and on-brand. Remember to proofread for grammar and spelling errors before publishing.</p><p style="margin-top:10px;"><a href="#" style="color:#4caf50;">Read more</a></p>', padding: '10px 20px 20px' } }] }], values: { backgroundColor: '#ffffff', padding: '0' } },
  'blog-basic': { cells: [1, 2], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Blog Image', width: '100%' } }] }, { contents: [{ type: 'heading', values: { text: 'Compelling headline', fontSize: '20px', fontWeight: 700, padding: '5px 10px' } }, { type: 'text', values: { text: '<p style="color:#666;font-size:14px;">Write engaging and informative content that will help your readers understand your message.</p><p style="margin-top:8px;"><a href="#" style="color:#4caf50;">Read more</a></p>', padding: '0 10px 10px' } }] }], values: { backgroundColor: '#ffffff', padding: '15px' } },
  'blog-double': { cells: [1, 1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Blog Image 1', width: '100%' } }, { type: 'heading', values: { text: 'Compelling headline', fontSize: '18px', fontWeight: 700, padding: '8px 5px 3px' } }, { type: 'text', values: { text: '<p style="color:#666;font-size:13px;">Write engaging and informative content that will help your readers understand your message.</p><p style="margin-top:6px;"><a href="#" style="color:#4caf50;">Read more</a></p>', padding: '0 5px 10px' } }] }, { contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Blog Image 2', width: '100%' } }, { type: 'heading', values: { text: 'Compelling headline', fontSize: '18px', fontWeight: 700, padding: '8px 5px 3px' } }, { type: 'text', values: { text: '<p style="color:#666;font-size:13px;">Write engaging and informative content that will help your readers understand your message.</p><p style="margin-top:6px;"><a href="#" style="color:#4caf50;">Read more</a></p>', padding: '0 5px 10px' } }] }], values: { backgroundColor: '#ffffff', padding: '15px 10px' } },
  'blog-mini': { cells: [1, 1], columns: [{ contents: [{ type: 'text', values: { text: '<table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:80px;vertical-align:top;"><div style="width:70px;height:70px;background:#f0f0f0;border-radius:4px;"></div></td><td style="padding-left:10px;vertical-align:top;"><strong style="font-size:14px;">Compelling headline</strong><br/><span style="color:#666;font-size:13px;">Write engaging and informative content.</span><br/><a href="#" style="color:#4caf50;font-size:13px;">Read more</a></td></tr></table>' } }] }, { contents: [{ type: 'text', values: { text: '<table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:80px;vertical-align:top;"><div style="width:70px;height:70px;background:#f0f0f0;border-radius:4px;"></div></td><td style="padding-left:10px;vertical-align:top;"><strong style="font-size:14px;">Compelling headline</strong><br/><span style="color:#666;font-size:13px;">Write engaging and informative content.</span><br/><a href="#" style="color:#4caf50;font-size:13px;">Read more</a></td></tr></table>' } }] }], values: { backgroundColor: '#ffffff', padding: '15px 10px' } },
  'blog-author1': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<p style="color:#555;font-style:italic;font-size:14px;line-height:1.5;">&ldquo;Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam platea fusce eget viverra integer et. Et laoreet enim urna, id. At phasellus cursus purus pretium suspendisse ultricies.&rdquo;</p>', padding: '10px 20px' } }, { type: 'text', values: { text: '<table cellpadding="0" cellspacing="0"><tr><td style="width:36px;"><div style="width:30px;height:30px;background:#e0e0e0;border-radius:50%;"></div></td><td style="padding-left:10px;"><strong style="font-size:14px;">Fabricio Texeira</strong><br/><span style="color:#999;font-size:12px;">Jan 18</span></td></tr></table>', padding: '5px 20px 15px' } }] }], values: { backgroundColor: '#ffffff', padding: '0' } },
  'blog-author2': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="width:50px;vertical-align:top;"><div style="width:40px;height:40px;background:#e0e0e0;border-radius:50%;"></div></td><td style="padding-left:12px;vertical-align:top;"><strong style="font-size:15px;">Author name</strong><br/><span style="color:#666;font-size:13px;">Write engaging and informative content that will help your readers understand your message.</span></td></tr></table>' } }] }], values: { backgroundColor: '#ffffff', padding: '15px 20px' } },
  'blog-rss': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<p style="font-weight:bold;font-size:16px;">NASA, Rocket Lab Announce Coverage for Second TROPICS Launch</p><p style="color:#666;font-size:13px;margin-top:6px;">After successfully launching the first pair of small satellites earlier this month from New Zealand, NASA and Rocket Lab are now targeting no earlier than 1:00 a.m. EDT Monday, May 23 (5:00 p.m. NZST), to launch the second pair of storm-tracking CubeSats into orbit.</p>' } }] }], values: { backgroundColor: '#ffffff', padding: '15px 20px' } },

  // Social
  'soc-links': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<p style="text-align:center;font-weight:bold;font-size:16px;">Follow us on social</p>' } }, { type: 'social', values: { align: 'center', icons: { iconType: 'circle' } } }] }], values: { backgroundColor: '#ffffff', padding: '20px' } },
  'soc-share': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<p style="text-align:center;font-size:14px;">Do you like the newsletter? Share it!</p>' } }, { type: 'social', values: { align: 'center', icons: { iconType: 'circle' } } }] }], values: { backgroundColor: '#ffffff', padding: '20px' } },
  'soc-facebook': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<div style="border:1px solid #ddd;border-radius:8px;overflow:hidden;max-width:500px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;"><div style="padding:12px 16px;display:flex;align-items:center;"><div style="width:40px;height:40px;background:#1877f2;border-radius:50%;margin-right:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:bold;font-size:20px;">f</div><div><strong style="font-size:14px;">MailerLite</strong><br/><span style="color:#999;font-size:12px;">Sep 16, 2019</span></div></div><p style="padding:0 16px 10px;margin:0;font-size:14px;color:#333;">Our team is so scattered across the globe, it\'s hard to keep track of where we\'re all working from! That\'s why our designer Vincent created this awesome interactive map</p><div style="background:#e8f4e8;height:250px;display:flex;align-items:center;justify-content:center;"><span style="font-size:18px;color:#666;">Map Preview</span></div><div style="padding:10px 16px;border-top:1px solid #eee;display:flex;gap:20px;"><span style="color:#999;font-size:13px;">Like</span><span style="color:#999;font-size:13px;">Comment</span><span style="color:#999;font-size:13px;">↗ Share</span></div></div>' } }] }], values: { backgroundColor: '#ffffff', padding: '15px 20px' } },
  'soc-instagram': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<div style="border:1px solid #ddd;border-radius:8px;overflow:hidden;max-width:500px;margin:0 auto;font-family:Helvetica,Arial,sans-serif;"><div style="padding:10px 14px;display:flex;align-items:center;"><div style="width:32px;height:32px;background:linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);border-radius:50%;margin-right:10px;"></div><strong style="font-size:14px;">mailerlite</strong></div><div style="background:#f0f0f0;height:300px;display:flex;align-items:center;justify-content:center;"><span style="font-size:18px;color:#666;">Photo</span></div><div style="padding:10px 14px;"><span style="color:#00376b;font-size:13px;">View More on Instagram</span><div style="margin-top:6px;display:flex;gap:12px;"><span style="font-size:14px;">Like</span><span style="font-size:18px;">Comment</span><span style="font-size:18px;">Share</span></div><p style="margin:6px 0 0;font-size:13px;color:#333;"><strong>72 likes</strong> 2 comments</p><p style="margin:4px 0 0;font-size:13px;color:#999;">Add a comment...</p></div></div>' } }] }], values: { backgroundColor: '#ffffff', padding: '15px 20px' } },

  // Footer
  'ftr-centered': { cells: [1], columns: [{ contents: [{ type: 'image', values: { src: { url: '' }, alt: 'Logo', width: '80px', textAlign: 'center' } }, { type: 'social', values: { align: 'center', icons: { iconType: 'circle' } } }, { type: 'text', values: { text: '<p style="text-align:center;"><strong>Company name</strong><br/><span style="font-size:12px;color:#999;">Add your company postal address here</span></p><p style="text-align:center;font-size:11px;color:#999;">You received this email because you signed up on our website or made a purchase from us.</p><p style="text-align:center;"><a href="{{ UnsubscribeURL . }}" style="font-size:12px;">Unsubscribe</a></p>' } }] }], values: { backgroundColor: '#f5f5f5', padding: '25px 20px' } },
  'ftr-basic': { cells: [1, 1], columns: [{ contents: [{ type: 'text', values: { text: '<p><strong>Company name</strong><br/><span style="font-size:12px;color:#999;">Add your company postal address here</span></p>' } }, { type: 'social', values: { align: 'left', icons: { iconType: 'circle' } } }] }, { contents: [{ type: 'text', values: { text: '<p style="font-size:11px;color:#999;">You received this email because you signed up on our website or made a purchase from us.</p><p><a href="{{ UnsubscribeURL . }}" style="font-size:12px;">Unsubscribe</a></p>' } }] }], values: { backgroundColor: '#f5f5f5', padding: '25px 20px' } },
  'ftr-aligned': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<table cellpadding="0" cellspacing="0" style="width:100%;"><tr><td style="vertical-align:middle;"><table cellpadding="0" cellspacing="0"><tr><td style="width:30px;"><div style="width:24px;height:24px;background:#4caf50;border-radius:50%;"></div></td><td style="padding-left:8px;"><strong style="font-size:14px;">Company</strong></td></tr></table></td><td style="text-align:right;vertical-align:middle;"><span style="font-size:20px;">● ● ●</span></td></tr></table>' } }, { type: 'text', values: { text: '<p><strong>Company name</strong><br/><span style="font-size:12px;color:#999;">Add your company postal address here</span></p><p style="font-size:11px;color:#999;">You received this email because you signed up on our website or made a purchase from us.</p><p><a href="{{ UnsubscribeURL . }}" style="font-size:12px;">Unsubscribe</a></p>' } }] }], values: { backgroundColor: '#f5f5f5', padding: '20px' } },
  'ftr-nav': { cells: [1], columns: [{ contents: [{ type: 'social', values: { align: 'center', icons: { iconType: 'circle', color: '#ffffff' } } }, { type: 'menu', values: { layout: 'horizontal', separator: '|', align: 'center', fontSize: '13px', color: '#ffffff', padding: '5px 10px' } }, { type: 'text', values: { text: '<p style="text-align:center;"><strong>Company name</strong><br/><span style="font-size:12px;color:#999;">Add your company postal address here</span></p><p style="text-align:center;font-size:11px;color:#999;">You received this email because you signed up on our website or made a purchase from us.</p><p style="text-align:center;"><a href="{{ UnsubscribeURL . }}" style="font-size:12px;">Unsubscribe</a></p>' } }] }], values: { backgroundColor: '#f5f5f5', padding: '0' } },
  'ftr-app': { cells: [1], columns: [{ contents: [{ type: 'text', values: { text: '<p style="text-align:center;"><strong>Company name</strong><br/><span style="font-size:12px;color:#999;">Add your company postal address here</span></p><p style="text-align:center;font-size:11px;color:#999;">You received this email because you signed up on our website or made a purchase from us.</p><p style="text-align:center;font-weight:bold;margin-top:15px;">Use our app on the go</p><p style="text-align:center;margin-top:8px;"><a href="#" style="display:inline-block;background:#333;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:12px;margin-right:8px;">App Store</a><a href="#" style="display:inline-block;background:#333;color:#fff;padding:8px 16px;border-radius:6px;text-decoration:none;font-size:12px;">▶ Google Play</a></p>' } }, { type: 'text', values: { text: '<p style="text-align:left;display:inline-block;"><a href="{{ UnsubscribeURL . }}" style="font-size:12px;">Unsubscribe</a></p>' } }, { type: 'social', values: { align: 'right', icons: { iconType: 'circle' } } }] }], values: { backgroundColor: '#f5f5f5', padding: '25px 20px' } }
}

// ─── Main Editor Component ───
interface DragDropEmailEditorProps {
  campaignType: string
  onDone?: (html: string, json: object) => void
}

const DRAWER_WIDTH = 300

const DragDropEmailEditor = ({ campaignType }: DragDropEmailEditorProps) => {
  const router = useRouter()
  const { lang } = useParams()
  const searchParams = useSearchParams()
  const locale = (lang as string) || 'en'
  const emailEditorRef = useRef<any>(null)
  const unlayerRef = useRef<EditorRef | null>(null)
  const [activeCategory, setActiveCategory] = useState('Elements')
  const [searchQuery, setSearchQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(true)
  const [dragOverEditor, setDragOverEditor] = useState(false)
  const [addedBlockName, setAddedBlockName] = useState<string | null>(null)
  const [previewMenuAnchor, setPreviewMenuAnchor] = useState<null | HTMLElement>(null)
  const [testEmailOpen, setTestEmailOpen] = useState(false)
  const [testEmailAddress, setTestEmailAddress] = useState('')
  const [testEmailSending, setTestEmailSending] = useState(false)
  const dragPreviewKeyRef = useRef<string | null>(null)
  const isMobile = useMobileBreakpoint()
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false)
  const [saveTemplateName, setSaveTemplateName] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [rightPanelOpen, setRightPanelOpen] = useState(true)
  const fromCampaignId = searchParams.get('from_campaign')
  const fromTemplateId = searchParams.get('from_template')
  const fromCampaignLoadedRef = useRef(false)
  const fromTemplateLoadedRef = useRef(false)

  const onReady = useCallback((unlayer: EditorRef) => {
    unlayerRef.current = unlayer

    // Register custom image picker — opens media library instead of default file upload
    ;(unlayer as any).registerCallback('selectImage', (data: any, done: (result: { url: string }) => void) => {
      const w = Math.min(window.innerWidth - 40, 1100)
      const h = Math.min(window.innerHeight - 40, 700)
      const picker = window.open(`/${locale}/media?picker=true`, 'mediaPicker', `width=${w},height=${h},scrollbars=yes`)

      const handleMessage = (event: MessageEvent) => {
        // Validate origin to prevent cross-origin message injection
        if (event.origin !== window.location.origin) return

        if (event.data?.type === 'media-picker-select' && event.data?.url) {
          done({ url: event.data.url })
          window.removeEventListener('message', handleMessage)
          if (checkClosed) clearInterval(checkClosed)
        }
      }

      window.addEventListener('message', handleMessage)

      // Clean up listener if popup is closed without selecting (or blocked)
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
        // Popup was blocked — clean up immediately
        window.removeEventListener('message', handleMessage)
      }
    })

    // Load recent campaign content if from_campaign param is present
    if (fromCampaignId && !fromCampaignLoadedRef.current) {
      fromCampaignLoadedRef.current = true
      setLoadingTemplate(true)

      campaignService.getById(parseInt(fromCampaignId, 10))
        .then((response) => {
          const campaign = response.data

          if (campaign?.body) {
            // Import raw HTML into Unlayer editor
            ;(unlayer as any).loadDesign({
              html: campaign.body,
              classic: true
            })

            setAddedBlockName('Template loaded from recent email')
          }
        })
        .catch((err) => {
          console.error('Failed to load campaign template:', err)
          setAddedBlockName('Failed to load recent email template')
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

            setAddedBlockName('Template loaded successfully')
          }
        })
        .catch((err) => {
          console.error('Failed to load template:', err)
          setAddedBlockName('Failed to load template')
        })
        .finally(() => {
          setLoadingTemplate(false)
        })
    }
  }, [fromCampaignId, fromTemplateId])

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

    if (!unlayer) return

    // Open window immediately (in user-gesture context) to avoid popup blocker
    const previewWindow = window.open('', '_blank')

    ;(unlayer as any).exportHtml((data: { html: string }) => {
      if (previewWindow) {
        // Use a sandboxed iframe inside the preview window to prevent script execution
        previewWindow.document.write(
          '<!DOCTYPE html><html><head><title>Email Preview</title><style>body{margin:0;}</style></head><body>' +
          '<iframe sandbox="" style="width:100%;height:100vh;border:none;" id="preview"></iframe>' +
          '<script>document.getElementById("preview").srcdoc=document.getElementById("content").textContent;</script>' +
          '<template id="content">' + data.html.replace(/<\/template/gi, '&lt;/template') + '</template>' +
          '</body></html>'
        )
        previewWindow.document.close()
      }
    })
  }

  const handleSendTestEmail = () => {
    const unlayer = unlayerRef.current

    if (!unlayer || !testEmailAddress.trim()) return

    setTestEmailSending(true)

    ;(unlayer as any).exportHtml(async (data: { html: string }) => {
      const email = testEmailAddress.trim()
      let tempCampaignId: number | null = null
      let tempSubscriberId: number | null = null

      try {
        // Get first available list for the temp campaign
        const listsRes = await listService.getAll({ per_page: 1 })
        const lists = listsRes.data?.results || []

        if (lists.length === 0) {
          setAddedBlockName('Failed: No subscriber lists available')
          setTimeout(() => setAddedBlockName(null), 3000)

          return
        }

        const listId = lists[0].id

        // Find or create subscriber
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

        // Create temp campaign
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

        // Send test using email address (Listmonk expects email strings)
        await campaignService.test(tempCampaignId, [email])

        setTestEmailOpen(false)
        setTestEmailAddress('')
        setAddedBlockName('Test email sent')
        setTimeout(() => setAddedBlockName(null), 2000)
      } catch (err) {
        console.error('Failed to send test email:', err)
        setAddedBlockName('Failed to send test email')
        setTimeout(() => setAddedBlockName(null), 3000)
      } finally {
        // Clean up temp resources
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

      // Show success feedback
      const name = blockName || blockCategories.flatMap(c => c.blocks).find(b => b.previewKey === previewKey)?.name || 'Block'

      setAddedBlockName(name)
      setTimeout(() => setAddedBlockName(null), 2000)
    })
  }

  // Drag-and-drop handlers
  const handleDragStart = (e: React.DragEvent, previewKey: string, blockName: string) => {
    dragPreviewKeyRef.current = previewKey
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('text/plain', previewKey)

    // Create custom drag ghost
    const ghost = document.createElement('div')

    ghost.textContent = blockName
    ghost.style.cssText = 'padding:8px 16px;background:#4caf50;color:#fff;border-radius:6px;font-size:13px;font-weight:600;position:absolute;top:-100px;left:-100px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.2);'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  const handleDragEnd = () => {
    dragPreviewKeyRef.current = null
    setDragOverEditor(false)
  }

  const handleEditorDragOver = (e: React.DragEvent) => {
    if (dragPreviewKeyRef.current) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      setDragOverEditor(true)
    }
  }

  const handleEditorDragLeave = () => {
    setDragOverEditor(false)
  }

  const handleEditorDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOverEditor(false)

    const previewKey = dragPreviewKeyRef.current || e.dataTransfer.getData('text/plain')

    if (previewKey) {
      handleAddBlock(previewKey)
    }

    dragPreviewKeyRef.current = null
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

        setAddedBlockName('Template saved successfully!')
        setSaveTemplateOpen(false)
        setSaveTemplateName('')
      } catch (err) {
        console.error('Failed to save template:', err)
        setAddedBlockName('Failed to save template')
      } finally {
        setSavingTemplate(false)
      }
    })
  }

  // Toggle Unlayer's right panel (Content/Blocks/Body tabs)
  const toggleRightPanel = () => {
    const unlayer = unlayerRef.current

    if (!unlayer) return

    const newState = !rightPanelOpen

    setRightPanelOpen(newState)

    ;(unlayer as any).updateTabs({
      content: { enabled: newState },
      blocks: { enabled: newState },
      body: { enabled: newState },
      uploads: { enabled: newState }
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
          gap: 2,
          px: 2,
          py: 1,
          bgcolor: '#2d2d2d',
          color: '#fff',
          minHeight: 52,
          zIndex: 1201
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Button
            variant='outlined'
            size='small'
            onClick={handleGoBack}
            sx={{
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.3)',
              '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' }
            }}
          >
            Go back
          </Button>
          <Tooltip title={drawerOpen ? 'Hide blocks panel' : 'Show blocks panel'}>
            <IconButton
              size='small'
              onClick={() => setDrawerOpen(!drawerOpen)}
              sx={{ color: drawerOpen ? '#4caf50' : 'rgba(255,255,255,0.5)' }}
            >
              <i className='tabler-layout-sidebar-left-collapse text-[20px]' />
            </IconButton>
          </Tooltip>
          <Tooltip title={rightPanelOpen ? 'Hide settings panel' : 'Show settings panel'}>
            <IconButton
              size='small'
              onClick={toggleRightPanel}
              sx={{ color: rightPanelOpen ? '#4caf50' : 'rgba(255,255,255,0.5)' }}
            >
              <i className='tabler-layout-sidebar-right-collapse text-[20px]' />
            </IconButton>
          </Tooltip>
        </Box>

        <Typography variant='subtitle2' sx={{ color: 'rgba(255,255,255,0.7)', display: { xs: 'none', sm: 'block' } }}>
          Email Editor
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title='Save as reusable template'>
            <Button
              variant='outlined'
              size='small'
              onClick={() => setSaveTemplateOpen(true)}
              sx={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.3)',
                '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' }
              }}
              startIcon={<i className='tabler-bookmark' />}
            >
              <Box component='span' sx={{ display: { xs: 'none', sm: 'inline' } }}>Save template</Box>
            </Button>
          </Tooltip>
          <Button
            variant='outlined'
            size='small'
            onClick={(e) => setPreviewMenuAnchor(e.currentTarget)}
            sx={{
              color: '#fff',
              borderColor: 'rgba(255,255,255,0.3)',
              '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.1)' }
            }}
            startIcon={<i className='tabler-eye' />}
            endIcon={<i className='tabler-chevron-down text-[14px]' />}
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
          <Button
            variant='contained'
            size='small'
            color='success'
            onClick={handleDoneEditing}
            startIcon={<i className='tabler-device-floppy' />}
          >
            <Box component='span' sx={{ display: { xs: 'none', sm: 'inline' } }}>Done editing</Box>
          </Button>
        </Box>
      </Box>

      {/* Editor area */}
      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Block Browser Drawer - persistent, pushes content */}
        <Box
          sx={{
            width: drawerOpen ? { xs: '100%', sm: DRAWER_WIDTH } : 0,
            minWidth: drawerOpen ? { xs: '100%', sm: DRAWER_WIDTH } : 0,
            transition: 'width 0.3s, min-width 0.3s',
            overflow: 'hidden',
            display: 'flex',
            borderRight: drawerOpen ? '1px solid' : 'none',
            borderColor: 'divider'
          }}
        >
          {/* Single drill-down panel: categories → blocks */}
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

                {/* Search within category */}
                <Box sx={{ px: 1.5, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <TextField
                    fullWidth
                    size='small'
                    placeholder={`Search ${activeCategory}...`}
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

                {/* Block cards */}
                <Box sx={{ px: 1.5, py: 1.5, overflowY: 'auto', flex: 1 }}>
                  {filteredBlocks.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {filteredBlocks.map((block, idx) => (
                        <Box
                          key={`${block.previewKey}-${idx}`}
                          draggable
                          onDragStart={(e) => handleDragStart(e, block.previewKey, block.name)}
                          onDragEnd={handleDragEnd}
                          onClick={() => handleAddBlock(block.previewKey, block.name)}
                          sx={{
                            border: '1px solid #e0e0e0',
                            borderRadius: 1,
                            bgcolor: '#fafafa',
                            p: 1.5,
                            cursor: 'grab',
                            position: 'relative',
                            '&:hover': {
                              borderColor: '#4caf50',
                              boxShadow: '0 0 0 1px #4caf50',
                              '& .block-add-hint': { opacity: 1 }
                            },
                            '&:active': { cursor: 'grabbing', transform: 'scale(0.98)' },
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
                            Click or drag
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
                  ) : (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography variant='body2' color='text.secondary'>
                        No blocks found
                      </Typography>
                    </Box>
                  )}
                </Box>
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

                {/* Search all blocks */}
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

        {/* Toggle chevron button */}
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
            borderRight: '1px solid',
            borderColor: 'divider',
            '&:hover': { bgcolor: '#e0e0e0' },
            transition: 'background-color 0.2s'
          }}
        >
          <i
            className={`tabler-chevron-${drawerOpen ? 'left' : 'right'} text-[14px]`}
            style={{ color: '#757575' }}
          />
        </Box>

        {/* Unlayer Editor - takes remaining space */}
        <Box
          sx={{ flex: 1, minWidth: 0, position: 'relative' }}
          onDragOver={handleEditorDragOver}
          onDragLeave={handleEditorDragLeave}
          onDrop={handleEditorDrop}
        >
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
          {/* Drop zone overlay */}
          {dragOverEditor && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                zIndex: 10,
                bgcolor: 'rgba(76,175,80,0.08)',
                border: '3px dashed #4caf50',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none'
              }}
            >
              <Box sx={{ bgcolor: 'rgba(76,175,80,0.9)', color: '#fff', px: 3, py: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <i className='tabler-download text-[20px]' />
                <Typography fontWeight={600} fontSize='0.9rem'>Drop to add block</Typography>
              </Box>
            </Box>
          )}
          <EmailEditor
            ref={emailEditorRef as any}
            onReady={onReady as any}
            minHeight='100%'
            options={{
              displayMode: 'email',
              features: {
                textEditor: {
                  spellChecker: true
                },
                userUploads: {
                  enabled: true
                }
              },
              appearance: {
                theme: 'modern_light'
              },
              tabs: {
                content: { enabled: true },
                blocks: { enabled: true },
                body: { enabled: true, active: true },
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

        {/* Right panel toggle chevron */}
        <Box
          onClick={toggleRightPanel}
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
            className={`tabler-chevron-${rightPanelOpen ? 'right' : 'left'} text-[14px]`}
            style={{ color: '#757575' }}
          />
        </Box>
      </Box>

      {/* Success/error snackbar */}
      <Snackbar
        open={!!addedBlockName}
        autoHideDuration={2500}
        onClose={() => setAddedBlockName(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          onClose={() => setAddedBlockName(null)}
          severity={addedBlockName?.startsWith('Failed') ? 'error' : 'success'}
          variant='filled'
          icon={<i className={`${addedBlockName?.startsWith('Failed') ? 'tabler-x' : 'tabler-check'} text-[18px]`} />}
          sx={{ minWidth: 250 }}
        >
          {(addedBlockName?.includes('email') || addedBlockName?.includes('emplate') || addedBlockName?.startsWith('Failed'))
            ? addedBlockName
            : `${addedBlockName} added to email`}
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

      {/* Save as Template dialog */}
      <Dialog open={saveTemplateOpen} onClose={() => setSaveTemplateOpen(false)} maxWidth='xs' fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <i className='tabler-bookmark text-[20px]' />
          Save as template
        </DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            Save this email design as a reusable template. You can find it under &quot;My templates&quot; in the Template gallery.
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
