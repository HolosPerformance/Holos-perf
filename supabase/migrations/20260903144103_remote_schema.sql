SET local check_function_bodies = off;

CREATE TABLE "public"."app_settings" (
  "id"         uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "key"        text                     NOT NULL,
  "value"      text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "app_settings_key_key" UNIQUE (key),
  CONSTRAINT "app_settings_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."athlete_profiles" (
  "id"            uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "athlete_email" text                     NOT NULL,
  "athlete_name"  text,
  "first_name"    text,
  "last_name"     text,
  "birth_date"    date,
  "sport"         text,
  "position"      text,
  "height_cm"     numeric,
  "weight_kg"     numeric,
  "notes"         text,
  "photo_url"     text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "athlete_profiles_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."athlete_profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."clubs" (
  "id"                                 uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "name"                               text                     NOT NULL,
  "coach_emails"                       text[]                   NOT NULL DEFAULT '{}'::text[],
  "athlete_emails"                     text[]                   NOT NULL DEFAULT '{}'::text[],
  "invite_links"                       jsonb                    DEFAULT '[]'::jsonb,
  "default_questionnaire_template_id"  uuid,
  "default_questionnaire_template_ids" uuid[]                   DEFAULT '{}'::uuid[],
  "main_team_name"                     text                     DEFAULT 'Équipe principale'::text,
  "primary_color"                      text,
  "secondary_color"                    text,
  "logo_url"                           text,
  "created_at"                         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                         timestamp with time zone NOT NULL DEFAULT now(),
  "can_access_subjective_data_page"    boolean                  NOT NULL DEFAULT true,
  "can_access_objective_data_page"     boolean                  NOT NULL DEFAULT true,
  CONSTRAINT "clubs_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."coach_branding" (
  "id"              uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "coach_email"     text                     NOT NULL,
  "primary_color"   text                     DEFAULT '#3b82f6'::text,
  "secondary_color" text,
  "club_name"       text,
  "club_logo_url"   text,
  "created_at"      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "coach_branding_coach_email_key" UNIQUE (coach_email),
  CONSTRAINT "coach_branding_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."events" (
  "id"                        uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "title"                     text                     NOT NULL,
  "theme"                     text,
  "description"               text,
  "user_email"                text                     NOT NULL,
  "event_date"                date                     NOT NULL,
  "start_time"                text                     DEFAULT '08:00'::text,
  "duration_minutes"          integer,
  "session_category"          text                     DEFAULT 'seance_terrain'::text,
  "session_color"             text                     DEFAULT '#f97316'::text,
  "assigned_athletes"         text[]                   DEFAULT '{}'::text[],
  "recurrence"                text                     DEFAULT 'none'::text,
  "recurrence_days"           text[]                   DEFAULT '{}'::text[],
  "recurrence_end_date"       date,
  "created_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "end_time"                  text,
  "is_training_session"       boolean                  DEFAULT false,
  "questionnaire_template_id" uuid,
  CONSTRAINT "events_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."groups" (
  "id"             uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "name"           text                     NOT NULL,
  "coach_email"    text                     NOT NULL,
  "athlete_emails" text[]                   NOT NULL DEFAULT '{}'::text[],
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "groups_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."messages" (
  "id"              uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "sender_email"    text                     NOT NULL,
  "recipient_email" text                     NOT NULL,
  "content"         text                     NOT NULL,
  "is_read"         boolean                  NOT NULL DEFAULT false,
  "created_date"    timestamp with time zone NOT NULL DEFAULT now(),
  "created_at"      timestamp with time zone DEFAULT now(),
  CONSTRAINT "messages_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."profiles" (
  "id"                              uuid                     NOT NULL,
  "email"                           text                     NOT NULL,
  "full_name"                       text,
  "first_name"                      text,
  "last_name"                       text,
  "birth_date"                      date,
  "user_status"                     text                     NOT NULL DEFAULT 'athlete'::text,
  "role"                            text                     NOT NULL DEFAULT 'user'::text,
  "is_approved"                     boolean                  NOT NULL DEFAULT false,
  "can_access_club_view"            boolean                  DEFAULT false,
  "can_access_individual_view"      boolean                  DEFAULT true,
  "can_access_subjective_data_page" boolean                  DEFAULT true,
  "can_access_objective_data_page"  boolean                  DEFAULT true,
  "avatar_url"                      text,
  "created_at"                      timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                      timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profiles_email_key" UNIQUE (email),
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id),
  CONSTRAINT "profiles_user_status_check" CHECK ((user_status = ANY (ARRAY['athlete'::text, 'coach'::text, 'coach_pro'::text, 'admin'::text])))
);

ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."question_bank_items" (
  "id"               uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "label"            text                     NOT NULL,
  "athlete_label"    text,
  "description"      text,
  "type"             text                     NOT NULL,
  "required"         boolean                  DEFAULT false,
  "scale_options"    jsonb                    DEFAULT '{}'::jsonb,
  "select_options"   jsonb                    DEFAULT '{}'::jsonb,
  "created_by_email" text,
  "created_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"       timestamp with time zone NOT NULL DEFAULT now(),
  "athleteLabel"     text                     DEFAULT ''::text,
  "scaleOptions"     jsonb,
  "selectOptions"    jsonb,
  CONSTRAINT "question_bank_items_pkey" PRIMARY KEY (id),
  CONSTRAINT "question_bank_items_type_check" CHECK ((type = ANY (ARRAY['scale'::text, 'text'::text, 'textarea'::text, 'number'::text, 'select'::text])))
);

