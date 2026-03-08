'use client'

import { useEffect, useState } from 'react'

import { useParams, useRouter } from 'next/navigation'

import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import CircularProgress from '@mui/material/CircularProgress'
import Alert from '@mui/material/Alert'

import type { Locale } from '@configs/i18n'

import { portalService } from '@/services/portal'
import { getLocalizedUrl } from '@/utils/i18n'

const CampaignArchiveView = () => {
  const [html, setHtml] = useState('')
  const [campaignName, setCampaignName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()
  const params = useParams()
  const { lang: locale, id } = params

  useEffect(() => {
    if (id) {
      fetchCampaign()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const fetchCampaign = async () => {
    try {
      setLoading(true)

      const result = await portalService.getCampaignArchiveDetail(Number(id))

      if (result.data) {
        setHtml(result.data.html || '')

        // Parse campaign name from the campaign data
        const campaignData = result.data.campaign

        if (campaignData) {
          const parsed = typeof campaignData === 'string' ? JSON.parse(campaignData) : campaignData

          setCampaignName(parsed?.data?.subject || parsed?.data?.name || 'Newsletter')
        }
      }
    } catch (err: any) {
      setError('Failed to load newsletter')
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

  if (error) {
    return (
      <Box>
        <Alert severity='error' className='mb-4'>
          {error}
        </Alert>
        <Button
          variant='tonal'
          startIcon={<i className='tabler-arrow-left' />}
          onClick={() => router.push(getLocalizedUrl('/portal/archive', locale as Locale))}
        >
          Back to Archive
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      <Box className='flex items-center gap-4 mb-4'>
        <Button
          variant='tonal'
          size='small'
          startIcon={<i className='tabler-arrow-left' />}
          onClick={() => router.push(getLocalizedUrl('/portal/archive', locale as Locale))}
        >
          Back
        </Button>
        <Typography variant='h6'>{campaignName}</Typography>
      </Box>

      <Card>
        <CardContent>
          {html ? (
            <div dangerouslySetInnerHTML={{ __html: html }} style={{ maxWidth: '100%', overflow: 'hidden' }} />
          ) : (
            <Typography color='text.secondary' className='text-center py-8'>
              No content available for this newsletter
            </Typography>
          )}
        </CardContent>
      </Card>
    </Box>
  )
}

export default CampaignArchiveView
