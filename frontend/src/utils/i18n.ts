// Config Imports
import { i18n } from '@configs/i18n'

// Util Imports
import { ensurePrefix } from '@/utils/string'

// Check if the url is missing the locale
export const isUrlMissingLocale = (url: string) => {
  return i18n.locales.every(locale => !(url.startsWith(`/${locale}/`) || url === `/${locale}`))
}

// Get the localized url
export const getLocalizedUrl = (url: string, languageCode: string): string => {
  if (!url || !languageCode) throw new Error("URL or Language Code can't be empty")

  // For default locale (en), don't add prefix - rewrites handle it
  if (languageCode === i18n.defaultLocale) {
    // Strip existing /en prefix if present
    if (url.startsWith(`/${i18n.defaultLocale}/`)) {
      return url.slice(3)
    }

    if (url === `/${i18n.defaultLocale}`) {
      return '/'
    }

    return ensurePrefix(url, '/')
  }

  return isUrlMissingLocale(url) ? `/${languageCode}${ensurePrefix(url, '/')}` : url
}
