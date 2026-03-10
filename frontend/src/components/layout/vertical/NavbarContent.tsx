// Third-party Imports
import classnames from 'classnames'

// Type Imports
import type { ShortcutsType } from '@components/layout/shared/ShortcutsDropdown'
import type { NotificationsType } from '@components/layout/shared/NotificationsDropdown'

// Component Imports
import NavToggle from './NavToggle'
import NavSearch from '@components/layout/shared/search'
import AccountSwitcher from '@components/layout/shared/AccountSwitcher'
import ModeDropdown from '@components/layout/shared/ModeDropdown'
import ShortcutsDropdown from '@components/layout/shared/ShortcutsDropdown'
import NotificationsDropdown from '@components/layout/shared/NotificationsDropdown'
import UserDropdown from '@components/layout/shared/UserDropdown'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

// Vars
const shortcuts: ShortcutsType[] = [
  {
    url: '/dashboards/email-marketing',
    icon: 'tabler-device-desktop-analytics',
    title: 'Dashboard',
    subtitle: 'Email Marketing'
  },
  {
    url: '/campaigns/list',
    icon: 'tabler-send',
    title: 'Campaigns',
    subtitle: 'Manage Campaigns'
  },
  {
    url: '/subscribers/list',
    icon: 'tabler-users',
    title: 'Subscribers',
    subtitle: 'Manage Subscribers'
  },
  {
    url: '/dashboards/analytics',
    icon: 'tabler-chart-bar',
    title: 'Analytics',
    subtitle: 'View Reports'
  }
]

const notifications: NotificationsType[] = []

const NavbarContent = () => {
  return (
    <div className={classnames(verticalLayoutClasses.navbarContent, 'flex items-center justify-between gap-4 is-full')}>
      <div className='flex items-center gap-4'>
        <NavToggle />
        <AccountSwitcher />
        <NavSearch />
      </div>
      <div className='flex items-center'>
        <ModeDropdown />
        <ShortcutsDropdown shortcuts={shortcuts} />
        <NotificationsDropdown notifications={notifications} />
        <UserDropdown />
      </div>
    </div>
  )
}

export default NavbarContent
