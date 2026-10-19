-- ─── Assignation des questionnaires du club à l'athlète connecté ──────────────
--
-- Un athlète ne peut pas modifier les questionnaires (RLS « templates_write »),
-- donc il ne peut pas s'ajouter lui-même aux questionnaires de son club en
-- rejoignant le club ou à la connexion. Cette fonction le fait à sa place, et
-- uniquement pour lui : elle ajoute l'utilisateur connecté aux questionnaires
-- (matin et soir) de son équipe si elle en a, sinon à ceux de son club.
-- Elle n'enlève jamais rien.

CREATE OR REPLACE FUNCTION public.sync_my_club_questionnaires()
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $function$
declare
  v_email text := public.current_user_email();
  v_ids uuid[] := '{}'::uuid[];
  v_club record;
  v_team_ids uuid[];
begin
  if v_email is null then
    return;
  end if;

  for v_club in
    select id,
           coalesce(default_questionnaire_template_ids, '{}'::uuid[])
             || coalesce(evening_questionnaire_template_ids, '{}'::uuid[]) as ids
    from public.clubs
    where v_email = any (athlete_emails)
  loop
    select coalesce(array_agg(x), '{}'::uuid[]) into v_team_ids
    from public.teams t,
         unnest(coalesce(t.questionnaire_template_ids, '{}'::uuid[])
                || coalesce(t.evening_questionnaire_template_ids, '{}'::uuid[])) as x
    where t.club_id = v_club.id
      and v_email = any (t.athlete_emails);

    if cardinality(v_team_ids) > 0 then
      v_ids := v_ids || v_team_ids;
    else
      v_ids := v_ids || v_club.ids;
    end if;
  end loop;

  update public.questionnaire_templates
     set assigned_athletes = coalesce(assigned_athletes, '{}'::text[]) || v_email
   where id = any (v_ids)
     and is_active
     and not (v_email = any (coalesce(assigned_athletes, '{}'::text[])));
end;
$function$;

REVOKE ALL ON FUNCTION public.sync_my_club_questionnaires() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_my_club_questionnaires() TO authenticated, service_role;
