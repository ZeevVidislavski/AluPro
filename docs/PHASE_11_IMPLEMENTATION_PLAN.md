# PHASE_11_IMPLEMENTATION_PLAN.md

## תוכנית מימוש Phase 11 — QuoteEditor.jsx (מיגרציה מלאה)

> **תאריך תכנון:** 2026-08-18 (לילה, ללא נוכחות המשתמשת). נכתב מיד אחרי `PHASE_10_IMPLEMENTATION_PLAN.md`, בעקבות ההחלטה המפורשת של המשתמשת: להרחיב את המיגרציה לכלול גם את `QuoteEditor.jsx` (כי טאב "הזמנות חומר" ב-`ProjectDetails.jsx` תלוי בו — ראו Phase 10 סעיף 1). **הלילה: תכנון בלבד, לא מימוש** (אושר מפורשות על ידי המשתמשת דרך AskUserQuestion).
> **סטטוס:** תכנון בלבד. **שום קוד לא נכתב.**

---

## 0. למה זה קיים ומה הקשר ל-Phase 10

`ProjectDetails.jsx`'s טאב "הזמנות חומר" (`MaterialOrdersTab.jsx` → `materialOrderGenerator.js`) קורא ל-`QuoteItem`/`QuoteItemComponent` — ישויות ששייכות בלעדית ל-`QuoteEditor.jsx`. אי אפשר למגר את הטאב הזה בלי למגר גם את `QuoteEditor.jsx`. המשתמשת אישרה במפורש להרחיב לכלול את שניהם באותו מאמץ מיגרציה (Phase 10 + Phase 11 ביחד), אך ביקשה שהלילה רק התכנון של `QuoteEditor.jsx` ייכתב — לא הקוד.

**סדר תלות בין השלבים:** Phase 11 (QuoteEditor.jsx) → מספק `QuoteItem`/`QuoteItemComponent` ב-Supabase → מאפשר את חלק ה-Material Orders ב-Phase 10. כלומר Phase 11 צריך לרוץ **לפני** שחלק ה-Material Orders ב-Phase 10 יכול להיסגר. שאר Phase 10 (6 הישויות האחרות) **אינו תלוי** ב-Phase 11 ויכול להתקדם במקביל/קודם.

---

## 1. אימות בפועל — מה `QuoteEditor.jsx` עושה (617 שורות, נקרא במלואו)

### 1.1 ישויות בשימוש

| ישות | פעולות | מצב היום |
|---|---|---|
| **`ProjectQuote`** | `filter({id})` (טעינה), `update()` (בתוך `handleSave`) | **קיים חלקית ב-Supabase** — Phase 4 (list+delete, `Quotes.jsx`), Phase 10 (מתוכנן: create+update, `ProjectDetails.jsx`). ב-`QuoteEditor.jsx` צריך רק `get(id)`+`update()` — **שניהם כבר יהיו קיימים ב-`ProjectQuoteService` אחרי Phase 10**, זה רק swap. |
| **`QuoteItem`** | full CRUD | **ישות חדשה לגמרי**, לא קיימת ב-Supabase בשום מקום |
| **`QuoteItemComponent`** | full CRUD | **ישות חדשה לגמרי**, לא קיימת ב-Supabase בשום מקום |
| **`ModelPricing`** | `.list()` (קריאה בלבד) | **כבר קיים ב-Supabase** (Phase 7) — `ModelPricingService.list()` swap ישיר, אין סיכון |
| **`QuoteTemplate`** | `.list()` (קריאה בלבד) | **כבר קיים ב-Supabase** (Phase 7) — swap ישיר |
| **`QuoteTemplateComponent`** | `filter({template_id})`, `create()` (בתוך `handleSaveTemplate`) | **כבר קיים ב-Supabase** (Phase 7, CRUD מלא) — swap ישיר, אין צורך בשינוי סכמה |
| **`CompanyHeader`** | `.list()` (קריאה בלבד) | **כבר קיים ב-Supabase** (Phase 6) — swap ישיר, כולל signed URL ללוגו דרך `CompanyHeaderService.getLogoUrl()` הקיים |
| **`Project`** | `filter({id: quote.project_id})` (קריאה בלבד, לתצוגה ב-PDF) | **כבר קיים ב-Supabase** (Phase 2) — `ProjectService` היום חושף רק `list/create`, **חסר `get(id)`** — יש להוסיף (מתוכנן גם ב-Phase 10 סעיף 4, לא כפילות — אותה תוספת משרתת את שני השלבים) |

