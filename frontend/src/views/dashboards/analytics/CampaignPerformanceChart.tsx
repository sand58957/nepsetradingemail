'use client'

// Next Imports
import dynamic from 'next/dynamic'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import { useTheme } from '@mui/material/styles'

// Third Party Imports
import type { ApexOptions } from 'apexcharts'

// Styled Component Imports
const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'))

interface Campaign {
  name: string
  sent: number
  views: number
  clicks: number
  bounces: number
}

interface CampaignPerformanceChartProps {
  campaigns: Campaign[]
  loading: boolean
}

const CampaignPerformanceChart = ({ campaigns, loading }: CampaignPerformanceChartProps) => {
  const theme = useTheme()

  const series = [
    {
      name: 'Sent',
      data: campaigns.slice(0, 6).map(c => c.sent || 0)
    },
    {
      name: 'Opens',
      data: campaigns.slice(0, 6).map(c => c.views || 0)
    },
    {
      name: 'Clicks',
      data: campaigns.slice(0, 6).map(c => c.clicks || 0)
    }
  ]

  const options: ApexOptions = {
    chart: {
      parentHeightOffset: 0,
      toolbar: { show: false }
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '55%'
      }
    },
    dataLabels: { enabled: false },
    colors: [theme.palette.primary.main, theme.palette.success.main, theme.palette.info.main],
    grid: {
      borderColor: 'var(--mui-palette-divider)',
      padding: { top: -10, bottom: -5 }
    },
    xaxis: {
      categories: campaigns.slice(0, 6).map(c => c.name?.substring(0, 12) || 'Campaign'),
      axisTicks: { show: false },
      axisBorder: { show: false }
    },
    yaxis: {
      labels: {
        formatter: (val: number) => `${val}`
      }
    },
    legend: {
      position: 'top',
      horizontalAlign: 'left'
    }
  }

  return (
    <Card>
      <CardHeader title='Campaign Performance' subheader='Sent, Opens & Clicks for recent campaigns' />
      <CardContent>
        {loading ? (
          <Box display='flex' justifyContent='center' p={4}>
            <CircularProgress />
          </Box>
        ) : campaigns.length === 0 ? (
          <Typography color='text.secondary' align='center' className='py-8'>
            No campaign data available yet.
          </Typography>
        ) : (
          <AppReactApexCharts type='bar' height={300} width='100%' series={series} options={options} />
        )}
      </CardContent>
    </Card>
  )
}

export default CampaignPerformanceChart
