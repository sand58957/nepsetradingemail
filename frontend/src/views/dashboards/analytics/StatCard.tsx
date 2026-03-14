'use client'

// MUI Imports
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
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
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', py: 4, height: '100%' }}>
        <CustomAvatar color={color} skin='light' variant='rounded' size={44} sx={{ mb: 1.5 }}>
          <i className={`${icon} text-[24px]`} />
        </CustomAvatar>
        <Typography
          variant='overline'
          sx={{ letterSpacing: 1, color: 'text.secondary', fontWeight: 600, fontSize: '0.7rem', lineHeight: 1.4 }}
        >
          {title}
        </Typography>
        {loading ? (
          <Box sx={{ mt: 1 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Typography variant='h4' sx={{ fontWeight: 700, mt: 0.5 }}>
            {value}
          </Typography>
        )}
      </CardContent>
    </Card>
  )
}

export default StatCard
