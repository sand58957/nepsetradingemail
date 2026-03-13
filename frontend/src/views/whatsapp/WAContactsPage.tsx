'use client'

import { useState } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Box from '@mui/material/Box'

// Tab Components
import WAContactList from './WAContactList'
import WAContactTags from './WAContactTags'
import WAContactFields from './WAContactFields'
import WAContactStats from './WAContactStats'
import WAContactCleanup from './WAContactCleanup'
import WAContactImport from './WAContactImport'

const WAContactsPage = () => {
  const [activeTab, setActiveTab] = useState(0)

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  return (
    <div className='flex flex-col gap-6'>
      <Typography variant='h4' className='font-bold'>
        WhatsApp Contacts
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
          <Tab label='All contacts' />
          <Tab label='Tags' />
          <Tab label='Fields' />
          <Tab label='Stats' />
          <Tab label='Clean up inactive' />
          <Tab label='Import' />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      {activeTab === 0 && <WAContactList />}
      {activeTab === 1 && <WAContactTags />}
      {activeTab === 2 && <WAContactFields />}
      {activeTab === 3 && <WAContactStats />}
      {activeTab === 4 && <WAContactCleanup />}
      {activeTab === 5 && <WAContactImport />}
    </div>
  )
}

export default WAContactsPage
