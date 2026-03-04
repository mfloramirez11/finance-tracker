import { NextRequest } from 'next/server'
import { z } from 'zod'
import { sql, withTransaction } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const UUIDSchema = z.string().uuid()

const CreatePaymentSchema = z.object({
  amount:           z.number().positive(),
  payment_date:     z.string().regex(DATE_REGEX, 'payment_date must be YYYY-MM-DD'),
  notes:            z.string().max(500).nullable().optional(),
  principal_amount: z.number().nonnegative().nullable().optional(),
  interest_amount:  z.number().nonnegative().nullable().optional(),
  late_fees:        z.number().nonnegative().nullable().optional(),
  misc_fees:        z.number().nonnegative().nullable().optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const { id } = await params

  const idParse = UUIDSchema.safeParse(id)
  if (!idParse.success) {
    return Response.json({ data: null, error: 'Invalid debt id' }, { status: 400 })
  }

  const body = await req.json()
  const parsed = CreatePaymentSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { amount, payment_date, notes, principal_amount, interest_amount, late_fees, misc_fees } = parsed.data

  // For interest-bearing loans, only the principal reduces the balance.
  // For 0% / credit cards (no principal breakdown), use the full amount.
  const balanceReduction = principal_amount != null ? principal_amount : amount

  const result = await withTransaction(async client => {
    const { rows: [payment] } = await client.query(
      `INSERT INTO finance_debt_payments
         (debt_id, payment_date, amount, principal_amount, interest_amount, late_fees, misc_fees, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [id, payment_date, amount, principal_amount ?? null, interest_amount ?? null, late_fees ?? null, misc_fees ?? null, notes ?? null]
    )
    const { rows: [debt] } = await client.query(
      `UPDATE finance_debts
       SET current_balance = GREATEST(0, current_balance - $1), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [balanceReduction, id]
    )
    return { payment, debt }
  })

  return Response.json({ data: result, error: null })
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
