'use client'

import { useEffect, useState } from 'react'

import { useParams, useRouter } from 'next/navigation'

import Card from '@mui/material/Card'
import CardHeader from '@mui/material/CardHeader'
import CardContent from '@mui/material/CardContent'
import CardActionArea from '@mui/material/CardActionArea'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'
import Chip from '@mui/material/Chip'

import type { Locale } from '@configs/i18n'

import { portalService } from '@/services/portal'
import { getLocalizedUrl } from '@/utils/i18n'

interface Campaign {
  id: number
  name: string
  subject: string
  created_at: string
  updated_at: string
  status: string
  tags?: string[]
}

const CampaignArchiveList = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()
  const { lang: locale } = useParams()

  useEffect(() => {
    fetchArchive()
  }, [])

  const fetchArchive = async () => {
    try {
      setLoading(true)

      const result = await portalService.getCampaignArchive({ per_page: 50 })

      setCampaigns(result.data?.results || [])
    } catch (err: any) {
      setError('Failed to load newsletter archive')
    } finally {
      setLoading(false)
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
    <Box>
      <Typography variant='h5' className='mb-4'>
        Newsletter Archive
      </Typography>

      {error && (
        <Alert severity='error' className='mb-4'>
          {error}
        </Alert>
      )}

      {campaigns.length === 0 ? (
        <Card>
          <CardContent className='text-center py-8'>
            <i className='tabler-inbox text-5xl mb-4 text-textSecondary' />
            <Typography color='text.secondary'>No archived newsletters yet</Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {campaigns.map(campaign => (
            <Grid item xs={12} sm={6} key={campaign.id}>
              <Card>
                <CardActionArea
                  onClick={() =>
                    router.push(getLocalizedUrl(`/portal/archive/${campaign.id}`, locale as Locale))
                  }
                >
                  <CardContent>
                    <Typography variant='h6' className='mb-1' noWrap>
                      {campaign.subject || campaign.name}
                    </Typography>
                    <Typography variant='body2' color='text.secondary' className='mb-2'>
                      {new Date(campaign.updated_at || campaign.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </Typography>
                    {campaign.tags && campaign.tags.length > 0 && (
                      <Box className='flex gap-1 flex-wrap'>
                        {campaign.tags.map(tag => (
                          <Chip key={tag} label={tag} size='small' variant='outlined' />
                        ))}
                      </Box>
                    )}
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  )
}

export default CampaignArchiveList
