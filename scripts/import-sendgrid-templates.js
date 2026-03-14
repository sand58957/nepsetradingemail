#!/usr/bin/env node
/**
 * Import professional email templates into Listmonk.
 * Creates ~60 templates across 25 categories matching SendGrid's design library.
 *
 * Usage:
 *   node scripts/import-sendgrid-templates.js
 *
 * Environment:
 *   LISTMONK_URL  – default http://localhost:9000
 *   LISTMONK_USER – default admin
 *   LISTMONK_PASS – default admin
 *
 * Each template is created with subject "[Category] Template Name"
 * so the TemplateGallery frontend can parse categories automatically.
 */

const http = require('http');
const https = require('https');

// Mode: 'backend' uses JWT auth via the Go backend API, 'listmonk' uses basic auth directly
const MODE = process.env.IMPORT_MODE || 'backend';
const BACKEND_URL = process.env.BACKEND_URL || 'https://nepalfillings.com';
const BACKEND_EMAIL = process.env.BACKEND_EMAIL || '008snk@gmail.com';
const BACKEND_PASSWORD = process.env.BACKEND_PASSWORD || 'admin123';
const LISTMONK_URL = process.env.LISTMONK_URL || 'http://localhost:9000';
const LISTMONK_USER = process.env.LISTMONK_USER || 'api_backend';
const LISTMONK_PASS = process.env.LISTMONK_PASS || 'BackendAPIToken2026';

let JWT_TOKEN = '';

// ─── Color Palettes per category ──────────────────────────────
const palettes = {
  Hospitality:     { primary: '#c9a96e', secondary: '#1a1a2e', accent: '#d4a853', bg: '#faf8f5' },
  Newsletter:      { primary: '#2563eb', secondary: '#1e293b', accent: '#3b82f6', bg: '#f8fafc' },
  Restaurant:      { primary: '#dc2626', secondary: '#1c1917', accent: '#ef4444', bg: '#fef2f2' },
  Seasonal:        { primary: '#059669', secondary: '#064e3b', accent: '#10b981', bg: '#ecfdf5' },
  'Non-Profit':    { primary: '#7c3aed', secondary: '#1e1b4b', accent: '#8b5cf6', bg: '#f5f3ff' },
  Announcements:   { primary: '#0891b2', secondary: '#164e63', accent: '#06b6d4', bg: '#ecfeff' },
  'Small Business':{ primary: '#ea580c', secondary: '#431407', accent: '#f97316', bg: '#fff7ed' },
  Promotional:     { primary: '#dc2626', secondary: '#1c1917', accent: '#ef4444', bg: '#fef2f2' },
  Travel:          { primary: '#0284c7', secondary: '#0c4a6e', accent: '#0ea5e9', bg: '#f0f9ff' },
  'Black Friday':  { primary: '#000000', secondary: '#18181b', accent: '#fbbf24', bg: '#18181b' },
  Discount:        { primary: '#e11d48', secondary: '#881337', accent: '#fb7185', bg: '#fff1f2' },
  Sale:            { primary: '#dc2626', secondary: '#991b1b', accent: '#f87171', bg: '#fef2f2' },
  Welcome:         { primary: '#2563eb', secondary: '#1e3a5f', accent: '#60a5fa', bg: '#eff6ff' },
  Loyalty:         { primary: '#7c3aed', secondary: '#4c1d95', accent: '#a78bfa', bg: '#f5f3ff' },
  Retail:          { primary: '#0891b2', secondary: '#155e75', accent: '#22d3ee', bg: '#ecfeff' },
  Fitness:         { primary: '#16a34a', secondary: '#14532d', accent: '#4ade80', bg: '#f0fdf4' },
  Confirmation:    { primary: '#2563eb', secondary: '#1e3a5f', accent: '#60a5fa', bg: '#eff6ff' },
  'Purchase Receipt':{ primary: '#059669', secondary: '#064e3b', accent: '#34d399', bg: '#ecfdf5' },
  Events:          { primary: '#9333ea', secondary: '#581c87', accent: '#c084fc', bg: '#faf5ff' },
  Recruiting:      { primary: '#0284c7', secondary: '#0c4a6e', accent: '#38bdf8', bg: '#f0f9ff' },
  Financial:       { primary: '#1d4ed8', secondary: '#1e3a5f', accent: '#3b82f6', bg: '#eff6ff' },
  Holiday:         { primary: '#dc2626', secondary: '#14532d', accent: '#22c55e', bg: '#fef2f2' },
  'Password Reset':{ primary: '#6366f1', secondary: '#312e81', accent: '#818cf8', bg: '#eef2ff' },
  'Abandoned Cart':{ primary: '#ea580c', secondary: '#431407', accent: '#fb923c', bg: '#fff7ed' },
  Contest:         { primary: '#d946ef', secondary: '#701a75', accent: '#e879f9', bg: '#fdf4ff' },
};

