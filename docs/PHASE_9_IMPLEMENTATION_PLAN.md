# PHASE_9_IMPLEMENTATION_PLAN.md

## תוכנית מימוש Phase 9 — GeneralExpense (הוצאות כלליות) + תיקון חוב טכני Partner ב-PartnerSettlement.jsx

> **תאריך תכנון:** 2026-08-17 (לילה, ללא נוכחות המשתמשת — ראו הערת "עבודה ללא השגחה" למטה)
> **סטטוס:** תכנון סופי, קוד ממומש. **migration לא רץ — ממתין להרצה ידנית של המשתמשת בבוקר.**
> **תנאי מקדים:** Phase 1-8 הושלמו ואומתו כולם על ידי המשתמשת. המטרה: להעלות את המערכת ל-Vercel מחר, לכן הדגש כאן הוא על **צמצום התלות ב-Base44** (שאין לה credentials) ולא רק "עוד ישות".

---

## ⚠️ הערת "עבודה ללא השגחה"

המשתמשת הלכה לישון וביקשה שאמשיך לבד. **לא הרצתי שום migration בעצמי** — זו עדיין כלל-ברזל של הפרויקט (המשתמשת היחידה שמריצה SQL ב-Supabase). כל מה שנכתב כאן הוא קוד + migration מוכנים לבדיקה/הרצה, לא מומשו בפועל מול DB חי. יש README נפרד (`supabase/migrations/README_MORNING.md`) עם סדר הרצה מדויק לבוקר.

---

## 0. היקף — מה כן ומה לא

**כן:**
1. **`GeneralExpense`** — ישות חדשה, CRUD מלא (`list`, `create`, `update`, `delete`). נמצאת אך ורק ב-`PartnerSettlement.jsx` (אומת ב-Grep גלובלי — אין שימוש נוסף בשום קובץ אחר).
2. **תיקון חוב טכני:** `PartnerSettlement.jsx` עדיין משתמש ב-`base44.entities.Partner.*` (CRUD מלא: create/update/delete + `.list()`) למרות ש-`PartnerService` **כבר קיים ועובד** מאז Phase 3 (נבדק אז דרך `Finance.jsx` ו-`Dashboard.jsx`, אך `PartnerSettlement.jsx` פוספס באותו סבב — צוין כפער ידוע ב-`PHASE_3_IMPLEMENTATION_PLAN.md`: *"בדיעבד נמצא ש-PartnerSettlement.jsx גם מבצע CRUD מלא ל-Partner (כולל delete) אך לא טופל — מסומן כפער בבדיקה מקדימה, לא כתקלה בפועל"*). מתקן את זה עכשיו, בו-זמנית עם GeneralExpense, כי זה אותו קובץ ואותו pattern בדיוק.

**קובץ UI מושפע (1):** `src/components/finance/PartnerSettlement.jsx` — קומפוננטה בתוך `Finance.jsx` (מסך עצמאי שכבר עבר).

**לא:** שום שינוי ל-`ProjectDetails.jsx`/`QuoteEditor.jsx` — נשארים קבוע מחוץ להיקף. **`MaterialOrder`/`MaterialOrderItem`/`Document` אומתו הלילה כלואים אך ורק בתוך `ProjectDetails.jsx`** (Grep גלובלי: `MaterialOrdersTab.jsx`/`materialOrderGenerator.js` נקראים רק מ-`ProjectDetails.jsx`; `Document` מופיע רק שם) — **אין להם מסך עצמאי**, בדיוק כמו שנמצא ב-Phase 5 לגבי `Document`. לא הועברו הלילה, ולא יועברו עד ש-`ProjectDetails.jsx` עצמו יתוכנן בנפרד (בהסכמת המשתמשת, לא הלילה).

---

## 1. אימות בפועל

