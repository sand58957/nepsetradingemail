'use client'

// React Imports
import { useEffect } from 'react'

// Next Imports
import { usePathname } from 'next/navigation'
import Link from 'next/link'

// MUI Imports
import Drawer from '@mui/material/Drawer'
import useMediaQuery from '@mui/material/useMediaQuery'
import type { Theme } from '@mui/material/styles'
import IconButton from '@mui/material/IconButton'
import Box from '@mui/material/Box'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { Mode } from '@core/types'

// Hook Imports
import { useIntersection } from '@/hooks/useIntersection'

type Props = {
  mode: Mode

  /**
   * Which presentation to render. The caller decides, rather than this component
   * measuring the viewport: useMediaQuery cannot run on the server, so it
   * returned false during SSR and every phone received the desktop navigation in
   * its HTML — six links laid out across a 375px screen, on top of the logo,
   * until hydration swapped them for the hamburger. The header now renders both
   * and lets CSS pick, so the first paint is already correct.
   */
  variant: 'inline' | 'drawer'
  isDrawerOpen: boolean
  setIsDrawerOpen: (open: boolean) => void
}

const menuItems = [
  { label: 'Home', href: '/', icon: 'tabler-home', section: null },
  { label: 'Features', href: '/#features', icon: 'tabler-sparkles', section: 'features' },
  { label: 'Pricing', href: '/#pricing-plans', icon: 'tabler-currency-dollar', section: 'pricing-plans' },
  { label: 'FAQ', href: '/#faq', icon: 'tabler-help-circle', section: 'faq' },
  { label: 'Contact', href: '/#contact-us', icon: 'tabler-mail', section: 'contact-us' },
  { label: 'Blog', href: '/blog', icon: 'tabler-article', section: null }
]

const FrontMenu = (props: Props) => {
  // Props
  const { variant, isDrawerOpen, setIsDrawerOpen } = props

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
    if (item.label === 'Blog') {
      return pathname.startsWith('/blog')
    }

    if (item.section) {
      return intersections[item.section]
    }

    return (
      !intersections.features &&
      !intersections['pricing-plans'] &&
      !intersections.faq &&
      !intersections['contact-us'] &&
      pathname === '/'
    )
  }

  const items = (
    <>
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
            backgroundColor: isActive(item) ? 'rgba(var(--mui-palette-primary-mainChannel) / 0.08)' : 'transparent',
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
    </>
  )

  if (variant === 'drawer') {
    return (
      <Drawer
        variant='temporary'
        anchor='left'
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        // Not keepMounted: the inline nav above is already in the DOM at every
        // width, so mounting these links again would duplicate the whole menu.
        ModalProps={{ keepMounted: false }}
        sx={{ '& .MuiDrawer-paper': { width: ['100%', 300] } }}
        className='p-5'
      >
        <div className='p-4 flex flex-col gap-x-3'>
          <IconButton
            onClick={() => setIsDrawerOpen(false)}
            aria-label='Close navigation menu'
            className='absolute inline-end-4 block-start-2'
          >
            <i className='tabler-x' />
          </IconButton>
          {items}
        </div>
      </Drawer>
    )
  }

  return <div className='flex items-center flex-wrap gap-x-1 gap-y-3'>{items}</div>
}

export default FrontMenu
