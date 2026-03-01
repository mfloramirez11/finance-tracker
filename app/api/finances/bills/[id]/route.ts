import { NextRequest } from 'next/server'
import { sql, rawSql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  const body = await req.json()

  const allowed = ['name', 'category', 'billing_type', 'default_amount', 'account', 'due_day', 'months_active', 'is_active', 'notes', 'sort_order', 'frequency', 'is_autopay']
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

  const updatedBill = result[0] as Record<string, unknown>

  // When default_amount changes on a Fixed bill, reset the current month's unpaid actual
  // so the monthly view immediately reflects the new default instead of the stale override
  if ('default_amount' in body && updatedBill.billing_type === 'Fixed') {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    await sql`
      UPDATE finance_actuals
      SET amount = NULL, updated_at = NOW()
      WHERE bill_id = ${id}
        AND year = ${year}
        AND month = ${month}
        AND is_paid = false
    `
  }

  return Response.json({ data: updatedBill, error: null })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  await sql`DELETE FROM finance_bills WHERE id = ${id}`
  return Response.json({ data: { id }, error: null })
}
