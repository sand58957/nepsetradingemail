'use client'

// React Imports
import { useState } from 'react'

// Next Imports
import Link from 'next/link'

// MUI Imports
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import useMediaQuery from '@mui/material/useMediaQuery'
import useScrollTrigger from '@mui/material/useScrollTrigger'
import Chip from '@mui/material/Chip'
import type { Theme } from '@mui/material/styles'

// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { Mode } from '@core/types'

// Component Imports
import Logo from '@components/layout/shared/Logo'
import ModeDropdown from '@components/layout/shared/ModeDropdown'
import FrontMenu from './FrontMenu'
import CustomIconButton from '@core/components/mui/IconButton'

// Util Imports
import { frontLayoutClasses } from '@layouts/utils/layoutClasses'

// Styles Imports
import styles from './styles.module.css'

const Header = ({ mode }: { mode: Mode }) => {
  // States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Hooks
  const isBelowLgScreen = useMediaQuery((theme: Theme) => theme.breakpoints.down('lg'))

  // Detect window scroll
  const trigger = useScrollTrigger({
    threshold: 0,
    disableHysteresis: true
  })

  return (
    <header className={classnames(frontLayoutClasses.header, styles.header)}>
      <div className={classnames(frontLayoutClasses.navbar, styles.navbar, { [styles.headerScrolled]: trigger })}>
        <div className={classnames(frontLayoutClasses.navbarContent, styles.navbarContent)}>
          {isBelowLgScreen ? (
            <div className='flex items-center gap-2 sm:gap-4'>
              <IconButton onClick={() => setIsDrawerOpen(true)} className='-mis-2'>
                <i className='tabler-menu-2 text-textPrimary' />
              </IconButton>
              <Link href='/'>
                <Logo />
              </Link>
              <FrontMenu mode={mode} isDrawerOpen={isDrawerOpen} setIsDrawerOpen={setIsDrawerOpen} />
            </div>
          ) : (
            <div className='flex items-center gap-10'>
              <Link href='/'>
                <Logo />
              </Link>
              <FrontMenu mode={mode} isDrawerOpen={isDrawerOpen} setIsDrawerOpen={setIsDrawerOpen} />
            </div>
          )}
          <div className='flex items-center gap-2 sm:gap-4'>
            <ModeDropdown />
            {isBelowLgScreen ? (
              <CustomIconButton
                component={Link}
                variant='contained'
                href='/en/login'
                color='primary'
              >
                <i className='tabler-login text-xl' />
              </CustomIconButton>
            ) : (
              <div className='flex items-center gap-3'>
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
                    background: 'linear-gradient(135deg, var(--mui-palette-primary-main) 0%, #7c3aed 100%)',
                    boxShadow: '0 4px 15px rgba(var(--mui-palette-primary-mainChannel) / 0.4)',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #7c3aed 0%, var(--mui-palette-primary-main) 100%)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 20px rgba(var(--mui-palette-primary-mainChannel) / 0.5)'
                    },
                    transition: 'all 0.3s ease'
                  }}
                >
                  Get Started Free
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header
