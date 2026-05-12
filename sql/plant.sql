-- SQL query to create the plant table for Supabase

-- 1. Create the new table with the correct columns
CREATE TABLE public.plant (
  plant integer NOT NULL,
  description text,
  CONSTRAINT plant_pkey PRIMARY KEY (plant)
);

-- 2. Enable Row Level Security (RLS) for the table
ALTER TABLE public.plant ENABLE ROW LEVEL SECURITY;

-- 3. Create policies to control access
CREATE POLICY "Allow authenticated users to view plants"
ON public.plant
FOR SELECT
TO authenticated
USING (true);

-- 4. Insert the data
INSERT INTO public.plant (plant, description) VALUES (7025, 'PEP Bandung');
INSERT INTO public.plant (plant, description) VALUES (7027, 'PEP Subang');
