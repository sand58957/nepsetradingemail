'use client'

import { useParams, useRouter, usePathname } from 'next/navigation'

import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Container from '@mui/material/Container'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Paper from '@mui/material/Paper'

import type { Locale } from '@configs/i18n'

import UserDropdown from '@components/layout/shared/UserDropdown'
import ModeDropdown from '@components/layout/shared/ModeDropdown'
import Logo from '@components/layout/shared/Logo'
import { getLocalizedUrl } from '@/utils/i18n'

import type { ChildrenType } from '@core/types'

const PortalLayout = ({ children }: ChildrenType) => {
  const router = useRouter()
  const pathname = usePathname()
  const { lang: locale } = useParams()

  const navItems = [
    { label: 'Home', icon: 'tabler-home', path: '/portal' },
    { label: 'Subscriptions', icon: 'tabler-mail', path: '/portal/subscriptions' },
    { label: 'Archive', icon: 'tabler-archive', path: '/portal/archive' },
    { label: 'Profile', icon: 'tabler-user', path: '/portal/profile' }
  ]

  const currentNavIndex = navItems.findIndex(item => pathname?.includes(item.path))

  return (
    <Box className='min-bs-full flex flex-col'>
      {/* Top AppBar */}
      <AppBar position='static' color='default' elevation={1}>
        <Toolbar className='flex justify-between'>
          <Box className='flex items-center gap-2'>
            <Logo />
            <Typography variant='h6' className='font-semibold hidden sm:block'>
              Nepal Fillings
            </Typography>
          </Box>
          <Box className='flex items-center gap-1'>
            <ModeDropdown />
            <UserDropdown />
          </Box>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth='md' className='flex-1 py-6 pb-20'>
        {children}
      </Container>

      {/* Bottom Navigation */}
      <Paper sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100 }} elevation={3}>
        <BottomNavigation
          showLabels
          value={currentNavIndex >= 0 ? currentNavIndex : 0}
          onChange={(_, newValue) => {
            router.push(getLocalizedUrl(navItems[newValue].path, locale as Locale))
          }}
        >
          {navItems.map(item => (
            <BottomNavigationAction key={item.path} label={item.label} icon={<i className={item.icon} />} />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  )
}

export default PortalLayout
