CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  father_name TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  date_of_birth DATE,
  user_id TEXT UNIQUE,
  email TEXT NOT NULL UNIQUE,
  mobile TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL CHECK (role IN ('admin', 'agent', 'merchant', 'customer')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'rejected')),
  password_hash TEXT,
  exam_number TEXT,
  marks NUMERIC(6,2),
  approval_number TEXT,
  shop_name TEXT,
  photo_url TEXT,
  generate_id_card BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES users(id),
  account_type TEXT NOT NULL CHECK (account_type IN ('admin_primary', 'admin_secondary', 'agent', 'merchant', 'customer')),
  account_number TEXT NOT NULL UNIQUE,
  balance NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (owner_user_id, account_type)
);

CREATE UNIQUE INDEX IF NOT EXISTS accounts_singleton_admin_types
  ON accounts (account_type)
  WHERE owner_user_id IS NULL;

CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_code TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  points NUMERIC(14,2) NOT NULL CHECK (points > 0),
  created_by UUID REFERENCES users(id),
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES point_transactions(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  points_delta NUMERIC(14,2) NOT NULL CHECK (points_delta <> 0),
  balance_after NUMERIC(14,2) NOT NULL CHECK (balance_after >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ledger_entries_account_created
  ON ledger_entries (account_id, created_at DESC);

CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  points NUMERIC(14,2) NOT NULL CHECK (points > 0),
  status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'redeemed')),
  redeemed_by UUID REFERENCES users(id),
  redeemed_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_name TEXT NOT NULL,
  owner_user_id UUID NOT NULL UNIQUE REFERENCES users(id),
  address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answers JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS plans (
  correct_answers_percentage INTEGER PRIMARY KEY CHECK (correct_answers_percentage IN (0, 25, 50, 75, 100)),
  customer_percentage NUMERIC(5,2) NOT NULL CHECK (customer_percentage >= 0 AND customer_percentage <= 100),
  admins_commission_percentage NUMERIC(5,2) NOT NULL CHECK (admins_commission_percentage >= 0 AND admins_commission_percentage <= 100),
  agents_commission_percentage NUMERIC(5,2) NOT NULL CHECK (agents_commission_percentage >= 0 AND agents_commission_percentage <= 100),
  CHECK (customer_percentage + admins_commission_percentage + agents_commission_percentage = 100)
);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value NUMERIC(18,2) NOT NULL DEFAULT 0
);

INSERT INTO system_settings (setting_key, setting_value)
VALUES ('lifetime_primary_issuance', 0)
ON CONFLICT (setting_key) DO NOTHING;

INSERT INTO plans
  (correct_answers_percentage, customer_percentage, admins_commission_percentage, agents_commission_percentage)
VALUES
  (0, 0, 70, 30),
  (25, 25, 50, 25),
  (50, 50, 30, 20),
  (75, 75, 10, 15),
  (100, 95, 0, 5)
ON CONFLICT (correct_answers_percentage) DO NOTHING;

INSERT INTO questions (question, answers, correct_answer)
SELECT seed.question, seed.answers::jsonb, seed.correct_answer
FROM (VALUES
  ('Which number comes after 2?', '["1", "3", "4", "5"]', '3'),
  ('How many days are there in a week?', '["5", "6", "7", "8"]', '7'),
  ('Which of these is a fruit?', '["Carrot", "Apple", "Potato", "Onion"]', 'Apple'),
  ('What is 5 + 3?', '["6", "7", "8", "9"]', '8')
) AS seed(question, answers, correct_answer)
WHERE NOT EXISTS (SELECT 1 FROM questions);
