// Third-party Imports
import CredentialProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { PrismaClient } from '@prisma/client'
import type { NextAuthOptions } from 'next-auth'
import type { Adapter } from 'next-auth/adapters'

const prisma = new PrismaClient()

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as Adapter,

  // ** Configure one or more authentication providers
  // ** Please refer to https://next-auth.js.org/configuration/options#providers for more `providers` options
  providers: [
    CredentialProvider({
      // ** The name to display on the sign in form (e.g. 'Sign in with...')
      // ** For more details on Credentials Provider, visit https://next-auth.js.org/providers/credentials
      name: 'Credentials',
      type: 'credentials',

      /*
       * As we are using our own Sign-in page, we do not need to change
       * username or password attributes manually in following credentials object.
       */
      credentials: {},
      async authorize(credentials) {
        const { email, password } = credentials as { email: string; password: string }

        try {
          // Call Go backend login endpoint directly (server-side, Docker internal network)
          const apiUrl = process.env.API_URL || 'https://nepalfillings.com/api/auth'

          const res = await fetch(`${apiUrl}/login`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
          })

          const data = await res.json()

          if (res.status === 401) {
            throw new Error(JSON.stringify({ message: [data.message || 'Invalid email or password'] }))
          }

          if (res.status === 200 && data.success) {
            // Go backend returns: { success, data: { access_token, refresh_token, user: {...}, account: {...} } }
            const user = data.data.user
            const account = data.data.account

            return {
              id: String(user.id),
              name: user.name,
              email: user.email,
              role: user.role,
              accessToken: data.data.access_token,
              image: '/images/avatars/1.png',
              accountId: account?.id ?? null,
              accountName: account?.name ?? null,
              accountPlan: account?.plan ?? null,
              accountLogoUrl: account?.logo_url ?? null,
              accountDomain: account?.domain ?? null
            }
          }

          return null
        } catch (e: any) {
          throw new Error(e.message)
        }
      }
    }),

    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string
    })

    // ** ...add more providers here
  ],

  // ** Please refer to https://next-auth.js.org/configuration/options#session for more `session` options
  session: {
    /*
     * Choose how you want to save the user session.
     * The default is `jwt`, an encrypted JWT (JWE) stored in the session cookie.
     * If you use an `adapter` however, NextAuth default it to `database` instead.
     * You can still force a JWT session by explicitly defining `jwt`.
     * When using `database`, the session cookie will only contain a `sessionToken` value,
     * which is used to look up the session in the database.
     * If you use a custom credentials provider, user accounts will not be persisted in a database by NextAuth.js (even if one is configured).
     * The option to use JSON Web Tokens for session tokens must be enabled to use a custom credentials provider.
     */
    strategy: 'jwt',

    // ** Seconds - How long until an idle session expires and is no longer valid
    maxAge: 30 * 24 * 60 * 60 // ** 30 days
  },

  // ** Please refer to https://next-auth.js.org/configuration/options#pages for more `pages` options
  pages: {
    signIn: '/login'
  },

  // ** Please refer to https://next-auth.js.org/configuration/options#callbacks for more `callbacks` options
  callbacks: {
    /*
     * While using `jwt` as a strategy, `jwt()` callback will be called before
     * the `session()` callback. So we have to add custom parameters in `token`
     * via `jwt()` callback to make them accessible in the `session()` callback
     */
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.name = user.name
        token.role = user.role
        token.accessToken = user.accessToken
        token.accountId = user.accountId
        token.accountName = user.accountName
        token.accountPlan = user.accountPlan
        token.accountLogoUrl = user.accountLogoUrl
        token.accountDomain = user.accountDomain
      }

      // Handle session update (e.g. after account switch)
      if (trigger === 'update' && session) {
        if (session.accessToken) token.accessToken = session.accessToken
        if (session.accountId !== undefined) token.accountId = session.accountId
        if (session.accountName !== undefined) token.accountName = session.accountName
        if (session.accountPlan !== undefined) token.accountPlan = session.accountPlan
        if (session.accountLogoUrl !== undefined) token.accountLogoUrl = session.accountLogoUrl
        if (session.accountDomain !== undefined) token.accountDomain = session.accountDomain
      }

      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.name = token.name
      }

      session.role = token.role
      session.accessToken = token.accessToken
      session.accountId = token.accountId
      session.accountName = token.accountName
      session.accountPlan = token.accountPlan
      session.accountLogoUrl = token.accountLogoUrl
      session.accountDomain = token.accountDomain

      return session
    }
  }
}
