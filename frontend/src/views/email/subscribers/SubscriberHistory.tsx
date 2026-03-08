'use client'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'

const SubscriberHistory = () => {
  return (
    <Card>
      <CardContent>
        <Typography variant='h6' className='mb-4'>Import History</Typography>
        <Typography color='text.secondary' className='text-center py-8'>
          No import history available on this instance. Use the Listmonk admin panel to import subscribers via CSV.
        </Typography>
      </CardContent>
    </Card>
  )
}

export default SubscriberHistory
