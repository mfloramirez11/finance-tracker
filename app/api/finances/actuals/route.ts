import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import { requireFinanceAuth, unauthorizedResponse } from '@/lib/finances/auth'

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
  const { bill_id, year, month, amount, is_paid, paid_date, notes } = body

  if (!bill_id || !year || !month) {
    return Response.json({ data: null, error: 'bill_id, year, month are required' }, { status: 400 })
  }

  // Look up the bill's linked debt
  const bills = await sql`SELECT debt_id FROM finance_bills WHERE id = ${bill_id}`
  const debtId: string | null = (bills[0]?.debt_id as string) ?? null

  // Look up any existing actual to find a previously auto-created payment
  const existing = await sql`
    SELECT id, linked_debt_payment_id, amount as existing_amount
    FROM finance_actuals
    WHERE bill_id = ${bill_id} AND year = ${year} AND month = ${month}
  `
  const existingActual = existing[0] ?? null
  const existingLinkedPaymentId: string | null = (existingActual?.linked_debt_payment_id as string) ?? null

  let newLinkedPaymentId: string | null = existingLinkedPaymentId
  const paymentAmount = amount ?? 0

  if (debtId) {
    if (is_paid) {
      if (!existingLinkedPaymentId) {
        // First time marking paid — create a payment record and reduce balance
        if (paymentAmount > 0) {
          const effectiveDate = paid_date ?? new Date().toISOString().split('T')[0]
          const [payment] = await sql`
            INSERT INTO finance_debt_payments (debt_id, payment_date, amount, notes)
            VALUES (${debtId}, ${effectiveDate}, ${paymentAmount}, 'Auto-logged from monthly bills')
            RETURNING id
          `
          await sql`
            UPDATE finance_debts
            SET current_balance = GREATEST(0, current_balance - ${paymentAmount}), updated_at = NOW()
            WHERE id = ${debtId}
          `
          newLinkedPaymentId = payment.id as string
        }
      } else {
        // Already have a linked payment — update it if the amount changed
        const [oldPayment] = await sql`
          SELECT amount FROM finance_debt_payments WHERE id = ${existingLinkedPaymentId}
        `
        if (oldPayment && paymentAmount > 0) {
          const oldAmount = parseFloat(oldPayment.amount as string)
          const delta = paymentAmount - oldAmount
          if (delta !== 0) {
            await sql`
              UPDATE finance_debt_payments SET amount = ${paymentAmount} WHERE id = ${existingLinkedPaymentId}
            `
            await sql`
              UPDATE finance_debts
              SET current_balance = GREATEST(0, current_balance - ${delta}), updated_at = NOW()
              WHERE id = ${debtId}
            `
          }
        }
        newLinkedPaymentId = existingLinkedPaymentId
      }
    } else {
      // Marking unpaid — delete linked payment and restore balance
      if (existingLinkedPaymentId) {
        const [deleted] = await sql`
          DELETE FROM finance_debt_payments WHERE id = ${existingLinkedPaymentId} RETURNING amount
        `
        if (deleted) {
          await sql`
            UPDATE finance_debts
            SET current_balance = current_balance + ${parseFloat(deleted.amount as string)}, updated_at = NOW()
            WHERE id = ${debtId}
          `
        }
        newLinkedPaymentId = null
      }
    }
  }

  // Upsert the actual, including the linked payment ID
  const result = await sql`
    INSERT INTO finance_actuals (bill_id, year, month, amount, is_paid, paid_date, notes, linked_debt_payment_id)
    VALUES (${bill_id}, ${year}, ${month}, ${amount ?? null}, ${is_paid ?? false}, ${paid_date ?? null}, ${notes ?? null}, ${newLinkedPaymentId})
    ON CONFLICT (bill_id, year, month) DO UPDATE SET
      amount = EXCLUDED.amount,
      is_paid = EXCLUDED.is_paid,
      paid_date = EXCLUDED.paid_date,
      notes = EXCLUDED.notes,
      linked_debt_payment_id = ${newLinkedPaymentId},
      updated_at = NOW()
    RETURNING *
  `
  return Response.json({ data: result[0], error: null })
}
