import { NextRequest } from 'next/server'
import { z } from 'zod'
import { sql, withTransaction } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

const UpsertActualSchema = z.object({
  bill_id: z.string().uuid('bill_id must be a valid UUID'),
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  amount: z.number().nonnegative().nullable().optional(),
  is_paid: z.boolean().optional(),
  paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

// GET /api/finances/actuals?year=2026&month=2
export async function GET(req: NextRequest) {
  const authResult = await requireFinanceAuth()
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const url = new URL(req.url)
  const year = parseInt(url.searchParams.get('year') ?? String(new Date().getFullYear()))
  const month = parseInt(url.searchParams.get('month') ?? String(new Date().getMonth() + 1))

  const rows = await sql`
    SELECT
      b.id as bill_id, b.name, b.category, b.billing_type, b.default_amount,
      b.account, b.due_day, b.months_active, b.sort_order, b.notes as bill_notes,
      b.frequency, b.is_autopay, b.owner, b.debt_id,
      a.id as actual_id, a.amount as actual_amount, a.is_paid, a.paid_date,
      a.notes as actual_notes, a.linked_debt_payment_id
    FROM finance_bills b
    LEFT JOIN finance_actuals a ON a.bill_id = b.id AND a.year = ${year} AND a.month = ${month}
    WHERE b.is_active = true
      AND (b.months_active IS NULL OR ${month} = ANY(b.months_active))
    ORDER BY b.sort_order, b.name
  `

  return Response.json({ data: rows, error: null })
}

// POST /api/finances/actuals — upsert a monthly actual, auto-linking debt payments
export async function POST(req: NextRequest) {
  const authResult = await requireFinanceAuth(true)
  if (!authResult.authorized) return unauthorizedResponse(authResult.reason!)

  const body = await req.json()
  const parse = UpsertActualSchema.safeParse(body)
  if (!parse.success) {
    const msg = parse.error.issues[0]?.message ?? 'Invalid request body'
    return Response.json({ data: null, error: msg }, { status: 400 })
  }
  const { bill_id, year, month, amount, is_paid, paid_date, notes } = parse.data

  // Read-only lookups — outside the transaction for efficiency
  const bills = await sql`SELECT debt_id FROM finance_bills WHERE id = ${bill_id}`
  const debtId: string | null = (bills[0]?.debt_id as string) ?? null

  const existing = await sql`
    SELECT id, linked_debt_payment_id, amount as existing_amount
    FROM finance_actuals
    WHERE bill_id = ${bill_id} AND year = ${year} AND month = ${month}
  `
  const existingActual = existing[0] ?? null
  const existingLinkedPaymentId: string | null = (existingActual?.linked_debt_payment_id as string) ?? null
  const paymentAmount = amount ?? 0

  // All writes are wrapped in a single DB transaction — rolls back atomically on any error
  try {
    const actual = await withTransaction(async (client) => {
      let newLinkedPaymentId: string | null = existingLinkedPaymentId

      if (debtId) {
        if (is_paid) {
          if (!existingLinkedPaymentId) {
            // First time marking paid — create payment record and reduce balance
            if (paymentAmount > 0) {
              const effectiveDate = paid_date ?? new Date().toISOString().split('T')[0]
              const { rows: [payment] } = await client.query(
                `INSERT INTO finance_debt_payments (debt_id, payment_date, amount, notes)
                 VALUES ($1, $2, $3, 'Auto-logged from monthly bills')
                 RETURNING id`,
                [debtId, effectiveDate, paymentAmount]
              )
              await client.query(
                `UPDATE finance_debts
                 SET current_balance = GREATEST(0, current_balance - $1), updated_at = NOW()
                 WHERE id = $2`,
                [paymentAmount, debtId]
              )
              newLinkedPaymentId = payment.id as string
            }
          } else {
            // Already have a linked payment — update if amount changed
            const { rows: [oldPayment] } = await client.query(
              `SELECT amount FROM finance_debt_payments WHERE id = $1`,
              [existingLinkedPaymentId]
            )
            if (oldPayment && paymentAmount > 0) {
              const oldAmount = parseFloat(oldPayment.amount as string)
              const delta = paymentAmount - oldAmount
              if (delta !== 0) {
                await client.query(
                  `UPDATE finance_debt_payments SET amount = $1 WHERE id = $2`,
                  [paymentAmount, existingLinkedPaymentId]
                )
                await client.query(
                  `UPDATE finance_debts
                   SET current_balance = GREATEST(0, current_balance - $1), updated_at = NOW()
                   WHERE id = $2`,
                  [delta, debtId]
                )
              }
            }
            newLinkedPaymentId = existingLinkedPaymentId
          }
        } else {
          // Marking unpaid — delete linked payment and restore balance
          if (existingLinkedPaymentId) {
            const { rows: [deleted] } = await client.query(
              `DELETE FROM finance_debt_payments WHERE id = $1 RETURNING amount`,
              [existingLinkedPaymentId]
            )
            if (deleted) {
              await client.query(
                `UPDATE finance_debts
                 SET current_balance = current_balance + $1, updated_at = NOW()
                 WHERE id = $2`,
                [parseFloat(deleted.amount as string), debtId]
              )
            }
            newLinkedPaymentId = null
          }
        }
      }

      // Upsert the actual including the linked payment ID
      const { rows: [upserted] } = await client.query(
        `INSERT INTO finance_actuals (bill_id, year, month, amount, is_paid, paid_date, notes, linked_debt_payment_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (bill_id, year, month) DO UPDATE SET
           amount = EXCLUDED.amount,
           is_paid = EXCLUDED.is_paid,
           paid_date = EXCLUDED.paid_date,
           notes = EXCLUDED.notes,
           linked_debt_payment_id = $8,
           updated_at = NOW()
         RETURNING *`,
        [bill_id, year, month, amount ?? null, is_paid ?? false, paid_date ?? null, notes ?? null, newLinkedPaymentId]
      )
      return upserted
    })

    return Response.json({ data: actual, error: null })
  } catch (err) {
    console.error('[actuals POST] transaction failed:', err)
    return Response.json({ data: null, error: 'Internal server error' }, { status: 500 })
  }
}