CREATE TABLE "public"."questionnaire_responses" (
  "id"             uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "template_id"    uuid,
  "event_id"       uuid,
  "athlete_email"  text                     NOT NULL,
  "athlete_name"   text,
  "responses"      jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "submitted_date" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "questionnaire_responses_pkey" PRIMARY KEY (id)
);

ALTER TABLE "public"."questionnaire_responses"
  ENABLE ROW LEVEL SECURITY;

CREATE TABLE "public"."questionnaire_templates" (
  "id"                        uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "name"                      text                     NOT NULL,
  "description"               text,
  "questions"                 jsonb                    NOT NULL DEFAULT '[]'::jsonb,
  "is_active"                 boolean                  NOT NULL DEFAULT true,
  "is_master_template"        boolean                  NOT NULL DEFAULT false,
  "assigned_coaches"          text[]                   DEFAULT '{}'::text[],
  "assigned_athletes"         text[]                   DEFAULT '{}'::text[],
  "auto_assigned_athletes"    text[]                   DEFAULT '{}'::text[],
  "assigned_to_coach_email"   text,
  "parent_master_template_id" uuid,
  "last_modified_by_email"    text,
  "style"                     jsonb                    DEFAULT '{}'::jsonb,
  "created_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                timestamp with time zone NOT NULL DEFAULT now(),
  "created_by_email"          text,
  CONSTRAINT "questionnaire_templates_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."session_documents" (
  "id"          uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "event_id"    uuid,
  "file_name"   text                     NOT NULL,
  "file_url"    text                     NOT NULL,
  "uploaded_by" text,
  "created_at"  timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "session_documents_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."strava_tokens" (
  "id"            uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "athlete_email" text                     NOT NULL,
  "access_token"  text,
  "refresh_token" text,
  "expires_at"    bigint,
  "athlete_id"    text,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "strava_tokens_athlete_email_key" UNIQUE (athlete_email),
  CONSTRAINT "strava_tokens_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."teams" (
  "id"                         uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "name"                       text                     NOT NULL,
  "club_id"                    uuid,
  "athlete_emails"             text[]                   NOT NULL DEFAULT '{}'::text[],
  "coach_emails"               text[]                   NOT NULL DEFAULT '{}'::text[],
  "questionnaire_template_ids" uuid[]                   DEFAULT '{}'::uuid[],
  "created_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"                 timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "teams_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."training_logs" (
  "id"                 uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "athlete_email"      text                     NOT NULL,
  "athlete_name"       text,
  "training_date"      date                     NOT NULL,
  "session_type"       text,
  "duration_minutes"   integer,
  "contenu_seance"     text,
  "fatigue"            numeric,
  "intensite"          numeric,
  "sommeil"            numeric,
  "plaisir"            numeric,
  "harmonie_proches"   numeric,
  "maitrise_technique" numeric,
  "maitrise_tactique"  numeric,
  "epanouissement"     numeric,
  "douleurs_zones"     jsonb                    DEFAULT '{}'::jsonb,
  "commentaire"        text,
  "created_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"         timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "training_logs_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."user_preferences" (
  "id"            uuid                     NOT NULL DEFAULT extensions.uuid_generate_v4(),
  "athlete_email" text                     NOT NULL,
  "preferences"   jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "user_preferences_athlete_email_key" UNIQUE (athlete_email),
  CONSTRAINT "user_preferences_pkey" PRIMARY KEY (id)
);

