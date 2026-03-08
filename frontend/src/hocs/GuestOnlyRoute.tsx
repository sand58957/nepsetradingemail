// Next Imports
import { redirect } from 'next/navigation'

// Third-party Imports
import { getServerSession } from 'next-auth'

// Type Imports
import type { ChildrenType } from '@core/types'
import type { Locale } from '@configs/i18n'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'
import { getHomeUrl } from '@/utils/roles'
import { authOptions } from '@/libs/auth'

const GuestOnlyRoute = async ({ children, lang }: ChildrenType & { lang: Locale }) => {
  const session = await getServerSession(authOptions)

  if (session) {
    // Redirect to role-appropriate home page
    const homeUrl = getHomeUrl(session.role || 'subscriber')

    redirect(getLocalizedUrl(homeUrl, lang))
  }

  return <>{children}</>
}

export default GuestOnlyRoute