// ─── Template definitions (category → array of templates) ─────
const templateDefs = {
  Hospitality: [
    { name: 'Modern Restaurant Newsletter', desc: 'Elegant restaurant promotion with menu highlights', layout: 'hero-content' },
    { name: 'Hospitality Hotel Newsletter', desc: 'Hotel updates and seasonal offerings', layout: 'hero-cards' },
    { name: 'Hotel Welcome Email', desc: 'Welcome guests with luxury stay details', layout: 'hero-content' },
    { name: 'Hotel Member Loyalty Program', desc: 'Loyalty rewards and member benefits', layout: 'feature-grid' },
  ],
  Newsletter: [
    { name: 'Basic Newsletter', desc: 'Clean and simple newsletter layout', layout: 'hero-content' },
    { name: 'Weekly Digest', desc: 'Curated weekly content roundup', layout: 'article-list' },
    { name: 'Company Update', desc: 'Share company news and milestones', layout: 'hero-content' },
    { name: 'Tech Newsletter', desc: 'Technology news and product updates', layout: 'article-list' },
    { name: 'Industry Insights', desc: 'Expert analysis and market trends', layout: 'hero-cards' },
    { name: 'Monthly Roundup', desc: 'Monthly highlights and top stories', layout: 'article-list' },
    { name: 'Editorial Newsletter', desc: 'Long-form editorial content', layout: 'hero-content' },
    { name: 'Curated Links', desc: 'Handpicked links and resources', layout: 'article-list' },
    { name: 'Product Newsletter', desc: 'Product updates and feature announcements', layout: 'feature-grid' },
    { name: 'Creative Newsletter', desc: 'Design-forward content showcase', layout: 'hero-cards' },
    { name: 'Startup Newsletter', desc: 'Startup news and funding updates', layout: 'article-list' },
    { name: 'Health Newsletter', desc: 'Wellness tips and health news', layout: 'hero-content' },
    { name: 'Education Newsletter', desc: 'Learning resources and course updates', layout: 'article-list' },
    { name: 'Community Newsletter', desc: 'Community events and member spotlights', layout: 'hero-cards' },
  ],
  Restaurant: [
    { name: 'Restaurant Grand Opening', desc: 'Announce your restaurant opening', layout: 'hero-content' },
  ],
  Seasonal: [
    { name: 'Spring Collection', desc: 'Spring arrivals and fresh picks', layout: 'hero-cards' },
    { name: 'Summer Sale', desc: 'Hot summer deals and discounts', layout: 'hero-content' },
    { name: 'Fall Harvest', desc: 'Autumn specials and seasonal offerings', layout: 'hero-cards' },
    { name: 'Winter Wonderland', desc: 'Winter collection and cozy picks', layout: 'hero-content' },
  ],
  'Non-Profit': [
    { name: 'Donation Appeal', desc: 'Fundraising campaign with impact stories', layout: 'hero-content' },
    { name: 'Volunteer Recruitment', desc: 'Call for volunteers and event helpers', layout: 'feature-grid' },
    { name: 'Impact Report', desc: 'Annual impact and transparency report', layout: 'article-list' },
  ],
  Announcements: [
    { name: 'Product Launch', desc: 'New product announcement with features', layout: 'hero-content' },
    { name: 'Company Milestone', desc: 'Celebrate achievements and growth', layout: 'hero-cards' },
  ],
  'Small Business': [
    { name: 'Local Business Intro', desc: 'Introduce your small business to the community', layout: 'hero-content' },
    { name: 'Service Offering', desc: 'Highlight your services and expertise', layout: 'feature-grid' },
    { name: 'Customer Appreciation', desc: 'Thank your loyal customers', layout: 'hero-content' },
    { name: 'Small Biz Newsletter', desc: 'Regular updates from your business', layout: 'article-list' },
    { name: 'Referral Program', desc: 'Encourage referrals with rewards', layout: 'hero-content' },
  ],
  Promotional: [
    { name: 'Flash Sale', desc: 'Limited time offer with countdown urgency', layout: 'hero-content' },
    { name: 'New Arrival', desc: 'Showcase new products and collections', layout: 'hero-cards' },
    { name: 'Bundle Deal', desc: 'Product bundle with savings highlight', layout: 'feature-grid' },
    { name: 'Clearance Sale', desc: 'End of season clearance event', layout: 'hero-content' },
    { name: 'VIP Exclusive', desc: 'Members-only exclusive deals', layout: 'hero-content' },
    { name: 'Free Shipping', desc: 'Free shipping promotion announcement', layout: 'hero-content' },
    { name: 'Gift Guide', desc: 'Curated gift ideas for every occasion', layout: 'hero-cards' },
    { name: 'Back in Stock', desc: 'Popular items back in stock alert', layout: 'hero-content' },
    { name: 'Pre-Order', desc: 'Pre-order announcement for upcoming items', layout: 'hero-content' },
    { name: 'Season Launch', desc: 'New season collection launch', layout: 'hero-cards' },
    { name: 'Member Discount', desc: 'Exclusive member discount offer', layout: 'hero-content' },
    { name: 'Weekend Special', desc: 'Weekend-only special offers', layout: 'hero-content' },
    { name: 'Reward Points', desc: 'Double points promotion', layout: 'feature-grid' },
    { name: 'Anniversary Sale', desc: 'Brand anniversary celebration sale', layout: 'hero-content' },
    { name: 'Early Access', desc: 'Early access to new collection', layout: 'hero-content' },
    { name: 'Best Sellers', desc: 'Showcase your top selling products', layout: 'hero-cards' },
  ],
  Travel: [
    { name: 'Travel Destination', desc: 'Featured destination with booking CTA', layout: 'hero-content' },
    { name: 'Flight Deals', desc: 'Discounted flight offers', layout: 'article-list' },
    { name: 'Hotel Package', desc: 'Hotel stay packages and bundles', layout: 'hero-cards' },
    { name: 'Travel Guide', desc: 'Destination travel guide and tips', layout: 'article-list' },
    { name: 'Booking Confirmation', desc: 'Travel booking confirmation details', layout: 'hero-content' },
  ],
  'Black Friday': [
    { name: 'Black Friday Mega Sale', desc: 'Massive Black Friday deals', layout: 'hero-content' },
    { name: 'Cyber Monday Deals', desc: 'Online exclusive Cyber Monday offers', layout: 'hero-cards' },
  ],
  Discount: [
    { name: 'Percentage Off', desc: 'Percentage discount promotion', layout: 'hero-content' },
    { name: 'Buy One Get One', desc: 'BOGO deal promotion', layout: 'hero-content' },
    { name: 'First Purchase', desc: 'New customer first purchase discount', layout: 'hero-content' },
    { name: 'Student Discount', desc: 'Special pricing for students', layout: 'hero-content' },
    { name: 'Bulk Discount', desc: 'Volume purchase savings', layout: 'feature-grid' },
  ],
  Sale: [
    { name: 'End of Season Sale', desc: 'Season clearance with deep discounts', layout: 'hero-content' },
    { name: 'Flash Sale 24hr', desc: '24-hour flash sale countdown', layout: 'hero-content' },
    { name: 'Warehouse Sale', desc: 'Warehouse clearance event', layout: 'hero-cards' },
    { name: 'Half Price Sale', desc: '50% off everything sale', layout: 'hero-content' },
    { name: 'Sample Sale', desc: 'Sample and outlet sale', layout: 'hero-cards' },
    { name: 'Midnight Sale', desc: 'Late night shopping deals', layout: 'hero-content' },
    { name: 'Super Sale', desc: 'The biggest sale of the year', layout: 'hero-content' },
  ],
  Welcome: [
    { name: 'Welcome New User', desc: 'Onboard new users with getting started guide', layout: 'hero-content' },
    { name: 'Welcome Series 1', desc: 'First email in welcome sequence', layout: 'hero-content' },
    { name: 'Welcome Series 2', desc: 'Second email with feature highlights', layout: 'feature-grid' },
    { name: 'Welcome Series 3', desc: 'Third email with social proof', layout: 'hero-cards' },
    { name: 'Welcome Subscriber', desc: 'Welcome new newsletter subscriber', layout: 'hero-content' },
    { name: 'Welcome Member', desc: 'Welcome to membership program', layout: 'hero-content' },
    { name: 'Welcome Back', desc: 'Re-engagement for returning users', layout: 'hero-content' },
    { name: 'Welcome Gift', desc: 'Welcome with exclusive discount gift', layout: 'hero-content' },
    { name: 'Onboarding Checklist', desc: 'Step-by-step onboarding guide', layout: 'feature-grid' },
  ],
  Loyalty: [
    { name: 'Loyalty Tier Upgrade', desc: 'Congratulate on loyalty tier upgrade', layout: 'hero-content' },
    { name: 'Points Statement', desc: 'Monthly loyalty points summary', layout: 'article-list' },
    { name: 'Exclusive Member Offer', desc: 'Special loyalty member deal', layout: 'hero-content' },
  ],
  Retail: [
    { name: 'Product Showcase', desc: 'Featured products grid layout', layout: 'hero-cards' },
    { name: 'New Collection', desc: 'New collection announcement', layout: 'hero-content' },
    { name: 'Fashion Lookbook', desc: 'Seasonal fashion lookbook', layout: 'hero-cards' },
    { name: 'Product Review', desc: 'Customer reviews and ratings', layout: 'article-list' },
    { name: 'Gift Card', desc: 'Gift card promotion', layout: 'hero-content' },
    { name: 'Size Guide', desc: 'Helpful size guide email', layout: 'feature-grid' },
    { name: 'Store Locator', desc: 'Find a store near you', layout: 'hero-content' },
    { name: 'Trending Now', desc: 'Trending products showcase', layout: 'hero-cards' },
    { name: 'Category Spotlight', desc: 'Spotlight on product category', layout: 'hero-cards' },
    { name: 'Customer Favorites', desc: 'Best-selling customer favorites', layout: 'hero-cards' },
    { name: 'Style Guide', desc: 'How to style featured items', layout: 'article-list' },
    { name: 'Limited Edition', desc: 'Limited edition product launch', layout: 'hero-content' },
    { name: 'Pre-Season Preview', desc: 'Preview upcoming collection', layout: 'hero-cards' },
    { name: 'Outlet Deals', desc: 'Outlet store discounts', layout: 'hero-cards' },
    { name: 'Accessories', desc: 'Accessories collection highlight', layout: 'hero-cards' },
    { name: 'Eco Collection', desc: 'Sustainable and eco-friendly picks', layout: 'hero-content' },
    { name: 'Bestsellers Recap', desc: 'Top selling items this month', layout: 'hero-cards' },
    { name: 'Wishlist Reminder', desc: 'Items in your wishlist on sale', layout: 'article-list' },
    { name: 'Brand Story', desc: 'Share your brand journey', layout: 'hero-content' },
  ],
  Fitness: [
    { name: 'Gym Membership', desc: 'Join the gym membership promotion', layout: 'hero-content' },
    { name: 'Workout Plan', desc: 'Weekly workout plan and tips', layout: 'feature-grid' },
    { name: 'Fitness Challenge', desc: '30-day fitness challenge invitation', layout: 'hero-content' },
  ],
  Confirmation: [
    { name: 'Order Confirmation', desc: 'Order placed confirmation with details', layout: 'hero-content' },
    { name: 'Shipping Confirmation', desc: 'Order shipped with tracking info', layout: 'hero-content' },
    { name: 'Appointment Confirmation', desc: 'Appointment booking confirmed', layout: 'hero-content' },
    { name: 'Registration Confirmation', desc: 'Account registration confirmed', layout: 'hero-content' },
    { name: 'Subscription Confirmation', desc: 'Subscription activated confirmation', layout: 'hero-content' },
    { name: 'Payment Confirmation', desc: 'Payment received confirmation', layout: 'hero-content' },
    { name: 'Cancellation Confirmation', desc: 'Cancellation processed confirmation', layout: 'hero-content' },
  ],
  'Purchase Receipt': [
    { name: 'Digital Receipt', desc: 'Clean digital purchase receipt', layout: 'article-list' },
  ],
  Events: [
    { name: 'Event Invitation', desc: 'Event invitation with RSVP', layout: 'hero-content' },
    { name: 'Webinar Registration', desc: 'Webinar sign-up promotion', layout: 'hero-content' },
    { name: 'Conference Agenda', desc: 'Conference schedule and speakers', layout: 'article-list' },
  ],
  Recruiting: [
    { name: 'Job Opening', desc: 'Open position announcement', layout: 'hero-content' },
  ],
  Financial: [
    { name: 'Account Statement', desc: 'Monthly account statement', layout: 'article-list' },
    { name: 'Investment Update', desc: 'Portfolio performance update', layout: 'hero-content' },
    { name: 'Financial Tips', desc: 'Personal finance tips newsletter', layout: 'article-list' },
  ],
  Holiday: [
    { name: 'Christmas Special', desc: 'Christmas holiday deals and greetings', layout: 'hero-content' },
    { name: 'New Year Wishes', desc: 'New Year celebration and offers', layout: 'hero-content' },
    { name: 'Valentines Day', desc: 'Valentine\'s Day gift guide', layout: 'hero-cards' },
    { name: 'Easter Sale', desc: 'Easter holiday specials', layout: 'hero-content' },
  ],
  'Password Reset': [
    { name: 'Password Reset', desc: 'Secure password reset email', layout: 'hero-content' },
  ],
  'Abandoned Cart': [
    { name: 'Cart Reminder', desc: 'Remind customers about abandoned items', layout: 'hero-cards' },
  ],
  Contest: [
    { name: 'Giveaway Contest', desc: 'Enter to win giveaway promotion', layout: 'hero-content' },
  ],
};

