import { NextRequest } from 'next/server'
import { sql, rawSql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  const body = await req.json()

  const allowed = ['name', 'category', 'billing_type', 'default_amount', 'account', 'due_day', 'months_active', 'is_active', 'notes', 'sort_order']
  const updates: string[] = []
  const values: any[] = []

  for (const key of allowed) {
    if (key in body) {
      updates.push(key)
      values.push(body[key])
    }
  }

  if (updates.length === 0) {
    return Response.json({ data: null, error: 'No valid fields to update' }, { status: 400 })
  }

  // Build dynamic update query
  const setClauses = updates.map((key, i) => `${key} = $${i + 2}`).join(', ')
  const queryText = `UPDATE finance_bills SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`
  const result = await rawSql(queryText, [id, ...values])

  if (!result.length) return Response.json({ data: null, error: 'Not found' }, { status: 404 })
  return Response.json({ data: result[0], error: null })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  await sql`DELETE FROM finance_bills WHERE id = ${id}`
  return Response.json({ data: { id }, error: null })
}
