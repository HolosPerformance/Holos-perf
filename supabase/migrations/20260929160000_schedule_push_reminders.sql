-- ─── Planification des rappels push ───────────────────────────────────────────
-- Appelle l'Edge Function `send-reminders` toutes les 15 minutes.
-- La fenêtre de tolérance du rappel quotidien est de ±7 min (voir
-- supabase/functions/_shared/reminders.ts) : elle est calée sur cette cadence.
-- Changer l'une sans l'autre créerait des trous ou des doublons.
--
-- PRÉREQUIS, à exécuter UNE FOIS par environnement, jamais commité :
--
--   select vault.create_secret('https://<ref>.supabase.co', 'project_url');
--   select vault.create_secret('<service_role_key>',        'service_role_key');
--
-- Les secrets passent par Vault précisément pour ne pas figurer dans ce dépôt.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Rejouable : on retire l'ancienne planification avant de la recréer.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'send-push-reminders') then
    perform cron.unschedule('send-push-reminders');
  end if;
end;
$$;

select cron.schedule(
  'send-push-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := (
      select decrypted_secret from vault.decrypted_secrets where name = 'project_url'
    ) || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);
