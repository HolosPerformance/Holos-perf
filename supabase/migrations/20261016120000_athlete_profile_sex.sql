-- ─── Sexe de l'athlète ─────────────────────────────────────────────────────────
--
-- Sert à afficher la silhouette homme ou femme dans la question « Zones
-- douloureuses » des questionnaires. Facultatif : sans valeur, l'athlète
-- choisit la silhouette dans le questionnaire.

ALTER TABLE "public"."athlete_profiles"
  ADD COLUMN IF NOT EXISTS "sex" text;

ALTER TABLE "public"."athlete_profiles"
  DROP CONSTRAINT IF EXISTS "athlete_profiles_sex_check";

ALTER TABLE "public"."athlete_profiles"
  ADD CONSTRAINT "athlete_profiles_sex_check" CHECK (sex IS NULL OR sex = ANY (ARRAY['homme'::text, 'femme'::text]));
