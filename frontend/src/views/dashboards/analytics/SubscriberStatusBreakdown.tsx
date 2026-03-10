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

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

// Styled Component Imports
const AppReactApexCharts = dynamic(() => import('@/libs/styles/AppReactApexCharts'))

interface SubscriberData {
  total: number
  active: number
  blocklisted: number
  unsubscribed: number
}

interface SubscriberStatusBreakdownProps {
  subscribers: SubscriberData | null
  loading: boolean
}

const SubscriberStatusBreakdown = ({ subscribers, loading }: SubscriberStatusBreakdownProps) => {
  const theme = useTheme()

  const active = subscribers?.active || 0
  const blocklisted = subscribers?.blocklisted || 0
  const unsubscribed = subscribers?.unsubscribed || 0
  const total = subscribers?.total || 0

  const series = [active, blocklisted, unsubscribed]
  const hasData = total > 0

  const options: ApexOptions = {
    chart: {
      sparkline: { enabled: true }
    },
    colors: [theme.palette.success.main, theme.palette.error.main, theme.palette.warning.main],
    labels: ['Active', 'Blocklisted', 'Unsubscribed'],
    legend: { show: false },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: { fontSize: '13px' },
            value: {
              fontSize: '22px',
              fontWeight: 600,
              formatter: (val: string) => val
            },
            total: {
              show: true,
              label: 'Total',
              fontSize: '13px',
              formatter: () => `${total}`
            }
          }
        }
      }
    }
  }

  const items = [
    {
      label: 'Active',
      count: active,
      icon: 'tabler-user-check',
      color: 'success' as const
    },
    {
      label: 'Blocklisted',
      count: blocklisted,
      icon: 'tabler-ban',
      color: 'error' as const
    },
    {
      label: 'Unsubscribed',
      count: unsubscribed,
      icon: 'tabler-user-minus',
      color: 'warning' as const
    }
  ]

  return (
    <Card>
      <CardHeader title='Subscriber Status' />
      <CardContent>
        {loading ? (
          <Box display='flex' justifyContent='center' p={4}>
            <CircularProgress />
          </Box>
        ) : !hasData ? (
          <Typography color='text.secondary' align='center' className='py-8'>
            No subscribers yet.
          </Typography>
        ) : (
          <>
            <AppReactApexCharts type='donut' height={220} width='100%' series={series} options={options} />
            <div className='flex flex-col gap-3 mts-4'>
              {items.map(item => (
                <div key={item.label} className='flex items-center justify-between'>
                  <div className='flex items-center gap-2'>
                    <CustomAvatar color={item.color} skin='light' variant='rounded' size={30}>
                      <i className={`${item.icon} text-[18px]`} />
                    </CustomAvatar>
                    <Typography variant='body2'>{item.label}</Typography>
                  </div>
                  <Typography className='font-medium' color='text.primary'>
                    {item.count.toLocaleString()}
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

export default SubscriberStatusBreakdown