**מסקנה חשובה:** מתוך 7 ישויות בקובץ, **5 כבר קיימות ב-Supabase** ורק דורשות swap מכני (ללא שינוי סכמה). **רק 2 ישויות** (`QuoteItem`, `QuoteItemComponent`) הן עבודה אמיתית וחדשה. זה הופך את Phase 11 לקטן משמעותית ממה שנראה על פניו.

### 1.2 זרימת השמירה (`handleSave`) — המורכבת ביותר בקובץ

לולאה דו-רמתית עם ניהול temp-ID:
1. לכל `item` ב-state המקומי (חלקם קיימים ב-DB עם `id` אמיתי, חלקם חדשים עם `_tempId` בלבד) — `create` או `update` לפי אם יש `id`.
2. לכל `component` בתוך אותו item — אותו דבר, `create`/`update` לפי `id`.
3. אחרי יצירת item/component חדש, ה-state המקומי מתעדכן עם ה-`id` האמיתי שחזר מה-DB (כדי שלחיצה נוספת על "שמור" לא תיצור כפילות).
4. בסוף, מחשב טוטלים (`calcQuoteTotals`) ומעדכן את `ProjectQuote` עצמו (`subtotal`, `vat_amount`, `total_with_vat`, `amount`, `is_detailed: true`).

**זו לא עסקה אטומית ב-DB** (כמו היום ב-Base44) — סדרת קריאות רשת נפרדות, אחת אחרי השנייה. אם קריאה אמצעית נכשלת (למשל network blip), חלק מהפריטים יישמרו וחלק לא. **זו התנהגות קיימת שיש לשמר כפי שהיא** (לא לשפר/לשנות ל-Phase 11 בלי אישור נפרד — זה שינוי התנהגות, לא רק swap טכני).

### 1.3 מחיקת item (`deleteItem`)
מוחקת קודם את כל ה-components של ה-item (`Promise.all`), ואז את ה-item עצמו. **hard delete**, לא soft — Base44 המקורי לא עושה soft delete כאן, ואין UI לשחזור. **החלטה נדרשת (סעיף 5):** להשאיר hard delete (תואם להתנהגות היום), או לעבור ל-soft delete (עקבי לשאר הפרויקט, אך משנה סמנטיקה)?

### 1.4 טעינת "תבנית" (`handleLoadTemplate`)
טוען `QuoteTemplateComponent` לפי `template_id` (כבר קיים ב-Supabase, Phase 7), ובונה מהם item זמני חדש (`_tempId`) — **לא נשמר עד `handleSave`**. אין כאן קריאת DB חדשה, רק שימוש ב-Service קיים.

### 1.5 PDF (`handlePDFClick` → `startPDF`)
**אין Storage בזרימה הזו כלל.** PDF נוצר **צד-לקוח בלבד**: `handleSave()` (שומר קודם) → מרנדר `QuotePrintView` ל-DOM נסתר → `html2canvas` מצלם אותו → `jsPDF` בונה PDF → `pdf.save()` מוריד ישירות לדפדפן של המשתמש. **אין upload, אין `file_url`, אין bucket.** זה שונה לגמרי מ-`ProjectQuote.file_url` ב-`ProjectDetails.jsx` (Phase 10) שהוא קובץ **מועלה** (PDF חיצוני שהמשתמש מצרף), לא מיוצר. שני מנגנונים נפרדים ובלתי-תלויים על אותה ישות.

**מסקנה:** Phase 11 **לא דורש Storage bucket חדש** ולא נוגע ב-`project-files` (Phase 10). `startPDF` קורא ל-`handleSave()` (משנה `ProjectQuote`+`QuoteItem`+`QuoteItemComponent`), לא ל-upload endpoint כלשהו.

---

## 2. סכמה נדרשת

### 2.1 `quote_items` — טבלה חדשה

```sql
create table public.quote_items (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null references public.tenants(id) on delete cascade,
  quote_id     uuid not null references public.project_quotes(id),

  width_cm     numeric,
  height_cm    numeric,
  quantity     numeric not null default 1,
  description  text,
  total_price  numeric,
  sort_order   numeric,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index quote_items_tenant_id_idx on public.quote_items (tenant_id) where deleted_at is null;
create index quote_items_quote_id_idx on public.quote_items (quote_id) where deleted_at is null;
```

