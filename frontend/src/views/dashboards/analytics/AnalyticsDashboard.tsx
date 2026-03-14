'use client'

// React Imports
import { useState, useEffect } from 'react'

// Next Imports
import { useSession } from 'next-auth/react'

// MUI Imports
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

// Service Imports
import analyticsService from '@/services/analytics'
import dashboardService from '@/services/dashboard'
import { importService } from '@/services/import'

// Type Imports
import type { AnalyticsOverview } from '@/services/analytics'
import type { ImportAnalytics } from '@/types/email'

// Component Imports
import StatCard from './StatCard'
import CampaignPerformanceChart from './CampaignPerformanceChart'
import EmailPerformanceRadial from './EmailPerformanceRadial'
import SubscriberStatusBreakdown from './SubscriberStatusBreakdown'
import CampaignStatusOverview from './CampaignStatusOverview'
import ImportAnalyticsCard from './ImportAnalyticsCard'
import ListStatisticsTable from './ListStatisticsTable'
import RecentCampaignsTable from './RecentCampaignsTable'

// Dashboard data from /dashboard/stats
interface DashboardData {
  total_subscribers: number
  active_subscribers: number
  total_lists: number
  total_campaigns: number
  campaigns_sent: number
  open_rate: number
  click_rate: number
  recent_campaigns: any[]
  list_stats: any[]
}

// Delivery Stat Card matching the screenshot design (centered, percentage + count)
const DeliveryStatCard = ({
  label,
  percentage,
  count,
  color,
  loading
}: {
  label: string
  percentage?: string
  count: number | string
  color: string
  loading?: boolean
}) => (
  <Card sx={{ textAlign: 'center', height: '100%' }}>
    <CardContent sx={{ py: 4 }}>
      <Typography
        variant='overline'
        sx={{ letterSpacing: 1.5, color: 'text.secondary', fontWeight: 600, fontSize: '0.7rem' }}
      >
        {label}
      </Typography>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <CircularProgress size={28} />
        </Box>
      ) : (
        <>
          <Typography variant='h4' sx={{ color, fontWeight: 700, mt: 1 }}>
            {percentage !== undefined ? percentage : count}
          </Typography>
          {percentage !== undefined && (
            <Typography variant='body2' sx={{ color: 'text.secondary', mt: 0.5 }}>
              {count}
            </Typography>
          )}
        </>
      )}
    </CardContent>
  </Card>
)

