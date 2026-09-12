'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import useScrollTrigger from '@mui/material/useScrollTrigger'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { Mode } from '@core/types'

// Component Imports
import Logo from '@components/layout/shared/Logo'
import ModeDropdown from '@components/layout/shared/ModeDropdown'
import FrontMenu from './FrontMenu'

// Util Imports
import { frontLayoutClasses } from '@layouts/utils/layoutClasses'

// Styles Imports
import styles from './styles.module.css'

const Header = ({ mode }: { mode: Mode }) => {
  // States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Detect window scroll
  const trigger = useScrollTrigger({
    threshold: 0,
    disableHysteresis: true
  })

  return (
    <header className={classnames(frontLayoutClasses.header, styles.header)}>
      <div className={classnames(frontLayoutClasses.navbar, styles.navbar, { [styles.headerScrolled]: trigger })}>
        <div className={classnames(frontLayoutClasses.navbarContent, styles.navbarContent)}>
          {/* Both layouts are rendered and CSS chooses between them. Branching on
              useMediaQuery instead put the desktop navigation into the HTML sent
              to phones -- six links across a 375px screen, overlapping the logo --
              until hydration replaced it. */}
          <div className='flex items-center gap-2 sm:gap-4 lg:hidden'>
            <IconButton onClick={() => setIsDrawerOpen(true)} className='-mis-2' aria-label='Open navigation menu'>
              <i className='tabler-menu-2 text-textPrimary' />
            </IconButton>
            <Link href='/'>
              <Logo />
            </Link>
          </div>
          <div className='hidden lg:flex items-center gap-10'>
            <Link href='/'>
              <Logo />
            </Link>
            <FrontMenu mode={mode} variant='inline' isDrawerOpen={isDrawerOpen} setIsDrawerOpen={setIsDrawerOpen} />
          </div>
          <FrontMenu mode={mode} variant='drawer' isDrawerOpen={isDrawerOpen} setIsDrawerOpen={setIsDrawerOpen} />
          <div className='flex items-center gap-2 sm:gap-4'>
            <ModeDropdown />
            {/* Mobile used to carry an icon-only Login here and no signup at all,
                so a phone visitor scrolled roughly 4,400px of features, testimonials
                and partners with nothing to sign up with. Signing up is the goal, so
                it gets the words; Login is one tap away in the drawer. */}
            <Button
              component={Link}
              variant='contained'
              href='/en/register'
              color='primary'
              className='lg:hidden'
              sx={{
                borderRadius: '50px',
                fontWeight: 600,
                textTransform: 'none',
                // "Sign up free" measured 106px and overflowed the header bar by
                // 65px at 375px, clipping to "Sign up fre". The hamburger, logo and
                // theme toggle leave roughly 95px here.
                px: 2,
                minInlineSize: 0,
                whiteSpace: 'nowrap'
              }}
            >
              Sign up
            </Button>
            <div className='hidden lg:flex items-center gap-3'>
              <Button
                component={Link}
                variant='outlined'
                href='/en/login'
                color='primary'
                startIcon={<i className='tabler-login text-lg' />}
                sx={{
                  borderRadius: '50px',
                  fontWeight: 600,
                  textTransform: 'none',
                  px: 3,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                    transform: 'translateY(-1px)',
                    boxShadow: '0 4px 12px rgba(var(--mui-palette-primary-mainChannel) / 0.3)'
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                Login
              </Button>
              <Button
                component={Link}
                variant='contained'
                href='/en/register'
                startIcon={<i className='tabler-rocket text-lg' />}
                sx={{
                  borderRadius: '50px',
                  fontWeight: 600,
                  textTransform: 'none',
                  px: 3,
                  // Starts on the darkened brand: the raw #7367F0 end of this gradient
                  // put white text at 4.26:1.
                  background: 'linear-gradient(135deg, #6E63E6 0%, #7c3aed 100%)',
                  boxShadow: '0 4px 15px rgba(var(--mui-palette-primary-mainChannel) / 0.4)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #7c3aed 0%, #6E63E6 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(var(--mui-palette-primary-mainChannel) / 0.5)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                Get started free
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