**תלוי ב-Phase 10:** `quote_id references project_quotes(id)` — ה-INSERT policy צריכה לוודא ש-`quote_id` שייך לאותו tenant, בדיוק כמו `model_components.model_id` (Phase 7). `project_quotes` כבר קיימת (Phase 4/6), אז אין תלות סדר קריטית מעבר לזה שהטבלה חייבת להתקיים — כן קיימת כבר היום.

### 2.2 `quote_item_components` — טבלה חדשה

```sql
create table public.quote_item_components (
  id                       uuid primary key default gen_random_uuid(),
  tenant_id                uuid not null references public.tenants(id) on delete cascade,
  quote_item_id            uuid not null references public.quote_items(id),
  catalog_item_id          uuid references public.model_pricing(id),  -- nullable, snapshot pattern כמו quote_template_components

  name_snapshot            text not null,
  category_snapshot        text,
  pricing_method_snapshot  text not null check (pricing_method_snapshot in ('sqm','meter','unit')),
  price_snapshot           numeric not null,
  quantity                 numeric,
  calculated_value         numeric,
  sort_order               numeric,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index quote_item_components_tenant_id_idx on public.quote_item_components (tenant_id) where deleted_at is null;
create index quote_item_components_quote_item_id_idx on public.quote_item_components (quote_item_id) where deleted_at is null;
```

**זהה במבנה ל-`quote_template_components`** (Phase 7) — אותו snapshot pattern (`name_snapshot`/`category_snapshot`/`pricing_method_snapshot`/`price_snapshot` קפואים בזמן ההוספה, `catalog_item_id` nullable). `pricing_method_snapshot` שומר את אותו enum `sqm|meter|unit` (שונה מ-`model_pricing.pricing_method`), **אותה אי-עקביות ידועה שכבר תועדה ב-Phase 7 סעיף 1.5** — לא לתקן, לשמר.

### 2.3 מחיקה — soft או hard? (תלוי בהחלטה, סעיף 5)

**אם soft (עקבי לשאר הפרויקט):** RPC `soft_delete_quote_item`/`soft_delete_quote_item_component`, אותו דפוס GUC-flag בדיוק כמו כל טבלה קודמת.

**אם hard (תואם ל-Base44 המקורי):** אין RPC, `DELETE` ישיר עם RLS policy רגילה (`for delete using (...)`) — **דפוס שלא קיים עדיין באף מקום בפרויקט** (כל טבלה קודמת עם delete משתמשת ב-soft+RPC). זה יהיה תקדים ראשון ל-hard delete אמיתי, ודורש revisit קטן של ה-"lessons applied" הסטנדרטיים בתחילת כל migration file.

**המלצה בתכנון (לא סופית — סעיף 5 לאישור):** soft delete, לשמור עקביות עם שאר המערכת, גם אם משנה קלות את הסמנטיקה המקורית (רשומות "מחוקות" נשארות בטבלה אך מוסתרות). ה-UI (`deleteItem`) לא ישתנה מבחינת המשתמש.

---

## 3. RLS + GRANT (תבנית סטנדרטית, ללא הפתעות)

```sql
alter table public.quote_items enable row level security;
alter table public.quote_item_components enable row level security;

create policy quote_items_select on public.quote_items
  for select using (deleted_at is null and tenant_id in (select public.user_tenant_ids()));

create policy quote_items_insert on public.quote_items
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and quote_id in (
      select id from public.project_quotes
      where tenant_id in (select public.user_tenant_ids()) and deleted_at is null
    )
  );

create policy quote_items_update on public.quote_items
  for update using (...) with check (...);  -- דפוס סטנדרטי

-- quote_item_components: אותו דפוס, quote_item_id FK check במקום quote_id

grant select, insert, update on public.quote_items to authenticated;
grant select, insert, update on public.quote_item_components to authenticated;
-- + execute על soft-delete RPCs אם מוחלט soft (סעיף 2.3)
```

**תלות מ-Phase 10:** ה-INSERT policy מסתמכת על `project_quotes` שכבר קיימת (לא תלויה בהרחבת ה-CRUD של Phase 10 שם, רק בכך שהטבלה עצמה קיימת — כבר המצב היום).

