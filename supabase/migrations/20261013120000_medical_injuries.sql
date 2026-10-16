-- ─── Module médical : fiches blessures ────────────────────────────────────────
--
-- Une ligne par blessure. Un athlète a au plus UNE blessure ouverte à la fois
-- (end_date null) ; sans blessure ouverte il est considéré « disponible ».
--
--   * status          : statut actuel de la blessure ouverte
--                       ('blesse' | 'reeducation' | 'reathletisation' | 'reprise_progressive')
--   * status_history  : passages successifs de statut, du plus ancien au plus récent, ex.
--                       [{"status": "blesse", "date": "2026-10-01", "note": "..."}]
--
-- Données de santé : visibles et modifiables uniquement par l'admin et par les
-- coachs qui encadrent l'athlète (club, équipe ou groupe). L'athlète n'y a pas accès.

CREATE TABLE IF NOT EXISTS "public"."injuries" (
  "id"                   uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "athlete_email"        text                     NOT NULL,
  "injury_type"          text,
  "body_location"        text,
  "side"                 text,
  "severity"             text,
  "context"              text,
  "is_recurrence"        boolean                  NOT NULL DEFAULT false,
  "injury_date"          date                     NOT NULL,
  "expected_return_date" date,
  "end_date"             date,
  "status"               text                     NOT NULL DEFAULT 'blesse'::text,
  "status_history"       jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "diagnosis"            text,
  "practitioner"         text,
  "notes"                text,
  "created_by"           text,
  "created_at"           timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"           timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "injuries_pkey" PRIMARY KEY (id),
  CONSTRAINT "injuries_status_check" CHECK ((status = ANY (ARRAY['blesse'::text, 'reeducation'::text, 'reathletisation'::text, 'reprise_progressive'::text])))
);

CREATE INDEX IF NOT EXISTS "injuries_athlete_email_idx" ON "public"."injuries" (athlete_email);

-- Une seule blessure ouverte par athlète
CREATE UNIQUE INDEX IF NOT EXISTS "injuries_one_open_per_athlete"
  ON "public"."injuries" (athlete_email) WHERE end_date IS NULL;

DROP TRIGGER IF EXISTS injuries_updated_at ON "public"."injuries";
CREATE TRIGGER injuries_updated_at
  BEFORE UPDATE ON "public"."injuries"
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ─── L'utilisateur courant encadre-t-il cet athlète ? ─────────────────────────
-- Admin : tous les athlètes. Coach / coach pro : athlètes de son club, de ses
-- équipes ou de son groupe.
CREATE OR REPLACE FUNCTION public.is_my_athlete(p_athlete_email text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = public
  AS $function$
  select case
    when public.current_user_status() = 'admin' then true
    when public.current_user_status() in ('coach', 'coach_pro') then (
      exists (select 1 from public.clubs
              where public.current_user_email() = any (coach_emails)
                and p_athlete_email = any (athlete_emails))
      or exists (select 1 from public.teams
              where public.current_user_email() = any (coach_emails)
                and p_athlete_email = any (athlete_emails))
      or exists (select 1 from public.groups
              where coach_email = public.current_user_email()
                and p_athlete_email = any (athlete_emails))
    )
    else false
  end;
$function$;

REVOKE ALL ON FUNCTION public.is_my_athlete(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_my_athlete(text) TO authenticated, service_role;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE "public"."injuries" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "injuries_staff_all" ON "public"."injuries";
CREATE POLICY "injuries_staff_all" ON "public"."injuries"
  FOR ALL
  TO "authenticated"
  USING (public.is_my_athlete(athlete_email))
  WITH CHECK (public.is_my_athlete(athlete_email));

REVOKE ALL ON TABLE "public"."injuries" FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "public"."injuries" TO authenticated, service_role;
