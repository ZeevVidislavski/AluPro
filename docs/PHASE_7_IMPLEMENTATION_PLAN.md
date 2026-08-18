# PHASE_7_IMPLEMENTATION_PLAN.md

## תוכנית מימוש Phase 7 — קטלוג רכיבים + תבניות (ModelPricing, ModelComponent, QuoteTemplate, QuoteTemplateComponent)

> **תאריך תכנון:** 2026-08-16
> **סטטוס:** תכנון סופי, ממתין למימוש. **לא בוצע שום שינוי קוד. לא נוצר migration.**
> **תנאי מקדים:** Phase 1-6 הושלמו ואומתו. לקחים חייבים ליישום: GRANT מפורש מההתחלה (טבלאות + sequences/functions/buckets), אימות UUID ישיר, בדיקת פערי מזהים/מערכות חוצות לפני מימוש (לא רק אחריו), Storage RLS כבר אומת עובד ב-Phase 6.

---

## 0. היקף — מה כן ומה לא

**כן:** 4 ישויות, כולן CRUD מלא, המהוות יחד את "קטלוג הרכיבים ותבניות" שמוצג במסך `ModelPricing.jsx`:
1. **`ModelPricing`** — דגם/רכיב בקטלוג (`list`, `create`, `update`, `delete`)
2. **`ModelComponent`** — "מתכון הייצור" של דגם (פרופילים/זכוכית/פרזול/אביזר עם נוסחת חישוב אורך/רוחב) — `filter({model_id})`, `create`, `update` (כולל bulk update לשמירת `calculated_length/width`), `delete`
3. **`QuoteTemplate`** — תבנית הצעת מחיר שמורה (`list`, `create`, `update`, `delete`)
4. **`QuoteTemplateComponent`** — רכיבי תבנית (snapshot של רכיב קטלוג בזמן ההוספה לתבנית) — `filter({template_id})`, `create`, `update` (רק `price_snapshot`), `delete`

**קבצי UI מושפעים (4, אומתו בקוד):**
- `src/pages/ModelPricing.jsx` — המסך הראשי, שתי טאבים (קטלוג + תבניות)
- `src/components/models/ModelComponentsTab.jsx` — טאב "רכיבי ייצור" בתוך דיאלוג עריכת דגם, כולל מחשבון אורך/רוחב עם שמירה חוזרת (`handleSaveCalcResults`)
- `src/components/templates/TemplateComponentsManager.jsx` — ניהול רכיבי תבנית בתוך שורה מורחבת בטאב "תבניות"
- `src/components/quotes/CatalogPickerModal.jsx` — **לא נוגע ב-Base44 ישירות** (מאומת: Grep החזיר אפס תוצאות) — מקבל `catalogItems` כ-prop, לא צריך שינוי

**לא:** `QuoteEditor.jsx` (שורות 135, 140, 323, 326, 345) ממשיך לקרוא ל-Base44 עבור `ModelPricing`/`QuoteTemplate`/`QuoteTemplateComponent` — נשאר קבוע מחוץ להיקף (כמו בכל שלב קודם). מכיוון ש-`QuoteEditor.jsx` לא עובר, **דגמים/תבניות שנוצרים דרך המסך החדש (Supabase) לא יופיעו ב-QuoteEditor** — אותו פער בדיוק כמו `CompanyHeader` ב-Phase 6 (ראו שם סעיף 8). זה מגביל את התועלת המעשית של Phase 7 עד ש-`QuoteEditor.jsx` עצמו יעבור, אך התוכנית ממשיכה כי המסך `ModelPricing.jsx` עצמו כן ישמש לניהול הקטלוג באופן עצמאי (יתרון: מוכן מראש למעבר עתידי של QuoteEditor).

---

## 1. אימות בפועל — מה הקוד עושה

נקראו במלואם: `ModelPricing.jsx` (469 שורות), `ModelComponentsTab.jsx` (215+ שורות, קטע רלוונטי), `TemplateComponentsManager.jsx` (112 שורות), Grep על `CatalogPickerModal.jsx`. ממצאים:

