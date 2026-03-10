'use client'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'

// Component Imports
import CustomAvatar from '@core/components/mui/Avatar'

interface StatCardProps {
  title: string
  value: string
  icon: string
  color: 'primary' | 'success' | 'warning' | 'error' | 'info' | 'secondary'
  loading?: boolean
}

const StatCard = ({ title, value, icon, color, loading }: StatCardProps) => {
  return (
    <Card>
      <CardContent className='flex justify-between gap-1'>
        <div className='flex flex-col gap-1 grow'>
          <Typography color='text.primary'>{title}</Typography>
          <div className='flex items-center gap-2 flex-wrap'>
            {loading ? <CircularProgress size={24} /> : <Typography variant='h4'>{value}</Typography>}
          </div>
        </div>
        <CustomAvatar color={color} skin='light' variant='rounded' size={42}>
          <i className={`${icon} text-[26px]`} />
        </CustomAvatar>
      </CardContent>
    </Card>
  )
}

export default StatCard
