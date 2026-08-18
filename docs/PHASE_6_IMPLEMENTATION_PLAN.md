# PHASE_6_IMPLEMENTATION_PLAN.md

## תוכנית מימוש Phase 6 — CompanyHeader (CRUD מלא) + Supabase Storage לראשונה

> **תאריך תכנון:** 2026-08-16 | **עדכון החלטות היקף:** 2026-08-16
> **סטטוס:** תכנון סופי, ממתין למימוש. **לא בוצע שום שינוי קוד. לא הותקנו חבילות. לא נוצר migration חדש. לא נוצר Storage bucket.**
>
> **החלטות שהתקבלו (2026-08-16), משלימות את השאלות הפתוחות בסעיף 7:**
> 1. **מחיקה = soft delete דרך RPC**, עקבי לשאר המערכת (`customers`, `project_quotes`).
> 2. **תוקף signed URL לתצוגה = שעה אחת** (3600 שניות), עקבי ל-`STORAGE_MIGRATION.md` הישן.
> 3. **"הסר לוגו" מנתק רק את `logo_url` בטבלה (`= null`)** — לא מוחק את הקובץ מ-Storage. קובץ יתום נשאר ב-bucket עד ניקוי עתידי (לא בהיקף Phase 6).
> **תנאי מקדים:** Phase 1-5 הושלמו ואומתו. לקחים חייבים ליישום: GRANT מפורש מההתחלה (כולל sequences/functions/**buckets**), אימות UUID ישיר, בדיקת פערי מזהים/מערכות חוצות (Phase 4) לפני מימוש.

---

## 0. היקף — מה כן ומה לא, ולמה זה שונה מכל שלב קודם

**כן:** `CompanyHeader` — `list`, `create`, `update`, `delete` (CRUD מלא — אומת בקוד, כל הפעולות קיימות ב-`CompanyHeaders.jsx`). **וגם**: העלאת קובץ לוגו — מעבר מ-Base44 `Core.UploadFile` ל-**Supabase Storage**.

**זהו השלב הראשון שדורש יותר מ-DDL/RLS/Service.** כל 6 השלבים הקודמים היו "רק" נתונים מובנים (טקסט/מספר/תאריך/UUID). Phase 6 מוסיף שכבה חדשה לגמרי: **קבצים בינאריים**. זה אומר:
- Bucket חדש ב-Supabase Storage (לא טבלה)
- Storage Policies (סוג RLS נפרד, לא זהה לזה שכתבנו עד כה)
- זרימת upload שונה לגמרי מ-`INSERT`/`UPDATE` רגיל (upload דו-שלבי: קובץ ← Storage, ואז URL/path ← טבלה)

**לא:** אין ישות נוספת בהיקף. `QuoteEditor.jsx` גם קורא ל-`CompanyHeader.list()` (שורה 145) — נשאר Base44 (לא עובר, אינו בהיקף), בדיוק כמו ש-`Project.list()` הישן נשאר ב-`Quotes.jsx`'s create עד Phase 4.

---

## 1. אימות בפועל — מה `CompanyHeaders.jsx` עושה

נקרא במלואו (154 שורות, גם בסבב אודיט קודם וגם עכשיו). ממצאים:

1. **CRUD מלא, 4 פעולות:** `list()`, `create()`/`update()` (משולבים תחת `save` mutation לפי `editId`), `delete()`, **ו-mutation נוסף** `setDefault` — לוקח `Promise.all` על **כל** ה-headers כדי לאפס `is_default` לכולם חוץ מהנבחר (שורה 40). זו לוגיקה עדינה ("רק רשומה אחת יכולה להיות ברירת מחדל") שצריך לשמר.
2. **Upload:** `base44.integrations.Core.UploadFile({ file })` (שורה 53) מחזיר `{ file_url }` — public URL קבוע, ללא הגבלת תוקף (אומת ב-`VENDOR_LOCK_IN_ANALYSIS.md`/`STORAGE_MIGRATION.md` מוקדם יותר בפרויקט: "URL ציבורי, ללא הרשאות").
3. **אין `project_id`/`tenant`-scoping טבעי בסכמה המקורית** — `CompanyHeader` הוא entity "גלובלי" מבחינת Base44 (אין FK לשום דבר). ב-Supabase, `tenant_id` עדיין יתווסף (כמו כל טבלה), אבל אין FK חוצה-ישות לבדוק ב-RLS INSERT (בניגוד ל-`project_quotes`/`reminders`).

---

## 2. סכמה — `company_headers`

```sql
create table public.company_headers (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,

  name          text not null,
  company_name  text,
  logo_url      text,  -- יוחלף ל-Storage path/public URL, ראו סעיף 3
  subtitle      text,
  is_default    boolean not null default false,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);
```

**הוחלט: soft delete דרך RPC** (`soft_delete_company_header`), עקבי לכל השלבים הקודמים עם delete (`customers`, `project_quotes`) — למרות ש-`CompanyHeaders.jsx` מבצע `remove.mutate(h.id)` ללא `window.confirm` (בניגוד ל-`Quotes.jsx`), זו עדיין מחיקת נתון עסקי שכדאי לשמר להיסטוריה.

---

## 3. Supabase Storage — תכנון ראשוני (חדש לגמרי בפרויקט זה)

### 3.1 Bucket
```sql
insert into storage.buckets (id, name, public) values ('company-logos', 'company-logos', false);
```
**לא `public: true`** — למרות ש-Base44 היום משתמש ב-URL ציבורי, זו בדיוק ההזדמנות לתקן את זה (כפי ש-`STORAGE_MIGRATION.md` כבר המליץ בזמנו: "קבצים פרטיים, גישה רק עם signed URL"). גישה תהיה דרך signed URLs עם תוקף מוגבל, לא URL קבוע לצמיתות.

### 3.2 מבנה path
```
{tenant_id}/company-headers/{header_id}/{timestamp}_{sanitized_filename}
```
תואם למבנה שכבר תוכנן ב-`STORAGE_MIGRATION.md` (מ-Audit קודם), מותאם ל-tenant.

### 3.3 Storage Policies (RLS על `storage.objects`, לא טבלה רגילה)
```sql
create policy company_logos_select on storage.objects
  for select using (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] in (select public.user_tenant_ids()::text)
  );

create policy company_logos_insert on storage.objects
  for insert with check (
    bucket_id = 'company-logos'
    and (storage.foldername(name))[1] in (select public.user_tenant_ids()::text)
  );
```
**הערה:** תחביר `storage.foldername()` וההתנהגות המדויקת של Storage RLS **לא אומתו מול Supabase חי בסבב זה** — זה תחום חדש (לא רק "טבלה נוספת עם אותו דפוס"), יש לבדוק בזמן המימוש בפועל, בדיוק כפי שה-GRANT על sequence התברר שגוי ב-Phase 2 עד שנבדק בפועל.

### 3.4 זרימת Upload חדשה ב-`CompanyHeaderService`
```js
async uploadLogo(file, headerId) {
  const path = `${tenantId}/company-headers/${headerId}/${Date.now()}_${sanitize(file.name)}`;
  const { error } = await supabase.storage.from('company-logos').upload(path, file);
  if (error) throw error;
  const { data } = await supabase.storage.from('company-logos').createSignedUrl(path, 3600);
  return { path, signedUrl: data.signedUrl };
}
```
**שינוי משמעותי מ-Base44:** `logo_url` בטבלה יאחסן **path פנימי** (`{tenant_id}/company-headers/...`), לא URL ציבורי מוכן. התצוגה (`<img src={h.logo_url} />`) תצטרך signed URL שנוצר **בזמן קריאה**, לא נשמר סטטית — משנה את קוד ה-render, לא רק את ה-upload.

---

## 4. GRANT — כולל Storage הפעם, לא רק טבלה

```sql
grant select, insert, update, delete on public.company_headers to authenticated;
-- Storage: grants נפרדים על storage.objects (מנוהל ע"י Supabase Storage API, לא GRANT SQL רגיל בהכרח — לאמת בזמן מימוש)
```

**זהו לקח חדש שלא נבדק בשום שלב קודם** — Storage grants לא בהכרח עובדים באותה מנגנון כמו טבלאות רגילות. **לא לשחזר את הבאג מ-Phase 2** (הנחה לא-מאומתת שהוכחה שגויה) — יש לבדוק את מסמכי Supabase Storage הרשמיים או לבדוק ישירות בזמן המימוש, לא להניח לפי אנלוגיה לטבלאות.

---

## 5. Service נדרש

**`companyHeaderService.js`** — `list()`, `create()`, `update()`, `delete()` (soft, לפי החלטה בסעיף 2), `setDefault(id)` (מיישם את הלוגיקה המיוחדת מ-`CompanyHeaders.jsx` שורה 40), **`uploadLogo(file, headerId)`** (חדש, סעיף 3.4), **`getLogoUrl(path)`** (יוצר signed URL לתצוגה).

---

## 6. עדכוני קוד נדרשים

| קובץ | שינוי |
|---|---|
| `CompanyHeaders.jsx` | `base44.entities.CompanyHeader.*` → `CompanyHeaderService.*`; `handleUpload` → `CompanyHeaderService.uploadLogo`; תצוגת `<img src={h.logo_url}>` → צריכה signed URL (לא ישיר מה-DB) |

**קובץ יחיד** — אך שינוי איכותי גדול יותר מכל שלב קודם, בגלל Storage.

---

## 7. החלטות שהתקבלו (סוכמו בראש המסמך, מפורטות כאן)

1. **Soft delete** דרך RPC — כמו כל שאר הישויות עם delete.
2. **תוקף signed URL = שעה אחת (3600s)**.
3. **"הסר לוגו"** מנתק `logo_url = null` בטבלה בלבד — לא נוגע ב-Storage. קבצים יתומים ינוקו בעתיד (לא בהיקף).

---

## 8. מה קרה בפועל — פער בין התוכנית לביצוע

**הקוד מומש במלואו וה-migration רץ בהצלחה בפעם הראשונה** — כולל Storage bucket ו-Storage RLS policies (`company_logos_select`/`company_logos_insert`), שהיו מסומנים כ"לא אומת" בתכנון. בניגוד ל-Phase 2 (שם הנחה לא-מאומתת על GRANT התבררה שגויה), כאן ה-syntax של `storage.foldername()` וה-GRANT על הטבלה עבדו כמתוכנן ללא תיקון נדרש.

1. **Migration (`0008_company_headers.sql`):** רץ נקי בסביבת ה-SQL Editor של Supabase — "Success. No rows returned", ללא שגיאות בטבלה, בטריגר, ב-RPC, ב-RLS, ב-bucket creation, או ב-Storage policies. זהו השלב הראשון שבו התכנון ל-Storage (התחום החדש) לא דרש שום תיקון post-hoc.
2. **`companyHeaderService.js`:** נבדק גם ב-Vitest (13 בדיקות חדשות, כולל mocking ל-`supabase.storage.from().upload()`/`.createSignedUrl()` — הפעם הראשונה שבדיקות בפרויקט נדרשות למוקאפ Storage API, לא רק `.from(table)`/`.rpc()`). סה"כ 57 בדיקות עוברות (13 חדשות + 44 קיימות), 3 מדולגות (כרגיל, `rls.test.js`), אפס רגרסיות.
3. **`CompanyHeaders.jsx`:** קומפילציה נקייה מול שרת ה-dev (`curl` → 200) אושרה לפני בדיקה ידנית.

**באג/פער חדש שהתגלה — לא באג בקוד שנכתב, אלא פער ארכיטקטוני שלא זוהה בתכנון המקורי:**

`QuoteEditor.jsx` (שורה 145) קורא ל-`base44.entities.CompanyHeader.list()` כדי למלא את ה-dropdown לבחירת כותרת (לוגו + שם חברה) שתופיע בראש הצעת מחיר PDF (שורות 143-145, 385, 587, 610). **`QuoteEditor.jsx` לא עבר בהיקף Phase 6** (כמו בכל שלב קודם — מוגדר קבוע כלא-בהיקף), ולכן ממשיך לקרוא ל-Base44 בלבד.

**המשמעות בפועל:** כותרת שנוצרת היום דרך המסך החדש (`CompanyHeaders.jsx`, מגובה Supabase) **לא מופיעה בכלל** ב-dropdown של `QuoteEditor.jsx` — משום ששתי המערכות (Base44 ו-Supabase) מנותקות לחלוטין מבחינת `CompanyHeader`, ואין דרך היום ליצור כותרת "משני הצדדים" בו-זמנית (אין גישה ל-Base44 admin/API ליצירת רשומה שם). זה תואם את המגבלה הקבועה של הפרויקט (חוסר גישה ל-Base44) אך **לא צוין במפורש** ב-סעיף 0/1 של מסמך זה לפני המימוש — פער בתכנון, לא בקוד.

**זה לא "באג" הניתן לתיקון בתוך Phase 6** (אין דרך לכתוב ל-Base44), אלא מגבלה מובנית שתישאר עד ש-`QuoteEditor.jsx` עצמו יעבור מיגרציה (וגם אז תידרש תוכנית הפעלה — data migration חד-פעמית של כותרות קיימות מ-Base44 ל-Supabase, לא רק swap קוד). מתועד כאן כדי שלא "ייעלם" בין השלבים.

**בדיקה ידנית שבוצעה:** יצירת כותרת חדשה, הרצת migration אושרה כ-"Success" ב-Supabase SQL Editor. בדיקת CRUD מלאה (create/upload logo/edit/set-default/delete) בדפדפן — **אושרה על ידי המשתמשת ("עובד")**. Phase 6 נסגר ללא באגים בקוד (הפער היחיד שהתגלה הוא ארכיטקטוני, `QuoteEditor.jsx`/Base44, לא באג לתיקון בהיקף זה).

---

## נספח — קבצים שאומתו לצורך מסמך זה

- `src/pages/CompanyHeaders.jsx` — נקרא במלואו (154 שורות, שוב — כבר נקרא באודיט קודם)
- `base44/entities/CompanyHeader.jsonc` — נקרא במלואו
- Grep גלובלי על ישויות שנותרו (`AgentSettings`, `AgentAlert`, `GeneralExpense`, `CompanyHeader`, `MaterialOrder*`, `ModelPricing`, `ModelComponent`, `QuoteTemplate*`) — אישר ש-`CompanyHeader` הוא היחיד מביניהן עם מסך עצמאי שלם, לא כלוא בתוך `ProjectDetails.jsx`/`QuoteEditor.jsx`/`BusinessAgent.jsx`

**לא אומת בתכנון, אומת בזמן מימוש:**
- ~~תחביר/התנהגות Supabase Storage RLS (`storage.foldername()`, GRANT semantics)~~ — **אומת: עבד כמתוכנן, ה-migration רץ נקי**
- ~~האם `supabase-js` הקיים תומך ב-`.storage` API ללא התקנה נוספת~~ — **אומת: כן, ללא צורך בהתקנה נוספת**

**פער חדש שהתגלה בזמן מימוש (לא היה ב"לא אומת" המקורי):**
- `QuoteEditor.jsx` צורך `CompanyHeader` דרך Base44 בלבד — כותרות שנוצרות ב-Supabase אינן נראות שם. ראו סעיף 8 לפרטים.

---

> **סוף מסמך** — 2026-08-16. מומש ואומת במלואו על ידי המשתמשת בדפדפן. Phase 6 סגור.