// ─── HTML Generators ──────────────────────────────────────────

function generateHeroContent(name, desc, p) {
  const isDark = name.includes('Black Friday') || name.includes('Cyber Monday');
  const textColor = isDark ? '#ffffff' : '#333333';
  const bgColor = isDark ? '#18181b' : '#ffffff';
  const heroBg = isDark ? '#000000' : p.primary;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name}</title>
</head>
<body style="margin:0;padding:0;background-color:${p.bg};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${p.bg};">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:${bgColor};border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<!-- Header -->
<tr>
<td style="background-color:${heroBg};padding:48px 40px;text-align:center;">
  <h1 style="margin:0 0 12px;font-size:28px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${name}</h1>
  <p style="margin:0 0 24px;font-size:16px;color:rgba(255,255,255,0.85);line-height:1.5;">${desc}</p>
  <a href="#" style="display:inline-block;padding:14px 36px;background-color:${isDark ? p.accent : '#ffffff'};color:${isDark ? '#000000' : heroBg};font-size:15px;font-weight:700;text-decoration:none;border-radius:6px;letter-spacing:0.3px;">Get Started</a>
</td>
</tr>

<!-- Content -->
<tr>
<td style="padding:40px;color:${textColor};">
  <h2 style="margin:0 0 16px;font-size:22px;color:${p.secondary};">What's Inside</h2>
  <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#555555;">We're excited to share this with you. This email contains carefully curated content designed to help you make the most of what we offer.</p>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr>
      <td style="padding:16px;background-color:${p.bg};border-radius:8px;border-left:4px solid ${p.primary};">
        <h3 style="margin:0 0 6px;font-size:16px;color:${p.secondary};">Highlight #1</h3>
        <p style="margin:0;font-size:14px;color:#666;line-height:1.5;">Discover our latest offerings and see what makes us stand out from the rest.</p>
      </td>
    </tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
    <tr>
      <td style="padding:16px;background-color:${p.bg};border-radius:8px;border-left:4px solid ${p.accent};">
        <h3 style="margin:0 0 6px;font-size:16px;color:${p.secondary};">Highlight #2</h3>
        <p style="margin:0;font-size:14px;color:#666;line-height:1.5;">Exclusive content and special offers available just for you.</p>
      </td>
    </tr>
  </table>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding-top:12px;">
      <a href="#" style="display:inline-block;padding:14px 40px;background-color:${p.primary};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:6px;">Learn More</a>
    </td></tr>
  </table>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">You're receiving this because you subscribed to our updates.</p>
  <p style="margin:0;font-size:12px;color:#9ca3af;"><a href="{{ UnsubscribeURL }}" style="color:${p.primary};">Unsubscribe</a> · <a href="{{ MessageURL }}" style="color:${p.primary};">View in Browser</a></p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function generateHeroCards(name, desc, p) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name}</title>
