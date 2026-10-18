-- ─── Traductions des questionnaires ───────────────────────────────────────────
--
-- Un même questionnaire peut désormais être proposé en plusieurs langues, au
-- lieu de dupliquer le questionnaire par langue. Les réponses restent stockées
-- par identifiant de question : toutes les langues alimentent donc les mêmes
-- statistiques dans le dashboard.
--
--   * translations       : langues ajoutées au questionnaire et traductions de
--                          son nom / sa description, ex.
--                          {"languages": ["en"], "name": {"en": "..."}, "description": {"en": "..."}}
--                          Les traductions des questions sont stockées dans
--                          chaque question (champ `translations` du JSON `questions`).
--   * athlete_languages  : langue dans laquelle chaque athlète assigné reçoit le
--                          questionnaire, ex. {"carlos@club.fr": "es"}.
--                          Un athlète absent de la liste le reçoit en français.

ALTER TABLE "public"."questionnaire_templates"
  ADD COLUMN IF NOT EXISTS "translations"      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "athlete_languages" jsonb NOT NULL DEFAULT '{}'::jsonb;
