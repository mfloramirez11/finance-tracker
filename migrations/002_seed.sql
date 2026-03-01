-- Seed finance_bills
INSERT INTO finance_bills (name, category, billing_type, default_amount, account, due_day, months_active, sort_order) VALUES
  ('Mortgage', 'Housing', 'Fixed', 4244.82, 'Robinhood [GC]', '1st', NULL, 1),
  ('Toyota Loan', 'Auto', 'Fixed', 756.24, 'Ally FloHao', '12th', NULL, 2),
  ('AT&T Fiber', 'Utilities', 'Fixed', 65.00, 'Apple Card→Chase', '25th', NULL, 3),
  ('PG&E', 'Utilities', 'Variable', NULL, 'Apple Card→Chase', '~18th', NULL, 4),
  ('EBMUD Water', 'Utilities', 'Bi-Monthly', NULL, 'Apple Card→Chase', '~15th', ARRAY[1,3,5,7,9,11], 5),
  ('Republic Services', 'Utilities', 'Quarterly', NULL, 'Ally FloHao', 'Varies', ARRAY[1,4,7,10], 6),
  ('AT&T Wireless', 'Wireless', 'Fixed', 153.96, 'Apple Card→Chase', '11th', NULL, 7),
  ('Pet Insurance', 'Insurance', 'Variable', 102.38, 'Apple Card→Chase', 'Monthly', NULL, 8),
  ('Auto Insurance (Geico)', 'Insurance', 'Variable', NULL, 'Ally FloHao', 'Monthly', NULL, 9),
  ('BofA Atmos Ring', 'Debt', 'Variable', 300.00, 'Chase Manny', 'Monthly', NULL, 10),
  ('FIFA Installments', 'Debt', 'Fixed', 155.00, 'Chase Manny', 'Monthly', NULL, 11),
  ('Student Loan', 'Debt', 'Fixed', 150.00, 'Auto', 'Monthly', NULL, 12),
  ('Apple Subscriptions', 'Subscriptions', 'Fixed', 57.94, 'Chase Manny', 'Monthly', NULL, 13),
  ('Netflix', 'Subscriptions', 'Variable', 17.00, 'Chase Manny', 'Monthly', NULL, 14),
  ('Disney+', 'Subscriptions', 'Variable', 8.00, 'Chase Manny', 'Monthly', NULL, 15),
  ('Hulu', 'Subscriptions', 'Variable', 8.00, 'Chase Manny', 'Monthly', NULL, 16),
  ('Max (HBO)', 'Subscriptions', 'Variable', 10.00, 'Chase Manny', 'Monthly', NULL, 17),
  ('Spotify', 'Subscriptions', 'Variable', 11.00, 'Chase Manny', 'Monthly', NULL, 18),
  ('ChatGPT', 'Subscriptions', 'Variable', 20.00, 'Chase Manny', 'Monthly', NULL, 19),
  ('Parent Support', 'Family', 'Fixed', 50.00, 'SoFi Family', 'Bi-wkly', NULL, 20),
  ('Bro Support', 'Family', 'Fixed', 25.00, 'SoFi Bro', 'Bi-wkly', NULL, 21)
ON CONFLICT DO NOTHING;

-- Seed finance_debts
INSERT INTO finance_debts (name, current_balance, original_balance, apr, min_payment, promo_end_date, promo_apr, sort_order) VALUES
  ('Toyota Tacoma Loan', 25000.00, 25000.00, 0.0499, 756.24, NULL, NULL, 1),
  ('BofA Atmos Ring', 3500.00, 3500.00, 0.0000, 300.00, '2026-08-28', 0.2674, 2),
  ('Student Loans', 4000.00, 4000.00, 0.0340, 150.00, NULL, NULL, 3),
  ('FIFA Installments', 5200.00, 5200.00, 0.0000, 155.00, NULL, NULL, 4)
ON CONFLICT DO NOTHING;

-- Seed finance_annual_items for 2026
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
ON CONFLICT DO NOTHING;
