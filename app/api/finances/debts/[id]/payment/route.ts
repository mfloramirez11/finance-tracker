import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  const body = await req.json()
  const { amount, payment_date, notes } = body

  if (!amount || !payment_date) {
    return Response.json({ data: null, error: 'amount and payment_date are required' }, { status: 400 })
  }

  // Log the payment
  const payment = await sql`
    INSERT INTO finance_debt_payments (debt_id, payment_date, amount, notes)
    VALUES (${id}, ${payment_date}, ${amount}, ${notes ?? null})
    RETURNING *
  `

  // Reduce the balance
  const debt = await sql`
    UPDATE finance_debts
    SET current_balance = GREATEST(0, current_balance - ${amount}), updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  return Response.json({ data: { payment: payment[0], debt: debt[0] }, error: null })
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth()
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  const payments = await sql`
    SELECT * FROM finance_debt_payments
    WHERE debt_id = ${id}
    ORDER BY payment_date DESC
  `
  return Response.json({ data: payments, error: null })
}
