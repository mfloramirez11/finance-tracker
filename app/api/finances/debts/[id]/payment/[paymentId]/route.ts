import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id, paymentId } = await params
  const body = await req.json()
  const { amount, payment_date, principal_amount, interest_amount, late_fees, misc_fees, notes } = body

  if (amount == null || isNaN(parseFloat(String(amount)))) {
    return Response.json({ data: null, error: 'amount is required and must be a number' }, { status: 400 })
  }

  // Get the existing payment to calculate balance delta
  const existing = await sql`
    SELECT * FROM finance_debt_payments WHERE id = ${paymentId} AND debt_id = ${id}
  `
  if (!existing.length) return Response.json({ data: null, error: 'Not found' }, { status: 404 })

  // Use principal amounts for the delta when available (interest-bearing loans).
  // Fall back to full amount for 0% / credit card payments with no breakdown.
  const oldEffective = existing[0].principal_amount != null
    ? parseFloat(String(existing[0].principal_amount))
    : parseFloat(String(existing[0].amount))
  const newEffective = (principal_amount != null)
    ? parseFloat(String(principal_amount))
    : parseFloat(String(amount))
  const balanceDelta = newEffective - oldEffective // positive = more principal = balance decreases more

  // Update the payment record
  const payment = await sql`
    UPDATE finance_debt_payments
    SET amount = ${amount},
        payment_date = ${payment_date},
        principal_amount = ${principal_amount ?? null},
        interest_amount = ${interest_amount ?? null},
        late_fees = ${late_fees ?? null},
        misc_fees = ${misc_fees ?? null},
        notes = ${notes ?? null}
    WHERE id = ${paymentId} AND debt_id = ${id}
    RETURNING *
  `

  // Adjust debt balance by the difference
  const debt = await sql`
    UPDATE finance_debts
    SET current_balance = GREATEST(0, current_balance - ${balanceDelta}), updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  return Response.json({ data: { payment: payment[0], debt: debt[0] }, error: null })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id, paymentId } = await params

  // Get amount before deleting so we can restore the balance
  const existing = await sql`
    SELECT * FROM finance_debt_payments WHERE id = ${paymentId} AND debt_id = ${id}
  `
  if (!existing.length) return Response.json({ data: null, error: 'Not found' }, { status: 404 })

  // Restore only what was originally deducted (principal, or full amount for 0% debts)
  const restoreAmount = existing[0].principal_amount != null
    ? parseFloat(String(existing[0].principal_amount))
    : parseFloat(String(existing[0].amount))

  await sql`DELETE FROM finance_debt_payments WHERE id = ${paymentId}`

  // Restore the balance
  const debt = await sql`
    UPDATE finance_debts
    SET current_balance = current_balance + ${restoreAmount}, updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  return Response.json({ data: { id: paymentId, debt: debt[0] }, error: null })
}