</head>
<body style="margin:0;padding:0;background-color:${p.bg};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${p.bg};">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg, ${p.primary}, ${p.secondary});padding:40px;text-align:center;">
  <h1 style="margin:0 0 10px;font-size:26px;font-weight:700;color:#ffffff;">${name}</h1>
  <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.85);">${desc}</p>
</td>
</tr>

<!-- Cards Grid -->
<tr>
<td style="padding:32px 28px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="48%" valign="top" style="padding-right:12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${p.bg};border-radius:8px;overflow:hidden;margin-bottom:20px;">
          <tr><td style="height:120px;background-color:${p.primary};text-align:center;vertical-align:middle;">
            <span style="font-size:40px;color:#ffffff;">★</span>
          </td></tr>
          <tr><td style="padding:16px;">
            <h3 style="margin:0 0 6px;font-size:15px;color:${p.secondary};">Featured Item</h3>
            <p style="margin:0 0 10px;font-size:13px;color:#666;line-height:1.4;">Discover something amazing and new today.</p>
            <a href="#" style="font-size:13px;color:${p.primary};font-weight:600;text-decoration:none;">Explore →</a>
          </td></tr>
        </table>
      </td>
      <td width="48%" valign="top" style="padding-left:12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${p.bg};border-radius:8px;overflow:hidden;margin-bottom:20px;">
          <tr><td style="height:120px;background-color:${p.accent};text-align:center;vertical-align:middle;">
            <span style="font-size:40px;color:#ffffff;">◆</span>
          </td></tr>
          <tr><td style="padding:16px;">
            <h3 style="margin:0 0 6px;font-size:15px;color:${p.secondary};">Top Pick</h3>
            <p style="margin:0 0 10px;font-size:13px;color:#666;line-height:1.4;">Our most popular choice this season.</p>
            <a href="#" style="font-size:13px;color:${p.primary};font-weight:600;text-decoration:none;">View →</a>
          </td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td width="48%" valign="top" style="padding-right:12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${p.bg};border-radius:8px;overflow:hidden;">
          <tr><td style="height:120px;background-color:${p.secondary};text-align:center;vertical-align:middle;">
            <span style="font-size:40px;color:#ffffff;">●</span>
          </td></tr>
          <tr><td style="padding:16px;">
            <h3 style="margin:0 0 6px;font-size:15px;color:${p.secondary};">New Arrival</h3>
            <p style="margin:0 0 10px;font-size:13px;color:#666;line-height:1.4;">Fresh additions you won't want to miss.</p>
            <a href="#" style="font-size:13px;color:${p.primary};font-weight:600;text-decoration:none;">Shop →</a>
          </td></tr>
        </table>
      </td>
      <td width="48%" valign="top" style="padding-left:12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${p.bg};border-radius:8px;overflow:hidden;">
          <tr><td style="height:120px;background-color:${p.primary};opacity:0.7;text-align:center;vertical-align:middle;">
            <span style="font-size:40px;color:#ffffff;">▲</span>
          </td></tr>
          <tr><td style="padding:16px;">
            <h3 style="margin:0 0 6px;font-size:15px;color:${p.secondary};">Trending</h3>
            <p style="margin:0 0 10px;font-size:13px;color:#666;line-height:1.4;">See what everyone is talking about.</p>
            <a href="#" style="font-size:13px;color:${p.primary};font-weight:600;text-decoration:none;">Discover →</a>
          </td></tr>
        </table>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- CTA -->
