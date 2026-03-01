import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function GET(req: NextRequest) {
  const authResult = await requireFinanceAuth()
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const settings = await sql`SELECT * FROM finance_settings ORDER BY key`
  return Response.json({ data: settings, error: null })
}

export async function POST(req: NextRequest) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const body = await req.json()
  const updates: { key: string; value: string; label?: string }[] = Array.isArray(body) ? body : [body]

  const results = []
  for (const { key, value, label } of updates) {
    if (!key || value === undefined) continue
    const result = await sql`
      INSERT INTO finance_settings (key, value, label)
      VALUES (${key}, ${String(value)}, ${label ?? null})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      RETURNING *
    `
    results.push(result[0])
  }

  return Response.json({ data: results, error: null })
}
