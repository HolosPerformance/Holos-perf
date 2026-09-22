-- Run this in Supabase SQL Editor
-- Fixes RLS policies for athlete_profiles and profiles tables

-- ── Helper function (SECURITY DEFINER bypasses RLS to avoid recursion) ────────
CREATE OR REPLACE FUNCTION public.get_my_user_status()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT user_status FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- ── athlete_profiles ──────────────────────────────────────────────────────────
ALTER TABLE public.athlete_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Athletes: full access to own profile
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='athlete_profiles' AND policyname='athlete_profiles_select_own') THEN
    CREATE POLICY "athlete_profiles_select_own" ON public.athlete_profiles
    FOR SELECT TO authenticated USING (athlete_email = auth.email());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='athlete_profiles' AND policyname='athlete_profiles_insert_own') THEN
    CREATE POLICY "athlete_profiles_insert_own" ON public.athlete_profiles
    FOR INSERT TO authenticated WITH CHECK (athlete_email = auth.email());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='athlete_profiles' AND policyname='athlete_profiles_update_own') THEN
    CREATE POLICY "athlete_profiles_update_own" ON public.athlete_profiles
    FOR UPDATE TO authenticated
    USING (athlete_email = auth.email())
    WITH CHECK (athlete_email = auth.email());
  END IF;

  -- Coaches + admins: full access to all profiles
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='athlete_profiles' AND policyname='athlete_profiles_staff_all') THEN
    CREATE POLICY "athlete_profiles_staff_all" ON public.athlete_profiles
    FOR ALL TO authenticated
    USING (public.get_my_user_status() IN ('coach', 'coach_pro', 'admin'))
    WITH CHECK (public.get_my_user_status() IN ('coach', 'coach_pro', 'admin'));
  END IF;
END $$;

-- ── profiles (User entity) ────────────────────────────────────────────────────
-- Needed so coaches/admins can call User.list() to see all users
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Every authenticated user can see their own row
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_select_own') THEN
    CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated USING (id = auth.uid());
  END IF;

  -- Coaches + admins can see all profiles (needed for user lists)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_staff_select_all') THEN
    CREATE POLICY "profiles_staff_select_all" ON public.profiles
    FOR SELECT TO authenticated
    USING (public.get_my_user_status() IN ('coach', 'coach_pro', 'admin'));
  END IF;

  -- Users can update their own profile
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_update_own') THEN
    CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid()) WITH CHECK (id = auth.uid());
  END IF;

  -- Admins can update all profiles (for user_status changes etc.)
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='profiles_admin_all') THEN
    CREATE POLICY "profiles_admin_all" ON public.profiles
    FOR ALL TO authenticated
    USING (public.get_my_user_status() = 'admin')
    WITH CHECK (public.get_my_user_status() = 'admin');
  END IF;
END $$;