<tr>
<td style="padding:0 28px 32px;text-align:center;">
  <a href="#" style="display:inline-block;padding:14px 40px;background-color:${p.primary};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:6px;">View All</a>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">You're receiving this because you subscribed to our updates.</p>
  <p style="margin:0;font-size:12px;color:#9ca3af;"><a href="{{ UnsubscribeURL }}" style="color:${p.primary};">Unsubscribe</a> · <a href="{{ MessageURL }}" style="color:${p.primary};">View in Browser</a></p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function generateArticleList(name, desc, p) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name}</title>
</head>
<body style="margin:0;padding:0;background-color:${p.bg};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${p.bg};">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<!-- Header -->
<tr>
<td style="padding:32px 40px;border-bottom:3px solid ${p.primary};">
  <h1 style="margin:0 0 6px;font-size:24px;font-weight:700;color:${p.secondary};">${name}</h1>
  <p style="margin:0;font-size:14px;color:#6b7280;">${desc}</p>
</td>
</tr>

<!-- Article 1 -->
<tr>
<td style="padding:28px 40px;border-bottom:1px solid #f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="80" valign="top" style="padding-right:20px;">
        <div style="width:80px;height:80px;background-color:${p.primary};border-radius:8px;text-align:center;line-height:80px;">
          <span style="font-size:30px;color:#fff;">01</span>
        </div>
      </td>
      <td valign="top">
        <h3 style="margin:0 0 6px;font-size:17px;color:${p.secondary};">First Article Title</h3>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.5;">A compelling summary that draws readers in and makes them want to learn more about this topic.</p>
        <a href="#" style="font-size:13px;color:${p.primary};font-weight:600;text-decoration:none;">Read more →</a>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- Article 2 -->
