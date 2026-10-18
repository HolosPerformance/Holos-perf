-- Run this in Supabase SQL Editor
-- Fixes RLS policies for groups and teams tables
-- Ensures admins can list ALL groups and ALL teams (across every club),
-- not just the ones belonging to their own coach account.

-- ── Helper function (already created in fix_athlete_profiles_rls.sql) ──────────
-- CREATE OR REPLACE FUNCTION public.get_my_user_status() ...

-- ── groups ───────────────────────────────────────────────────────────────────
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Admins: full access to all groups
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='groups'
    AND policyname='groups_admin_all'
  ) THEN
    CREATE POLICY "groups_admin_all" ON public.groups
    FOR ALL TO authenticated
    USING (public.get_my_user_status() = 'admin')
    WITH CHECK (public.get_my_user_status() = 'admin');
  END IF;

  -- Coaches: full access to their own groups
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='groups'
    AND policyname='groups_coach_own'
  ) THEN
    CREATE POLICY "groups_coach_own" ON public.groups
    FOR ALL TO authenticated
    USING (coach_email = auth.email())
    WITH CHECK (coach_email = auth.email());
  END IF;

  -- Athletes: read groups they belong to
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='groups'
    AND policyname='groups_athlete_select_own'
  ) THEN
    CREATE POLICY "groups_athlete_select_own" ON public.groups
    FOR SELECT TO authenticated
    USING (auth.email() = ANY(athlete_emails));
  END IF;
END $$;

-- ── teams ────────────────────────────────────────────────────────────────────
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Admins: full access to all teams
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='teams'
    AND policyname='teams_admin_all'
  ) THEN
    CREATE POLICY "teams_admin_all" ON public.teams
    FOR ALL TO authenticated
    USING (public.get_my_user_status() = 'admin')
    WITH CHECK (public.get_my_user_status() = 'admin');
  END IF;

  -- Coaches: full access to teams of clubs they coach
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='teams'
    AND policyname='teams_coach_own_club'
  ) THEN
    CREATE POLICY "teams_coach_own_club" ON public.teams
    FOR ALL TO authenticated
    USING (
      club_id IN (SELECT id FROM public.clubs WHERE auth.email() = ANY(coach_emails))
      OR auth.email() = ANY(coach_emails)
    )
    WITH CHECK (
      club_id IN (SELECT id FROM public.clubs WHERE auth.email() = ANY(coach_emails))
      OR auth.email() = ANY(coach_emails)
    );
  END IF;

  -- Athletes: read the team they belong to
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='teams'
    AND policyname='teams_athlete_select_own'
  ) THEN
    CREATE POLICY "teams_athlete_select_own" ON public.teams
    FOR SELECT TO authenticated
    USING (auth.email() = ANY(athlete_emails));
  END IF;
END $$;
