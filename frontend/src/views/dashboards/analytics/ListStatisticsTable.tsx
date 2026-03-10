'use client'

// MUI Imports
import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'

interface ListItem {
  id: number
  name: string
  type: string
  optin: string
  subscriber_count: number
}

interface ListStatisticsTableProps {
  lists: ListItem[]
  loading: boolean
}

const ListStatisticsTable = ({ lists, loading }: ListStatisticsTableProps) => {
  return (
    <Card>
      <CardHeader title='Mailing Lists' subheader='Subscribers per list' />
      <CardContent>
        {loading ? (
          <Box display='flex' justifyContent='center' p={4}>
            <CircularProgress />
          </Box>
        ) : lists.length === 0 ? (
          <Typography color='text.secondary' align='center' className='py-8'>
            No mailing lists yet.
          </Typography>
        ) : (
          <div className='flex flex-col gap-3'>
            {lists.map(list => (
              <div key={list.id} className='flex items-center justify-between'>
                <div>
                  <Typography className='font-medium' color='text.primary'>
                    {list.name}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {list.type} &middot; {list.optin} opt-in
                  </Typography>
                </div>
                <Chip
                  label={`${list.subscriber_count?.toLocaleString() || 0}`}
                  size='small'
                  variant='tonal'
                  color='primary'
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default ListStatisticsTable