<tr>
<td style="padding:28px 40px;border-bottom:1px solid #f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="80" valign="top" style="padding-right:20px;">
        <div style="width:80px;height:80px;background-color:${p.accent};border-radius:8px;text-align:center;line-height:80px;">
          <span style="font-size:30px;color:#fff;">02</span>
        </div>
      </td>
      <td valign="top">
        <h3 style="margin:0 0 6px;font-size:17px;color:${p.secondary};">Second Article Title</h3>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.5;">Another engaging piece that provides value and keeps your audience coming back for more content.</p>
        <a href="#" style="font-size:13px;color:${p.primary};font-weight:600;text-decoration:none;">Read more →</a>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- Article 3 -->
<tr>
<td style="padding:28px 40px;border-bottom:1px solid #f3f4f6;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="80" valign="top" style="padding-right:20px;">
        <div style="width:80px;height:80px;background-color:${p.secondary};border-radius:8px;text-align:center;line-height:80px;">
          <span style="font-size:30px;color:#fff;">03</span>
        </div>
      </td>
      <td valign="top">
        <h3 style="margin:0 0 6px;font-size:17px;color:${p.secondary};">Third Article Title</h3>
        <p style="margin:0 0 8px;font-size:14px;color:#6b7280;line-height:1.5;">An informative article that rounds out this edition with useful insights and actionable tips.</p>
        <a href="#" style="font-size:13px;color:${p.primary};font-weight:600;text-decoration:none;">Read more →</a>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- CTA -->
