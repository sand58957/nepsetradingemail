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
