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
import Alert from '@mui/material/Alert'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

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

// Gallery template card type
interface GalleryTemplate {
  name: string
  bgColor: string
  textColor: string
  icon: string
  headline: string
}

// Gallery templates per category
const galleryTemplatesMap: Record<string, GalleryTemplate[]> = {
  'Black Friday': [
    { name: 'Exclusive sale', bgColor: '#1a1a2e', textColor: '#fff', icon: 'tabler-gift', headline: 'Embrace the spirit of excellence' },
    { name: 'Giveaway', bgColor: '#16213e', textColor: '#fff', icon: 'tabler-trophy', headline: 'Win Big with Our Exclusive Giveaway' },
    { name: 'Special holiday deals', bgColor: '#e8f5e9', textColor: '#1b5e20', icon: 'tabler-truck-delivery', headline: 'Free delivery for the entire month!' },
    { name: 'Holiday sale', bgColor: '#fff3e0', textColor: '#e65100', icon: 'tabler-coffee', headline: 'Enjoy your favorite coffee beans with a discount!' },
    { name: 'Black Friday countdown timer', bgColor: '#212121', textColor: '#fff', icon: 'tabler-clock', headline: 'BLACK FRIDAY' },
    { name: 'Black Friday special', bgColor: '#e8eaf6', textColor: '#283593', icon: 'tabler-book', headline: 'Discounts, Delights, and Books' },
    { name: 'Black Friday sale', bgColor: '#e0f2f1', textColor: '#004d40', icon: 'tabler-vinyl', headline: 'SPIN THE BLACK FRIDAY SALE' },
    { name: 'Special Black Friday offer', bgColor: '#fce4ec', textColor: '#880e4f', icon: 'tabler-palette', headline: 'Special Black Friday offer for Creative' },
    { name: 'Black Friday is around the corner', bgColor: '#263238', textColor: '#fff', icon: 'tabler-calendar', headline: 'Black Friday is just around the corner' },
    { name: 'Crack the code', bgColor: '#6a1b9a', textColor: '#fff', icon: 'tabler-code', headline: 'CRACK THE CODE - 30% OFF' },
    { name: 'Glow with Exclusive offers', bgColor: '#1b5e20', textColor: '#fff', icon: 'tabler-sparkles', headline: 'Glow with Exclusive Skincare Offers' },
    { name: 'Flash Friday deals', bgColor: '#ff6f00', textColor: '#fff', icon: 'tabler-bolt', headline: 'Flash Friday Deals - Up to 70% Off' },
    { name: 'Midnight Black Friday', bgColor: '#0d0d0d', textColor: '#ffd700', icon: 'tabler-moon', headline: 'Midnight Black Friday Special' }
  ],
  'Blog and updates': [
    { name: 'Weekly digest', bgColor: '#e3f2fd', textColor: '#1565c0', icon: 'tabler-news', headline: 'Your Weekly Digest' },
    { name: 'New blog post', bgColor: '#f3e5f5', textColor: '#7b1fa2', icon: 'tabler-article', headline: 'New Post Published' },
    { name: 'Monthly roundup', bgColor: '#e8f5e9', textColor: '#2e7d32', icon: 'tabler-calendar-stats', headline: 'Monthly Roundup' },
    { name: 'Product update', bgColor: '#fff8e1', textColor: '#f57f17', icon: 'tabler-rocket', headline: 'Product Update' },
    { name: 'Company news', bgColor: '#e0f7fa', textColor: '#00838f', icon: 'tabler-building', headline: 'Company News' },
    { name: 'Feature announcement', bgColor: '#fce4ec', textColor: '#c62828', icon: 'tabler-speakerphone', headline: 'New Feature Alert' },
    { name: 'Changelog', bgColor: '#e8eaf6', textColor: '#283593', icon: 'tabler-list-check', headline: 'Changelog Update' },
    { name: 'Industry insights', bgColor: '#efebe9', textColor: '#4e342e', icon: 'tabler-chart-line', headline: 'Industry Insights' },
    { name: 'Tips and tricks', bgColor: '#f1f8e9', textColor: '#33691e', icon: 'tabler-bulb', headline: 'Tips & Tricks' },
    { name: 'Behind the scenes', bgColor: '#fafafa', textColor: '#424242', icon: 'tabler-camera', headline: 'Behind the Scenes' },
    { name: 'Tutorial email', bgColor: '#e0f2f1', textColor: '#004d40', icon: 'tabler-school', headline: 'Step-by-Step Tutorial' },
    { name: 'Case study', bgColor: '#fff3e0', textColor: '#e65100', icon: 'tabler-file-analytics', headline: 'Case Study Spotlight' }
  ],
  'Business': [
    { name: 'Professional newsletter', bgColor: '#263238', textColor: '#eceff1', icon: 'tabler-briefcase', headline: 'Professional Newsletter' },
    { name: 'Corporate update', bgColor: '#1a237e', textColor: '#fff', icon: 'tabler-building', headline: 'Corporate Update' },
    { name: 'Meeting invitation', bgColor: '#e8eaf6', textColor: '#283593', icon: 'tabler-calendar-event', headline: 'Meeting Invitation' },
    { name: 'Quarterly report', bgColor: '#efebe9', textColor: '#3e2723', icon: 'tabler-report', headline: 'Quarterly Report' },
    { name: 'Partnership announcement', bgColor: '#e3f2fd', textColor: '#0d47a1', icon: 'tabler-handshake', headline: 'New Partnership' }
  ],
  'Deals and offers': [
    { name: 'Flash sale', bgColor: '#f44336', textColor: '#fff', icon: 'tabler-bolt', headline: 'Flash Sale - Limited Time!' },
    { name: 'Discount code', bgColor: '#ff9800', textColor: '#fff', icon: 'tabler-ticket', headline: 'Your Exclusive Discount Code' },
    { name: 'Bundle deal', bgColor: '#4caf50', textColor: '#fff', icon: 'tabler-package', headline: 'Bundle Deal - Save More' },
    { name: 'Clearance sale', bgColor: '#9c27b0', textColor: '#fff', icon: 'tabler-tag', headline: 'Clearance Sale' },
    { name: 'Buy one get one', bgColor: '#2196f3', textColor: '#fff', icon: 'tabler-gift', headline: 'Buy One Get One Free' },
    { name: 'Seasonal offer', bgColor: '#ff5722', textColor: '#fff', icon: 'tabler-sun', headline: 'Seasonal Special Offer' },
    { name: 'Early bird discount', bgColor: '#607d8b', textColor: '#fff', icon: 'tabler-alarm', headline: 'Early Bird Discount' },
    { name: 'Loyalty reward', bgColor: '#795548', textColor: '#fff', icon: 'tabler-award', headline: 'Loyalty Reward' },
    { name: 'Weekend special', bgColor: '#e91e63', textColor: '#fff', icon: 'tabler-calendar', headline: 'Weekend Special' },
    { name: 'Free shipping', bgColor: '#00bcd4', textColor: '#fff', icon: 'tabler-truck', headline: 'Free Shipping on All Orders' },
    { name: 'Member exclusive', bgColor: '#3f51b5', textColor: '#fff', icon: 'tabler-crown', headline: 'Members Only Deal' },
    { name: 'Last chance offer', bgColor: '#f44336', textColor: '#fff', icon: 'tabler-hourglass', headline: 'Last Chance!' },
    { name: 'VIP access sale', bgColor: '#212121', textColor: '#ffd700', icon: 'tabler-diamond', headline: 'VIP Access Sale' },
    { name: 'Referral bonus', bgColor: '#009688', textColor: '#fff', icon: 'tabler-users', headline: 'Refer a Friend & Save' },
    { name: 'Anniversary sale', bgColor: '#673ab7', textColor: '#fff', icon: 'tabler-confetti', headline: 'Anniversary Sale' },
    { name: 'Student discount', bgColor: '#03a9f4', textColor: '#fff', icon: 'tabler-school', headline: 'Student Discount' },
    { name: 'New customer welcome', bgColor: '#8bc34a', textColor: '#fff', icon: 'tabler-heart', headline: 'Welcome! Here is Your Offer' },
    { name: 'Double points day', bgColor: '#ff6f00', textColor: '#fff', icon: 'tabler-stars', headline: 'Double Points Day!' },
    { name: 'Secret sale', bgColor: '#37474f', textColor: '#fff', icon: 'tabler-lock-open', headline: 'Secret Sale Unlocked' },
    { name: 'Price drop alert', bgColor: '#d32f2f', textColor: '#fff', icon: 'tabler-trending-down', headline: 'Price Drop Alert!' },
    { name: 'Combo offer', bgColor: '#1976d2', textColor: '#fff', icon: 'tabler-stack', headline: 'Combo Offer - Save Big' },
    { name: 'Daily deal', bgColor: '#388e3c', textColor: '#fff', icon: 'tabler-clock', headline: 'Today\'s Daily Deal' },
    { name: 'Mega sale', bgColor: '#c62828', textColor: '#fff', icon: 'tabler-flame', headline: 'MEGA SALE' },
    { name: 'Gift card promo', bgColor: '#f06292', textColor: '#fff', icon: 'tabler-gift', headline: 'Gift Card Promotion' },
    { name: 'Holiday countdown', bgColor: '#1b5e20', textColor: '#fff', icon: 'tabler-christmas-tree', headline: 'Holiday Countdown Deals' },
    { name: 'Exclusive preview', bgColor: '#4a148c', textColor: '#fff', icon: 'tabler-eye', headline: 'Exclusive Preview Access' }
  ],
  'E-commerce': [
    { name: 'Order confirmation', bgColor: '#e8f5e9', textColor: '#2e7d32', icon: 'tabler-circle-check', headline: 'Order Confirmed!' },
    { name: 'Shipping notification', bgColor: '#e3f2fd', textColor: '#1565c0', icon: 'tabler-truck', headline: 'Your Order is on Its Way' },
    { name: 'Abandoned cart', bgColor: '#fff3e0', textColor: '#e65100', icon: 'tabler-shopping-cart', headline: 'You Left Something Behind' },
    { name: 'Product launch', bgColor: '#f3e5f5', textColor: '#7b1fa2', icon: 'tabler-rocket', headline: 'New Product Launch' },
    { name: 'Review request', bgColor: '#fafafa', textColor: '#424242', icon: 'tabler-star', headline: 'How Was Your Experience?' },
    { name: 'Back in stock', bgColor: '#e0f2f1', textColor: '#00695c', icon: 'tabler-bell', headline: 'Back in Stock!' },
    { name: 'Wishlist reminder', bgColor: '#fce4ec', textColor: '#c62828', icon: 'tabler-heart', headline: 'Items in Your Wishlist' },
    { name: 'Cross-sell', bgColor: '#e8eaf6', textColor: '#283593', icon: 'tabler-arrows-cross', headline: 'You Might Also Like' },
    { name: 'New arrivals', bgColor: '#212121', textColor: '#fff', icon: 'tabler-sparkles', headline: 'New Arrivals Just In' },
    { name: 'Seasonal collection', bgColor: '#efebe9', textColor: '#4e342e', icon: 'tabler-leaf', headline: 'Seasonal Collection' },
    { name: 'Reorder reminder', bgColor: '#e0f7fa', textColor: '#00838f', icon: 'tabler-refresh', headline: 'Time to Reorder?' },
    { name: 'Product comparison', bgColor: '#f1f8e9', textColor: '#33691e', icon: 'tabler-arrows-diff', headline: 'Compare Products' },
    { name: 'Gift guide', bgColor: '#fce4ec', textColor: '#880e4f', icon: 'tabler-gift', headline: 'Gift Guide for Every Occasion' },
    { name: 'Price alert', bgColor: '#fff8e1', textColor: '#f57f17', icon: 'tabler-bell-ringing', headline: 'Price Drop on Your Favorites' },
    { name: 'Delivery update', bgColor: '#e3f2fd', textColor: '#1565c0', icon: 'tabler-map-pin', headline: 'Delivery Update' },
    { name: 'Return confirmation', bgColor: '#efebe9', textColor: '#3e2723', icon: 'tabler-receipt-refund', headline: 'Return Processed' },
    { name: 'Loyalty program', bgColor: '#4a148c', textColor: '#fff', icon: 'tabler-crown', headline: 'Join Our Loyalty Program' },
    { name: 'Flash deal', bgColor: '#f44336', textColor: '#fff', icon: 'tabler-bolt', headline: 'Flash Deal - 24 Hours Only' },
    { name: 'Category spotlight', bgColor: '#263238', textColor: '#eceff1', icon: 'tabler-category', headline: 'Category Spotlight' },
    { name: 'Size guide', bgColor: '#e8eaf6', textColor: '#283593', icon: 'tabler-ruler', headline: 'Find Your Perfect Size' },
    { name: 'Payment confirmation', bgColor: '#e8f5e9', textColor: '#1b5e20', icon: 'tabler-credit-card', headline: 'Payment Received' },
    { name: 'Subscription box', bgColor: '#f3e5f5', textColor: '#6a1b9a', icon: 'tabler-box', headline: 'Your Monthly Box is Ready' },
    { name: 'Pre-order available', bgColor: '#fff3e0', textColor: '#bf360c', icon: 'tabler-clock', headline: 'Pre-Order Now Available' },
    { name: 'Best sellers', bgColor: '#ffd600', textColor: '#212121', icon: 'tabler-trophy', headline: 'Our Best Sellers' }
  ],
  'Events': [
    { name: 'Event invitation', bgColor: '#7b1fa2', textColor: '#fff', icon: 'tabler-calendar-event', headline: 'You are Invited!' },
    { name: 'Webinar registration', bgColor: '#1565c0', textColor: '#fff', icon: 'tabler-device-laptop', headline: 'Register for Our Webinar' },
    { name: 'Conference reminder', bgColor: '#00695c', textColor: '#fff', icon: 'tabler-microphone', headline: 'Conference Reminder' },
    { name: 'Workshop signup', bgColor: '#e65100', textColor: '#fff', icon: 'tabler-tools', headline: 'Workshop Signup' },
    { name: 'Event recap', bgColor: '#e8eaf6', textColor: '#283593', icon: 'tabler-photo', headline: 'Event Recap' },
    { name: 'Save the date', bgColor: '#fce4ec', textColor: '#c62828', icon: 'tabler-calendar-heart', headline: 'Save the Date!' },
    { name: 'RSVP reminder', bgColor: '#fff8e1', textColor: '#f57f17', icon: 'tabler-mail-forward', headline: 'RSVP Reminder' }
  ],
  'Featured': [
    { name: 'Minimalist newsletter', bgColor: '#fafafa', textColor: '#212121', icon: 'tabler-layout', headline: 'Clean & Minimal' },
    { name: 'Bold announcement', bgColor: '#f44336', textColor: '#fff', icon: 'tabler-speakerphone', headline: 'Bold Announcement' },
    { name: 'Modern portfolio', bgColor: '#263238', textColor: '#eceff1', icon: 'tabler-photo', headline: 'Modern Portfolio' },
    { name: 'Gradient header', bgColor: '#4a148c', textColor: '#fff', icon: 'tabler-palette', headline: 'Gradient Style' },
    { name: 'Photo-centric', bgColor: '#1a237e', textColor: '#fff', icon: 'tabler-camera', headline: 'Photo-Centric Design' },
    { name: 'Card layout', bgColor: '#e0f2f1', textColor: '#004d40', icon: 'tabler-layout-cards', headline: 'Card Layout' },
    { name: 'Split screen', bgColor: '#fff3e0', textColor: '#e65100', icon: 'tabler-columns', headline: 'Split Screen Design' },
    { name: 'Dark mode', bgColor: '#121212', textColor: '#bb86fc', icon: 'tabler-moon', headline: 'Dark Mode Template' },
    { name: 'Neon accent', bgColor: '#0d0d0d', textColor: '#00ff88', icon: 'tabler-bolt', headline: 'Neon Accent Style' }
  ],
  'Health and wellness': [
    { name: 'Wellness newsletter', bgColor: '#e8f5e9', textColor: '#2e7d32', icon: 'tabler-leaf', headline: 'Wellness Newsletter' },
    { name: 'Fitness update', bgColor: '#e3f2fd', textColor: '#1565c0', icon: 'tabler-run', headline: 'Fitness Update' },
    { name: 'Nutrition tips', bgColor: '#fff8e1', textColor: '#f57f17', icon: 'tabler-apple', headline: 'Nutrition Tips' },
    { name: 'Meditation reminder', bgColor: '#f3e5f5', textColor: '#7b1fa2', icon: 'tabler-yin-yang', headline: 'Meditation Reminder' },
    { name: 'Health check', bgColor: '#e0f7fa', textColor: '#00838f', icon: 'tabler-heartbeat', headline: 'Health Check Reminder' },
    { name: 'Yoga class', bgColor: '#fce4ec', textColor: '#880e4f', icon: 'tabler-yoga', headline: 'Yoga Class Schedule' },
    { name: 'Mental health', bgColor: '#e8eaf6', textColor: '#283593', icon: 'tabler-brain', headline: 'Mental Health Resources' },
    { name: 'Sleep tips', bgColor: '#1a237e', textColor: '#90caf9', icon: 'tabler-moon-stars', headline: 'Better Sleep Tips' },
    { name: 'Spa promotion', bgColor: '#efebe9', textColor: '#4e342e', icon: 'tabler-plant-2', headline: 'Spa Day Promotion' }
  ],
  'Holiday': [
    { name: 'Christmas greetings', bgColor: '#c62828', textColor: '#fff', icon: 'tabler-christmas-tree', headline: 'Merry Christmas!' },
    { name: 'New Year celebration', bgColor: '#1a237e', textColor: '#ffd700', icon: 'tabler-confetti', headline: 'Happy New Year!' },
    { name: 'Valentine\'s Day', bgColor: '#e91e63', textColor: '#fff', icon: 'tabler-heart', headline: 'Happy Valentine\'s Day' },
    { name: 'Easter special', bgColor: '#fff9c4', textColor: '#f57f17', icon: 'tabler-egg', headline: 'Easter Special' },
    { name: 'Mother\'s Day', bgColor: '#f8bbd0', textColor: '#880e4f', icon: 'tabler-flower', headline: 'Happy Mother\'s Day' },
    { name: 'Father\'s Day', bgColor: '#e3f2fd', textColor: '#1565c0', icon: 'tabler-tie', headline: 'Happy Father\'s Day' },
    { name: 'Halloween', bgColor: '#ff6f00', textColor: '#212121', icon: 'tabler-pumpkin-scary', headline: 'Happy Halloween!' },
    { name: 'Thanksgiving', bgColor: '#795548', textColor: '#fff', icon: 'tabler-leaf', headline: 'Happy Thanksgiving' },
    { name: 'Independence Day', bgColor: '#1565c0', textColor: '#fff', icon: 'tabler-flag', headline: 'Happy 4th of July!' },
    { name: 'Diwali greetings', bgColor: '#ff8f00', textColor: '#fff', icon: 'tabler-flame', headline: 'Happy Diwali!' },
    { name: 'Hanukkah', bgColor: '#1976d2', textColor: '#fff', icon: 'tabler-candle', headline: 'Happy Hanukkah' },
    { name: 'Lunar New Year', bgColor: '#d32f2f', textColor: '#ffd700', icon: 'tabler-moon', headline: 'Lunar New Year' },
    { name: 'Spring festival', bgColor: '#66bb6a', textColor: '#fff', icon: 'tabler-flower', headline: 'Spring Festival' },
    { name: 'Summer sale', bgColor: '#ff7043', textColor: '#fff', icon: 'tabler-sun', headline: 'Summer Sale!' },
    { name: 'Back to school', bgColor: '#5c6bc0', textColor: '#fff', icon: 'tabler-backpack', headline: 'Back to School' },
    { name: 'Winter holidays', bgColor: '#0d47a1', textColor: '#e3f2fd', icon: 'tabler-snowflake', headline: 'Winter Holidays' },
    { name: 'Cyber Monday', bgColor: '#212121', textColor: '#00e676', icon: 'tabler-device-desktop', headline: 'Cyber Monday Deals' },
    { name: 'Year end review', bgColor: '#37474f', textColor: '#eceff1', icon: 'tabler-chart-bar', headline: 'Year in Review' }
  ],
  'Nonprofit': [
    { name: 'Donation appeal', bgColor: '#2e7d32', textColor: '#fff', icon: 'tabler-heart-handshake', headline: 'Make a Difference Today' },
    { name: 'Volunteer signup', bgColor: '#1565c0', textColor: '#fff', icon: 'tabler-users', headline: 'Volunteer With Us' },
    { name: 'Impact report', bgColor: '#e8f5e9', textColor: '#1b5e20', icon: 'tabler-chart-bar', headline: 'Our Impact Report' },
    { name: 'Fundraiser event', bgColor: '#7b1fa2', textColor: '#fff', icon: 'tabler-coin', headline: 'Join Our Fundraiser' },
    { name: 'Thank you donor', bgColor: '#fff8e1', textColor: '#f57f17', icon: 'tabler-trophy', headline: 'Thank You for Your Support' },
    { name: 'Campaign update', bgColor: '#e3f2fd', textColor: '#0d47a1', icon: 'tabler-progress', headline: 'Campaign Progress Update' }
  ],
  'Notifications': [
    { name: 'Password reset', bgColor: '#e8eaf6', textColor: '#283593', icon: 'tabler-lock', headline: 'Reset Your Password' },
    { name: 'Account verification', bgColor: '#e8f5e9', textColor: '#2e7d32', icon: 'tabler-shield-check', headline: 'Verify Your Account' },
    { name: 'Payment receipt', bgColor: '#fff3e0', textColor: '#e65100', icon: 'tabler-receipt', headline: 'Payment Receipt' },
    { name: 'Security alert', bgColor: '#ffebee', textColor: '#c62828', icon: 'tabler-alert-triangle', headline: 'Security Alert' },
    { name: 'Account update', bgColor: '#e0f7fa', textColor: '#00838f', icon: 'tabler-user-check', headline: 'Account Updated' },
    { name: 'Subscription renewal', bgColor: '#f3e5f5', textColor: '#7b1fa2', icon: 'tabler-refresh', headline: 'Subscription Renewal' }
  ],
  'Products': [
    { name: 'Product showcase', bgColor: '#212121', textColor: '#fff', icon: 'tabler-diamond', headline: 'Product Showcase' },
    { name: 'Feature highlight', bgColor: '#1565c0', textColor: '#fff', icon: 'tabler-highlight', headline: 'Feature Highlight' },
    { name: 'Product comparison', bgColor: '#e8eaf6', textColor: '#283593', icon: 'tabler-arrows-diff', headline: 'Compare Our Products' }
  ],
  'Survey and quizzes': [
    { name: 'Customer survey', bgColor: '#e3f2fd', textColor: '#1565c0', icon: 'tabler-clipboard-list', headline: 'We Value Your Feedback' },
    { name: 'NPS survey', bgColor: '#e8f5e9', textColor: '#2e7d32', icon: 'tabler-chart-dots', headline: 'How Likely Would You Recommend?' },
    { name: 'Product feedback', bgColor: '#fff8e1', textColor: '#f57f17', icon: 'tabler-message-dots', headline: 'Product Feedback' },
    { name: 'Quiz invitation', bgColor: '#f3e5f5', textColor: '#7b1fa2', icon: 'tabler-brain', headline: 'Take Our Quiz!' },
    { name: 'Post-purchase review', bgColor: '#fce4ec', textColor: '#c62828', icon: 'tabler-star', headline: 'Rate Your Purchase' },
    { name: 'Event feedback', bgColor: '#e0f7fa', textColor: '#00838f', icon: 'tabler-thumb-up', headline: 'Event Feedback' },
    { name: 'Annual survey', bgColor: '#efebe9', textColor: '#4e342e', icon: 'tabler-file-analytics', headline: 'Annual Customer Survey' }
  ]
}

