-- =====================================================================
-- 0012_seed_model_catalog.sql
--
-- Real catalog data from Zeev (35 components), sourced from a CSV he
-- exported/prepared himself (not from Base44 — Base44 credentials were
-- never available for this migration, so base44/entities/*.jsonc only
-- ever held schema shape, never actual rows; see docs/PHASE_2
-- _IMPLEMENTATION_PLAN.md). Seeded into the one existing tenant
-- ("alupro-demo") as a starting catalog — each tenant is expected to own
-- and edit its own copy from here (no shared/global catalog table).
--
-- Category/pricing_method values below are mapped from the Hebrew source
-- labels to this table's CHECK-constrained English values (all 7
-- category values and all 4 pricing_method values used in the source
-- data match existing constraints in 0009_model_catalog.sql — no schema
-- change needed):
--   מבנה->structure, תוספת->addon, סדרה->series, תריס->shutter,
--   מנוע->motor, זכוכית->glass, רשת->mesh
--   מר"->sqm, מ' רץ גובה->meter_height, מ' רץ רוחב->meter_width, יחידה->unit
-- =====================================================================

insert into public.model_pricing (tenant_id, model_name, category, pricing_method, base_price, notes, is_active)
select t.id, v.model_name, v.category, v.pricing_method, v.base_price, v.notes, true
from public.tenants t
cross join (values
  ('גג פנל קבוע אלומיניום',                    'structure', 'sqm',          1100, null),
  ('הלבשה בומבה גובה',                          'addon',     'meter_height',   50, null),
  ('הלבשה בומבה רוחב',                          'addon',     'meter_width',    50, null),
  ('חלון פתיחה קיפ קטן',                        'series',    'unit',         1400, null),
  ('תריס רפפה חלון מסגרת נפרדת',                'shutter',   'sqm',          1900, null),
  ('מנוע לתריס קליל',                           'motor',     'unit',         1200, null),
  ('מסתור תריס חיצוני אלומיניום',               'shutter',   'meter_width',   900, null),
  ('תריס רפפה כיס',                             'shutter',   'sqm',          1700, null),
  ('חלוקה בלגי רוחב',                           'series',    'meter_width',   300, null),
  ('חלוקה בלגי גובה',                           'series',    'meter_height',  300, null),
  ('פתיחה בלגי 4300',                           'series',    'sqm',          2500, null),
  ('הזזה בלגי 7300',                            'series',    'sqm',          2500, null),
  ('תריס משוך 61',                              'shutter',   'sqm',           450, null),
  ('מנוע סומפי רדיו',                           'motor',     'unit',         1800, null),
  ('חלון 7000 מסילה 40',                        'series',    'sqm',          1400, null),
  ('דלת 4900',                                  'series',    'sqm',          4500, null),
  ('ידית בהלה כפול עם בריחים',                  'addon',     'unit',         4500, null),
  ('ידית בהלה',                                 'addon',     'unit',         1800, null),
  ('מחזיר שמן לדלת כפולה עם מתאם סגירה',        'addon',     'unit',         5000, null),
  ('מחזיר שמן',                                 'addon',     'unit',            1, null),
  ('ידית משיכה צינור',                          'addon',     'unit',         1000, null),
  ('זכוכית Low-e',                              'glass',     'sqm',             1, null),
  ('זכוכית סנרג''י',                            'glass',     'sqm',             1, null),
  ('זכוכית צלון',                               'glass',     'sqm',          1800, 'ל9200'),
  ('תוספת תריס אור',                            'shutter',   'sqm',           550, 'שלב מידי'),
  ('רשת נשלפת',                                 'mesh',      'unit',          350, 'רשת שקופה'),
  ('רשת קלה',                                   'mesh',      'unit',          280, 'רשת שקופה'),
  ('רשת 7000',                                  'mesh',      'unit',         1000, 'רשת שקופה'),
  ('רשת ויטרינה 9000',                          'mesh',      'unit',         1200, 'רשת שקופה'),
  ('הזזה 9000 3 כנפיים',                        'series',    'sqm',          1900, null),
  ('הזזה 9000 2 כנפים',                         'series',    'sqm',          1850, null),
  ('ארגז OpenArt',                              'shutter',   'meter_width',   950, 'המחיר ללא משקוף עיוור'),
  ('מנוע קליל מנעולה',                          'motor',     'unit',         1600, 'משקל גדול'),
  ('מנגנון דרייקיפ קליל',                       'addon',     'unit',          850, null)
) as v(model_name, category, pricing_method, base_price, notes)
where t.slug = 'alupro-demo';

-- =====================================================================
-- Verification
-- =====================================================================

select count(*) as inserted_count from public.model_pricing mp
join public.tenants t on t.id = mp.tenant_id
where t.slug = 'alupro-demo';
