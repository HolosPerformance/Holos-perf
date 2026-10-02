-- ─── Activation de la RLS sur les 13 tables restantes ─────────────────────────
--
-- Le schéma comptait 54 policies sur 16 tables, mais seulement 3 tables avaient
-- réellement `ENABLE ROW LEVEL SECURITY`. Sur les 13 autres, les policies
-- existaient sans jamais être évaluées : PostgreSQL ne les applique pas tant que
-- la RLS n'est pas activée sur la table.
--
-- Comme `anon` et `authenticated` disposent des droits SQL complets (comportement
-- normal de Supabase, où la RLS est la seule barrière), ces 13 tables étaient
-- lisibles ET modifiables avec la seule clé anon — laquelle est publique par
-- conception, puisqu'embarquée dans le bundle JavaScript.
--
-- Deux policies manquantes sont ajoutées AVANT l'activation, sans quoi l'app
-- casserait (voir les commentaires en regard).

-- ─── 1. Policies manquantes ───────────────────────────────────────────────────

-- `messages` n'avait que INSERT / SELECT / UPDATE. UserManagement supprime les
-- messages d'un utilisateur lors de sa suppression : sans policy DELETE, la RLS
-- bloquerait l'opération, y compris pour un admin.
drop policy if exists messages_delete on public.messages;
create policy messages_delete on public.messages
  for delete
  using (
    sender_email = current_user_email()
    or recipient_email = current_user_email()
    or current_user_status() = 'admin'
  );

-- `session_documents` reste volontairement réservé aux coachs et admins : c'est
-- déjà ce que fait l'interface, qui ne charge les documents que pour eux
-- (SessionDetailModal, `enabled: … && isCoachOrAdmin`). Aucune policy athlète
-- n'est donc ajoutée — l'activation de la RLS ne retire ici aucun usage réel.

-- ─── 2. Activation de la RLS ──────────────────────────────────────────────────
-- Ordre de priorité du rapport : jetons tiers, puis données personnelles.

alter table public.strava_tokens           enable row level security; -- jetons OAuth Strava
alter table public.training_logs           enable row level security; -- données de santé
alter table public.messages                enable row level security; -- correspondance privée
alter table public.user_preferences        enable row level security;
alter table public.clubs                   enable row level security; -- invite_links
alter table public.session_documents       enable row level security;
alter table public.app_settings            enable row level security;
alter table public.coach_branding          enable row level security;
alter table public.events                  enable row level security;
alter table public.groups                  enable row level security;
alter table public.question_bank_items     enable row level security;
alter table public.questionnaire_templates enable row level security;
alter table public.teams                   enable row level security;
