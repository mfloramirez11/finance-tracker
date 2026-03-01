-- Finance accounts table (bank accounts + credit cards)
CREATE TABLE IF NOT EXISTS finance_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'bank',   -- 'bank' | 'credit_card'
  last_four TEXT,
  paid_by TEXT,                         -- For credit cards: which bank account pays it
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add frequency column to finance_bills
ALTER TABLE finance_bills ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'Monthly';

-- Seed default accounts based on existing bill data
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
ON CONFLICT DO NOTHING;
