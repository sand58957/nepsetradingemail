import { NextResponse, type NextRequest } from 'next/server'

// Theme demo pages that were live and indexable: a fake iPhone checkout, a
// card-and-password payment form and a marketplace help article. nginx answers
// these first; this covers requests that reach Node directly.
const GONE = new Set([
  '/front-pages/checkout',
  '/front-pages/payment',
  '/front-pages/help-center/article/how-to-add-product-in-cart'
])

const GONE_PREFIXES = ['/pages/auth/', '/pages/misc/', '/en/pages/auth/', '/en/pages/misc/', '/fr/pages/', '/ar/pages/']

// Sign-in screens: crawlable, never indexed.
const NOINDEX = new Set([
  '/login',
  '/register',
  '/forgot-password',
  '/choose-account',
  '/en/login',
  '/en/register',
  '/en/forgot-password',
  '/en/choose-account'
])

const GONE_BODY =
  '<!doctype html><html lang=en><meta charset=utf-8><meta name=robots content=noindex>' +
  '<title>Page removed | Nepal Fillings</title><h1>This page has been removed</h1>' +
  '<p><a href=/>Nepal Fillings home</a> · <a href=/pricing>Pricing</a> · <a href=/blog>Blog</a></p></html>'

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (GONE.has(pathname) || GONE_PREFIXES.some(prefix => pathname.startsWith(prefix))) {
    return new NextResponse(GONE_BODY, {
      status: 410,
      headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' }
    })
  }

  if (NOINDEX.has(pathname)) {
    const response = NextResponse.next()

    response.headers.set('x-robots-tag', 'noindex, follow')

    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/front-pages/:path*',
    '/pages/:path*',
    '/en/pages/:path*',
    '/fr/pages/:path*',
    '/ar/pages/:path*',
    '/login',
    '/register',
    '/forgot-password',
    '/choose-account',
    '/en/login',
    '/en/register',
    '/en/forgot-password',
    '/en/choose-account'
  ]
}
