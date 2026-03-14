'use client'

import { useState } from 'react'

// MUI Imports
import Typography from '@mui/material/Typography'
import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'
import Box from '@mui/material/Box'

// Tab Components
import SubscriberListTable from './SubscriberListTable'
import SubscriberSegments from './SubscriberSegments'
import SubscriberGroups from './SubscriberGroups'
import SubscriberFields from './SubscriberFields'
import SubscriberStats from './SubscriberStats'
import SubscriberCleanup from './SubscriberCleanup'
import SubscriberImport from './SubscriberImport'

const SubscriberPage = () => {
  const [activeTab, setActiveTab] = useState(0)

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue)
  }

  return (
    <div className='flex flex-col gap-6'>
      <Typography variant='h4' className='font-bold'>
        Subscribers
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
          <Tab label='All subscribers' />
          <Tab label='Segments' />
          <Tab label='Groups' />
          <Tab label='Fields' />
          <Tab label='Stats' />
          <Tab label='Clean up inactive' />
          <Tab label='Import' />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      {activeTab === 0 && <SubscriberListTable />}
      {activeTab === 1 && <SubscriberSegments />}
      {activeTab === 2 && <SubscriberGroups />}
      {activeTab === 3 && <SubscriberFields />}
      {activeTab === 4 && <SubscriberStats />}
      {activeTab === 5 && <SubscriberCleanup />}
      {activeTab === 6 && <SubscriberImport />}
    </div>
  )
}

export default SubscriberPage