נקרא במלואו: `PartnerSettlement.jsx` (577 שורות). Grep גלובלי על `base44\.entities\.(MaterialOrder|MaterialOrderItem|Document|GeneralExpense)\b` אישר:
- `MaterialOrder`/`MaterialOrderItem`: רק ב-`materialOrderGenerator.js` ו-`MaterialOrdersTab.jsx`, שניהם נקראים רק מ-`ProjectDetails.jsx` (Grep נוסף על שמות הקבצים אישר זאת).
- `Document`: רק ב-`ProjectDetails.jsx` עצמו.
- `GeneralExpense`: רק ב-`PartnerSettlement.jsx`.

ממצאים ב-`PartnerSettlement.jsx`:
1. **`GeneralExpense` CRUD מלא**, סטנדרטי לגמרי — `list()`, `create()`, `update(id,data)`, `delete(id)`. שדה `paid_by_partner_id` הוא string חופשי (FK רך ל-Partner, לא constraint קשיח גם ב-Base44 — נשמר כך, לא הופך ל-FK אמיתי כדי לא לשבור רשומות קיימות עם ID שכבר לא קיים).
2. **`Partner` CRUD מלא, עדיין ב-Base44** (שורות 34, 75, 79, 83) — למרות ש-`PartnerService` קיים ב-`src/services/partnerService.js` מאז Phase 3 עם `list/create/update` (**לא `delete`** — יש לבדוק, ראו סעיף 3).
3. **הפונקציה `calculateFullPartnerSettlement`** (מיובאת מ-`@/components/lib/partnerSettlement.jsx`) היא לוגיקה טהורה בצד לקוח — מקבלת מערכים (`partners`, `projects`, `allPayments` וכו') ומחזירה חישוב. **אינה נוגעת ב-Base44/Supabase כלל** — לא לשנות.

---

## 2. בעיה שהתגלתה: `PartnerService` חסר `delete`

בדיקת `src/services/partnerService.js` (Phase 3) העלתה: השירות חושף רק `list()`, `create()`, `update()` — **אין `delete()`**, כי ב-Phase 3 `Finance.jsx`/`Dashboard.jsx` לא ביצעו מחיקת שותפים. אבל `PartnerSettlement.jsx` **כן** מבצע מחיקה (`deletePartner` mutation, שורה 82-85, עם `window.confirm`).

**החלטה (ללא אישור מפורש מהמשתמשת — מתועד לבדיקה בבוקר):** מוסיף `delete()` ל-`PartnerService` הקיים, לא בונה שירות מקביל. הוספה נקייה (extending an existing service, לא שינוי API קיים) עם RPC `soft_delete_partner` חדש, **תואם בדיוק לדפוס** שכבר קיים ב-4 ישויות אחרות (`customers`, `project_quotes`, `company_headers`, ה-4 טבלאות מ-Phase 7). מוסיף migration קטנה נפרדת עבור זה (לא נוגע בטבלת `partners` הקיימת מלבד הוספת RPC+trigger update).

**לבדוק בבוקר:** שה-`partners` table הקיימת (מ-`0005_partners_payments_orders.sql`) כבר כוללת `deleted_at`/`created_by`/`tenant_id` — **כן**, נבדק, כל הטבלאות מ-Phase 1 ואילך כוללות את העמודות הסטנדרטיות גם אם לא נעשה בהן שימוש מיידי. אז הוספת RPC בלבד, לא ALTER TABLE.

---

## 3. סכמה

```sql
-- General expenses — new table
create table public.general_expenses (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              uuid not null references public.tenants(id) on delete cascade,

  description            text not null,
  category               text not null default 'other'
                           check (category in ('rent','salary','equipment','marketing','other')),
  amount                 numeric not null,
  expense_date           date not null,
  paid_by_partner_id     text,   -- soft reference, not a hard FK (see section 1.1)
  paid_by_partner_name   text,
  notes                  text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index general_expenses_tenant_id_idx on public.general_expenses (tenant_id) where deleted_at is null;
```

**`paid_by_partner_id` הוא `text`, לא `uuid references partners(id)`:** ב-Base44 המקורי זהו string חופשי ללא constraint (נבדק ב-`GeneralExpense.jsonc`) — נשמר ככה כדי לא להוסיף אילוץ שלא היה קיים ולא לסכן שגיאת insert אם ה-ID לא תואם פורמט UUID/לא קיים.

**Partner soft-delete (תוספת לטבלה קיימת, לא טבלה חדשה):**
```sql
create or replace function public.soft_delete_partner(partner_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.partners where id = partner_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Partner not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid() and tenant_id = v_tenant_id
      and role in ('owner', 'admin', 'member') and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this partner';
  end if;

  perform set_config('app.allow_deleted_at_change', 'on', true);
  update public.partners set deleted_at = now(), updated_by = auth.uid() where id = partner_id;
  perform set_config('app.allow_deleted_at_change', 'off', true);
end;
$$;

grant execute on function public.soft_delete_partner(uuid) to authenticated;
```

**הערה קריטית לבדיקה בבוקר:** יש לוודא שהטריגר הקיים על `partners` (מ-`0005_partners_payments_orders.sql`) **כבר** תומך בדפוס ה-GUC bypass flag (`app.allow_deleted_at_change`). **לא אומת הלילה** — קרוב לוודאי שכן (כל הטבלאות עם UPDATE trigger מ-Phase 3 ואילך משתמשות באותו template), אך יש להריץ ולוודא שאין שגיאת "deleted_at must be changed via..." בבדיקה הידנית. אם הטריגר הקיים חוסם ללא ה-flag, יידרש `create or replace function` נוסף על הטריגר הקיים (לא נכתב מראש — מסומן כסיכון פתוח).

---

## 4. RLS + GRANT

```sql
alter table public.general_expenses enable row level security;

create policy general_expenses_select on public.general_expenses
  for select using (deleted_at is null and tenant_id in (select public.user_tenant_ids()));

create policy general_expenses_insert on public.general_expenses
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
  );

create policy general_expenses_update on public.general_expenses
  for update using (
    deleted_at is null and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

grant select, insert, update on public.general_expenses to authenticated;
```

**מחיקה = soft delete דרך RPC**, עקבי לכל הטבלאות עם delete:
```sql
create or replace function public.soft_delete_general_expense(expense_id uuid) ...
-- (אותו דפוס מדויק כמו soft_delete_customer / soft_delete_partner לעיל)
grant execute on function public.soft_delete_general_expense(uuid) to authenticated;
```

Triggers: `protect_immutable_columns_general_expenses` — אותו דפוס בדיוק (created_by/tenant_id חסומים תמיד, deleted_at חסום ללא ה-GUC flag).

---

## 5. Services

- **`generalExpenseService.js`** — חדש. `list()`, `create()`, `update()`, `delete()` (soft, RPC). דפוס זהה ל-`customerService.js`.
- **`partnerService.js`** — **מורחב**, לא נכתב מחדש. מוסיף `delete(id)` (soft, RPC `soft_delete_partner`) לשירות הקיים.

---

## 6. עדכוני קוד

| קובץ | שינוי |
|---|---|
| `PartnerSettlement.jsx` | `base44.entities.Partner.*` → `PartnerService.*` (4 מקומות: list/create/update/delete); `base44.entities.GeneralExpense.*` → `GeneralExpenseService.*` (4 מקומות) |

**קובץ יחיד.**

---

## 7. סדר צעדים

1. Migration: `0011_general_expenses_and_partner_delete.sql` — טבלת `general_expenses` + RLS + GRANT + RPC, ועוד RPC `soft_delete_partner` על הטבלה הקיימת `partners` (ללא ALTER TABLE, רק RPC/GRANT חדשים)
2. `generalExpenseService.js` (חדש) + `partnerService.js` (הרחבה) + `services/index.js`
3. עדכון `PartnerSettlement.jsx`
4. בדיקות Vitest ל-`generalExpenseService.js` + הרחבת הבדיקות הקיימות ל-`partnerService.js` (אם קיימות — לבדוק)
5. `npm run build` מקומי — לוודא build production תקין
6. המשתמשת מריצה migration בבוקר (ראו README נפרד)
7. בדיקה ידנית: הוצאות כלליות (create/edit/delete), ניהול שותפים מתוך `PartnerSettlement.jsx` (create/edit/**delete** — זה החלק החדש)
8. עדכון מסמך זה עם "מה קרה בפועל"

---

## 8. מה קרה בפועל עד סוף הלילה

**קוד מומש במלואו, נבדק ב-Vitest, ונבדק build production — אך migration 0011 לא הורץ (כרגיל, ממתין להרצה ידנית של המשתמשת בבוקר).**

1. **`generalExpenseService.js`** נכתב (list/create/update/delete-soft), **`partnerService.js` הורחב** עם `delete()` חדש (RPC `soft_delete_partner`).
2. **`PartnerSettlement.jsx`** עודכן במלואו — `base44.entities.Partner/GeneralExpense` הוסרו לגמרי (Grep מאמת: אין יותר `base44` בקובץ).
3. **בדיקת `partnerService.test.js` הקיימת עודכנה** — הטענה הישנה `PartnerService.delete is undefined` הוחלפה בבדיקה חיובית ל-RPC `soft_delete_partner`, כי היא הפכה לא-נכונה ברגע שנוסף ה-delete.
4. **`generalExpenseService.test.js` חדש** — 13 בדיקות.
5. **סה"כ Vitest: 107 עוברים, 3 מדולגים, אפס רגרסיות.**
6. **`npm run build` רץ בהצלחה** מקומית — `dist/` תקין.
7. **נמצא ותוקן פער נוסף, לא היה בתכנון המקורי:** אין `vercel.json` בפרויקט. האפליקציה משתמשת ב-`BrowserRouter` (client-side routing) — ללא קובץ rewrite, כל ניווט ישיר/רענון לנתיב פנימי (`/Customers` וכו') היה מחזיר 404 ב-Vercel. **נוצר `vercel.json` עם rewrite ל-`index.html`** — זה היה כנראה ה"באג" הכי משמעותי שהיה נתקל בו deploy ראשון בלי הכנה.
8. **נמצא שאין `.env.example`** — נוצר, כולל תיעוד שרק 2 משתני Supabase נדרשים בפועל.
9. **`docs/DEPLOYMENT_CHECKLIST.md` נוצר** — רשימת בדיקות מקיפה לפני/אחרי ה-deploy, כולל אזהרה מפורשת לגבי Supabase Auth redirect URLs (לא נבדק, דורש גישה לממשק Supabase).

**סיכון פתוח שהיה מתועד — נסגר בבוקר:** האם הטריגר הקיים על `partners` (מ-Phase 3) תומך בדפוס ה-GUC bypass ש-`soft_delete_partner` צריך. **אומת בפועל ב-2026-08-17 בבוקר** — המשתמשת הריצה את `0011_general_expenses_and_partner_delete.sql` בהצלחה, ואישרה ידנית שמחיקת שותף ("ניהול שותפים") עובדת, וכן CRUD מלא על הוצאות כלליות. **Phase 9 סגור, ללא באגים.**

---

## נספח — קבצים שאומתו

- `src/components/finance/PartnerSettlement.jsx` — נקרא במלואו (577 שורות)
- `src/services/partnerService.js` — נקרא, אומת שאין `delete()`
- `base44/entities/GeneralExpense.jsonc` — נקרא במלואו
- Grep גלובלי על `base44\.entities\.(MaterialOrder|MaterialOrderItem|Document|GeneralExpense)\b` — אישר את היקף הלילה
- Grep על `MaterialOrdersTab|materialOrderGenerator` ו-`PartnerSettlement` — אישרו את גרף התלויות (מי קורא למי)

---

> **סוף מסמך** — נכתב 2026-08-17 בלילה, מומש ואומת במלואו בבוקר על ידי המשתמשת. Phase 9 סגור.
