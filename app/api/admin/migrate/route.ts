import { NextRequest } from 'next/server'
import { sql } from '@/lib/db'
import bcrypt from 'bcryptjs'

// One-time setup endpoint — protected by a secret token
// Call: POST /api/admin/migrate with header X-Setup-Token: <SETUP_TOKEN>
export async function POST(req: NextRequest) {
  const token = req.headers.get('x-setup-token')
  if (!token || token !== process.env.SETUP_TOKEN) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    // Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'viewer',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // finance_bills
    await sql`
      CREATE TABLE IF NOT EXISTS finance_bills (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        billing_type TEXT NOT NULL,
        default_amount NUMERIC(10,2),
        account TEXT,
        due_day TEXT,
        months_active INTEGER[],
        is_active BOOLEAN DEFAULT true,
        notes TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // finance_actuals
    await sql`
      CREATE TABLE IF NOT EXISTS finance_actuals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bill_id UUID REFERENCES finance_bills(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        amount NUMERIC(10,2),
        is_paid BOOLEAN DEFAULT false,
        paid_date DATE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(bill_id, year, month)
      )
    `

    // finance_annual_items
    await sql`
      CREATE TABLE IF NOT EXISTS finance_annual_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        amount NUMERIC(10,2) NOT NULL,
        due_date DATE NOT NULL,
        account TEXT,
        is_paid BOOLEAN DEFAULT false,
        paid_date DATE,
        year INTEGER NOT NULL,
        notes TEXT,
        is_critical BOOLEAN DEFAULT false,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // finance_debts
    await sql`
      CREATE TABLE IF NOT EXISTS finance_debts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        current_balance NUMERIC(10,2) NOT NULL,
        original_balance NUMERIC(10,2),
        apr NUMERIC(6,4) DEFAULT 0,
        min_payment NUMERIC(10,2),
        promo_end_date DATE,
        promo_apr NUMERIC(6,4),
        account TEXT,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // finance_debt_payments
    await sql`
      CREATE TABLE IF NOT EXISTS finance_debt_payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        debt_id UUID REFERENCES finance_debts(id) ON DELETE CASCADE,
        payment_date DATE NOT NULL,
        amount NUMERIC(10,2) NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // finance_bill_history
    await sql`
      CREATE TABLE IF NOT EXISTS finance_bill_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        bill_id UUID REFERENCES finance_bills(id) ON DELETE SET NULL,
        change_date DATE NOT NULL,
        category TEXT,
        bill_name TEXT NOT NULL,
        old_provider TEXT,
        old_amount NUMERIC(10,2),
        new_provider TEXT,
        new_amount NUMERIC(10,2),
        reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // finance_settings
    await sql`
      CREATE TABLE IF NOT EXISTS finance_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        label TEXT,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    // Seed settings
    await sql`
      INSERT INTO finance_settings (key, value, label) VALUES
        ('biweekly_net_pay', '4442.96', 'Bi-weekly Net Pay'),
        ('pay_periods_per_year', '26', 'Pay Periods Per Year'),
        ('emergency_fund_target', '50000', 'Emergency Fund Target'),
        ('emergency_fund_current', '0', 'Emergency Fund Current Balance'),
        ('bofa_deadline', '2026-08-28', 'BofA 0% Promo Deadline')
      ON CONFLICT (key) DO NOTHING
    `

    // Seed bills (due_day stored as plain number string for proper sorting)
    await sql`
      INSERT INTO finance_bills (name, category, billing_type, default_amount, account, due_day, months_active, sort_order) VALUES
        ('Mortgage', 'Housing', 'Fixed', 4244.82, 'Robinhood [GC]', '1', NULL, 1),
        ('Toyota Loan', 'Auto', 'Fixed', 756.24, 'Ally FloHao', '12', NULL, 2),
        ('AT&T Fiber', 'Utilities', 'Fixed', 65.00, 'Apple Card→Chase', '25', NULL, 3),
        ('PG&E', 'Utilities', 'Variable', NULL, 'Apple Card→Chase', '18', NULL, 4),
        ('EBMUD Water', 'Utilities', 'Bi-Monthly', NULL, 'Apple Card→Chase', '15', ARRAY[1,3,5,7,9,11], 5),
        ('Republic Services', 'Utilities', 'Quarterly', NULL, 'Ally FloHao', 'Varies', ARRAY[1,4,7,10], 6),
        ('AT&T Wireless', 'Wireless', 'Fixed', 153.96, 'Apple Card→Chase', '11', NULL, 7),
        ('Pet Insurance', 'Insurance', 'Variable', 102.38, 'Apple Card→Chase', NULL, NULL, 8),
        ('Auto Insurance (Geico)', 'Insurance', 'Variable', NULL, 'Ally FloHao', NULL, NULL, 9),
        ('BofA Atmos Ring', 'Debt', 'Variable', 300.00, 'Chase Manny', NULL, NULL, 10),
        ('FIFA Installments', 'Debt', 'Fixed', 155.00, 'Chase Manny', NULL, NULL, 11),
        ('Student Loan', 'Debt', 'Fixed', 150.00, 'Auto', NULL, NULL, 12),
        ('Apple Subscriptions', 'Subscriptions', 'Fixed', 57.94, 'Chase Manny', NULL, NULL, 13),
        ('Netflix', 'Subscriptions', 'Variable', 17.00, 'Chase Manny', NULL, NULL, 14),
        ('Disney+', 'Subscriptions', 'Variable', 8.00, 'Chase Manny', NULL, NULL, 15),
        ('Hulu', 'Subscriptions', 'Variable', 8.00, 'Chase Manny', NULL, NULL, 16),
        ('Max (HBO)', 'Subscriptions', 'Variable', 10.00, 'Chase Manny', NULL, NULL, 17),
        ('Spotify', 'Subscriptions', 'Variable', 11.00, 'Chase Manny', NULL, NULL, 18),
        ('ChatGPT', 'Subscriptions', 'Variable', 20.00, 'Chase Manny', NULL, NULL, 19),
        ('Parent Support', 'Family', 'Fixed', 50.00, 'SoFi Family', NULL, NULL, 20),
        ('Bro Support', 'Family', 'Fixed', 25.00, 'SoFi Bro', NULL, NULL, 21)
      ON CONFLICT DO NOTHING
    `

    // Seed debts (no unique constraint yet at this point — dedup happens in migration 003 below)
    await sql`
      INSERT INTO finance_debts (name, current_balance, original_balance, apr, min_payment, promo_end_date, promo_apr, sort_order) VALUES
        ('Toyota Tacoma Loan', 25000.00, 25000.00, 0.0499, 756.24, NULL, NULL, 1),
        ('BofA Atmos Ring', 3500.00, 3500.00, 0.0000, 300.00, '2026-08-28', 0.2674, 2),
        ('Student Loans', 4000.00, 4000.00, 0.0340, 150.00, NULL, NULL, 3),
        ('FIFA Installments', 5200.00, 5200.00, 0.0000, 155.00, NULL, NULL, 4)
      ON CONFLICT DO NOTHING
    `

    // Seed annual items
    await sql`
      INSERT INTO finance_annual_items (name, category, amount, due_date, account, is_critical, year) VALUES
        ('Subaru Registration', 'Auto', 352.00, '2026-01-16', 'Ally FloHao', false, 2026),
        ('Property Tax (2nd)', 'Housing', 5237.08, '2026-02-01', 'Robinhood [GC]', true, 2026),
        ('WHOOP Annual', 'Health', 389.00, '2026-02-10', 'Chase Manny', false, 2026),
        ('Paramount+', 'Subscriptions', 59.99, '2026-03-29', 'Chase Manny', false, 2026),
        ('Toyota Registration', 'Auto', 250.00, '2026-06-02', 'Ally FloHao', false, 2026),
        ('Google Workspace', 'Tech', 144.00, '2026-06-08', 'Chase Manny', false, 2026),
        ('Mitsubishi Registration', 'Auto', 150.00, '2026-06-20', 'Ally FloHao', false, 2026),
        ('Property Tax (1st)', 'Housing', 5237.08, '2026-08-01', 'Robinhood [GC]', true, 2026),
        ('Vix Annual', 'Subscriptions', 59.99, '2026-08-25', 'Chase Manny', false, 2026),
        ('BofA 0% PROMO DEADLINE', 'Debt', 3500.00, '2026-08-28', 'Chase Manny', true, 2026),
        ('Chase Sapphire Annual Fee', 'Credit Card', 95.00, '2026-08-15', 'Chase Manny', false, 2026),
        ('Chase Marriott Annual Fee', 'Credit Card', 95.00, '2026-08-15', 'Chase Manny', false, 2026),
        ('Homeowners Insurance', 'Housing', 4154.00, '2026-10-15', 'Ally FloHao', true, 2026),
        ('Amex Green Annual Fee', 'Credit Card', 150.00, '2026-10-21', 'Chase Manny', false, 2026),
        ('CoPilot Annual', 'Tech', 69.99, '2026-12-14', 'Chase Manny', false, 2026)
      ON CONFLICT DO NOTHING
    `

    // Create default users
    const mannyHash = await bcrypt.hash('changeme123', 10)
    const celestiHash = await bcrypt.hash('changeme456', 10)

    await sql`
      INSERT INTO users (username, password_hash, role) VALUES
        ('manny', ${mannyHash}, 'admin'),
        ('celesti', ${celestiHash}, 'viewer')
      ON CONFLICT (username) DO NOTHING
    `

    // --- Migration 003: accounts + frequency ---
    await sql`
      CREATE TABLE IF NOT EXISTS finance_accounts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'bank',
        last_four TEXT,
        paid_by TEXT,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `

    await sql`ALTER TABLE finance_bills ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'Monthly'`
    await sql`ALTER TABLE finance_bills ADD COLUMN IF NOT EXISTS is_autopay BOOLEAN DEFAULT false`

    // --- Migration 004: payment breakdown columns ---
    await sql`ALTER TABLE finance_debt_payments ADD COLUMN IF NOT EXISTS principal_amount NUMERIC(10,2)`
    await sql`ALTER TABLE finance_debt_payments ADD COLUMN IF NOT EXISTS interest_amount NUMERIC(10,2)`
    await sql`ALTER TABLE finance_debt_payments ADD COLUMN IF NOT EXISTS late_fees NUMERIC(10,2)`
    await sql`ALTER TABLE finance_debt_payments ADD COLUMN IF NOT EXISTS misc_fees NUMERIC(10,2)`

    // --- Migration 005: owner label on bills and annual items ---
    await sql`ALTER TABLE finance_bills ADD COLUMN IF NOT EXISTS owner TEXT`
    await sql`ALTER TABLE finance_annual_items ADD COLUMN IF NOT EXISTS owner TEXT`

    // --- Dedup all seeded tables (keep oldest row per unique key) ---
    await sql`
      DELETE FROM finance_debts
      WHERE id NOT IN (
        SELECT DISTINCT ON (name) id FROM finance_debts ORDER BY name, created_at ASC
      )
    `
    await sql`
      DELETE FROM finance_bills
      WHERE id NOT IN (
        SELECT DISTINCT ON (name) id FROM finance_bills ORDER BY name, created_at ASC
      )
    `
    await sql`
      DELETE FROM finance_annual_items
      WHERE id NOT IN (
        SELECT DISTINCT ON (name, year) id FROM finance_annual_items ORDER BY name, year, created_at ASC
      )
    `

    // Add unique indexes (idempotent via IF NOT EXISTS)
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS finance_debts_name_idx ON finance_debts (name)`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS finance_bills_name_idx ON finance_bills (name)`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS finance_annual_items_name_year_idx ON finance_annual_items (name, year)`
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS finance_accounts_name_idx ON finance_accounts (name)`

    await sql`
      INSERT INTO finance_accounts (name, type, paid_by, sort_order) VALUES
        ('Robinhood [GC]', 'bank', NULL, 1),
        ('Ally FloHao', 'bank', NULL, 2),
        ('Chase Manny', 'bank', NULL, 3),
        ('SoFi Family', 'bank', NULL, 4),
        ('SoFi Bro', 'bank', NULL, 5),
        ('Apple Card', 'credit_card', 'Chase Manny', 10),
        ('Chase Sapphire', 'credit_card', 'Chase Manny', 11),
        ('Chase Marriott', 'credit_card', 'Chase Manny', 12),
        ('Amex Green', 'credit_card', 'Chase Manny', 13)
      ON CONFLICT (name) DO NOTHING
    `

    return Response.json({
      data: 'Migration complete. Users: manny/changeme123 (admin), celesti/changeme456 (viewer). CHANGE PASSWORDS!',
      error: null,
    })
  } catch (err) {
    console.error('Migration error:', err)
    return Response.json({ data: null, error: String(err) }, { status: 500 })
  }
}