<tr>
<td style="padding:28px 40px;text-align:center;">
  <a href="#" style="display:inline-block;padding:14px 40px;background-color:${p.primary};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:6px;">View All Articles</a>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">You're receiving this because you subscribed to our updates.</p>
  <p style="margin:0;font-size:12px;color:#9ca3af;"><a href="{{ UnsubscribeURL }}" style="color:${p.primary};">Unsubscribe</a> · <a href="{{ MessageURL }}" style="color:${p.primary};">View in Browser</a></p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function generateFeatureGrid(name, desc, p) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${name}</title>
</head>
<body style="margin:0;padding:0;background-color:${p.bg};font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${p.bg};">
<tr><td align="center" style="padding:20px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

<!-- Header -->
<tr>
<td style="background-color:${p.secondary};padding:40px;text-align:center;">
  <h1 style="margin:0 0 10px;font-size:26px;font-weight:700;color:#ffffff;">${name}</h1>
  <p style="margin:0;font-size:15px;color:rgba(255,255,255,0.8);">${desc}</p>
</td>
</tr>

<!-- Feature Grid -->
<tr>
<td style="padding:36px 32px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="33%" valign="top" style="text-align:center;padding:12px;">
        <div style="width:56px;height:56px;background-color:${p.primary};border-radius:50%;margin:0 auto 12px;text-align:center;line-height:56px;">
          <span style="color:#fff;font-size:24px;">✦</span>
        </div>
        <h3 style="margin:0 0 6px;font-size:15px;color:${p.secondary};">Feature One</h3>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.4;">Essential capability that drives value.</p>
      </td>
      <td width="33%" valign="top" style="text-align:center;padding:12px;">
        <div style="width:56px;height:56px;background-color:${p.accent};border-radius:50%;margin:0 auto 12px;text-align:center;line-height:56px;">
          <span style="color:#fff;font-size:24px;">◈</span>
        </div>
        <h3 style="margin:0 0 6px;font-size:15px;color:${p.secondary};">Feature Two</h3>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.4;">Powerful tool for your success.</p>
      </td>
      <td width="33%" valign="top" style="text-align:center;padding:12px;">
        <div style="width:56px;height:56px;background-color:${p.primary};border-radius:50%;margin:0 auto 12px;text-align:center;line-height:56px;">
          <span style="color:#fff;font-size:24px;">✧</span>
        </div>
        <h3 style="margin:0 0 6px;font-size:15px;color:${p.secondary};">Feature Three</h3>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.4;">Innovative solution for growth.</p>
      </td>
    </tr>
  </table>

  <!-- Divider -->
  <hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0;">

  <!-- Bottom section -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td width="33%" valign="top" style="text-align:center;padding:12px;">
        <div style="width:56px;height:56px;background-color:${p.accent};border-radius:50%;margin:0 auto 12px;text-align:center;line-height:56px;">
          <span style="color:#fff;font-size:24px;">◉</span>
        </div>
        <h3 style="margin:0 0 6px;font-size:15px;color:${p.secondary};">Feature Four</h3>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.4;">Streamlined experience for all.</p>
      </td>
      <td width="33%" valign="top" style="text-align:center;padding:12px;">
        <div style="width:56px;height:56px;background-color:${p.secondary};border-radius:50%;margin:0 auto 12px;text-align:center;line-height:56px;">
          <span style="color:#fff;font-size:24px;">◆</span>
        </div>
        <h3 style="margin:0 0 6px;font-size:15px;color:${p.secondary};">Feature Five</h3>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.4;">Built for reliability and scale.</p>
      </td>
      <td width="33%" valign="top" style="text-align:center;padding:12px;">
        <div style="width:56px;height:56px;background-color:${p.primary};border-radius:50%;margin:0 auto 12px;text-align:center;line-height:56px;">
          <span style="color:#fff;font-size:24px;">★</span>
        </div>
        <h3 style="margin:0 0 6px;font-size:15px;color:${p.secondary};">Feature Six</h3>
        <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.4;">Premium quality guaranteed.</p>
      </td>
    </tr>
  </table>
</td>
</tr>

<!-- CTA -->
<tr>
<td style="padding:0 32px 32px;text-align:center;">
  <a href="#" style="display:inline-block;padding:14px 40px;background-color:${p.primary};color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;border-radius:6px;">Get Started</a>
</td>
</tr>