CREATE OR REPLACE FUNCTION public.current_user_email()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
  select email from public.profiles
  where id = auth.uid()
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.current_user_status()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
  select user_status from public.profiles
  where id = auth.uid()
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_user_status()
  RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  AS $function$
  SELECT user_status FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  AS $function$
begin
  insert into public.profiles (id, email, full_name, first_name, last_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', '')
  );
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  AS $function$
begin new.updated_at = now(); return new; end;
$function$;

ALTER TABLE "public"."profiles"
  ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE "public"."questionnaire_responses"
  ADD CONSTRAINT "fk_qr_event" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE SET NULL;

ALTER TABLE "public"."questionnaire_responses"
  ADD CONSTRAINT "questionnaire_responses_template_id_fkey" FOREIGN KEY (template_id) REFERENCES public.questionnaire_templates(id) ON DELETE SET NULL;

ALTER TABLE "public"."questionnaire_templates"
  ADD CONSTRAINT "questionnaire_templates_parent_master_template_id_fkey" FOREIGN KEY (parent_master_template_id) REFERENCES public.questionnaire_templates(id);

ALTER TABLE "public"."session_documents"
  ADD CONSTRAINT "session_documents_event_id_fkey" FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE;

ALTER TABLE "public"."teams"
  ADD CONSTRAINT "teams_club_id_fkey" FOREIGN KEY (club_id) REFERENCES public.clubs(id) ON DELETE CASCADE;

CREATE INDEX idx_athlete_profiles_email ON public.athlete_profiles USING btree (athlete_email);

CREATE INDEX idx_events_date ON public.events USING btree (event_date);

CREATE INDEX idx_events_user_email ON public.events USING btree (user_email);

CREATE INDEX idx_groups_coach_email ON public.groups USING btree (coach_email);

CREATE INDEX idx_messages_created ON public.messages USING btree (created_date DESC);

CREATE INDEX idx_messages_recipient ON public.messages USING btree (recipient_email);

CREATE INDEX idx_messages_sender ON public.messages USING btree (sender_email);

CREATE INDEX idx_messages_unread ON public.messages USING btree (recipient_email, is_read)
  WHERE (is_read = false);

CREATE INDEX idx_questionnaire_responses_athlete ON public.questionnaire_responses USING btree (athlete_email);

CREATE INDEX idx_questionnaire_responses_date ON public.questionnaire_responses USING btree (submitted_date DESC);

CREATE INDEX idx_questionnaire_responses_template ON public.questionnaire_responses USING btree (template_id);

CREATE INDEX idx_session_documents_event ON public.session_documents USING btree (event_id);

CREATE INDEX idx_teams_club_id ON public.teams USING btree (club_id);

CREATE UNIQUE INDEX idx_training_logs_athlete_date ON public.training_logs USING btree (athlete_email, training_date);

CREATE INDEX idx_training_logs_athlete ON public.training_logs USING btree (athlete_email);

CREATE INDEX idx_training_logs_date ON public.training_logs USING btree (training_date DESC);

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER athlete_profiles_updated_at
  BEFORE UPDATE ON public.athlete_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER clubs_updated_at
  BEFORE UPDATE ON public.clubs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER coach_branding_updated_at
  BEFORE UPDATE ON public.coach_branding
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER question_bank_items_updated_at
  BEFORE UPDATE ON public.question_bank_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER questionnaire_responses_updated_at
  BEFORE UPDATE ON public.questionnaire_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER questionnaire_templates_updated_at
  BEFORE UPDATE ON public.questionnaire_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER strava_tokens_updated_at
  BEFORE UPDATE ON public.strava_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER training_logs_updated_at
  BEFORE UPDATE ON public.training_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "app_settings_select" ON "public"."app_settings"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "app_settings_write" ON "public"."app_settings"
  FOR ALL
  TO PUBLIC
  USING ((public.current_user_status() = 'admin'::text));

