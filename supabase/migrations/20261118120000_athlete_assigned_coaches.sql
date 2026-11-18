-- Entraîneurs assignés à un athlète par l'administrateur.
--
-- L'écran « Gestion des utilisateurs » et la fiche athlète écrivaient déjà ce
-- champ, hérité de Base44, mais il n'avait jamais été créé dans Supabase :
-- chaque enregistrement échouait. Un athlète assigné apparaît dans la vue
-- individuelle de l'entraîneur (tableau de bord, calendrier, messages,
-- médical, réponses du jour), au même titre que les athlètes de ses groupes.
--
-- Aucune policy à ajouter : athlete_profiles a déjà RLS activé, le staff peut
-- lire et modifier toutes les fiches, l'athlète lit la sienne.

ALTER TABLE "public"."athlete_profiles"
  ADD COLUMN IF NOT EXISTS "assigned_coach_emails" text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_athlete_profiles_assigned_coaches
  ON public.athlete_profiles USING gin (assigned_coach_emails);
