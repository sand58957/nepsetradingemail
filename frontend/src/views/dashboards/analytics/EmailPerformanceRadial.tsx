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
import Divider from '@mui/material/Divider'
import { useTheme } from '@mui/material/styles'

// Third Party Imports
import type { ApexOptions } from 'apexcharts'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Styled Component Imports
const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'))

interface PerformanceData {
  total_sent: number
  total_opens: number
  total_clicks: number
  avg_open_rate: number
  avg_click_rate: number
  bounce_rate: number
}

interface EmailPerformanceRadialProps {
  performance: PerformanceData | null
  loading: boolean
}

const EmailPerformanceRadial = ({ performance, loading }: EmailPerformanceRadialProps) => {
  const theme = useTheme()

  const openRate = Number((performance?.avg_open_rate || 0).toFixed(1))
  const clickRate = Number((performance?.avg_click_rate || 0).toFixed(1))
  const bounceRate = Number((performance?.bounce_rate || 0).toFixed(1))

  const options: ApexOptions = {
    chart: {
      sparkline: { enabled: true }
    },
    colors: [theme.palette.success.main, theme.palette.info.main, theme.palette.warning.main],
    plotOptions: {
      radialBar: {
        startAngle: -90,
        endAngle: 90,
        hollow: { size: '40%' },
        track: {
          background: 'var(--mui-palette-divider)',
          strokeWidth: '100%'
        },
        dataLabels: {
          name: {
            offsetY: 60,
            fontSize: '13px',
            color: 'var(--mui-palette-text-secondary)'
          },
          value: {
            offsetY: 20,
            fontSize: '22px',
            fontWeight: 600,
            color: 'var(--mui-palette-text-primary)',
            formatter: (val: number) => `${val}%`
          }
        }
      }
    },
    labels: ['Open Rate', 'Click Rate', 'Bounce Rate'],
    stroke: { lineCap: 'round' }
  }

  const stats = [
    {
      title: 'Total Sent',
      value: performance?.total_sent?.toLocaleString() || '0',
      icon: 'tabler-send',
      color: 'primary' as const
    },
    {
      title: 'Total Opens',
      value: performance?.total_opens?.toLocaleString() || '0',
      icon: 'tabler-mail-opened',
      color: 'success' as const
    },
    {
      title: 'Total Clicks',
      value: performance?.total_clicks?.toLocaleString() || '0',
      icon: 'tabler-click',
      color: 'info' as const
    }
  ]

  return (
    <Card>
      <CardHeader title='Email Performance' />
      <CardContent>
        {loading ? (
          <Box display='flex' justifyContent='center' p={4}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <AppReactApexCharts
              type='radialBar'
              height={220}
              width='100%'
              series={[openRate, clickRate, bounceRate]}
              options={options}
            />
            <Divider className='mbs-4 mbe-4' />
            <div className='flex flex-col gap-3'>
              {stats.map(stat => (
                <div key={stat.title} className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <CustomAvatar color={stat.color} skin='light' variant='rounded' size={30}>
                      <i className={`${stat.icon} text-[18px]`} />
                    </CustomAvatar>
                    <Typography variant='body2'>{stat.title}</Typography>
                  </div>
                  <Typography className='font-medium' color='text.primary'>
                    {stat.value}
                  </Typography>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default EmailPerformanceRadial
