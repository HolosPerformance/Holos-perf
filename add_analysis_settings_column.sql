-- Réglages des menus « AFE » et « Analyse réseau » du Coach Dashboard
-- (indicateurs exclus, groupes de couleurs, paramètres), enregistrés par utilisateur.
-- À exécuter une fois dans l'éditeur SQL de Supabase.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS analysis_settings jsonb;
