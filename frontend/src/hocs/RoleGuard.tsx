'use client'

// Third-party Imports
import { useSession } from 'next-auth/react'

// Type Imports
import type { ChildrenType } from '@core/types'

type Props = ChildrenType & {
  allowedRoles: string[]
  fallback?: React.ReactNode
}

/**
 * Client-side component for conditional rendering based on user role.
 * Renders children only if the user's role is in the allowedRoles list.
 */
const RoleGuard = ({ children, allowedRoles, fallback = null }: Props) => {
  const { data: session } = useSession()

  const userRole = session?.role || ''

  if (!allowedRoles.includes(userRole)) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

export default RoleGuard
