// Next Imports
import { redirect } from 'next/navigation'

// Third-party Imports
import { getServerSession } from 'next-auth'

// Type Imports
import type { Locale } from '@configs/i18n'
import type { ChildrenType } from '@core/types'

// Component Imports
import AuthRedirect from '@/components/AuthRedirect'

// Util Imports
import { getLocalizedUrl } from '@/utils/i18n'
import { authOptions } from '@/libs/auth'

type Props = ChildrenType & {
  locale: Locale
  allowedRoles?: string[]
}

export default async function AuthGuard({ children, locale, allowedRoles }: Props) {
  const session = await getServerSession(authOptions)

  // Not authenticated — redirect to login
  if (!session) {
    return <AuthRedirect lang={locale} />
  }

  // If allowedRoles specified, check role
  if (allowedRoles && allowedRoles.length > 0) {
    const userRole = session.role || ''

    if (!allowedRoles.includes(userRole)) {
      // Subscriber trying to access admin/staff pages → redirect to portal
      if (userRole === 'subscriber') {
        redirect(getLocalizedUrl('/portal', locale))
      }

      // User trying to access admin pages → redirect to 401
      redirect(getLocalizedUrl('/pages/misc/401-not-authorized', locale))
    }
  }

  return <>{children}</>
}
