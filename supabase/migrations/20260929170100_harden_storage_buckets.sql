-- ─── Buckets de stockage : création versionnée + durcissement ─────────────────
--
-- Reprend `create_storage_buckets.sql` (jusqu'ici exécuté à la main dans
-- l'éditeur SQL, d'où une stack locale sans aucun bucket alors que la prod en a
-- quatre), et corrige deux défauts :
--
--   1. `session-documents` était public : un bucket public Supabase est lisible
--      sans authentification par quiconque connaît l'URL. Pour des documents
--      attachés à des athlètes, c'est une exposition. Il passe en privé, servi
--      par URL signée (voir SessionDetailModal).
--
--      Les types acceptés sont limités au PDF : la fonctionnalité n'est pas
--      encore utilisée (0 objet dans le bucket) et les administrateurs ont
--      indiqué que l'usage prévu est le PDF. Aucun import existant ne peut
--      donc être cassé. Élargir la liste plus tard est un changement d'une
--      ligne.
--
--   2. Les policies d'upload n'exigeaient que « être authentifié ». N'importe
--      quel athlète pouvait donc déposer n'importe quel fichier dans le bucket
--      de n'importe quel club. L'upload est réservé aux coachs et admins, qui
--      sont les seuls à en avoir l'usage dans l'app.
--
-- `branding`, `clubs` et `questionnaire-images` restent publics : ce sont des
-- logos et visuels destinés à être affichés sans authentification.

-- ─── 1. Buckets ───────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('branding',             'branding',             true, 5242880,
   array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']),
  ('clubs',                'clubs',                true, 5242880,
   array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']),
  ('questionnaire-images', 'questionnaire-images', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']),
  ('session-documents',    'session-documents',    false, 20971520, array['application/pdf'])
on conflict (id) do nothing;

-- Applique le durcissement même si le bucket préexiste (cas de la production).
update storage.buckets
set public = false,
    file_size_limit = 20971520,
    allowed_mime_types = array['application/pdf']
where id = 'session-documents';

-- ─── 2. Policies ──────────────────────────────────────────────────────────────

-- Anciennes policies « tout authentifié » et lecture publique de session-documents.
drop policy if exists "Authenticated users can upload to branding"             on storage.objects;
drop policy if exists "Authenticated users can upload to clubs"                on storage.objects;
drop policy if exists "Authenticated users can upload to session-documents"    on storage.objects;
drop policy if exists "Authenticated users can upload to questionnaire-images" on storage.objects;
drop policy if exists "Public read from session-documents"                     on storage.objects;

-- Lecture publique des visuels : volontaire.
do $$
begin
  if not exists (select 1 from pg_policies
                 where schemaname='storage' and tablename='objects'
                   and policyname='Public read from branding') then
    create policy "Public read from branding" on storage.objects
      for select to public using (bucket_id = 'branding');
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='storage' and tablename='objects'
                   and policyname='Public read from clubs') then
    create policy "Public read from clubs" on storage.objects
      for select to public using (bucket_id = 'clubs');
  end if;
  if not exists (select 1 from pg_policies
                 where schemaname='storage' and tablename='objects'
                   and policyname='Public read from questionnaire-images') then
    create policy "Public read from questionnaire-images" on storage.objects
      for select to public using (bucket_id = 'questionnaire-images');
  end if;
end $$;

-- Upload réservé aux coachs et admins, sur les quatre buckets.
drop policy if exists "storage_upload_staff" on storage.objects;
create policy "storage_upload_staff" on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('branding','clubs','questionnaire-images','session-documents')
    and public.current_user_status() = any (array['coach','coach_pro','admin'])
  );

drop policy if exists "storage_update_staff" on storage.objects;
create policy "storage_update_staff" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('branding','clubs','questionnaire-images','session-documents')
    and public.current_user_status() = any (array['coach','coach_pro','admin'])
  );

drop policy if exists "storage_delete_staff" on storage.objects;
create policy "storage_delete_staff" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('branding','clubs','questionnaire-images','session-documents')
    and public.current_user_status() = any (array['coach','coach_pro','admin'])
  );

-- Lecture de session-documents : coachs et admins uniquement, ce qui correspond
-- à l'usage réel (SessionDetailModal ne charge les documents que pour eux).
-- Les fichiers sont désormais servis par URL signée, jamais par URL publique.
drop policy if exists "session_documents_read" on storage.objects;
create policy "session_documents_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'session-documents'
    and public.current_user_status() = any (array['coach','coach_pro','admin'])
  );
