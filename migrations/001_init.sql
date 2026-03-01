-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer', -- 'admin' | 'viewer'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Core bill/expense items
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
);

-- Monthly actuals
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
);

-- Annual/one-time expenses
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
);

-- Debt tracker
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
);

-- Debt payment log
CREATE TABLE IF NOT EXISTS finance_debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debt_id UUID REFERENCES finance_debts(id) ON DELETE CASCADE,
  payment_date DATE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bill change history
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
);

-- App settings
CREATE TABLE IF NOT EXISTS finance_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  label TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed settings
INSERT INTO finance_settings (key, value, label) VALUES
  ('biweekly_net_pay', '4442.96', 'Bi-weekly Net Pay'),
  ('pay_periods_per_year', '26', 'Pay Periods Per Year'),
  ('emergency_fund_target', '50000', 'Emergency Fund Target'),
  ('emergency_fund_current', '0', 'Emergency Fund Current Balance'),
  ('bofa_deadline', '2026-08-28', 'BofA 0% Promo Deadline')
ON CONFLICT (key) DO NOTHING;
