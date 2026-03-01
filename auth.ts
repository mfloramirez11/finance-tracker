import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { sql } from '@/lib/db'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null

        const users = await sql`
          SELECT id, username, password_hash, role
          FROM users
          WHERE username = ${credentials.username as string}
          LIMIT 1
        `

        if (users.length === 0) return null

        const user = users[0]
        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password_hash as string
        )

        if (!isValid) return null

        return {
          id: String(user.id),
          name: user.username as string,
          email: user.username as string,
          role: user.role as string,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role
        token.id = user.id
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as any).role = token.role
        ;(session.user as any).id = token.id
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
})
