-- Strava : stocker le profil renvoyé par l'autorisation OAuth.
--
-- Le front (`src/components/StravaConnect.jsx`) affiche le nom et la photo du
-- compte Strava connecté. Ces deux champs étaient écrits par l'ancienne
-- fonction Base44 sous les noms `strava_athlete_name` / `strava_profile_picture`,
-- qui n'ont jamais existé dans `public.strava_tokens` : la carte restait donc
-- vide. On les ajoute ici, sans le préfixe `strava_` puisque la table le porte
-- déjà dans son nom — comme la colonne `athlete_id`.
--
-- Le champ `user_id` du code Base44 n'est volontairement PAS repris : la clé de
-- rapprochement est `athlete_email`, déjà unique sur cette table et utilisée par
-- tout le reste du schéma (athlete_emails, coach_emails, …).

alter table public.strava_tokens
  add column if not exists athlete_name    text,
  add column if not exists profile_picture text;

comment on column public.strava_tokens.athlete_name    is 'Prénom + nom du compte Strava, pour affichage.';
comment on column public.strava_tokens.profile_picture is 'URL de la photo de profil Strava (profile_medium).';
