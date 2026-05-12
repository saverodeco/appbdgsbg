-- SQL query to create the pr_stock table for Supabase

-- 1. Drop the old table if it exists and you want a fresh start
-- DROP TABLE IF EXISTS public.pr_stock;

-- 2. Create the new table with the correct columns
CREATE TABLE public.pr_stock (
  roll_id text NOT NULL,
  plant text NOT NULL,
  weight numeric,
  gsm numeric,
  width numeric,
  length numeric,
  diameter numeric,
  bin_location text,
  goods_receive_date timestamptz,
  kind text,
  batch text,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT pr_stock_pkey PRIMARY KEY (roll_id, plant)
);

-- 3. Enable Row Level Security (RLS) for the table
ALTER TABLE public.pr_stock ENABLE ROW LEVEL SECURITY;

-- 4. Create policies to control access
CREATE POLICY "Allow authenticated users to view stock"
ON public.pr_stock
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Allow all access for service_role"
ON public.pr_stock
FOR ALL
TO service_role;
