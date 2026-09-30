-- ─── Élévation de privilèges via profiles ─────────────────────────────────────
--
-- La policy `profiles_update_own` autorise un utilisateur à modifier sa propre
-- ligne avec `WITH CHECK (id = auth.uid())`, sans aucune restriction de colonne.
-- N'importe quel athlète connecté pouvait donc, par un simple appel à l'API :
--
--   PATCH /rest/v1/profiles?id=eq.<son id>   {"user_status": "admin"}
--
-- et devenir administrateur. Vérifié en local : le compte de test est passé de
-- `athlete` à `admin` en un appel.
--
-- Trois conséquences distinctes, toutes exploitables par le même défaut :
--
--   * `user_status` / `role` → accès administrateur complet.
--   * `is_approved`         → contournement de l'approbation par un admin, qui
--                             est aujourd'hui le seul garde-fou à l'inscription.
--   * `email`               → les policies identifient l'utilisateur via
--                             `current_user_email()`, qui lit `profiles.email`.
--                             Reprendre l'adresse d'un autre athlète donne accès
--                             à ses données.
--   * `can_access_*`        → octroi de vues réservées aux coachs.
--
-- PostgreSQL ne sait pas restreindre des colonnes depuis une policy RLS, et les
-- privilèges au niveau colonne bloqueraient aussi les admins, qui passent par le
-- même rôle `authenticated`. On passe donc par un trigger.

create or replace function public.profiles_guard_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Opérations serveur (service_role, migrations, seed) : pas de restriction.
  if auth.uid() is null then
    return new;
  end if;

  -- Les administrateurs gèrent statuts, approbations et droits d'accès.
  if public.get_my_user_status() = 'admin' then
    return new;
  end if;

  if new.email                           is distinct from old.email
     or new.user_status                     is distinct from old.user_status
     or new.role                            is distinct from old.role
     or new.is_approved                     is distinct from old.is_approved
     or new.can_access_club_view            is distinct from old.can_access_club_view
     or new.can_access_individual_view      is distinct from old.can_access_individual_view
     or new.can_access_subjective_data_page is distinct from old.can_access_subjective_data_page
     or new.can_access_objective_data_page  is distinct from old.can_access_objective_data_page
  then
    raise exception
      'Modification non autorisée : statut, approbation, e-mail et droits d''accès sont réservés aux administrateurs.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_columns on public.profiles;
create trigger profiles_guard_privileged_columns
  before update on public.profiles
  for each row
  execute function public.profiles_guard_privileged_columns();
