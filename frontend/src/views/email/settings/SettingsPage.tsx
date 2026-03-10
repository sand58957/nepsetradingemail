'use client'

import { useState, useEffect } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'

// Tab Components
import CompanyProfileTab from './CompanyProfileTab'
import DefaultSettingsTab from './DefaultSettingsTab'
import DomainsTab from './DomainsTab'
import EcommerceTab from './EcommerceTab'
import LinkTrackingTab from './LinkTrackingTab'

// Services
import accountSettingsService from '@/services/accountSettings'

// Types
import type { AccountSettings } from '@/types/email'

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState(0)
  const [loading, setLoading] = useState(true)
  const [settings, setSettings] = useState<AccountSettings | null>(null)

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success'
  })

  const fetchSettings = async () => {
    try {
      setLoading(true)

      const response = await accountSettingsService.getAll()

      setSettings(response.data)
    } catch (err) {
      console.error('Failed to fetch account settings:', err)
      setSnackbar({ open: true, message: 'Failed to load account settings', severity: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  const handleSaveSuccess = (message: string) => {
    setSnackbar({ open: true, message, severity: 'success' })
    fetchSettings()
  }

  const handleSaveError = (message: string) => {
    setSnackbar({ open: true, message, severity: 'error' })
  }

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }))
  }

  if (loading) {
    return (
      <div className='flex items-center justify-center min-h-[400px]'>
        <CircularProgress />
      </div>
    )
  }

  return (
    <div className='flex flex-col gap-6'>
      <Typography variant='h4' className='font-bold'>
        Account Settings
      </Typography>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant='scrollable'
          scrollButtons='auto'
          sx={{
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              fontSize: '0.9rem',
              minWidth: 'auto',
              px: 3
            }
          }}
        >
          <Tab
            label='Company Profile'
            icon={<i className='tabler-building text-[20px]' />}
            iconPosition='start'
          />
          <Tab
            label='Default Settings'
            icon={<i className='tabler-palette text-[20px]' />}
            iconPosition='start'
          />
          <Tab
            label='Domains'
            icon={<i className='tabler-world text-[20px]' />}
            iconPosition='start'
          />
          <Tab
            label='E-commerce Integration'
            icon={<i className='tabler-shopping-cart text-[20px]' />}
            iconPosition='start'
          />
          <Tab
            label='Link Tracking'
            icon={<i className='tabler-link text-[20px]' />}
            iconPosition='start'
          />
        </Tabs>
      </Box>

      {/* Error state when settings failed to load */}
      {!settings && !loading && (
        <Card>
          <CardContent className='flex flex-col items-center gap-4 py-8'>
            <Typography color='text.secondary'>Failed to load account settings.</Typography>
            <Button variant='outlined' onClick={fetchSettings}>Retry</Button>
          </CardContent>
        </Card>
      )}

      {/* Tab Panels */}
      {activeTab === 0 && settings && (
        <CompanyProfileTab
          data={settings.company_profile}
          onSaveSuccess={handleSaveSuccess}
          onSaveError={handleSaveError}
        />
      )}
      {activeTab === 1 && settings && (
        <DefaultSettingsTab
          data={settings.brand_defaults}
          onSaveSuccess={handleSaveSuccess}
          onSaveError={handleSaveError}
        />
      )}
      {activeTab === 2 && settings && (
        <DomainsTab
          data={settings.domains}
          onSaveSuccess={handleSaveSuccess}
          onSaveError={handleSaveError}
        />
      )}
      {activeTab === 3 && settings && (
        <EcommerceTab
          data={settings.ecommerce}
          onSaveSuccess={handleSaveSuccess}
          onSaveError={handleSaveError}
        />
      )}
      {activeTab === 4 && settings && (
        <LinkTrackingTab
          data={settings.link_tracking}
          onSaveSuccess={handleSaveSuccess}
          onSaveError={handleSaveError}
        />
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} variant='filled'>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </div>
  )
}

export default SettingsPage