1. **`ModelPricing` CRUD:** `list()`, `create()`, `update(id,data)`, `delete(id)` — סטנדרטי, ללא ניואנס מיוחד.
2. **`ModelComponent`:** נקרא תמיד עם `filter({model_id: modelId})`, לא `list()` גורף — יש לתמוך בסינון לפי `model_id` ב-Service. `handleSaveCalcResults` (שורה 198-213) מבצע **bulk update מקבילי** (`Promise.all`) על מספר רכיבים בבת אחת — לשמור בדיוק את אותה יכולת (לא `list`+ לולאה טבעית, אלא `update` פר-רכיב על מזהים ידועים מראש).
3. **`QuoteTemplate`:** `list()`, `create()`, `update()`, `delete()` — רגיל, אך יצירה כרוכה תמיד ביצירת `QuoteTemplateComponent` נלווים (ראו הבא) — לא עסקה אטומית ב-DB (אין טרנזקציה מפורשת גם היום ב-Base44 — `Promise.all` בלבד), לא לשנות התנהגות.
4. **`QuoteTemplateComponent`:** נקרא עם `filter({template_id})` פר-תבנית (`ModelPricing.jsx` שורה 115, בתוך `Promise.all` על כל התבניות במקביל). `create()` מבצע **snapshot** של שדות מ-`ModelPricing` בזמן ההוספה (`name_snapshot`, `pricing_method_snapshot`, `price_snapshot`) — לא FK חי, קפוא בזמן ההוספה, נשאר קבוע גם אם ה-`ModelPricing` המקורי משתנה אח"כ. `update()` בפועל תמיד רק על `price_snapshot` (מ-`TemplateComponentsManager.jsx` שורה 77) — עדכון מחיר ידני בתבנית, ללא נגיעה ב-snapshot אחר.
5. **אי-עקביות enum קיימת (לא לתקן, לתעד):** `ModelPricing.pricing_method` הוא `sqm|meter_width|meter_height|unit`, אך `QuoteTemplateComponent.pricing_method_snapshot` הוא `sqm|meter|unit` (חסר `meter_width`/`meter_height`, יש `meter` כללי שלא קיים ב-`ModelPricing`). אושר גם ב-`quoteCalculations.js` (`PRICING_METHOD_LABELS` ממפה גם `meter` וגם `meter_width` לאותה תווית) וב-`TemplateComponentsManager.jsx` (שורות 8-14, אותה מפה כפולה). זו אי-עקביות קיימת ב-Base44, לא משהו שנוצר בהעברה — הסכמה ב-Supabase תשמר את שני ה-enum-ים בדיוק כפי שהם (לא לאחד).

---

## 2. סכמה

```sql
create table public.model_pricing (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,

  model_name     text not null,
  category       text not null default 'product'
                   check (category in ('product','series','structure','shutter','motor','mesh','addon','glass','other')),
  pricing_method text not null default 'sqm'
                   check (pricing_method in ('sqm','meter_width','meter_height','unit')),
  base_price     numeric not null,
  notes          text,
  is_active      boolean not null default true,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create table public.model_components (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          uuid not null references public.tenants(id) on delete cascade,
  model_id           uuid not null references public.model_pricing(id) on delete cascade,

  component_type     text not null check (component_type in ('profile','glass','hardware','accessory')),
  item_code          text not null,
  quantity           numeric not null default 1,
  length_base        text check (length_base in ('opening_width','opening_height','fixed')),
  length_op1         text not null default 'none' check (length_op1 in ('none','add','subtract','multiply','divide')),
  length_val1        numeric,
  length_op2         text not null default 'none' check (length_op2 in ('none','add','subtract','multiply','divide')),
  length_val2        numeric,
  width_base         text check (width_base in ('opening_width','opening_height','fixed')),
  width_op1          text not null default 'none' check (width_op1 in ('none','add','subtract','multiply','divide')),
  width_val1         numeric,
  width_op2          text not null default 'none' check (width_op2 in ('none','add','subtract','multiply','divide')),
  width_val2         numeric,
  calculated_length  numeric,
  calculated_width   numeric,
  notes              text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create table public.quote_templates (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,

  name         text not null,
  description  text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create table public.quote_template_components (
  id                        uuid primary key default gen_random_uuid(),
  tenant_id                 uuid not null references public.tenants(id) on delete cascade,
  template_id               uuid not null references public.quote_templates(id) on delete cascade,
  catalog_item_id           uuid references public.model_pricing(id),  -- nullable: snapshot, המקור עשוי להימחק

  name_snapshot             text not null,
  category_snapshot         text,
  pricing_method_snapshot   text not null check (pricing_method_snapshot in ('sqm','meter','unit')),  -- enum שונה במכוון מ-model_pricing.pricing_method, ראו סעיף 1.5
  price_snapshot            numeric not null,
  sort_order                numeric,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index model_components_model_id_idx on public.model_components (model_id) where deleted_at is null;
create index quote_template_components_template_id_idx on public.quote_template_components (template_id) where deleted_at is null;
```

