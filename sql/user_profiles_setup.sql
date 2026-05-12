-- SQL query to create the user_profiles table and related policies for Supabase

-- 1. Create the table to store user profiles and their permissions
CREATE TABLE public.user_profiles (
  id uuid NOT NULL,  -- This MUST match the id from auth.users
  email text,
  permissions text[], -- This will store an array of authority names
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT user_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
);

-- 2. Enable Row Level Security (RLS) for the table
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- 3. Create policies for access control

-- Allow users to view their own profile
CREATE POLICY "Allow individual user to view their own profile"
ON public.user_profiles
FOR SELECT
USING (auth.uid() = id);

-- Allow service_role to have full access for administrative tasks (like assigning permissions)
CREATE POLICY "Allow service_role to manage all profiles"
ON public.user_profiles
FOR ALL
TO service_role
WITH CHECK (true);

-- 4. Create a trigger function to automatically create a user profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach the trigger to the auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
