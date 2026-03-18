// Third-party Imports
import CredentialProvider from 'next-auth/providers/credentials'
import type { NextAuthOptions } from 'next-auth'

export const authOptions: NextAuthOptions = {
  // ** Configure authentication providers
  providers: [
    // Email + Password login
    CredentialProvider({
      id: 'credentials',
      name: 'Credentials',
      type: 'credentials',
      credentials: {},
      async authorize(credentials) {
        const { email, password } = credentials as { email: string; password: string }

        try {
          const apiUrl = process.env.API_URL || 'https://nepalfillings.com/api/auth'

          const res = await fetch(`${apiUrl}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          })

          const data = await res.json()

          if (res.status === 401) {
            throw new Error(JSON.stringify({ message: [data.message || 'Invalid email or password'] }))
          }

          if (res.status === 200 && data.success) {
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

    // Google OAuth (via backend token verification)
    CredentialProvider({
      id: 'google-auth',
      name: 'Google',
      type: 'credentials',
      credentials: {},
      async authorize(credentials) {
        const { idToken } = credentials as { idToken: string }

        try {
          const apiUrl = process.env.API_URL || 'https://nepalfillings.com/api/auth'

          const res = await fetch(`${apiUrl}/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_token: idToken })
          })

          const data = await res.json()

          if (!res.ok || !data.success) {
            throw new Error(JSON.stringify({ message: [data.message || 'Google authentication failed'] }))
          }

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
        } catch (e: any) {
          throw new Error(e.message)
        }
      }
    }),

    // OTP Verification (SMS or WhatsApp)
    CredentialProvider({
      id: 'otp-verify',
      name: 'OTP',
      type: 'credentials',
      credentials: {},
      async authorize(credentials) {
        const { phone, code, channel } = credentials as { phone: string; code: string; channel: string }

        try {
          const apiUrl = process.env.API_URL || 'https://nepalfillings.com/api/auth'

          const res = await fetch(`${apiUrl}/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, code, channel })
          })

          const data = await res.json()

          if (!res.ok || !data.success) {
            throw new Error(JSON.stringify({ message: [data.message || 'OTP verification failed'] }))
          }

          const user = data.data.user
          const account = data.data.account

          return {
            id: String(user.id),
            name: user.name,
            email: user.email || '',
            role: user.role,
            accessToken: data.data.access_token,
            image: '/images/avatars/1.png',
            accountId: account?.id ?? null,
            accountName: account?.name ?? null,
            accountPlan: account?.plan ?? null,
            accountLogoUrl: account?.logo_url ?? null,
            accountDomain: account?.domain ?? null
          }
        } catch (e: any) {
          throw new Error(e.message)
        }
      }
    })
  ],

  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60 // 30 days
  },

  pages: {
    signIn: '/login'
  },

  callbacks: {
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
