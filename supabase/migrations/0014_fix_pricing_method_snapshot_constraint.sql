-- =====================================================================
-- 0014_fix_pricing_method_snapshot_constraint.sql
-- Bug fix, found 2026-08-18 during manual testing of QuoteEditor.jsx
-- (Phase 11): saving a quote item failed with
-- "new row for relation quote_item_components violates check constraint
-- quote_item_components_pricing_method_snapshot_check" whenever a real
-- catalog item used pricing_method 'meter_width' or 'meter_height'.
--
-- Root cause: quote_item_components.pricing_method_snapshot and
-- quote_template_components.pricing_method_snapshot were both
-- constrained to ('sqm','meter','unit') — faithfully copying Base44's
-- original JSON schema for QuoteItemComponent/QuoteTemplateComponent
-- (base44/entities/QuoteItemComponent.jsonc,
-- base44/entities/QuoteTemplateComponent.jsonc both only declare
-- sqm/meter/unit). But model_pricing.pricing_method (the actual source
-- of these snapshots, via CatalogPickerModal) uses
-- sqm/meter_width/meter_height/unit — a real, wider enum. Base44 being
-- schemaless never enforced its own declared enum, so this mismatch
-- silently existed in the original app too and never surfaced; Postgres
-- enforces it strictly, which is what broke saving here.
--
-- Fix: widen both CHECK constraints to accept the same 4 values as
-- model_pricing.pricing_method. This does NOT unify the two enums or
-- remove the distinction documented in PHASE_7/11 section 1.5 — it just
-- makes the constraint match reality (every value model_pricing can
-- actually produce), rather than a narrower list nothing enforced
-- upstream anyway.
--
-- This file has not been run against any Supabase project.
-- =====================================================================

alter table public.quote_item_components
  drop constraint quote_item_components_pricing_method_snapshot_check;

alter table public.quote_item_components
  add constraint quote_item_components_pricing_method_snapshot_check
  check (pricing_method_snapshot in ('sqm','meter','meter_width','meter_height','unit'));

alter table public.quote_template_components
  drop constraint quote_template_components_pricing_method_snapshot_check;

alter table public.quote_template_components
  add constraint quote_template_components_pricing_method_snapshot_check
  check (pricing_method_snapshot in ('sqm','meter','meter_width','meter_height','unit'));

-- =====================================================================
-- End of 0014_fix_pricing_method_snapshot_constraint.sql
-- =====================================================================