---

## 4. Services נדרשים

### 4.1 `quoteItemService.js` — חדש
`listByQuote(quoteId)`, `create(data)`, `update(id, data)`, `delete(id)` (soft/hard לפי סעיף 5).

### 4.2 `quoteItemComponentService.js` — חדש
`listByQuoteItem(quoteItemId)`, `listByQuoteItems(quoteItemIds)` (ל-`allComponents` query שטוען הכל בבת אחת דרך `Promise.all` פר-item — **לשמר את אותה צורה בדיוק**, כמו החלטה מקבילה ב-Phase 7 עבור `quote_template_components`), `create`, `update`, `delete`.

### 4.3 שירותים קיימים שרק צריכים תוספת קטנה
- **`projectService.js`** — הוספת `get(id)` (משותף גם ל-Phase 10, לא כפילות עבודה)
- **`projectQuoteService.js`** — כבר יקבל `get`/`update` מ-Phase 10 — `QuoteEditor.jsx` פשוט צורך את מה שכבר שם

### 4.4 ללא שינוי כלל
`modelPricingService.js`, `quoteTemplateService.js`, `quoteTemplateComponentService.js`, `companyHeaderService.js` — כולם כבר תומכים במה שנדרש.

---

## 5. החלטות — הופעלו כברירת מחדל תחת Auto Mode (המשתמשת לא זמינה, יש לתקף בסקירה)

עם מעבר לעבודה ללא עצירות לאישור (Auto Mode), הוחלט להמשיך עם ברירות המחדל שכבר הומלצו במסמך זה, במקום להמתין:

1. **Soft delete** ל-`quote_items`/`quote_item_components` — עקביות עם שאר הפרויקט (כל טבלה אחרת עם delete משתמשת ב-RPC+soft). מומש.
2. **`handleSave`'s multi-step network flow נשמר בדיוק כפי שהוא** — לא אוחד ל-batch insert, לא שונה סמנטית. מומש.
3. **Migration נפרדת ל-Phase 11** (לא מאוחדת עם Phase 10) — מאפשרת בדיקה/rollback עצמאיים. מומש.

### 5.1 באג נוסף שהתגלה בסבב קריאת הקבצים הנלווים (חשוב לתקן, לא לדחות)

**`companyHeader.logo_url`/`h.logo_url` משמשים כ-`<img src>` ישיר בשני מקומות שלא היו ידועים כשנכתב Phase 6:**
- `QuotePrintView.jsx` שורה 41: `<img src={companyHeader.logo_url} ...>`
- `SelectHeaderModal.jsx` שורה 50: `<img src={h.logo_url} ...>`

