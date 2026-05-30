// The product ships English-only content. `fr`/`ar` were Vuexy template
// leftovers with no real translations — shipping them created duplicate-content
// routes with no hreflang. Trimmed to `en` until real localized content exists.
export const i18n = {
  defaultLocale: 'en',
  locales: ['en'],
  langDirection: {
    en: 'ltr'
  }
} as const

export type Locale = (typeof i18n)['locales'][number]