<!-- Footer -->
<tr>
<td style="padding:24px 40px;background-color:#f9fafb;border-top:1px solid #e5e7eb;text-align:center;">
  <p style="margin:0 0 8px;font-size:12px;color:#9ca3af;">You're receiving this because you subscribed to our updates.</p>
  <p style="margin:0;font-size:12px;color:#9ca3af;"><a href="{{ UnsubscribeURL }}" style="color:${p.primary};">Unsubscribe</a> · <a href="{{ MessageURL }}" style="color:${p.primary};">View in Browser</a></p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

const layoutGenerators = {
  'hero-content': generateHeroContent,
  'hero-cards': generateHeroCards,
  'article-list': generateArticleList,
  'feature-grid': generateFeatureGrid,
};

// Listmonk requires {{ template "content" . }} in campaign templates.
// We wrap the design HTML inside a Listmonk-compatible wrapper.
function wrapForListmonk(html) {
  // Replace the inner body content section with the Listmonk content placeholder
  // so that campaign content gets injected into the template layout.
  // We insert the placeholder right after the </head><body...> opening and keep the design as the default visual.
  return html.replace(
    '</body>',
    '<!-- Listmonk content placeholder -->\n{{ template "content" . }}\n</body>'
  );
}

// ─── API helper ──────────────────────────────────────────────

function apiRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const baseURL = MODE === 'backend' ? BACKEND_URL : LISTMONK_URL;
    const apiPath = MODE === 'backend' ? `/api${path.replace('/api', '')}` : path;
    const url = new URL(apiPath, baseURL);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;

    let authHeader;
    if (MODE === 'backend') {
      authHeader = `Bearer ${JWT_TOKEN}`;
    } else {
      authHeader = `Basic ${Buffer.from(`${LISTMONK_USER}:${LISTMONK_PASS}`).toString('base64')}`;
    }

    const payload = body ? JSON.stringify(body) : null;

    const opts = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
      },
    };

    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function loginBackend() {
  return new Promise((resolve, reject) => {
    const url = new URL('/api/auth/login', BACKEND_URL);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;
    const payload = JSON.stringify({ email: BACKEND_EMAIL, password: BACKEND_PASSWORD });

    const opts = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
    };

    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.data?.access_token || '');
        } catch {
          resolve('');
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ─── Main ─────────────────────────────────────────────────────

async function main() {
  if (MODE === 'backend') {
    console.log('🔗 Connecting to backend at', BACKEND_URL);
    JWT_TOKEN = await loginBackend();
    if (!JWT_TOKEN) {
      console.error('❌ Failed to get JWT token. Check credentials.');
      process.exit(1);
    }
    console.log('✓ Authenticated via backend API');
  } else {
    console.log('🔗 Connecting to Listmonk at', LISTMONK_URL);
  }

  // Test connection
  const test = await apiRequest('GET', '/templates');
  if (test.status !== 200) {
    console.error('❌ Cannot fetch templates:', test.status, test.data);
    process.exit(1);
  }

  const existingTemplates = test.data?.data || [];
  const existingNames = new Set(existingTemplates.map(t => t.name));
  console.log(`✓ Connected. ${existingTemplates.length} existing templates found.`);

  let created = 0;
  let skipped = 0;
  let failed = 0;
  let total = 0;

  for (const [category, templates] of Object.entries(templateDefs)) {
    const palette = palettes[category] || palettes.Newsletter;

    for (const tpl of templates) {
      total++;
      const templateName = `[${category}] ${tpl.name}`;

      if (existingNames.has(templateName)) {
        console.log(`  ⏭  Skip (exists): ${templateName}`);
        skipped++;
        continue;
      }

      const generator = layoutGenerators[tpl.layout] || generateHeroContent;
      const htmlBody = wrapForListmonk(generator(tpl.name, tpl.desc, palette));

      const payload = {
        name: templateName,
        type: 'campaign',
        subject: templateName,
        body: htmlBody,
      };

      try {
        const res = await apiRequest('POST', '/templates', payload);

        if (res.status === 200 || res.status === 201) {
          console.log(`  ✅ Created: ${templateName}`);
          created++;
        } else {
          console.log(`  ❌ Failed (${res.status}): ${templateName} — ${JSON.stringify(res.data)}`);
          failed++;
        }
      } catch (err) {
        console.log(`  ❌ Error: ${templateName} — ${err.message}`);
        failed++;
      }

      // Small delay to avoid overwhelming the API
      await new Promise(r => setTimeout(r, 100));
    }
  }

  console.log('\n─────────────────────────────────');
  console.log(`📊 Summary: ${total} total, ${created} created, ${skipped} skipped, ${failed} failed`);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