**הערות עיצוב:**
- `model_components.model_id` ו-`quote_template_components.template_id` הם `not null` (תמיד תלויים ברשומת-אב בתוך אותו batch של Phase 7) — בניגוד ל-`reminders.project_id` (חוצה-Phase, nullable).
- `catalog_item_id` ב-`quote_template_components` **כן** nullable — כי זהו snapshot; אם ה-`model_pricing` המקורי נמחק (soft delete), התבנית עדיין תציג את השם/מחיר השמור.
- **מחיקה = soft delete דרך RPC**, עקבי לכל שאר הישויות עם delete בפרויקט. 4 RPCs: `soft_delete_model_pricing`, `soft_delete_model_component`, `soft_delete_quote_template`, `soft_delete_quote_template_component`.
- `on delete cascade` בין הטבלאות (ל-tenant ול-model/template) הוא ברמת FK בלבד — לא קשור ל-soft delete; אם `tenants` נמחק fyi (לא בשימוש כרגע), ה-hard cascade יפעל. Soft delete ברמת האפליקציה נשאר נפרד, כמו בכל טבלה קודמת.

---

## 3. RLS + Triggers + GRANT

דפוס זהה למדויק לכל הטבלאות הקודמות עם delete (`customers`, `project_quotes`, `company_headers`):
- טריגר `protect_immutable_columns_<table>` לכל אחת מ-4 הטבלאות — חוסם שינוי `created_by`/`tenant_id` תמיד, חוסם שינוי `deleted_at` ללא ה-GUC flag.
- RPC `soft_delete_<table>(id)` — SECURITY DEFINER, בודק הרשאה (`owner`/`admin`/`member`) לפי `tenant_id`, מפעיל flag, מעדכן, מכבה flag.
- RLS: `select`/`insert`/`update` policies לכל טבלה, `tenant_id in (select user_tenant_ids())`.
- **`model_components`/`quote_template_components`:** בדיקת INSERT נוספת — `model_id`/`template_id` חייבים להשתייך לאותו tenant (כמו `project_quotes.project_id` ב-Phase 4):
```sql
and model_id in (select id from public.model_pricing where tenant_id in (select user_tenant_ids()) and deleted_at is null)
```
- GRANT: `select, insert, update` על 4 הטבלאות, `execute` על 4 ה-RPCs, ל-`authenticated`.

---

## 4. Services נדרשים

4 קבצים, דפוס זהה לכל השירותים הקודמים:

- **`modelPricingService.js`** — `list()`, `create()`, `update()`, `delete()` (soft, RPC)
- **`modelComponentService.js`** — `listByModel(modelId)` (לא `list()` גורף — תמיד מסונן), `create(modelId, data)` (מזריק `model_id`), `update(id, data)`, `updateMany(updates)` (bulk, ל-`handleSaveCalcResults` — `Promise.all` פנימי על מערך `{id, data}`), `delete(id)` (soft, RPC)
- **`quoteTemplateService.js`** — `list()`, `create()`, `update()`, `delete()` (soft, RPC)
- **`quoteTemplateComponentService.js`** — `listByTemplate(templateId)`, `listByTemplates(templateIds)` (עבור ה-`Promise.all` הקיים ב-`ModelPricing.jsx` — או לחלופין שינוי לקריאה אחת עם `in (...)`, להחליט בזמן מימוש), `create(data)`, `update(id, data)`, `delete(id)` (soft, RPC)

כל 4 ה-Services מזריקים `tenant_id`/`created_by` ב-`create()` (דפוס `getActiveTenantId` הרגיל, משוכפל בכוונה כמו בכל שירות קודם).

---

## 5. עדכוני קוד נדרשים

| קובץ | שינוי |
|---|---|
| `ModelPricing.jsx` | `base44.entities.ModelPricing/QuoteTemplate/QuoteTemplateComponent` → Services המתאימים (5 mutations + 2 queries) |
| `ModelComponentsTab.jsx` | `base44.entities.ModelComponent` → `ModelComponentService` (כולל `handleSaveCalcResults` → `updateMany`) |
| `TemplateComponentsManager.jsx` | `base44.entities.QuoteTemplateComponent` → `QuoteTemplateComponentService` |
| `CatalogPickerModal.jsx` | **אין שינוי** — לא נוגע ב-Base44 |

**4 קבצים בפועל (3 טעונים שינוי + 1 ללא שינוי, מתועד לשלמות)** — היקף דומה ל-Phase 3/5.

---

## 6. סדר צעדים מוצע

