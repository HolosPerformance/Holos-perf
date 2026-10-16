-- ─── Banque de questions : type « Zones douloureuses » ─────────────────────────
--
-- La contrainte sur le type n'acceptait que les types d'origine : enregistrer
-- une question « Zones douloureuses » (body_pain) dans la banque échouait.
-- Son échelle d'intensité est stockée dans scaleOptions, comme une échelle.

ALTER TABLE "public"."question_bank_items"
  DROP CONSTRAINT IF EXISTS "question_bank_items_type_check";

ALTER TABLE "public"."question_bank_items"
  ADD CONSTRAINT "question_bank_items_type_check"
  CHECK ((type = ANY (ARRAY['scale'::text, 'text'::text, 'textarea'::text, 'number'::text, 'select'::text, 'body_pain'::text])));
