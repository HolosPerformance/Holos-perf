-- Run this in Supabase SQL Editor
-- Fixes RLS policies for questionnaire_responses table
-- Allows coaches to read responses from athletes in their GROUP or CLUB

-- ── Helper function (already created in fix_athlete_profiles_rls.sql) ──────────
-- CREATE OR REPLACE FUNCTION public.get_my_user_status() ...

ALTER TABLE public.questionnaire_responses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- Drop old coach policy if it only covered groups
  DROP POLICY IF EXISTS "coach_read_athlete_responses" ON public.questionnaire_responses;
  DROP POLICY IF EXISTS "coaches_read_athlete_responses" ON public.questionnaire_responses;
  DROP POLICY IF EXISTS "questionnaire_responses_coach_select" ON public.questionnaire_responses;

  -- Athletes: read own responses
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='questionnaire_responses'
    AND policyname='qr_select_own'
  ) THEN
    CREATE POLICY "qr_select_own" ON public.questionnaire_responses
    FOR SELECT TO authenticated
    USING (athlete_email = auth.email());
  END IF;

  -- Athletes: insert own responses
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='questionnaire_responses'
    AND policyname='qr_insert_own'
  ) THEN
    CREATE POLICY "qr_insert_own" ON public.questionnaire_responses
    FOR INSERT TO authenticated
    WITH CHECK (athlete_email = auth.email());
  END IF;

  -- Athletes: update own responses
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='questionnaire_responses'
    AND policyname='qr_update_own'
  ) THEN
    CREATE POLICY "qr_update_own" ON public.questionnaire_responses
    FOR UPDATE TO authenticated
    USING (athlete_email = auth.email())
    WITH CHECK (athlete_email = auth.email());
  END IF;

  -- Admins: full access
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='questionnaire_responses'
    AND policyname='qr_admin_all'
  ) THEN
    CREATE POLICY "qr_admin_all" ON public.questionnaire_responses
    FOR ALL TO authenticated
    USING (public.get_my_user_status() = 'admin')
    WITH CHECK (public.get_my_user_status() = 'admin');
  END IF;

  -- Coaches: read responses from athletes in their GROUP or CLUB
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='questionnaire_responses'
    AND policyname='qr_coach_select_group_or_club'
  ) THEN
    CREATE POLICY "qr_coach_select_group_or_club" ON public.questionnaire_responses
    FOR SELECT TO authenticated
    USING (
      public.get_my_user_status() IN ('coach', 'coach_pro')
      AND (
        -- Athlete is in coach's group
        athlete_email IN (
          SELECT unnest(athlete_emails)
          FROM public.groups
          WHERE coach_email = auth.email()
        )
        OR
        -- Athlete is in coach's club
        athlete_email IN (
          SELECT unnest(athlete_emails)
          FROM public.clubs
          WHERE auth.email() = ANY(coach_emails)
        )
      )
    );
  END IF;

END $$;
