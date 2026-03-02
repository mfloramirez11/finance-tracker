import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params
  const body = await req.json()
  const { amount, payment_date, notes, principal_amount, interest_amount, late_fees, misc_fees } = body

  if (!amount || !payment_date) {
    return Response.json({ data: null, error: 'amount and payment_date are required' }, { status: 400 })
  }

  // Log the payment with optional breakdown
  const payment = await sql`
    INSERT INTO finance_debt_payments (debt_id, payment_date, amount, principal_amount, interest_amount, late_fees, misc_fees, notes)
    VALUES (${id}, ${payment_date}, ${amount}, ${principal_amount ?? null}, ${interest_amount ?? null}, ${late_fees ?? null}, ${misc_fees ?? null}, ${notes ?? null})
    RETURNING *
  `

  // For interest-bearing loans, only the principal reduces the balance.
  // For 0% / credit cards (no principal breakdown), use the full amount.
  const balanceReduction = (principal_amount != null) ? principal_amount : amount
  const debt = await sql`
    UPDATE finance_debts
    SET current_balance = GREATEST(0, current_balance - ${balanceReduction}), updated_at = NOW()
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