1. Migration: 4 טבלאות + 4 triggers + 4 RPCs + RLS + GRANT
2. 4 קבצי Service + עדכון `services/index.js`
3. עדכון 3 קבצי UI (סעיף 5)
4. בדיקות Vitest ל-4 ה-Services (כולל `updateMany`/`listByModel`/`listByTemplate`)
5. המשתמשת מריצה migration ב-Supabase SQL Editor
6. בדיקה ידנית: יצירת דגם קטלוג + רכיבי ייצור + מחשבון אורך/רוחב עם שמירה, יצירת תבנית מהקטלוג, עריכת מחיר שמור בתבנית, מחיקת רכיב/תבנית
7. עדכון מסמך זה עם "מה קרה בפועל"

---

## 8. מה קרה בפועל

**מומש ואומת במלואו על ידי המשתמשת בדפדפן — ללא באגים.** Migration (`0009_model_catalog.sql`) רץ בהצלחה בפעם הראשונה (4 טבלאות, triggers, RPCs, RLS, GRANT). 4 השירותים נבדקו גם ב-Vitest (29 בדיקות חדשות בזמן הכתיבה, לימים חלק מ-86 שעברו בסה"כ באותו סבב).

בדיקה ידנית שאושרה: יצירת דגם קטלוג, הוספת רכיבי ייצור כולל שימוש במחשבון אורך/רוחב ושמירת התוצאות (`updateMany`), יצירת תבנית מהקטלוג, עריכת מחיר שמור בתוך תבנית, מחיקת רכיב/תבנית — הכל עבד כצפוי בניסיון הראשון.

שתי ההחלטות הפתוחות מסעיף 7 (שימור צורת ה-`Promise.all` הקיימת ל-`listByTemplate`, שימור אי-העקביות ב-enum `pricing_method`) אושרו על ידי המשתמשת מראש ולא נדרשו שינויים.

הפער היחיד שנותר הוא הידוע-מראש: `QuoteEditor.jsx` ממשיך לקרוא ל-Base44 עבור `ModelPricing`/`QuoteTemplate`/`QuoteTemplateComponent`, כך שדגמים/תבניות חדשים לא מופיעים שם — אותה מגבלה כמו `CompanyHeader` ב-Phase 6, לא באג לתיקון בשלב זה.

---

## 7. סיכונים / החלטות פתוחות (לאישור המשתמשת לפני מימוש)

1. **`listByTemplates` (רבים) מול `listByTemplate` (יחיד) + `Promise.all`:** הקוד הקיים מבצע `Promise.all` על כל תבנית בנפרד (שאילתה נפרדת לכל תבנית). ניתן לשמר בדיוק את אותה צורה (`listByTemplate` פר-תבנית, קריאה מרובה), או לשפר לקריאה אחת עם `template_id in (...)`. **המלצה: לשמר את הצורה הקיימת בשלב זה** (עקביות עם עיקרון "לא לשנות התנהגות שלא התבקשה"), לשקול אופטימיזציה בעתיד אם תתגלה כאיטית בפועל.
2. **אי-עקביות ה-enum (`meter` מול `meter_width`/`meter_height`)** — לא בהיקף לתקן, רק לתעד ולשמר בדיוק כפי שהיא (ראו סעיף 1.5).
3. **הפער עם `QuoteEditor.jsx`** — מוכר מראש מסעיף 0, אותה מגבלה מבנית כמו `CompanyHeader` ב-Phase 6.

---

## נספח — קבצים שאומתו לצורך מסמך זה

- `src/pages/ModelPricing.jsx` — נקרא במלואו (469 שורות)
- `src/components/models/ModelComponentsTab.jsx` — נקרא (קטע רלוונטי, שורות 120-220)
- `src/components/templates/TemplateComponentsManager.jsx` — נקרא במלואו (112 שורות)
- `src/components/quotes/CatalogPickerModal.jsx` — Grep בלבד, אישר אפס שימוש ב-`base44`
- `base44/entities/{ModelPricing,ModelComponent,QuoteTemplate,QuoteTemplateComponent}.jsonc` — נקראו במלואם
- Grep גלובלי על `base44\.entities\.\w+` בכל `src/pages` ו-`src/components` — אישר שאין קובץ נוסף שנוגע ב-4 הישויות מלבד השלושה שסומנו לשינוי, ושה-`QuoteEditor.jsx` הוא היחיד שנשאר תלוי בהן דרך Base44

---

> **סוף מסמך** — 2026-08-16. מומש ואומת במלואו על ידי המשתמשת בדפדפן. Phase 7 סגור.
