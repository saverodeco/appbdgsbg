-- SQL query to create the fg_transporter table for Supabase

-- 1. Create the new table with the correct columns
CREATE TABLE public.fg_transporter (
  truck_no text NOT NULL,
  truck_type text,
  driver_name text,
  driver_number text,
  expedition text,
  dimension_length numeric,
  dimension_width numeric,
  dimension_height numeric,
  CONSTRAINT fg_transporter_pkey PRIMARY KEY (truck_no)
);

-- 2. Enable Row Level Security (RLS) for the table
ALTER TABLE public.fg_transporter ENABLE ROW LEVEL SECURITY;

-- 3. Create policies to control access
CREATE POLICY "Allow authenticated users to view transporters"
ON public.fg_transporter
FOR SELECT
TO authenticated
USING (true);
