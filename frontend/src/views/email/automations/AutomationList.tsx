'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import CircularProgress from '@mui/material/CircularProgress'
import Box from '@mui/material/Box'
import Switch from '@mui/material/Switch'
import Tooltip from '@mui/material/Tooltip'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'

import automationService from '@/services/automation'
import type { AutomationData } from '@/services/automation'

const triggerLabels: Record<string, string> = {
  subscriber_added: 'Subscriber Added to List',
  manual: 'Manual Trigger',
  campaign_open: 'Campaign Opened',
  campaign_click: 'Campaign Link Clicked'
}

const AutomationList = () => {
  const router = useRouter()
  const { lang: locale } = useParams()
  const [automations, setAutomations] = useState<AutomationData[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [toggling, setToggling] = useState<number | null>(null)

  const fetchAutomations = async () => {
    try {
      setLoading(true)
      const res = await automationService.getAll({ page: 1, per_page: 50 })
      setAutomations(res.data || [])
    } catch (err) {
      console.error('Failed to fetch automations:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAutomations()
  }, [])

  const handleToggle = async (id: number) => {
    try {
      setToggling(id)
      await automationService.toggleStatus(id)
      await fetchAutomations()
    } catch (err) {
      console.error('Failed to toggle:', err)
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await automationService.delete(deleteId)
      setDeleteId(null)
      await fetchAutomations()
    } catch (err) {
      console.error('Failed to delete:', err)
    }
  }

  return (
    <>
      <Card>
        <CardHeader
          title='Automations'
          subheader='Create automated email sequences triggered by subscriber actions'
          action={
            <Button
              variant='contained'
              startIcon={<i className='tabler-plus' />}
              onClick={() => router.push(`/${locale}/automations/create`)}
            >
              Create Automation
            </Button>
          }
        />
        <CardContent sx={{ p: 0 }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : automations.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <i className='tabler-robot text-[48px]' style={{ color: 'var(--mui-palette-text-secondary)' }} />
              <Typography variant='h6' sx={{ mt: 2 }}>
                No automations yet
              </Typography>
              <Typography color='text.secondary' sx={{ mt: 1 }}>
                Create your first automation to send email sequences automatically.
              </Typography>
              <Button
                variant='contained'
                sx={{ mt: 3 }}
                startIcon={<i className='tabler-plus' />}
                onClick={() => router.push(`/${locale}/automations/create`)}
              >
                Create Automation
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Trigger</TableCell>
                    <TableCell>Steps</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell align='right'>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {automations.map(automation => (
                    <TableRow
                      key={automation.id}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => router.push(`/${locale}/automations/${automation.id}`)}
                    >
                      <TableCell>
                        <Typography fontWeight={600}>{automation.name}</Typography>
                        {automation.description && (
                          <Typography variant='caption' color='text.secondary'>
                            {automation.description}
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={triggerLabels[automation.trigger_type] || automation.trigger_type}
                          size='small'
                          variant='tonal'
                          color='primary'
                        />
                      </TableCell>
                      <TableCell>
                        {automation.steps?.length || 0} step{(automation.steps?.length || 0) !== 1 ? 's' : ''}
                      </TableCell>
                      <TableCell>
                        <Tooltip title={automation.is_active ? 'Active — click to deactivate' : 'Inactive — click to activate'}>
                          <Switch
                            checked={automation.is_active}
                            size='small'
                            disabled={toggling === automation.id}
                            onClick={e => {
                              e.stopPropagation()
                              handleToggle(automation.id)
                            }}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Typography variant='body2'>
                          {new Date(automation.created_at).toLocaleDateString('en-US', {
                            year: 'numeric', month: 'short', day: 'numeric'
                          })}
                        </Typography>
                      </TableCell>
                      <TableCell align='right'>
                        <Tooltip title='Edit'>
                          <IconButton
                            size='small'
                            onClick={e => {
                              e.stopPropagation()
                              router.push(`/${locale}/automations/${automation.id}`)
                            }}
                          >
                            <i className='tabler-edit text-[20px]' />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title='Delete'>
                          <IconButton
                            size='small'
                            color='error'
                            onClick={e => {
                              e.stopPropagation()
                              setDeleteId(automation.id)
                            }}
                          >
                            <i className='tabler-trash text-[20px]' />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Delete Automation</DialogTitle>
        <DialogContent>
          <Typography>Are you sure you want to delete this automation? This action cannot be undone.</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button onClick={handleDelete} color='error' variant='contained'>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

export default AutomationList
