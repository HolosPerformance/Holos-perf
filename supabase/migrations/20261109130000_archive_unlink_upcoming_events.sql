-- ─── Archivage : retrait du questionnaire des séances à venir ────────────────
--
-- Une séance planifiée liée à un questionnaire archivé continuerait de le
-- proposer aux athlètes et d'envoyer le rappel d'après-séance.
--
-- Le retrait est fait par un déclencheur, et non par l'application : la RLS ne
-- laisse un entraîneur modifier que ses propres séances, celles d'un autre
-- entraîneur ou d'un administrateur auraient donc gardé le lien sans erreur.
--
-- Les séances passées gardent leur lien, ainsi que celles du jour ayant déjà
-- reçu une réponse : leur détail en a besoin pour afficher les réponses.

CREATE OR REPLACE FUNCTION public.unlink_archived_questionnaire_from_upcoming_events()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $function$
begin
  update public.events e
     set questionnaire_template_id = null
   where e.questionnaire_template_id = new.id
     and e.event_date >= (now() at time zone 'Europe/Paris')::date
     and not exists (
       select 1 from public.questionnaire_responses r where r.event_id = e.id
     );
  return new;
end;
$function$;

REVOKE ALL ON FUNCTION public.unlink_archived_questionnaire_from_upcoming_events() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER questionnaire_templates_archive_unlink_events
  AFTER UPDATE OF archived_at ON public.questionnaire_templates
  FOR EACH ROW
  WHEN (old.archived_at IS NULL AND new.archived_at IS NOT NULL)
  EXECUTE FUNCTION public.unlink_archived_questionnaire_from_upcoming_events();
