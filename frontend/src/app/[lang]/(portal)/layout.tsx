// MUI Imports
import InitColorSchemeScript from '@mui/material/InitColorSchemeScript'

// Third-party Imports
import 'react-perfect-scrollbar/dist/css/styles.css'

// Type Imports
import type { ChildrenType } from '@core/types'
import type { Locale } from '@configs/i18n'

// Component Imports
import Providers from '@components/Providers'
import AuthGuard from '@/hocs/AuthGuard'
import PortalLayout from '@/components/layout/portal/PortalLayout'

// Config Imports
import { i18n } from '@configs/i18n'

// Util Imports
import { getSystemMode } from '@core/utils/serverHelpers'

// Style Imports
import '@/app/globals.css'

// Generated Icon CSS Imports
import '@assets/iconify-icons/generated-icons.css'

const Layout = async (props: ChildrenType & { params: Promise<{ lang: string }> }) => {
  const params = await props.params
  const { children } = props

  const lang: Locale = i18n.locales.includes(params.lang as Locale) ? (params.lang as Locale) : i18n.defaultLocale
  const direction = i18n.langDirection[lang]
  const systemMode = await getSystemMode()

  return (
    <Providers direction={direction}>
      <AuthGuard locale={lang} allowedRoles={['subscriber']}>
        <InitColorSchemeScript attribute='data' defaultMode={systemMode} />
        <PortalLayout>{children}</PortalLayout>
      </AuthGuard>
    </Providers>
  )
}

export default Layout
