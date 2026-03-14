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
        {/* Email Marketing Section — visible to admin + user */}
        <MenuSection label='Email Marketing'>
          <MenuItem href={`/${locale}/dashboards/email-marketing`} icon={<i className='tabler-mail' />}>
            Dashboard
          </MenuItem>
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
<MenuItem href={`/${locale}/media`} icon={<i className='tabler-photo' />}>
            Media
          </MenuItem>
          <SubMenu label='Automations' icon={<i className='tabler-robot' />}>
            <MenuItem href={`/${locale}/automations/list`}>All Automations</MenuItem>
            <MenuItem href={`/${locale}/automations/create`}>Create New</MenuItem>
          </SubMenu>
          <MenuItem href={`/${locale}/dashboards/analytics`} icon={<i className='tabler-chart-bar' />}>
            Analytics
          </MenuItem>
        </MenuSection>

        {/* WhatsApp Marketing Section — visible to admin + user */}
        <MenuSection label='WhatsApp Marketing'>
          <MenuItem href={`/${locale}/whatsapp`} icon={<i className='tabler-brand-whatsapp' />}>
            Dashboard
          </MenuItem>
          <MenuItem href={`/${locale}/whatsapp/contacts`} icon={<i className='tabler-address-book' />}>
            Contacts
          </MenuItem>
          <MenuItem href={`/${locale}/whatsapp/groups`} icon={<i className='tabler-users-group' />}>
            Groups
          </MenuItem>
          <SubMenu label='Campaigns' icon={<i className='tabler-speakerphone' />}>
            <MenuItem href={`/${locale}/whatsapp/campaigns`}>All Campaigns</MenuItem>
            <MenuItem href={`/${locale}/whatsapp/campaigns/create`}>Create New</MenuItem>
          </SubMenu>
          <SubMenu label='Templates' icon={<i className='tabler-template' />}>
            <MenuItem href={`/${locale}/whatsapp/templates`}>My Templates</MenuItem>
            <MenuItem href={`/${locale}/whatsapp/templates/library`}>Template Library</MenuItem>
          </SubMenu>
          <MenuItem href={`/${locale}/whatsapp/analytics`} icon={<i className='tabler-chart-dots-3' />}>
            Analytics
          </MenuItem>
          <MenuItem href={`/${locale}/whatsapp/settings`} icon={<i className='tabler-settings' />}>
            Settings
          </MenuItem>
        </MenuSection>

        {/* SMS Marketing Section */}
        <MenuSection label='SMS Marketing'>
          <MenuItem href={`/${locale}/sms`} icon={<i className='tabler-message' />}>
            Dashboard
          </MenuItem>
          <MenuItem href={`/${locale}/sms/contacts`} icon={<i className='tabler-address-book' />}>
            Contacts
          </MenuItem>
          <MenuItem href={`/${locale}/sms/groups`} icon={<i className='tabler-users-group' />}>
            Groups
          </MenuItem>
          <SubMenu label='Campaigns' icon={<i className='tabler-speakerphone' />}>
            <MenuItem href={`/${locale}/sms/campaigns`}>All Campaigns</MenuItem>
            <MenuItem href={`/${locale}/sms/campaigns/create`}>Create New</MenuItem>
          </SubMenu>
          <MenuItem href={`/${locale}/sms/analytics`} icon={<i className='tabler-chart-dots-3' />}>
            Analytics
          </MenuItem>
          <MenuItem href={`/${locale}/sms/settings`} icon={<i className='tabler-settings' />}>
            Settings
          </MenuItem>
        </MenuSection>

        {/* API Services Section */}
        <MenuSection label='API Services'>
          <MenuItem href={`/${locale}/api-keys`} icon={<i className='tabler-key' />}>
            API Keys & Credits
          </MenuItem>
        </MenuSection>

        {/* Administration section — admin only */}
        {isAdmin && (
          <MenuSection label='Administration'>
            <MenuItem href={`/${locale}/admin/users`} icon={<i className='tabler-users-group' />}>
              User Management
            </MenuItem>
            <MenuItem href={`/${locale}/admin/credits`} icon={<i className='tabler-credit-card' />}>
              API Credit Management
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
