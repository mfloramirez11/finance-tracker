import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function POST(req: NextRequest) {
  const authResult = await requireFinanceAuth()
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) {
    return Response.json({ data: null, error: 'Both fields are required' }, { status: 400 })
  }
  if (newPassword.length < 8) {
    return Response.json({ data: null, error: 'New password must be at least 8 characters' }, { status: 400 })
  }

  // Look up the current user
  const users = await sql`
    SELECT id, password_hash FROM users WHERE username = ${authResult.username!}
  `
  if (!users.length) return Response.json({ data: null, error: 'User not found' }, { status: 404 })

  const user = users[0]
  const valid = await bcrypt.compare(currentPassword, user.password_hash as string)
  if (!valid) {
    return Response.json({ data: null, error: 'Current password is incorrect' }, { status: 400 })
  }

  const newHash = await bcrypt.hash(newPassword, 10)
  await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${user.id}`

  return Response.json({ data: 'Password updated', error: null })
}