מאז Phase 6, `company_headers.logo_url` הוא **path פנימי ב-Storage, לא URL ציבורי** — תצוגה דורשת signed URL דרך `CompanyHeaderService.getLogoUrl(path)` (ראה `CompanyHeaders.jsx`'s `useLogoSignedUrl`/`HeaderLogo`, שם זה כבר טופל נכון). שני הקבצים האלה **לא עודכנו אז** כי לא נסרקו כחלק מ-Phase 6 (הם שייכים ל-`QuoteEditor.jsx`, שלא היה בהיקף). **זהו באג אמיתי וקיים כבר היום** (לא נגרם על ידי Phase 11) — לוגו לא יוצג נכון בתצוגה המקדימה של בחירת כותרת ולא ב-PDF שנוצר, כי ה-URL הגולמי (path פנימי לבקט פרטי) לא נגיש ישירות מהדפדפן.

**תוקן כחלק מ-Phase 11:** שני הקבצים עודכנו לפתור signed URL דרך `useLogoSignedUrl`/`HeaderLogo` (מיובא מ-`CompanyHeaders.jsx` או משוכפל באופן מקומי אם import cross-page לא נוח — הוחלט לשכפל hook קטן, כמו בכל שירות אחר בפרויקט, ראו הערת קוד).

---

## 6. מה נשאר מחוץ להיקף גם אחרי Phase 10+11 ביחד

- **`QuotePrintView.jsx`, `QuoteItemCard.jsx`, `CatalogPickerModal.jsx`, `SaveTemplateModal.jsx`/`TemplateModal.jsx`, `LoadTemplateModal.jsx`, `SelectHeaderModal.jsx`** — לא נקראו עדיין השבוע (רק `CatalogPickerModal.jsx` נבדק ב-Phase 7, אושר כ-"לא נוגע ב-Base44"). יש לקרוא את כולם לפני כתיבת קוד בפועל — לא הונח שהם "בטוחים" רק כי הם קומפוננטות תצוגה.
- **הזמנת חומר עצמה** (`MaterialOrder`/`MaterialOrderItem`, Phase 10 סעיף 1) — Phase 11 מספק את `QuoteItem`/`QuoteItemComponent` שהיא תלויה בהם, אך **אינה** ממגרת את הטבלאות/הלוגיקה של `materialOrderGenerator.js` עצמן — זו עדיין עבודה נפרדת (אך קטנה יותר לאחר ש-Phase 11 יושלם, כי התלות שחסמה לגמרי תוסר).

---

## 7. נספח — קבצים שאומתו

- `src/pages/QuoteEditor.jsx` — נקרא במלואו (617 שורות)
- `src/lib/quoteCalculations.js` — נקרא במלואו
- `base44/entities/{QuoteItem,QuoteItemComponent}.jsonc` — נקראו במלואם
- Grep על `base44\.entities\.\w+` בתוך `QuoteEditor.jsx` — אימת רשימת 7 הישויות
- הצלבה מול `src/services/{modelPricingService,quoteTemplateService,quoteTemplateComponentService,companyHeaderService,projectQuoteService,projectService}.js` הקיימים — אישרה אילו כבר תומכים במה שנדרש ואילו צריכים תוספת

**לא נקראו עדיין (יש לקרוא לפני מימוש בפועל):** `QuoteItemCard.jsx`, `QuotePrintView.jsx`, `SaveTemplateModal.jsx`/`TemplateModal.jsx`, `LoadTemplateModal.jsx`, `SelectHeaderModal.jsx`.

---

## 8. מה קרה בפועל

**מומש במלואו תחת Auto Mode (2026-08-18 בוקר), כולל 5 קבצי הקומפוננטות שהיו מסומנים "לא נקראו עדיין" בסעיף 6/7:**

1. **`QuoteItemCard.jsx`, `QuotePrintView.jsx`, `TemplateModal.jsx`, `LoadTemplateModal.jsx`, `SelectHeaderModal.jsx`** — כולם נקראו במלואם. `QuoteItemCard.jsx`/`TemplateModal.jsx`/`LoadTemplateModal.jsx` אינם נוגעים ב-Base44 כלל (מקבלים props/callbacks בלבד) — לא נדרש שינוי.
2. **התגלה באג אמיתי, לא קשור ל-Phase 11 עצמו:** `QuotePrintView.jsx` (שורה 41 המקורית) ו-`SelectHeaderModal.jsx` (שורה 50 המקורית) הציגו `company_headers.logo_url` כ-`<img src>` ישיר, בעוד שמאז Phase 6 זהו path פנימי ב-Storage, לא URL. באג קיים מאז Phase 6 (לא נסרק אז כי שני הקבצים שייכים ל-`QuoteEditor.jsx`, שלא היה בהיקף). **תוקן:** `SelectHeaderModal.jsx` מקבל קומפוננטת `HeaderThumbnail` פנימית שפותרת signed URL; `QuotePrintView.jsx` מקבל `companyHeader.resolvedLogoUrl` מוכן מראש — נפתר ב-`QuoteEditor.jsx`'s `startPDF()` **לפני** הרינדור, כי `html2canvas` מצלם את ה-DOM באופן סינכררוני ולא יכול להמתין ל-`<img>` א-סינכרוני שנטען.
3. **`quoteItemService.js` + `quoteItemComponentService.js`** נכתבו — soft delete, לא hard, בהתאם להחלטת ברירת המחדל תחת Auto Mode (סעיף 5).
4. **`ProjectQuoteService.get(id)` ו-`ProjectService.get` (משותף ל-Phase 10)** נוספו — נדרשו בפועל, לא רק תוכננו.
5. **`QuoteEditor.jsx` עודכן במלואו** — כל 7 הישויות עוברות דרך Services, `handleSave`'s זרימת השמירה הרב-שלבית נשמרה בדיוק כפי שהייתה (לא אוחדה ל-batch).
6. **Migration `0013_quote_editor.sql`** נכתב — `quote_items`+`quote_item_components`, triggers, RPCs, RLS, GRANT.
7. **`npm run build` + Vitest (140/140 עוברים, כולל 2 קבצי בדיקה חדשים ל-`quoteItemService`/`quoteItemComponentService`)** — נבדק, אין רגרסיות.

**מיגרציות 0012+0013 הורצו בהצלחה על ידי המשתמשת ואומתו ידנית** — כל הפעולות בתוך `ProjectDetails.jsx` עבדו (תשלומים/הזמנות/הצעות-מחיר-בתוך-פרויקט/מסמכים/תזכורות/עריכה/סגירת התחשבנות), ו-`QuoteEditor.jsx` פעל תקין (הוספת פריטים, שמירה, תבניות).

**באג נוסף נמצא ותוקן באותו סבב בדיקה:** `Quotes.jsx` (מסך "הצעות מחיר" הנפרד, לא `ProjectDetails.jsx`) עדיין קרא את בורר הפרויקטים שלו ("הצעה חדשה") מ-Base44, ו-`create()` שלו נשאר על Base44 — שריד מכוון מ-Phase 4, שם ההחלטה הייתה שהצעה שנוצרת ב-Supabase תיצור UUID ש-`QuoteEditor.jsx` (אז עוד Base44) לא יזהה. **מכיוון ש-`QuoteEditor.jsx` עבר מיגרציה מלאה הלילה (Phase 11), האילוץ המקורי כבר לא רלוונטי.** `Quotes.jsx` עודכן: בורר הפרויקטים עבר ל-`ProjectService.list()`, ו-`create()` עבר ל-`ProjectQuoteService.create()` — שניהם כבר קיימים, לא נדרש migration נוסף. נבדק: build+140 טסטים עוברים, `base44` הוסר לחלוטין מהקובץ.

**הבהרה לגבי טאב "הזמנות חומר":** נשאר על Base44 בכוונה — תלוי ב-`materialOrderGenerator.js`, שדורש עדכון נפרד (הוא קורא ל-`QuoteItem`/`QuoteItemComponent` בדרך שהתאימה לזרימת היצירה הישנה, לא עודכן הלילה). זה **לא** רגרסיה — זו עבודה שנותרה, מתועדת ב-`PHASE_10_IMPLEMENTATION_PLAN.md` סעיף 1.

---

## 9. באג נוסף שנמצא בבדיקה ידנית (2026-08-18) — constraint שגוי

שמירת הצעת מחיר עם רכיב קטלוג ש-`pricing_method` שלו הוא `meter_width`/`meter_height` נכשלה: `new row for relation "quote_item_components" violates check constraint "...pricing_method_snapshot_check"`.

**סיבת השורש:** ה-CHECK constraint על `pricing_method_snapshot` (גם ב-`quote_item_components` וגם ב-`quote_template_components`, Phase 7) הוגבל ל-`('sqm','meter','unit')` — העתקה נאמנה של הסכמה המקורית ב-Base44 (`QuoteItemComponent.jsonc`/`QuoteTemplateComponent.jsonc` מצהירים רק על 3 הערכים האלה). אבל `model_pricing.pricing_method` — המקור האמיתי ל-snapshot-ים האלה, דרך `CatalogPickerModal` — כולל גם `meter_width`/`meter_height`. Base44, being schemaless, מעולם לא אכף את ה-enum שהוא עצמו הצהיר עליו, אז חוסר ההתאמה הזה היה קיים באפליקציה המקורית בשקט ומעולם לא צף; Postgres אוכף בקפדנות, וזה מה ששבר את השמירה כאן.

**תוקן:** `0014_fix_pricing_method_snapshot_constraint.sql` — מרחיב את שני ה-constraints ל-5 הערכים (`sqm, meter, meter_width, meter_height, unit`), כדי לכסות כל מה ש-`model_pricing` יכול לייצר בפועל. **לא מאחד את שני ה-enum-ים ולא מבטל את ההבחנה** שתועדה ב-Phase 7/11 section 1.5 — רק מתקן את ה-constraint שיתאים למציאות.

---

> **סוף מסמך** — נכתב 2026-08-18 לילה, מומש ואומת 2026-08-18 בבוקר. Phase 11 סגור, כולל תיקון `Quotes.jsx` ותיקון constraint (`0014`).