CREATE POLICY "athlete_profiles_all" ON "public"."athlete_profiles"
  FOR ALL
  TO PUBLIC
  USING (((athlete_email = public.current_user_email()) OR (public.current_user_status() = ANY (ARRAY['coach'::text, 'coach_pro'::text, 'admin'::text]))));

CREATE POLICY "athlete_profiles_insert_own" ON "public"."athlete_profiles"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((athlete_email = auth.email()));

CREATE POLICY "athlete_profiles_insert_staff" ON "public"."athlete_profiles"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.user_status = ANY (ARRAY['admin'::text, 'coach'::text, 'coach_pro'::text]))))));

CREATE POLICY "athlete_profiles_select_own" ON "public"."athlete_profiles"
  FOR SELECT
  TO "authenticated"
  USING ((athlete_email = auth.email()));

CREATE POLICY "athlete_profiles_staff_all" ON "public"."athlete_profiles"
  FOR ALL
  TO "authenticated"
  USING ((public.get_my_user_status() = ANY (ARRAY['coach'::text, 'coach_pro'::text, 'admin'::text])))
  WITH CHECK ((public.get_my_user_status() = ANY (ARRAY['coach'::text, 'coach_pro'::text, 'admin'::text])));

CREATE POLICY "athlete_profiles_update_own" ON "public"."athlete_profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((athlete_email = auth.email()))
  WITH CHECK ((athlete_email = auth.email()));

CREATE POLICY "athlete_profiles_update_staff" ON "public"."athlete_profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.user_status = ANY (ARRAY['admin'::text, 'coach'::text, 'coach_pro'::text]))))));

CREATE POLICY "clubs_all" ON "public"."clubs"
  FOR ALL
  TO PUBLIC
  USING (((public.current_user_email() = ANY (coach_emails)) OR (public.current_user_email() = ANY (athlete_emails)) OR (public.current_user_status() = 'admin'::text)));

CREATE POLICY "clubs_update_staff" ON "public"."clubs"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.user_status = ANY (ARRAY['admin'::text, 'coach'::text, 'coach_pro'::text]))))));

CREATE POLICY "coach_branding_select" ON "public"."coach_branding"
  FOR SELECT
  TO PUBLIC
  USING (true);

CREATE POLICY "coach_branding_write" ON "public"."coach_branding"
  FOR ALL
  TO PUBLIC
  USING (((coach_email = public.current_user_email()) OR (public.current_user_status() = 'admin'::text)));

CREATE POLICY "events_select" ON "public"."events"
  FOR SELECT
  TO PUBLIC
  USING (((user_email = public.current_user_email()) OR (public.current_user_email() = ANY (assigned_athletes)) OR (public.current_user_status() = 'admin'::text)));

CREATE POLICY "events_write" ON "public"."events"
  FOR ALL
  TO PUBLIC
  USING (((user_email = public.current_user_email()) OR (public.current_user_status() = 'admin'::text)));

CREATE POLICY "groups_all" ON "public"."groups"
  FOR ALL
  TO PUBLIC
  USING (((coach_email = public.current_user_email()) OR (public.current_user_email() = ANY (athlete_emails)) OR (public.current_user_status() = 'admin'::text)));

CREATE POLICY "messages_insert" ON "public"."messages"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((sender_email = public.current_user_email()));

CREATE POLICY "messages_select" ON "public"."messages"
  FOR SELECT
  TO PUBLIC
  USING (((sender_email = public.current_user_email()) OR (recipient_email = public.current_user_email()) OR (public.current_user_status() = 'admin'::text)));

