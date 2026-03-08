'use client'

import Link from 'next/link'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'

interface CampaignTypeOption {
  key: string
  title: string
  description: string
  icon: string
  enabled: boolean
  href: string
}

const campaignTypes: CampaignTypeOption[] = [
  {
    key: 'regular',
    title: 'Regular',
    description: 'Create a standard email campaign and send it to your subscriber lists. Best for newsletters, announcements, and promotions.',
    icon: 'tabler-mail',
    enabled: true,
    href: '/campaigns/create?type=regular'
  },
  {
    key: 'ab-split',
    title: 'A/B Split',
    description: 'Test two versions of your email to find what works best. Compare subject lines, content, or send times.',
    icon: 'tabler-ab',
    enabled: true,
    href: '/campaigns/create?type=regular'
  },
  {
    key: 'rss',
    title: 'RSS',
    description: 'Automatically send email campaigns based on your RSS feed updates. Great for blog post notifications.',
    icon: 'tabler-rss',
    enabled: false,
    href: '#'
  },
  {
    key: 'auto-resend',
    title: 'Auto Resend',
    description: 'Automatically resend campaigns to subscribers who did not open the first email with an updated subject line.',
    icon: 'tabler-refresh',
    enabled: false,
    href: '#'
  },
  {
    key: 'multivariate',
    title: 'Multivariate',
    description: 'Test multiple variables simultaneously to find the optimal combination of subject, content, and send time.',
    icon: 'tabler-chart-bar',
    enabled: false,
    href: '#'
  }
]

const ChooseCampaignType = () => {
  return (
    <div className='flex flex-col gap-6'>
      <div className='flex items-center justify-between'>
        <div>
          <Typography variant='h4' className='font-bold'>Choose Campaign Type</Typography>
          <Typography color='text.secondary' className='mt-1'>
            Select the type of campaign you want to create
          </Typography>
        </div>
        <Button
          variant='outlined'
          color='secondary'
          component={Link}
          href='/campaigns/list'
          startIcon={<i className='tabler-arrow-left' />}
        >
          Back to Campaigns
        </Button>
      </div>

      <Grid container spacing={4}>
        {campaignTypes.map(ct => (
          <Grid key={ct.key} size={{ xs: 12, sm: 6, md: 4 }}>
            <Card
              sx={{
                height: '100%',
                opacity: ct.enabled ? 1 : 0.6,
                position: 'relative',
                transition: 'box-shadow 0.2s',
                '&:hover': ct.enabled ? { boxShadow: 6 } : {}
              }}
            >
              {!ct.enabled && (
                <Chip
                  label='Premium'
                  color='warning'
                  size='small'
                  sx={{ position: 'absolute', top: 16, right: 16 }}
                />
              )}
              <CardContent className='flex flex-col items-center text-center gap-4 p-6' sx={{ height: '100%' }}>
                <div
                  className='flex items-center justify-center rounded-xl'
                  style={{
                    width: 72,
                    height: 72,
                    backgroundColor: ct.enabled ? 'var(--mui-palette-primary-lightOpacity)' : 'var(--mui-palette-action-hover)'
                  }}
                >
                  <i
                    className={`${ct.icon} text-[36px]`}
                    style={{ color: ct.enabled ? 'var(--mui-palette-primary-main)' : 'var(--mui-palette-text-disabled)' }}
                  />
                </div>
                <Typography variant='h6' className='font-semibold'>
                  {ct.title}
                </Typography>
                <Typography variant='body2' color='text.secondary' className='flex-grow'>
                  {ct.description}
                </Typography>
                <Button
                  variant={ct.enabled ? 'contained' : 'outlined'}
                  fullWidth
                  disabled={!ct.enabled}
                  component={ct.enabled ? Link : 'button'}
                  href={ct.enabled ? ct.href : undefined}
                  startIcon={<i className={ct.enabled ? 'tabler-plus' : 'tabler-lock'} />}
                >
                  {ct.enabled ? 'Create' : 'Coming Soon'}
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </div>
  )
}

export default ChooseCampaignType
