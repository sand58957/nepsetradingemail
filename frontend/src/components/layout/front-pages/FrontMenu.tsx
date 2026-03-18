'use client'

// React Imports
import { useEffect } from 'react'

// Next Imports
import { usePathname } from 'next/navigation'
import Link from 'next/link'

// MUI Imports
import Typography from '@mui/material/Typography'
import Drawer from '@mui/material/Drawer'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Theme } from '@mui/material/styles'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { Mode } from '@core/types'

// Hook Imports
import { useIntersection } from '@/hooks/useIntersection'

type Props = {
  mode: Mode
  isDrawerOpen: boolean
  setIsDrawerOpen: (open: boolean) => void
}

type WrapperProps = {
  children: React.ReactNode
  isBelowLgScreen: boolean
  className?: string
  isDrawerOpen: boolean
  setIsDrawerOpen: (open: boolean) => void
}

const Wrapper = (props: WrapperProps) => {
  // Props
  const { children, isBelowLgScreen, className, isDrawerOpen, setIsDrawerOpen } = props

  if (isBelowLgScreen) {
    return (
      <Drawer
        variant='temporary'
        anchor='left'
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        ModalProps={{
          keepMounted: true
        }}
        sx={{ '& .MuiDrawer-paper': { width: ['100%', 300] } }}
        className={classnames('p-5', className)}
      >
        <div className='p-4 flex flex-col gap-x-3'>
          <IconButton onClick={() => setIsDrawerOpen(false)} className='absolute inline-end-4 block-start-2'>
            <i className='tabler-x' />
          </IconButton>
          {children}
        </div>
      </Drawer>
    )
  }

  return <div className={classnames('flex items-center flex-wrap gap-x-1 gap-y-3', className)}>{children}</div>
}

const menuItems = [
  { label: 'Home', href: '/front-pages/landing-page', icon: 'tabler-home', section: null },
  { label: 'Features', href: '/front-pages/landing-page#features', icon: 'tabler-sparkles', section: 'features' },
  { label: 'Pricing', href: '/front-pages/landing-page#pricing-plans', icon: 'tabler-currency-dollar', section: 'pricing-plans' },
  { label: 'FAQ', href: '/front-pages/landing-page#faq', icon: 'tabler-help-circle', section: 'faq' },
  { label: 'Contact', href: '/front-pages/landing-page#contact-us', icon: 'tabler-mail', section: 'contact-us' }
]

const FrontMenu = (props: Props) => {
  // Props
  const { isDrawerOpen, setIsDrawerOpen, mode } = props

  // Hooks
  const pathname = usePathname()
  const isBelowLgScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'))
  const { intersections } = useIntersection()

  useEffect(() => {
    if (!isBelowLgScreen && isDrawerOpen) {
      setIsDrawerOpen(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBelowLgScreen])

  const isActive = (item: (typeof menuItems)[0]) => {
    if (item.section) {
      return intersections[item.section]
    }

    return (
      !intersections.features &&
      !intersections['pricing-plans'] &&
      !intersections.faq &&
      !intersections['contact-us'] &&
      pathname === '/front-pages/landing-page'
    )
  }

  return (
    <Wrapper isBelowLgScreen={isBelowLgScreen} isDrawerOpen={isDrawerOpen} setIsDrawerOpen={setIsDrawerOpen}>
      {menuItems.map(item => (
        <Box
          key={item.label}
          component={Link}
          href={item.href}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
            px: 2,
            py: 0.75,
            borderRadius: '50px',
            textDecoration: 'none',
            fontWeight: 500,
            fontSize: '0.9rem',
            color: isActive(item) ? 'primary.main' : 'text.primary',
            backgroundColor: isActive(item)
              ? 'rgba(var(--mui-palette-primary-mainChannel) / 0.08)'
              : 'transparent',
            transition: 'all 0.2s ease',
            '&:hover': {
              color: 'primary.main',
              backgroundColor: 'rgba(var(--mui-palette-primary-mainChannel) / 0.08)',
              transform: 'translateY(-1px)'
            }
          }}
        >
          <i className={classnames(item.icon, 'text-[1.1rem]')} />
          {item.label}
        </Box>
      ))}
    </Wrapper>
  )
}

export default FrontMenu