CREATE POLICY "messages_update" ON "public"."messages"
  FOR UPDATE
  TO PUBLIC
  USING (((recipient_email = public.current_user_email()) OR (public.current_user_status() = 'admin'::text)));

CREATE POLICY "profiles_admin_all" ON "public"."profiles"
  FOR ALL
  TO "authenticated"
  USING ((public.get_my_user_status() = 'admin'::text))
  WITH CHECK ((public.get_my_user_status() = 'admin'::text));

CREATE POLICY "profiles_select_own" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING ((id = auth.uid()));

CREATE POLICY "profiles_select" ON "public"."profiles"
  FOR SELECT
  TO PUBLIC
  USING ((auth.role() = 'authenticated'::text));

CREATE POLICY "profiles_staff_select_all" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING ((public.get_my_user_status() = ANY (ARRAY['coach'::text, 'coach_pro'::text, 'admin'::text])));

CREATE POLICY "profiles_update_own" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((id = auth.uid()))
  WITH CHECK ((id = auth.uid()));

CREATE POLICY "profiles_update" ON "public"."profiles"
  FOR UPDATE
  TO PUBLIC
  USING ((auth.uid() = id));

CREATE POLICY "question_bank_all" ON "public"."question_bank_items"
  FOR ALL
  TO PUBLIC
  USING ((public.current_user_status() = ANY (ARRAY['coach'::text, 'coach_pro'::text, 'admin'::text])));

CREATE POLICY "coaches_can_submit_for_athletes" ON "public"."questionnaire_responses"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((athlete_email = ( SELECT profiles.email
   FROM public.profiles
  WHERE (profiles.id = auth.uid()))) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.user_status = ANY (ARRAY['coach'::text, 'coach_pro'::text, 'admin'::text])))))));

CREATE POLICY "qr_admin_all" ON "public"."questionnaire_responses"
  FOR ALL
  TO "authenticated"
  USING ((public.get_my_user_status() = 'admin'::text))
  WITH CHECK ((public.get_my_user_status() = 'admin'::text));

CREATE POLICY "qr_coach_select_group_or_club" ON "public"."questionnaire_responses"
  FOR SELECT
  TO "authenticated"
  USING (((public.get_my_user_status() = ANY (ARRAY['coach'::text, 'coach_pro'::text])) AND ((athlete_email IN ( SELECT unnest(groups.athlete_emails) AS unnest
   FROM public.groups
  WHERE (groups.coach_email = auth.email()))) OR (athlete_email IN ( SELECT unnest(clubs.athlete_emails) AS unnest
   FROM public.clubs
  WHERE (auth.email() = ANY (clubs.coach_emails)))))));

CREATE POLICY "qr_insert_own" ON "public"."questionnaire_responses"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((athlete_email = auth.email()));

CREATE POLICY "qr_select_own" ON "public"."questionnaire_responses"
  FOR SELECT
  TO "authenticated"
  USING ((athlete_email = auth.email()));

CREATE POLICY "qr_update_own" ON "public"."questionnaire_responses"
  FOR UPDATE
  TO "authenticated"
  USING ((athlete_email = auth.email()))
  WITH CHECK ((athlete_email = auth.email()));

CREATE POLICY "responses_insert" ON "public"."questionnaire_responses"
  FOR INSERT
  TO PUBLIC
  WITH CHECK ((athlete_email = public.current_user_email()));

CREATE POLICY "responses_select" ON "public"."questionnaire_responses"
  FOR SELECT
  TO PUBLIC
  USING (((athlete_email = public.current_user_email()) OR (public.current_user_status() = ANY (ARRAY['coach'::text, 'coach_pro'::text, 'admin'::text]))));

CREATE POLICY "responses_update" ON "public"."questionnaire_responses"
  FOR UPDATE
  TO PUBLIC
  USING (((athlete_email = public.current_user_email()) OR (public.current_user_status() = ANY (ARRAY['coach'::text, 'coach_pro'::text, 'admin'::text]))));

CREATE POLICY "templates_select" ON "public"."questionnaire_templates"
  FOR SELECT
  TO PUBLIC
  USING
    (((public.current_user_email() = ANY (assigned_athletes)) OR (public.current_user_email() = ANY (assigned_coaches)) OR (public.current_user_status() = ANY (ARRAY['coach'::text,
    'coach_pro'::text, 'admin'::text]))));

