import { NextRequest } from 'next/server'
import { sql, rawSql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  const body = await req.json()

  const allowed = ['name', 'type', 'last_four', 'paid_by', 'sort_order']
  const updates: string[] = []
  const values: unknown[] = []

  for (const key of allowed) {
    if (key in body) {
      updates.push(key)
      values.push(body[key])
    }
  }

  if (!updates.length) {
    return Response.json({ data: null, error: 'No valid fields to update' }, { status: 400 })
  }

  const setClauses = updates.map((k, i) => `${k} = $${i + 2}`).join(', ')
  const result = await rawSql(
    `UPDATE finance_accounts SET ${setClauses} WHERE id = $1 RETURNING *`,
    [id, ...values]
  )

  if (!result.length) return Response.json({ data: null, error: 'Not found' }, { status: 404 })
  return Response.json({ data: result[0], error: null })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  await sql`DELETE FROM finance_accounts WHERE id = ${id}`
  return Response.json({ data: { id }, error: null })
}
