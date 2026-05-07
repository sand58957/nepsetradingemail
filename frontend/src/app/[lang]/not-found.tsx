// Component Imports
import Providers from '@components/Providers'
import BlankLayout from '@layouts/BlankLayout'
import NotFound from '@views/NotFound'

// Util Imports
import { getServerMode, getSystemMode } from '@core/utils/serverHelpers'

/**
 * Renders when any segment under /[lang]/* calls `notFound()` (e.g. our
 * [...not-found]/page.tsx catch-all). Next.js automatically returns HTTP 404
 * for this boundary, so unknown URLs no longer produce soft-404s.
 */
const NotFoundBoundary = async () => {
  const mode = await getServerMode()
  const systemMode = await getSystemMode()

  return (
    <Providers direction='ltr'>
      <BlankLayout systemMode={systemMode}>
        <NotFound mode={mode} />
      </BlankLayout>
    </Providers>
  )
}

export default NotFoundBoundary