CREATE POLICY "templates_write" ON "public"."questionnaire_templates"
  FOR ALL
  TO PUBLIC
  USING ((public.current_user_status() = ANY (ARRAY['coach'::text, 'coach_pro'::text, 'admin'::text])));

CREATE POLICY "session_documents_all" ON "public"."session_documents"
  FOR ALL
  TO PUBLIC
  USING ((public.current_user_status() = ANY (ARRAY['coach'::text, 'coach_pro'::text, 'admin'::text])));

CREATE POLICY "strava_tokens_all" ON "public"."strava_tokens"
  FOR ALL
  TO PUBLIC
  USING (((athlete_email = public.current_user_email()) OR (public.current_user_status() = 'admin'::text)));

CREATE POLICY "teams_all" ON "public"."teams"
  FOR ALL
  TO PUBLIC
  USING (((public.current_user_email() = ANY (coach_emails)) OR (public.current_user_email() = ANY (athlete_emails)) OR (public.current_user_status() = 'admin'::text)));

CREATE POLICY "teams_delete_staff" ON "public"."teams"
  FOR DELETE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.user_status = ANY (ARRAY['admin'::text, 'coach'::text, 'coach_pro'::text]))))));

CREATE POLICY "teams_insert_staff" ON "public"."teams"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.user_status = ANY (ARRAY['admin'::text, 'coach'::text, 'coach_pro'::text]))))));

CREATE POLICY "teams_update_staff" ON "public"."teams"
  FOR UPDATE
  TO "authenticated"
  USING ((EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.user_status = ANY (ARRAY['admin'::text, 'coach'::text, 'coach_pro'::text]))))));

CREATE POLICY "training_logs_select" ON "public"."training_logs"
  FOR SELECT
  TO PUBLIC
  USING (((athlete_email = public.current_user_email()) OR (public.current_user_status() = ANY (ARRAY['coach'::text, 'coach_pro'::text, 'admin'::text]))));

CREATE POLICY "training_logs_write" ON "public"."training_logs"
  FOR ALL
  TO PUBLIC
  USING (((athlete_email = public.current_user_email()) OR (public.current_user_status() = ANY (ARRAY['coach'::text, 'coach_pro'::text, 'admin'::text]))));

CREATE POLICY "user_preferences_all" ON "public"."user_preferences"
  FOR ALL
  TO PUBLIC
  USING (((athlete_email = public.current_user_email()) OR (public.current_user_status() = ANY (ARRAY['coach'::text, 'coach_pro'::text, 'admin'::text]))));

CREATE POLICY "Authenticated users can upload to branding" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((bucket_id = 'branding'::text));

CREATE POLICY "Authenticated users can upload to clubs" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((bucket_id = 'clubs'::text));

CREATE POLICY "Authenticated users can upload to questionnaire-images" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((bucket_id = 'questionnaire-images'::text));

CREATE POLICY "Authenticated users can upload to session-documents" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((bucket_id = 'session-documents'::text));

CREATE POLICY "Public read from branding" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'branding'::text));

CREATE POLICY "Public read from clubs" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'clubs'::text));

CREATE POLICY "Public read from questionnaire-images" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'questionnaire-images'::text));

CREATE POLICY "Public read from session-documents" ON "storage"."objects"
  FOR SELECT
  TO PUBLIC
  USING ((bucket_id = 'session-documents'::text));

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."messages";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."profiles";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."questionnaire_responses";

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."training_logs";

GRANT EXECUTE ON FUNCTION "public"."current_user_email"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."current_user_status"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."get_my_user_status"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."handle_new_user"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO PUBLIC, "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."app_settings" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."athlete_profiles" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."clubs" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."coach_branding" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."events" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."groups" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."messages" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."question_bank_items" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."questionnaire_responses" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."questionnaire_templates" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."session_documents" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."strava_tokens" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."teams" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."training_logs" TO "anon", "authenticated", "postgres", "service_role";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."user_preferences" TO "anon", "authenticated", "postgres", "service_role";

