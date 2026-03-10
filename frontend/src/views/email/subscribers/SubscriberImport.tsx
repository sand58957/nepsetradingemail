'use client'

import { useState, useEffect } from 'react'

import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Box from '@mui/material/Box'
import Skeleton from '@mui/material/Skeleton'

import type { ImportAnalytics } from '@/types/email'
import importService from '@/services/import'

import CSVImportWizard from './import/CSVImportWizard'
import APIImport from './import/APIImport'
import WebhookImport from './import/WebhookImport'
import ImportHistoryTable from './import/ImportHistoryTable'

const SubscriberImport = () => {
  const [activeSubTab, setActiveSubTab] = useState(0)
  const [analytics, setAnalytics] = useState<ImportAnalytics | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAnalytics = async () => {
    try {
      const res = await importService.getAnalytics()

      setAnalytics(res.data)
    } catch {
      // Silently fail - analytics cards will show 0
      setAnalytics({
        total_imports: 0,
        total_records: 0,
        total_successful: 0,
        total_failed: 0,
        total_skipped: 0,
        active_webhooks: 0,
        suppressed_emails: 0
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAnalytics()
  }, [])

  const statCards = [
    {
      label: 'Total Imports',
      value: analytics?.total_imports ?? 0,
      icon: 'tabler-file-import',
      color: 'primary'
    },
    {
      label: 'Records Imported',
      value: analytics?.total_successful ?? 0,
      icon: 'tabler-users-plus',
      color: 'success'
    },
    {
      label: 'Success Rate',
      value:
        analytics && analytics.total_records > 0
          ? `${Math.round((analytics.total_successful / analytics.total_records) * 100)}%`
          : '—',
      icon: 'tabler-chart-pie',
      color: 'info'
    },
    {
      label: 'Active Webhooks',
      value: analytics?.active_webhooks ?? 0,
      icon: 'tabler-webhook',
      color: 'warning'
    }
  ]

  return (
    <div className='flex flex-col gap-6'>
      {/* Analytics Summary Cards */}
      <Grid container spacing={4}>
        {statCards.map(card => (
          <Grid key={card.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card>
              <CardContent className='flex items-center gap-4'>
                <div
                  className='flex items-center justify-center rounded-lg'
                  style={{
                    width: 48,
                    height: 48,
                    backgroundColor: `var(--mui-palette-${card.color}-lightOpacity)`
                  }}
                >
                  <i
                    className={`${card.icon} text-[24px]`}
                    style={{ color: `var(--mui-palette-${card.color}-main)` }}
                  />
                </div>
                <div>
                  {loading ? (
                    <>
                      <Skeleton width={60} height={32} />
                      <Skeleton width={80} height={20} />
                    </>
                  ) : (
                    <>
                      <Typography variant='h5' className='font-bold'>
                        {card.value}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {card.label}
                      </Typography>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Sub-Tabs */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tabs
            value={activeSubTab}
            onChange={(_, v) => setActiveSubTab(v)}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.875rem',
                minWidth: 'auto',
                px: 3
              }
            }}
          >
            <Tab icon={<i className='tabler-file-upload text-[18px]' />} iconPosition='start' label='CSV Import' />
            <Tab icon={<i className='tabler-code text-[18px]' />} iconPosition='start' label='API Import' />
            <Tab icon={<i className='tabler-webhook text-[18px]' />} iconPosition='start' label='Webhook Import' />
            <Tab icon={<i className='tabler-history text-[18px]' />} iconPosition='start' label='Import History' />
          </Tabs>
        </Box>
        <CardContent>
          {activeSubTab === 0 && <CSVImportWizard onImportComplete={fetchAnalytics} />}
          {activeSubTab === 1 && <APIImport onImportComplete={fetchAnalytics} />}
          {activeSubTab === 2 && <WebhookImport onWebhookChange={fetchAnalytics} />}
          {activeSubTab === 3 && <ImportHistoryTable />}
        </CardContent>
      </Card>
    </div>
  )
}

export default SubscriberImport
