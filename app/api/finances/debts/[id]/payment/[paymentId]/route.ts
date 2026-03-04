import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withTransaction } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const UUIDSchema = z.string().uuid()

const PatchPaymentSchema = z.object({
  amount:           z.number().positive(),
  payment_date:     z.string().regex(DATE_REGEX, 'payment_date must be YYYY-MM-DD'),
  notes:            z.string().max(500).nullable().optional(),
  principal_amount: z.number().nonnegative().nullable().optional(),
  interest_amount:  z.number().nonnegative().nullable().optional(),
  late_fees:        z.number().nonnegative().nullable().optional(),
  misc_fees:        z.number().nonnegative().nullable().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id, paymentId } = await params

  const idParse = UUIDSchema.safeParse(id)
  const pidParse = UUIDSchema.safeParse(paymentId)
  if (!idParse.success || !pidParse.success) {
    return Response.json({ data: null, error: 'Invalid id' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = PatchPaymentSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { amount, payment_date, principal_amount, interest_amount, late_fees, misc_fees, notes } = parsed.data

  const result = await withTransaction(async client => {
    // Get the existing payment to calculate balance delta
    const { rows: existing } = await client.query(
      `SELECT * FROM finance_debt_payments WHERE id = $1 AND debt_id = $2`,
      [paymentId, id]
    )
    if (!existing.length) return null

    // Use principal amounts for the delta when available (interest-bearing loans).
    // Fall back to full amount for 0% / credit card payments with no breakdown.
    const oldEffective = existing[0].principal_amount != null
      ? parseFloat(String(existing[0].principal_amount))
      : parseFloat(String(existing[0].amount))
    const newEffective = principal_amount != null
      ? parseFloat(String(principal_amount))
      : parseFloat(String(amount))
    const balanceDelta = newEffective - oldEffective // positive = more principal = balance decreases more

    // Update the payment record
    const { rows: [payment] } = await client.query(
      `UPDATE finance_debt_payments
       SET amount = $1, payment_date = $2, principal_amount = $3,
           interest_amount = $4, late_fees = $5, misc_fees = $6, notes = $7
       WHERE id = $8 AND debt_id = $9
       RETURNING *`,
      [amount, payment_date, principal_amount ?? null, interest_amount ?? null,
       late_fees ?? null, misc_fees ?? null, notes ?? null, paymentId, id]
    )

    // Adjust debt balance by the difference
    const { rows: [debt] } = await client.query(
      `UPDATE finance_debts
       SET current_balance = GREATEST(0, current_balance - $1), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [balanceDelta, id]
    )

    return { payment, debt }
  })

  if (!result) return Response.json({ data: null, error: 'Not found' }, { status: 404 })
  return Response.json({ data: result, error: null })
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; paymentId: string }> }
) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id, paymentId } = await params

  const idParse = UUIDSchema.safeParse(id)
  const pidParse = UUIDSchema.safeParse(paymentId)
  if (!idParse.success || !pidParse.success) {
    return Response.json({ data: null, error: 'Invalid id' }, { status: 400 })
  }

  const result = await withTransaction(async client => {
    // Get amount before deleting so we can restore the balance
    const { rows: existing } = await client.query(
      `SELECT * FROM finance_debt_payments WHERE id = $1 AND debt_id = $2`,
      [paymentId, id]
    )
    if (!existing.length) return null

    // Restore only what was originally deducted (principal, or full amount for 0% debts)
    const restoreAmount = existing[0].principal_amount != null
      ? parseFloat(String(existing[0].principal_amount))
      : parseFloat(String(existing[0].amount))

    await client.query(`DELETE FROM finance_debt_payments WHERE id = $1`, [paymentId])

    // Restore the balance
    const { rows: [debt] } = await client.query(
      `UPDATE finance_debts
       SET current_balance = current_balance + $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [restoreAmount, id]
    )

    return { id: paymentId, debt }
  })

  if (!result) return Response.json({ data: null, error: 'Not found' }, { status: 404 })
  return Response.json({ data: result, error: null })
}
