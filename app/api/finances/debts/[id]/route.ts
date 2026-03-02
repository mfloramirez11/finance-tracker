import { NextRequest } from 'next/server'
import { sql, rawSql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  const body = await req.json()

  // Special: recalculate current_balance from payment history
  // Uses principal_amount where available (loans), full amount otherwise (0% cards)
  if (body.recalculate_from_history) {
    const payments = await sql`
      SELECT COALESCE(principal_amount, amount) AS effective
      FROM finance_debt_payments
      WHERE debt_id = ${id}
    `
    const totalPrincipal = payments.reduce((s: number, p: any) => s + parseFloat(String(p.effective)), 0)
    const [debtRow] = await sql`SELECT original_balance FROM finance_debts WHERE id = ${id}`
    if (!debtRow) return Response.json({ data: null, error: 'Not found' }, { status: 404 })
    const newBalance = Math.max(0, parseFloat(String(debtRow.original_balance)) - totalPrincipal)
    const [updated] = await sql`
      UPDATE finance_debts SET current_balance = ${newBalance}, updated_at = NOW() WHERE id = ${id} RETURNING *
    `
    return Response.json({ data: updated, error: null })
  }

  const allowed = ['name', 'current_balance', 'original_balance', 'apr', 'min_payment',
    'promo_end_date', 'promo_apr', 'account', 'is_active', 'sort_order', 'notes']
  const updates: string[] = []
  const values: unknown[] = []

  for (const key of allowed) {
    if (key in body) {
      updates.push(key)
      values.push(body[key])
    }
  }

  if (updates.length === 0) {
    return Response.json({ data: null, error: 'No valid fields to update' }, { status: 400 })
  }

  const setClauses = updates.map((key, i) => `${key} = $${i + 2}`).join(', ')
  const queryText = `UPDATE finance_debts SET ${setClauses}, updated_at = NOW() WHERE id = $1 RETURNING *`
  const result = await rawSql(queryText, [id, ...values])

  if (!result.length) return Response.json({ data: null, error: 'Not found' }, { status: 404 })
  return Response.json({ data: result[0], error: null })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  await sql`UPDATE finance_debts SET is_active = false WHERE id = ${id}`
  return Response.json({ data: { id }, error: null })
}
