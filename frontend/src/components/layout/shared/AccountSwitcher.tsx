'use client'

import { useRef, useState } from 'react'
import type { MouseEvent } from 'react'

import { useParams, useRouter } from 'next/navigation'

import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Popper from '@mui/material/Popper'
import Fade from '@mui/material/Fade'
import Paper from '@mui/material/Paper'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import MenuList from '@mui/material/MenuList'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import Avatar from '@mui/material/Avatar'
import ButtonBase from '@mui/material/ButtonBase'

import { useSession } from 'next-auth/react'

import { useSettings } from '@core/hooks/useSettings'
import { getLocalizedUrl } from '@/utils/i18n'
import type { Locale } from '@/configs/i18n'

const AccountSwitcher = () => {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)

  const router = useRouter()
  const { data: session } = useSession()
  const { settings } = useSettings()
  const { lang: locale } = useParams()

  const accountName = session?.accountName || 'No Account'
  const accountPlan = session?.accountPlan || 'Free'

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const handleToggle = () => setOpen(prev => !prev)

  const handleClose = (event?: MouseEvent<HTMLLIElement> | (MouseEvent | TouchEvent)) => {
    if (anchorRef.current && anchorRef.current.contains(event?.target as HTMLElement)) {
      return
    }

    setOpen(false)
  }

  const handleSwitchAccount = () => {
    setOpen(false)
    router.push(getLocalizedUrl('/choose-account', locale as Locale))
  }

  if (!session?.accountId) return null

  return (
    <>
      <ButtonBase
        ref={anchorRef}
        onClick={handleToggle}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          borderRadius: 1,
          '&:hover': { bgcolor: 'action.hover' }
        }}
      >
        {session?.accountLogoUrl ? (
          <Avatar src={session.accountLogoUrl} sx={{ width: 28, height: 28 }} />
        ) : (
          <Avatar sx={{ width: 28, height: 28, bgcolor: 'primary.main', fontSize: '0.75rem' }}>
            {getInitials(accountName)}
          </Avatar>
        )}
        <Box sx={{ textAlign: 'left', display: { xs: 'none', sm: 'block' } }}>
          <Typography variant='body2' fontWeight={600} lineHeight={1.2} noWrap sx={{ maxWidth: 120 }}>
            {accountName}
          </Typography>
          <Chip label={accountPlan} size='small' variant='tonal' color='success' sx={{ height: 18, fontSize: '0.65rem', mt: 0.25 }} />
        </Box>
        <i className='tabler-chevron-down' style={{ fontSize: 16, opacity: 0.5 }} />
      </ButtonBase>

      <Popper open={open} transition disablePortal placement='bottom-start' anchorEl={anchorRef.current} className='min-is-[200px] !mbs-3 z-[1]'>
        {({ TransitionProps, placement }) => (
          <Fade {...TransitionProps} style={{ transformOrigin: placement === 'bottom-start' ? 'left top' : 'left bottom' }}>
            <Paper className={settings.skin === 'bordered' ? 'border shadow-none' : 'shadow-lg'}>
              <ClickAwayListener onClickAway={e => handleClose(e as MouseEvent | TouchEvent)}>
                <MenuList>
                  <div className='flex items-center plb-2 pli-4 gap-2' tabIndex={-1}>
                    <div>
                      <Typography variant='body2' fontWeight={600}>
                        {accountName}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        Plan: {accountPlan}
                      </Typography>
                    </div>
                  </div>
                  <Divider className='mlb-1' />
                  <MenuItem className='mli-2 gap-3' onClick={handleSwitchAccount}>
                    <i className='tabler-switch-horizontal' />
                    <Typography color='text.primary'>Switch account</Typography>
                  </MenuItem>
                </MenuList>
              </ClickAwayListener>
            </Paper>
          </Fade>
        )}
      </Popper>
    </>
  )
}

export default AccountSwitcher
