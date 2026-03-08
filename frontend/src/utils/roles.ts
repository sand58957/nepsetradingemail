// Role constants
export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  SUBSCRIBER: 'subscriber'
} as const

export type UserRole = (typeof ROLES)[keyof typeof ROLES]

// Role check helpers
export const isAdmin = (role: string): boolean => role === ROLES.ADMIN
export const isStaff = (role: string): boolean => role === ROLES.ADMIN || role === ROLES.USER
export const isSubscriber = (role: string): boolean => role === ROLES.SUBSCRIBER
export const hasRole = (role: string, allowedRoles: string[]): boolean => allowedRoles.includes(role)

// Get the appropriate home URL based on user role
export const getHomeUrl = (role: string): string => {
  switch (role) {
    case ROLES.SUBSCRIBER:
      return '/portal'
    case ROLES.ADMIN:
    case ROLES.USER:
    default:
      return '/dashboards/email-marketing'
  }
}

// Role display labels
export const getRoleLabel = (role: string): string => {
  switch (role) {
    case ROLES.ADMIN:
      return 'Admin'
    case ROLES.USER:
      return 'Staff'
    case ROLES.SUBSCRIBER:
      return 'Subscriber'
    default:
      return role
  }
}

// Role colors for MUI chips
export const getRoleColor = (role: string): 'error' | 'primary' | 'success' | 'default' => {
  switch (role) {
    case ROLES.ADMIN:
      return 'error'
    case ROLES.USER:
      return 'primary'
    case ROLES.SUBSCRIBER:
      return 'success'
    default:
      return 'default'
  }
}
