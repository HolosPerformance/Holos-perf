-- ─── Archivage des questionnaires ───────────────────────────────────────────
--
-- Supprimer un questionnaire vidait le lien de toutes ses réponses
-- (template_id passe à NULL) et effaçait ses questions : l'historique des
-- athlètes devenait invisible. Un questionnaire n'est donc plus supprimé mais
-- archivé : les entraîneurs le voient comme supprimé, les administrateurs le
-- retrouvent dans la bibliothèque et peuvent le restaurer.
--
-- Un questionnaire archivé a aussi is_active = false : les écrans des athlètes,
-- les rappels et l'assignation automatique l'ignorent donc sans autre changement.

ALTER TABLE "public"."questionnaire_templates"
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "archived_by_email" text;
