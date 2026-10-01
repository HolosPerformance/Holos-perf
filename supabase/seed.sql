-- =============================================================================
-- Seed de développement local — Holos-perf
-- Appliqué automatiquement par `supabase db reset` / `supabase start`.
-- NE PAS utiliser en production (mots de passe en clair, données fictives).
--
-- Comptes créés (mot de passe commun : password123)
--   admin@holos.test  → admin
--   coach@holos.test  → coach
--   alice@holos.test  → athlète (a déjà répondu au questionnaire post-séance)
--   bob@holos.test    → athlète (rappels activés, pas encore répondu)
--   chloe@holos.test  → athlète (notifications désactivées)
-- =============================================================================

-- ─── 1. Utilisateurs auth (le trigger handle_new_user crée les profiles) ──────
insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  reauthentication_token, is_sso_user, is_anonymous
)
select
  u.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  u.email, crypt('password123', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', u.full_name, 'first_name', u.first_name, 'last_name', u.last_name),
  now(), now(), '', '', '', '', '', false, false
from (values
  ('11111111-1111-1111-1111-111111111111'::uuid, 'admin@holos.test', 'Admin Holos',  'Admin', 'Holos'),
  ('22222222-2222-2222-2222-222222222222'::uuid, 'coach@holos.test', 'Coach Test',   'Coach', 'Test'),
  ('33333333-3333-3333-3333-333333333333'::uuid, 'alice@holos.test', 'Alice Martin', 'Alice', 'Martin'),
  ('44444444-4444-4444-4444-444444444444'::uuid, 'bob@holos.test',   'Bob Durand',   'Bob',   'Durand'),
  ('55555555-5555-5555-5555-555555555555'::uuid, 'chloe@holos.test', 'Chloé Petit',  'Chloé', 'Petit')
) as u(id, email, full_name, first_name, last_name);

-- ─── 2. Identités email (nécessaire pour le login GoTrue) ─────────────────────
insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
)
select
  u.id::text, u.id,
  jsonb_build_object('sub', u.id::text, 'email', u.email),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@holos.test';

-- ─── 3. Statuts / approbation des profils (auto-créés par le trigger) ─────────
update public.profiles set is_approved = true where email like '%@holos.test';
update public.profiles set user_status = 'admin', can_access_club_view = true where email = 'admin@holos.test';
update public.profiles set user_status = 'coach', can_access_club_view = true where email = 'coach@holos.test';

-- ─── 4. Profils athlètes ──────────────────────────────────────────────────────
insert into public.athlete_profiles (athlete_email, athlete_name, first_name, last_name, sport) values
  ('alice@holos.test', 'Alice Martin', 'Alice', 'Martin', 'Handball'),
  ('bob@holos.test',   'Bob Durand',   'Bob',   'Durand', 'Handball'),
  ('chloe@holos.test', 'Chloé Petit',  'Chloé', 'Petit',  'Handball');

-- ─── 5. Club + équipe ─────────────────────────────────────────────────────────
insert into public.clubs (id, name, coach_emails, athlete_emails, main_team_name) values
  ('c1000000-0000-0000-0000-000000000001', 'AS Holos',
   '{coach@holos.test}',
   '{alice@holos.test,bob@holos.test,chloe@holos.test}',
   'Séniors');

insert into public.teams (id, name, club_id, athlete_emails, coach_emails) values
  ('d1000000-0000-0000-0000-000000000001', 'Séniors',
   'c1000000-0000-0000-0000-000000000001',
   '{alice@holos.test,bob@holos.test,chloe@holos.test}',
   '{coach@holos.test}');

insert into public.groups (id, name, coach_email, athlete_emails) values
  ('91000000-0000-0000-0000-000000000001', 'Groupe A', 'coach@holos.test',
   '{alice@holos.test,bob@holos.test,chloe@holos.test}');

-- ─── 5b. Questionnaire assigné (lié à la séance) ──────────────────────────────
insert into public.questionnaire_templates (id, name, description, questions, is_active, assigned_athletes) values
  ('f1000000-0000-0000-0000-000000000001', 'Ressenti du jour', 'Questionnaire post-séance',
   '[{"id":"rpe","label":"RPE","type":"scale"},{"id":"fatigue","label":"Fatigue","type":"scale"}]'::jsonb,
   true, '{alice@holos.test,bob@holos.test,chloe@holos.test}');

-- ─── 6. Séance d'entraînement du jour ─────────────────────────────────────────
-- end_time calé à ~75 min avant maintenant (heure de Paris) pour tomber dans la
-- fenêtre du rappel post-séance (60–90 min après la fin).
insert into public.events (
  id, title, description, user_email, event_date, start_time, end_time,
  duration_minutes, is_training_session, assigned_athletes, session_category,
  questionnaire_template_id
) values (
  'e1000000-0000-0000-0000-000000000001',
  'Séance terrain du jour', 'Travail technique + opposition',
  'coach@holos.test', current_date, '10:00',
  to_char((now() at time zone 'Europe/Paris') - interval '75 minutes', 'HH24:MI'),
  90, true,
  '{alice@holos.test,bob@holos.test,chloe@holos.test}',
  'seance_terrain',
  'f1000000-0000-0000-0000-000000000001'
);

-- ─── 7. Réponse déjà soumise par Alice (pour tester le "skip si déjà répondu") ─
insert into public.questionnaire_responses (
  event_id, athlete_email, athlete_name, responses, submitted_date
) values (
  'e1000000-0000-0000-0000-000000000001', 'alice@holos.test', 'Alice Martin',
  '{"rpe": 6, "fatigue": 4}'::jsonb, now()
);

-- ─── 8. Préférences de notification ───────────────────────────────────────────
-- Stockées dans le blob jsonb `preferences` (le schéma n'a pas de colonnes à plat).
insert into public.user_preferences (athlete_email, preferences) values
  ('alice@holos.test', '{"notifications_enabled": true,  "daily_reminder_time": "20:00", "email_reminders": true}'::jsonb),
  ('bob@holos.test',   '{"notifications_enabled": true,  "daily_reminder_time": "19:30", "email_reminders": true}'::jsonb),
  ('chloe@holos.test', '{"notifications_enabled": false, "daily_reminder_time": "21:00", "email_reminders": false}'::jsonb);