// Predefined gallery categories
const galleryCategories = Object.keys(galleryTemplatesMap).map(name => ({
  name,
  count: galleryTemplatesMap[name].length,
  icon: {
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
  }[name] || 'tabler-template'
}))

const totalGalleryTemplates = galleryCategories.reduce((sum, c) => sum + c.count, 0)

// Get all gallery templates flat
const allGalleryTemplates = Object.values(galleryTemplatesMap).flat()

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
  const [premiumDialog, setPremiumDialog] = useState(false)
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
    router.push(`/${locale}/campaigns/create?type=${campaignType}&template=${templateId}`)
  }

  const handleUseRecentCampaign = (campaign: any) => {
    router.push(`/${locale}/campaigns/create?type=${campaignType}&template=scratch&from_campaign=${campaign.id}`)
  }

  const filteredTemplates = templates.filter(t =>
    searchQuery ? t.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  )

  // Get gallery templates for selected category
  const getDisplayedGalleryTemplates = () => {
    if (selectedCategory === 'all') return allGalleryTemplates

    return galleryTemplatesMap[selectedCategory] || []
  }

  const filteredGalleryTemplates = getDisplayedGalleryTemplates().filter(t =>
    searchQuery ? t.name.toLowerCase().includes(searchQuery.toLowerCase()) : true
  )

  // Gallery template card component
  const GalleryTemplateCard = ({ gt }: { gt: GalleryTemplate }) => (
    <Card
      sx={{
        cursor: 'pointer',
        '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' },
        transition: 'all 0.2s'
      }}
      onClick={() => setPremiumDialog(true)}
    >
      <Box
        sx={{
          height: 200,
          bgcolor: gt.bgColor,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 2,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Decorative background circles */}
        <Box
          sx={{
            position: 'absolute',
            top: -20,
            right: -20,
            width: 80,
            height: 80,
            borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.08)'
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -30,
            left: -30,
            width: 100,
            height: 100,
            borderRadius: '50%',
            bgcolor: 'rgba(255,255,255,0.05)'
          }}
        />
        <i
          className={`${gt.icon} text-[32px]`}
          style={{ color: gt.textColor, marginBottom: 12, opacity: 0.9 }}
        />
        <Typography
          variant='subtitle2'
          sx={{
            color: gt.textColor,
            textAlign: 'center',
            fontWeight: 700,
            lineHeight: 1.3,
            fontSize: '0.85rem',
            px: 1
          }}
        >
          {gt.headline}
        </Typography>
        {/* Premium badge */}
        <Chip
          label='Premium'
          size='small'
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            bgcolor: 'rgba(255,255,255,0.9)',
            color: '#e65100',
            fontWeight: 600,
            fontSize: '0.65rem',
            height: 20
          }}
        />
      </Box>
      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
        <Typography variant='body2' fontWeight={500} noWrap>
          {gt.name}
        </Typography>
      </CardContent>
    </Card>
  )

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
                <Chip label={templates.length} size='small' color='primary' sx={{ height: 22, fontSize: '0.75rem' }} />
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
            {/* Premium Banner */}
            {selectedCategory !== 'my' && (
              <Alert
                severity='info'
                icon={<i className='tabler-star text-[20px]' />}
                action={
                  <Button color='inherit' size='small' variant='outlined'>
                    Upgrade
                  </Button>
                }
                sx={{ mb: 3 }}
              >
                Template gallery is a premium feature. Upgrade to a paid plan for instant access to premium tools.
              </Alert>
            )}

            {/* Template Count */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Typography variant='body2' color='text.secondary'>
                {selectedCategory === 'my'
                  ? `${filteredTemplates.length} templates listed`
                  : selectedCategory === 'all'
                    ? `${allGalleryTemplates.length} templates listed`
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
                  filteredTemplates.map(template => (
                    <Card
                      key={`user-${template.id}`}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { boxShadow: 6, transform: 'translateY(-2px)' },
                        transition: 'all 0.2s'
                      }}
                      onClick={() => handleSelectTemplate(template.id)}
                    >
                      <Box
                        sx={{
                          height: 200,
                          bgcolor: 'action.hover',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          position: 'relative'
                        }}
                      >
                        {template.body ? (
                          <iframe
                            srcDoc={template.body.substring(0, 2000)}
                            sandbox=''
                            style={{
                              width: '250%',
                              height: '250%',
                              transform: 'scale(0.4)',
                              transformOrigin: 'top left',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              pointerEvents: 'none',
                              border: 'none'
                            }}
                            title={`Preview of ${template.name}`}
                          />
                        ) : (
                          <i className='tabler-mail text-[40px]' style={{ color: 'var(--mui-palette-text-disabled)' }} />
                        )}
                      </Box>
                      <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                        <Typography variant='body2' fontWeight={500} noWrap>
                          {template.name}
                        </Typography>
                      </CardContent>
                    </Card>
                  ))}

                {/* Gallery Templates (show in category or 'all') */}
                {selectedCategory !== 'my' &&
                  filteredGalleryTemplates.map((gt, idx) => (
                    <GalleryTemplateCard key={`gallery-${idx}`} gt={gt} />
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

      {/* Premium Dialog */}
      <Dialog open={premiumDialog} onClose={() => setPremiumDialog(false)} maxWidth='xs' fullWidth fullScreen={isMobile}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <i className='tabler-crown text-[24px]' style={{ color: '#ff9800' }} />
          Premium Template
        </DialogTitle>
        <DialogContent>
          <Typography>
            This template is part of the premium collection. Upgrade your plan to unlock all professionally designed templates.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPremiumDialog(false)} color='secondary'>
            Cancel
          </Button>
          <Button variant='contained' color='warning' startIcon={<i className='tabler-star' />}>
            Upgrade Plan
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  )
}

export default TemplateGallery