const AnalyticsDashboard = () => {
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Data states
  const [overviewData, setOverviewData] = useState<AnalyticsOverview | null>(null)
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [importData, setImportData] = useState<ImportAnalytics | null>(null)

  useEffect(() => {
    const fetchAllData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch from 3 endpoints in parallel — use allSettled for partial failure handling
        const [overviewResult, dashboardResult, importResult] = await Promise.allSettled([
          analyticsService.getOverview(),
          dashboardService.getStats(),
          importService.getAnalytics()
        ])

        if (overviewResult.status === 'fulfilled' && overviewResult.value?.data) {
          setOverviewData(overviewResult.value.data)
        }

        if (dashboardResult.status === 'fulfilled' && dashboardResult.value?.data) {
          setDashboardData(dashboardResult.value.data as unknown as DashboardData)
        }

        if (importResult.status === 'fulfilled' && importResult.value?.data) {
          setImportData(importResult.value.data)
        }

        // Only show error if ALL requests failed
        const allFailed =
          overviewResult.status === 'rejected' &&
          dashboardResult.status === 'rejected' &&
          importResult.status === 'rejected'

        if (allFailed) {
          setError('Failed to load analytics data. Please try again.')
        }
      } catch (err) {
        console.error('Analytics fetch error:', err)
        setError('Failed to connect to server')
      } finally {
        setLoading(false)
      }
    }

    // If session is still loading, wait
    if (status === 'loading') return

    if (session) {
      fetchAllData()
    } else {
      setLoading(false)
    }
  }, [session, status])

  // Extract data for child components
  const recentCampaigns = dashboardData?.recent_campaigns || []
  const listDetails = overviewData?.lists?.details || dashboardData?.list_stats || []

  return (
    <Grid container spacing={6}>
      {/* Error Banner */}
      {error && (
        <Grid size={{ xs: 12 }}>
          <Card>
            <CardContent>
              <Typography color='error'>{error}</Typography>
            </CardContent>
          </Card>
        </Grid>
      )}

      {/* Row 0: Email Delivery Stats (Requests, Delivered, Opened, Clicked, Bounces, Spam Reports) */}
      <Grid size={{ xs: 12 }}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <DeliveryStatCard
              label='REQUESTS'
              count={overviewData?.performance?.total_sent?.toLocaleString() || '0'}
              color='#555'
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <DeliveryStatCard
              label='DELIVERED'
              percentage={`${overviewData?.performance?.delivery_rate?.toFixed(2) || '0.00'}%`}
              count={overviewData?.performance?.total_delivered?.toLocaleString() || '0'}
              color='#8BC34A'
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <DeliveryStatCard
              label='OPENED'
              percentage={`${overviewData?.performance?.avg_open_rate?.toFixed(2) || '0.00'}%`}
              count={overviewData?.performance?.total_opens?.toLocaleString() || '0'}
              color='#00BCD4'
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <DeliveryStatCard
              label='CLICKED'
              percentage={`${overviewData?.performance?.avg_click_rate?.toFixed(2) || '0.00'}%`}
              count={overviewData?.performance?.total_clicks?.toLocaleString() || '0'}
              color='#9E9E9E'
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <DeliveryStatCard
              label='BOUNCES'
              percentage={`${overviewData?.performance?.bounce_rate?.toFixed(2) || '0.00'}%`}
              count={overviewData?.performance?.total_bounces?.toLocaleString() || '0'}
              color='#FF9800'
              loading={loading}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <DeliveryStatCard
              label='SPAM REPORTS'
              percentage={`${overviewData?.performance?.spam_rate?.toFixed(2) || '0.00'}%`}
              count={overviewData?.performance?.spam_reports?.toLocaleString() || '0'}
              color='#F44336'
              loading={loading}
            />
          </Grid>
        </Grid>
      </Grid>

      {/* Row 1: KPI Stat Cards */}
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Total Subscribers'
          value={overviewData?.subscribers?.total?.toLocaleString() || dashboardData?.total_subscribers?.toLocaleString() || '0'}
          icon='tabler-users'
          color='primary'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Active Subscribers'
          value={overviewData?.subscribers?.active?.toLocaleString() || dashboardData?.active_subscribers?.toLocaleString() || '0'}
          icon='tabler-user-check'
          color='success'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Campaigns Sent'
          value={overviewData?.campaigns?.sent?.toLocaleString() || dashboardData?.campaigns_sent?.toLocaleString() || '0'}
          icon='tabler-send'
          color='warning'
          loading={loading}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6, md: 3 }}>
        <StatCard
          title='Mailing Lists'
          value={overviewData?.lists?.total?.toLocaleString() || dashboardData?.total_lists?.toLocaleString() || '0'}
          icon='tabler-list'
          color='info'
          loading={loading}
        />
      </Grid>

      {/* Row 2: Campaign Performance Chart + Email Performance Radial */}
      <Grid size={{ xs: 12, lg: 8 }}>
        <CampaignPerformanceChart campaigns={recentCampaigns} loading={loading} />
      </Grid>
      <Grid size={{ xs: 12, md: 6, lg: 4 }}>
        <EmailPerformanceRadial performance={overviewData?.performance || null} loading={loading} />
      </Grid>

      {/* Row 3: Subscriber Status + Campaign Status + Import Analytics */}
      <Grid size={{ xs: 12, md: 6, lg: 4 }}>
        <SubscriberStatusBreakdown subscribers={overviewData?.subscribers || null} loading={loading} />
      </Grid>
      <Grid size={{ xs: 12, md: 6, lg: 4 }}>
        <CampaignStatusOverview campaigns={overviewData?.campaigns || null} loading={loading} />
      </Grid>
      <Grid size={{ xs: 12, md: 6, lg: 4 }}>
        <ImportAnalyticsCard importData={importData} loading={loading} />
      </Grid>

      {/* Row 4: Recent Campaigns Table + List Statistics */}
      <Grid size={{ xs: 12, lg: 8 }}>
        <RecentCampaignsTable campaigns={recentCampaigns} loading={loading} />
      </Grid>
      <Grid size={{ xs: 12, md: 6, lg: 4 }}>
        <ListStatisticsTable lists={listDetails} loading={loading} />
      </Grid>
    </Grid>
  )
}

export default AnalyticsDashboard
