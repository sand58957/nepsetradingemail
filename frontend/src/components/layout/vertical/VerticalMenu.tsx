// Next Imports
import { useParams } from 'next/navigation'

// MUI Imports
import { useTheme } from '@mui/material/styles'

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar'

// Type Imports
import type { getDictionary } from '@/utils/getDictionary'
import type { VerticalMenuContextProps } from '@menu/components/vertical-menu/Menu'

// Component Imports
import { Menu, SubMenu, MenuItem, MenuSection } from '@menu/vertical-menu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

// Styled Component Imports
import StyledVerticalNavExpandIcon from '@menu/styles/vertical/StyledVerticalNavExpandIcon'

// Style Imports
import menuItemStyles from '@core/styles/vertical/menuItemStyles'
import menuSectionStyles from '@core/styles/vertical/menuSectionStyles'

type RenderExpandIconProps = {
  open?: boolean
  transitionDuration?: VerticalMenuContextProps['transitionDuration']
}

type Props = {
  dictionary: Awaited<ReturnType<typeof getDictionary>>
  scrollMenu: (container: any, isPerfectScrollbar: boolean) => void
  role: string
}

const RenderExpandIcon = ({ open, transitionDuration }: RenderExpandIconProps) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='tabler-chevron-right' />
  </StyledVerticalNavExpandIcon>
)

const VerticalMenu = ({ scrollMenu, role }: Props) => {
  // Hooks
  const theme = useTheme()
  const verticalNavOptions = useVerticalNav()
  const params = useParams()

  // Vars
  const { isBreakpointReached, transitionDuration } = verticalNavOptions
  const { lang: locale } = params
  const isAdmin = role === 'admin'

  const ScrollWrapper = isBreakpointReached ? 'div' : PerfectScrollbar

  return (
    <ScrollWrapper
      {...(isBreakpointReached
        ? {
            className: 'bs-full overflow-y-auto overflow-x-hidden',
            onScroll: container => scrollMenu(container, false)
          }
        : {
            options: { wheelPropagation: false, suppressScrollX: true },
            onScrollY: container => scrollMenu(container, true)
          })}
    >
      <Menu
        popoutMenuOffset={{ mainAxis: 23 }}
        menuItemStyles={menuItemStyles(verticalNavOptions, theme)}
        renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
        renderExpandedMenuItemIcon={{ icon: <i className='tabler-circle text-xs' /> }}
        menuSectionStyles={menuSectionStyles(verticalNavOptions, theme)}
      >
        {/* Dashboard */}
        <MenuItem href={`/${locale}/dashboards/email-marketing`} icon={<i className='tabler-smart-home' />}>
          Dashboard
        </MenuItem>

        {/* Email Marketing Section — visible to admin + user */}
        <MenuSection label='Email Marketing'>
          <SubMenu label='Subscribers' icon={<i className='tabler-users' />}>
            <MenuItem href={`/${locale}/subscribers/list`}>All Subscribers</MenuItem>
            <MenuItem href={`/${locale}/subscribers/import`}>Import</MenuItem>
          </SubMenu>
          <SubMenu label='Campaigns' icon={<i className='tabler-send' />}>
            <MenuItem href={`/${locale}/campaigns/list`}>All Campaigns</MenuItem>
            <MenuItem href={`/${locale}/campaigns/create`}>Create New</MenuItem>
          </SubMenu>
          <MenuItem href={`/${locale}/lists`} icon={<i className='tabler-list' />}>
            Lists
          </MenuItem>
          <MenuItem href={`/${locale}/templates/list`} icon={<i className='tabler-template' />}>
            Templates
          </MenuItem>
          <MenuItem href={`/${locale}/media`} icon={<i className='tabler-photo' />}>
            Media
          </MenuItem>
        </MenuSection>

        {/* Analytics — visible to admin + user */}
        <MenuSection label='Insights'>
          <MenuItem href={`/${locale}/dashboards/analytics`} icon={<i className='tabler-chart-bar' />}>
            Analytics
          </MenuItem>
        </MenuSection>

        {/* Admin-only section */}
        {isAdmin && (
          <MenuSection label='Administration'>
            <MenuItem href={`/${locale}/admin/users`} icon={<i className='tabler-users-group' />}>
              User Management
            </MenuItem>
            <MenuItem href={`/${locale}/settings`} icon={<i className='tabler-settings' />}>
              Settings
            </MenuItem>
          </MenuSection>
        )}
      </Menu>
    </ScrollWrapper>
  )
}

export default VerticalMenu
