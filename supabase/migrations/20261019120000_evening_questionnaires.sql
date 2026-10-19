-- ─── Questionnaires du soir ────────────────────────────────────────────────────
--
-- Un club (et chacune de ses équipes) peut proposer deux créneaux de
-- questionnaires : le matin, avant la séance, et le soir, après l'entraînement.
-- Les colonnes existantes (clubs.default_questionnaire_template_ids et
-- teams.questionnaire_template_ids) servent pour le matin ; ces nouvelles
-- colonnes servent pour le soir.

ALTER TABLE "public"."clubs"
  ADD COLUMN IF NOT EXISTS "evening_questionnaire_template_ids" uuid[] DEFAULT '{}'::uuid[];

ALTER TABLE "public"."teams"
  ADD COLUMN IF NOT EXISTS "evening_questionnaire_template_ids" uuid[] DEFAULT '{}'::uuid[];
