'use client'

import { useEffect, useState } from 'react'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Switch from '@mui/material/Switch'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Typography from '@mui/material/Typography'

import { portalService } from '@/services/portal'
import api from '@/services/api'

interface ListItem2 {
  id: number
  name: string
  description?: string
  subscribed: boolean
}

const SubscriptionsView = () => {
  const [lists, setLists] = useState<ListItem2[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchSubscriptions()
  }, [])

  const fetchSubscriptions = async () => {
    try {
      setLoading(true)

      // Get user's current subscriptions (includes list info)
      const subData = await portalService.getSubscriptions()
      const subscriberLists = subData?.data?.lists || []

      // Build list from subscription data — subscriber-accessible endpoint
      const mergedLists = subscriberLists.map((l: any) => ({
        id: l.id,
        name: l.name,
        description: l.description || '',
        subscribed: l.subscription_status === 'confirmed'
      }))

      setLists(mergedLists)
    } catch {
      setError('Failed to load subscription data')
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = (listId: number) => {
    setLists(prev => prev.map(l => (l.id === listId ? { ...l, subscribed: !l.subscribed } : l)))
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError('')
      setSuccess('')

      const subscribedIds = lists.filter(l => l.subscribed).map(l => l.id)

      await portalService.updateSubscriptions(subscribedIds)
      setSuccess('Subscriptions updated successfully!')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update subscriptions')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box className='flex justify-center p-8'>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Card>
      <CardHeader title='My Subscriptions' subheader='Toggle the lists you want to receive emails from' />
      <CardContent>
        {error && (
          <Alert severity='error' className='mb-4'>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity='success' className='mb-4'>
            {success}
          </Alert>
        )}

        {lists.length === 0 ? (
          <Typography color='text.secondary' className='py-4 text-center'>
            No mailing lists available
          </Typography>
        ) : (
          <List>
            {lists.map(list => (
              <ListItem key={list.id} divider>
                <ListItemText primary={list.name} secondary={list.description} />
                <Switch checked={list.subscribed} onChange={() => handleToggle(list.id)} color='primary' />
              </ListItem>
            ))}
          </List>
        )}

        <Box className='flex flex-wrap justify-end mt-4 gap-2'>
          <Button variant='contained' onClick={handleSave} disabled={saving} startIcon={<i className='tabler-check' />}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Box>
      </CardContent>
    </Card>
  )
}

export default SubscriptionsView
