-- =====================================================================
-- 0027_quote_item_spec.sql
-- Technical-spec fields on quote_items, used by the contractor/customer
-- "מפרט טכני ודגמים משורטטים" PDFs (QuoteSpecPrintView.jsx).
-- All nullable text; no RLS/trigger changes needed (existing policies and
-- protect_immutable_columns_quote_items cover whole rows).
-- Not yet run against any Supabase project: run it BEFORE using the new
-- fields in the editor, otherwise saving an item that has them will fail.
-- =====================================================================

alter table public.quote_items
  add column if not exists location       text,  -- e.g. סלון, מטבח
  add column if not exists opening_type   text,  -- key from src/lib/quoteSpec.js OPENING_TYPES
  add column if not exists profile_series text,  -- e.g. 9200 מחוזק
  add column if not exists system_type    text,  -- e.g. חלון הזזה דו כנפי
  add column if not exists glazing        text,  -- זיגוג
  add column if not exists shading        text;  -- תריס / רשת
