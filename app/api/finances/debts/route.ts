import { NextRequest } from 'next/server'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

const CreateDebtSchema = z.object({
  name:             z.string().min(1).max(100),
  current_balance:  z.number().nonnegative(),
  original_balance: z.number().nonnegative().nullable().optional(),
  apr:              z.number().min(0).max(100).nullable().optional(),
  min_payment:      z.number().nonnegative().nullable().optional(),
  promo_end_date:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'promo_end_date must be YYYY-MM-DD').nullable().optional(),
  promo_apr:        z.number().min(0).max(100).nullable().optional(),
  account:          z.string().max(100).nullable().optional(),
  notes:            z.string().max(500).nullable().optional(),
})

export async function GET(req: NextRequest) {
  const authResult = await requireFinanceAuth()
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const debts = await sql`
    SELECT
      d.*,
      COALESCE(
        (SELECT SUM(COALESCE(principal_amount, amount)) FROM finance_debt_payments WHERE debt_id = d.id),
        0
      ) as total_paid
    FROM finance_debts d
    WHERE d.is_active = true
    ORDER BY d.sort_order, d.name
  `

  const payments = await sql`
    SELECT * FROM finance_debt_payments ORDER BY payment_date DESC LIMIT 50
  `

  const totalDebt = debts.reduce((s: number, d: any) => s + parseFloat(d.current_balance), 0)
  const totalMinPayment = debts.reduce((s: number, d: any) => s + parseFloat(d.min_payment ?? 0), 0)

  return Response.json({
    data: { debts, payments, totalDebt, totalMinPayment },
    error: null,
  })
}

export async function POST(req: NextRequest) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const body = await req.json()
  const parsed = CreateDebtSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ data: null, error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const { name, current_balance, original_balance, apr, min_payment, promo_end_date, promo_apr, account, notes } = parsed.data

  const result = await sql`
    INSERT INTO finance_debts (name, current_balance, original_balance, apr, min_payment, promo_end_date, promo_apr, account, notes)
    VALUES (
      ${name}, ${current_balance}, ${original_balance ?? current_balance},
      ${apr ?? 0}, ${min_payment ?? null}, ${promo_end_date ?? null},
      ${promo_apr ?? null}, ${account ?? null}, ${notes ?? null}
    )
    RETURNING *
  `
  return Response.json({ data: result[0], error: null }, { status: 201 })
}
