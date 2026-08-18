# SUPABASE_SCHEMA_PLAN.md

## סכמת Supabase ל-Proof of Concept — Tenant → User → Membership → Customer

> **תאריך תכנון:** 2026-08-03 | **מומש ואומת:** 2026-08-11–12 (Phase 1), 2026-08-12 (Phase 2 — `projects`)
> **סטטוס:** ✅ **מומש בפועל ב-Supabase (פרויקט AluPro).** שני תיקונים קריטיים נתפסו רק בזמן הרצה בדפדפן — GRANT חסר על 4 הטבלאות הראשונות (ראו "⚠️ תיקון קריטי שנוסף אחרי מימוש" למטה) ו-GRANT חסר על ה-sequence של `projects` (ראו סעיף 10.4).
> **היקף:** 5 טבלאות — 4 הראשונות מ-Phase 1 (`tenants`, `profiles`, `tenant_memberships`, `customers`) + `projects` שנוספה ב-Phase 2 (ראו סעיף "עדכון Phase 2 — projects" בהמשך המסמך; `list`+`create` בלבד, `ProjectDetails.jsx` עדיין לא עבר). שאר 18 הישויות (`ProjectQuote` וכו') **לא** נכללות במסמך זה — ימופו בהמשך, לפי סדר התלות שכבר תוכנן ב-`CLAUDE_MIGRATION_REVIEW.md` סעיף 8.
> **תיקונים בסבב תכנון שני (לפני מימוש):** מניעת RLS recursion (helper functions), הסרת UPDATE policies חופפות (מחיקה/שחזור → RPC), RLS מלאה ל-`profiles`, policies לניהול tenants/memberships, `search_path` מפורש בכל SECURITY DEFINER function, `WITH CHECK` על כל UPDATE, תיעוד מפורש של מי רשאי לשנות `created_by`/`updated_by`/`tenant_id`/`deleted_at`. פירוט מלא בסעיף "מה תוקן" בהמשך המסמך.

---

## ⚠️ תיקון קריטי שנוסף אחרי מימוש — GRANT חסר (לא היה במסמך המקורי כלל)

**מסמך זה, כפי שנכתב במקור, החמיץ לגמרי את הצורך ב-table-level GRANT.** כל המיקוד היה ב-RLS policies (סעיף 7 להלן) — אך **RLS policies לא עוזרות אם ל-role `authenticated` אין מלכתחילה הרשאת `SELECT`/`INSERT`/`UPDATE` על הטבלה**. Postgres בודק GRANT **לפני** שהוא בכלל מגיע להערכת RLS. זה התגלה רק כשניסיון ה-CRUD הראשון בדפדפן נכשל עם `permission denied for table tenant_memberships` (קוד שגיאה `42501`) — לא נתפס בשום סקירת קוד/תכנון קודמת.

**זה קרה כי** Supabase Dashboard בד"כ מעניק GRANTs אוטומטית כשיוצרים טבלה דרך ה-UI — אך זה **לא** קורה כשכותבים migrations כ-SQL גולמי (הבחירה שנעשתה ב-ADR-07, "SQL Migrations" ולא Prisma/UI).

**התיקון בפועל:** `supabase/migrations/0002_grants_fix.sql` — הרץ **אחרי** ה-migration הראשונה, מעניק GRANT מפורש על 4 הטבלאות ו-2 ה-RPC functions ל-role `authenticated`.

**חובה לכל migration עתידית (Project, ProjectQuote וכו'):** GRANT הוא חלק בלתי נפרד מיצירת כל טבלה חדשה, **לא** תיקון נפרד לאחר מכן. תבנית מומלצת לכל migration עתידית:

```sql
-- אחרי כל CREATE TABLE + RLS policies:
grant select, insert, update on public.<table_name> to authenticated;
-- ואם יש RPC functions לטבלה זו:
grant execute on function public.<function_name>(...) to authenticated;
```

פירוט מלא של האבחון בפועל — `docs/PHASE_1_IMPLEMENTATION_PLAN.md` סעיף 6, ו-`memory/bug_no_active_tenant_membership.md`.

---

## 0. עקרון מנחה

לפי ADR-04 ו-ADR-03 (`ARCHITECTURE_DECISIONS.md`): Multi-tenant הוא יעד ודאי, ו-`tenant_id` נוסף מהסכמה הראשונה. אבל **"להוסיף `tenant_id`" הוא לא החלטה אחת — הוא שלוש החלטות נפרדות** שצריך להסכים עליהן בנפרד: (א) איך מגדירים "חברה" (tenant), (ב) איך מקשרים משתמש לחברה (membership), (ג) **איך קובעים איזו חברה "פעילה" עבור משתמש נתון ברגע נתון** — זו לא אותה שאלה כמו (ב), ראו סעיף 4 להלן.

---

## 1. `tenants`

```sql
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null,
  status      text not null default 'active' check (status in ('active', 'suspended', 'cancelled')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create unique index tenants_slug_unique on public.tenants (slug) where deleted_at is null;
```

**הערות:**
- `slug` ייחודי רק בין רשומות לא-מחוקות (ראו סעיף 5, Soft Delete — כלל ייחודיות).
- אין `created_by`/`updated_by` על `tenants` עצמה — אין עדיין "משתמש" שיצר את הטננט הראשון (chicken-and-egg: הטננט הראשון נוצר לפני שיש membership). ייווצר ע"י seed script ידני ב-Phase 1.

---

## 2. `profiles`

מרחיב את `auth.users` המובנה של Supabase (דפוס סטנדרטי בכל פרויקט Supabase — `auth.users` מכיל רק `id`/`email`/מטא-דאטה של אימות; `profiles` הוא הטבלה "העסקית" עם 1:1 relationship).

```sql
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

**הערות:**
- `id` = `auth.uid()` — לא UUID עצמאי; זו הזהות שדרכה RLS מזהה "מי המשתמש".
- **אין `deleted_at` כאן** — מחיקת פרופיל תלויה במחיקת `auth.users` (מנוהל ע"י Supabase Auth עצמו), לא ב-soft delete שלנו.
- **אין `tenant_id` על `profiles`** — כוונה: משתמש יכול תיאורטית להיות שייך ליותר מטננט אחד (ראו סעיף 4) — הקישור נמצא רק ב-`tenant_memberships`, לא כאן.

### RLS על `profiles` (חסר בגרסה הקודמת — תוקן)

`profiles` הייתה חשופה ללא RLS כלל בגרסה הקודמת של מסמך זה — פער אבטחה של ממש (כל משתמש מאומת יכול היה לקרוא/לערוך את הפרופיל של כל משתמש אחר). מדיניות מתוקנת:

```sql
alter table public.profiles enable row level security;

-- כל משתמש מאומת יכול לראות פרופילים של חברים לאותו tenant (לא כל פרופיל בעולם)
create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or id in (
      select tm2.profile_id from public.tenant_memberships tm1
      join public.tenant_memberships tm2 on tm2.tenant_id = tm1.tenant_id
      where tm1.profile_id = auth.uid()
        and tm1.deleted_at is null
        and tm2.deleted_at is null
    )
  );

-- משתמש עורך רק את הפרופיל של עצמו
create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

-- יצירת פרופיל: רק ל-auth.uid() של עצמו (בד"כ trigger אוטומטי אחרי signup, לא INSERT ידני מה-Frontend)
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());
```

**הערה:** `profiles_select` משתמש כאן ב-JOIN דו-שלבי ישיר על `tenant_memberships` בתוך ה-policy — יש לשים לב שזה בדיוק דפוס ה-recursion הפוטנציאלי שמטופל בסעיף 6.6 להלן (helper function). כדי להימנע מבעיה, ה-policy הזו **חייבת** להשתמש ב-helper function הבטוחה (`user_tenant_ids()`) ולא ב-subquery ישיר כפי שכתוב כאן להמחשה — ראו הגרסה המתוקנת המלאה בסעיף 7.

---

## 3. `tenant_memberships`

```sql
create table public.tenant_memberships (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'admin', 'member', 'viewer')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,

  unique (tenant_id, profile_id)
);
```

**Roles בסיסיים (מצומצם מ-`SECURITY_MODEL.md`, מספיק ל-PoC של Customer CRUD בלבד):**

| Role | צפייה ב-Customers | יצירה/עריכה | מחיקה (soft) | שחזור | ניהול חברות/הרשאות |
|------|---------------------|--------------|----------------|--------|------------------------|
| `owner` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ | ❌ |
| `member` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `viewer` | ✅ | ❌ | ❌ | ❌ | ❌ |

**הערה:** זהו RBAC מינימלי בלבד לצורך PoC — לא ה-RBAC המלא (`SuperAdmin`/`TenantAdmin`/`Manager`/`User`/`Viewer`) שתוכנן ב-`SECURITY_MODEL.md` לכל המערכת. יש להרחיב כשמגיעים לישויות עם פעולות עדינות יותר (למשל `projects:close-settlement`).

---

## 4. Active Tenant — כיצד קובעים איזו חברה "פעילה"

**זו לא אותה שאלה כמו "איך מקשרים משתמש לחברה" (סעיף 3).** גם אם משתמש שייך לחברה אחת בלבד היום, מבנה הסכמה חייב להיות מוכן למקרה של יותר מחברה אחת — כדי שלא נצטרך migration שוברת סכמה בעתיד. 4 חלופות:

### חלופה 1 — Membership יחיד (מומלץ ל-PoC)
"הטננט הפעיל" = ה-`tenant_memberships` היחיד של המשתמש. אין צורך בעמודה נוספת — נגזר ב-runtime:
```sql
select tenant_id from public.tenant_memberships
where profile_id = auth.uid() and deleted_at is null
limit 1;
```
**יתרון:** אפס מבנה נוסף, הכי מהיר למימוש PoC.
**חיסרון:** ברגע שמשתמש מקבל membership שני (חברה נוספת), "הטננט הפעיל" הופך לא-דטרמיניסטי (`LIMIT 1` על אילו מהם?).

### חלופה 2 — `active_tenant_id` על `profiles`
```sql
alter table public.profiles add column active_tenant_id uuid references public.tenants(id);
```
עמודה מפורשת שמצביעה על הבחירה הנוכחית. דורש UI למעבר בין חברות ("Switch workspace").
**יתרון:** דטרמיניסטי גם עם ריבוי חברות.
**חיסרון:** שינוי סכמה (`ALTER TABLE profiles`) כדי להוסיף — אך זהו שינוי תוסף (לא שובר), לא migration הרסני.

### חלופה 3 — JWT Custom Claims
הטננט הפעיל מוטבע בתוך ה-JWT עצמו (Supabase Auth Hook / `custom_access_token_hook`), כך ש-RLS policies יכולות לקרוא אותו ישירות מ-`auth.jwt()` בלי query נוסף לטבלת memberships בכל בדיקת RLS.
**יתרון:** ביצועים (RLS מהיר יותר, אין JOIN בכל policy).
**חיסרון:** דורש session refresh בכל מעבר טננט (ה-JWT הישן עדיין "תקוע" על הטננט הקודם עד רענון).

### חלופה 4 — בחירת חברה בזמן התחברות (כמו Slack/Notion)
מסך ביניים אחרי login שבו המשתמש בוחר לאיזו חברה להתחבר; הבחירה נשמרת ב-session/local state של ה-frontend, לא ב-DB בכלל.
**יתרון:** UX ברור למשתמשים בכמה חברות; לא דורש שינוי סכמה כלל.
**חיסרון:** לא persistent — משתמש שבוחר חברה A ואז רענון דף עשוי לחזור להתחלה, תלוי במימוש ה-session.

### ההחלטה ל-Phase 1

**מומלץ: חלופה 1 (Membership יחיד)** — תואם למצב הנוכחי (עסק אלומיניום אחד, לא צפויים ריבוי tenants בפועל בקרוב). **אך ה-RLS policies (סעיף 6) חייבות להיכתב בצורה שלא "נועלת" את המבנה לחלופה 1** — כלומר, במקום:

```sql
-- רע: מניח membership יחיד באופן קשיח בתוך ה-policy עצמה
using (tenant_id = (select tenant_id from tenant_memberships where profile_id = auth.uid() limit 1))
```

יש לכתוב:

```sql
-- טוב: תומך גם בעתיד עם כמה memberships, בלי לשנות שום דבר בסכמה
using (tenant_id in (
  select tenant_id from public.tenant_memberships
  where profile_id = auth.uid() and deleted_at is null
))
```

כך שהמעבר העתידי לחלופה 2/3/4 הוא שינוי **בשכבת האפליקציה** (איך בוחרים איזה tenant_id לשלוח בבקשת CRUD) ולא שינוי בסכמה או ב-RLS policies עצמן.

---

## 5. `customers`

```sql
create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,

  name           text not null,
  customer_type  text not null check (customer_type in ('private', 'contractor')),
  phone          text not null,
  email          text,
  address        text,
  notes          text,
  status         text not null default 'active' check (status in ('active', 'inactive')),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id),
  updated_by     uuid references public.profiles(id),
  deleted_at     timestamptz
);

create index customers_tenant_id_idx on public.customers (tenant_id) where deleted_at is null;
```

**מיפוי שדות מול `base44/entities/Customer.jsonc` (אומת בסבב הקודם):** `name`/`customer_type`/`phone` נשארים `required` (תואם ל-`"required": ["name", "customer_type", "phone"]` בסכמת Base44 המקורית); `customer_type` ו-`status` הופכים ל-`CHECK` constraints במקום `enum` רופף; `email`/`address`/`notes` נשארים אופציונליים כמו במקור.

---

## 6. Soft Delete — מדיניות מלאה (מתוקנת: מחיקה/שחזור עוברים ל-RPC)

לפי דרישת המשתמשת, לכל שימוש ב-`deleted_at` (כאן: `tenants`, `tenant_memberships`, `customers` — **לא** `profiles`, ראו סעיף 2):

### 6.1 כיצד list/filter מסתירים רשומות מחוקות
**ברמה כפולה, לא רק אחת:**
1. **RLS policy עצמה** כוללת `and deleted_at is null` בתוך ה-`USING` clause (לא רק אינדקס חלקי) — כך שגם אם ה-Service Layer "שוכח" תנאי סינון, ה-DB עדיין חוסם.
2. **Service Layer** (`customerService.list()`) גם הוא מוסיף `.is('deleted_at', null)` באופן מפורש — הגנה כפולה (defense in depth), לא רק כדי לחסוך על עומס אלא כדי שהתנהגות הרשימה תהיה מכוונת וברורה בקוד עצמו, לא רק "מוסתרת" ב-RLS.

### 6.2 מי רשאי לשחזר
לפי טבלת ה-roles בסעיף 3: **`owner`/`admin` בלבד**.

### 6.3 האם `delete()` הוא soft delete — **תוקן: דרך RPC, לא UPDATE ישיר מה-Frontend**

**שינוי מהותי מהגרסה הקודמת:** בגרסה הקודמת תוכננו שתי `UPDATE` policies חופפות (`customers_update` הרגילה, ו-`customers_soft_delete` המוגבלת ל-owner/admin) — Postgres RLS **אכן** תומך בכמה policies על אותה פעולה (הן מאוחדות ב-OR), אך זה בדיוק הבעיה: כל `UPDATE` (כולל עדכון שדה `name` רגיל ע"י `member`) **וגם** יכול "לגלוש" ולשנות `deleted_at` אם ה-`WITH CHECK` לא מגביל זאת בנפרד לכל עמודה — RLS ברמת שורה לא יודע להבחין "איזו עמודה" משתנה בתוך אותה בקשת UPDATE. **הפתרון: לא לחשוף `deleted_at` כעמודה ניתנת לעדכון כלל דרך CRUD ישיר** — מחיקה ושחזור עוברים אך ורק דרך **Postgres RPC functions** (`SECURITY DEFINER`), לא דרך `supabase.from('customers').update(...)` גנרי:

```sql
create or replace function public.soft_delete_customer(customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.customers where id = customer_id and deleted_at is null;
  if v_tenant_id is null then
    raise exception 'Customer not found or already deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to delete this customer';
  end if;

  update public.customers set deleted_at = now(), updated_by = auth.uid() where id = customer_id;
end;
$$;

create or replace function public.restore_customer(customer_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_tenant_id uuid;
begin
  select tenant_id into v_tenant_id from public.customers where id = customer_id and deleted_at is not null;
  if v_tenant_id is null then
    raise exception 'Customer not found or not deleted';
  end if;

  if not exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = v_tenant_id
      and role in ('owner', 'admin')
      and deleted_at is null
  ) then
    raise exception 'Insufficient permissions to restore this customer';
  end if;

  update public.customers set deleted_at = null, updated_by = auth.uid() where id = customer_id;
end;
$$;
```

`CustomerService.delete(id)` (ב-Frontend, סעיף Service Layer ב-`PHASE_1_IMPLEMENTATION_PLAN.md`) קורא ל-`supabase.rpc('soft_delete_customer', { customer_id: id })`, **לא** ל-`supabase.from('customers').update({ deleted_at: ... })`. מחיקה קשיחה (hard delete) עדיין לא נחשפת בשלב זה כלל — אם תידרש (GDPR right-to-erasure), תהיה RPC נפרדת ומפורשת.

**חשוב:** בגלל שינוי זה, **אין יותר `customers_update`/`customers_soft_delete` כ-2 policies חופפות** — יש `customers_update` יחידה (ל-`member`+, שדות עסקיים רגילים בלבד) ו-2 RPC functions נפרדות למחיקה/שחזור. ה-DDL המלא בסעיף 7 מעודכן בהתאם.

### 6.4 כללי ייחודיות לרשומות מחוקות
- **`tenants.slug`:** `UNIQUE` רק בתוך `WHERE deleted_at IS NULL` (ראו DDL בסעיף 1) — כך שאפשר ליצור טננט חדש עם `slug` שהיה שייך לטננט שנמחק בעבר.
- **`tenant_memberships (tenant_id, profile_id)`:** ה-`UNIQUE` constraint הנוכחי (סעיף 3) **אינו** מסונן לפי `deleted_at` — כלומר אם משתמש הוסר מחברה (`deleted_at` מסומן) ואז מוזמן חזרה, יש להחליט: לשחזר את הרשומה הישנה (`UPDATE ... SET deleted_at = null`) או ליצור רשומה חדשה (ותתנגש עם ה-`UNIQUE` הקיים). **המלצה:** תמיד לשחזר קיימת, לא ליצור כפולה — RPC ייעודית להוספת חבר (`invite_member`, לא מפורטת כאן — מחוץ להיקף ה-PoC) בודקת קודם אם קיימת רשומה מחוקה ומשחזרת אותה.
- **`customers`:** אין `UNIQUE` constraint טבעי היום (Base44 לא אכף ייחודיות שם/טלפון) — לא נדרש טיפול מיוחד.

### 6.5 כיצד RLS מתייחסת לרשומות מחוקות
כברירת מחדל — **חסימה מלאה**, כולל קריאה ישירה לפי ID (לא רק מ-`list`). כלומר `SELECT * FROM customers WHERE id = 'xyz'` על רשומה מחוקה **גם היא** תיחסם ע"י RLS (לא רק מוסתרת מרשימה) — אלא אם בעתיד יתעורר צורך עסקי מפורש ב"סל מיחזור" נגיש למשתמש (לא קיים כרגע, לא לממש spekulatively).

### 6.6 מניעת RLS Recursion ב-`tenant_memberships` — Helper Functions בטוחות

**בעיה שזוהתה בגרסה הקודמת:** ה-policy `memberships_select` (סעיף 7 הישן) מכילה `SELECT` **מתוך `tenant_memberships` עצמה** בתוך ה-`USING` clause שמגן על `tenant_memberships`. ב-Postgres RLS, policy שמסננת טבלה X ומכילה בתוכה שאילתה על X עצמה (גם אם "רק" לבדיקת role) עלולה לגרום ל-**recursion אינסופי** או להתנהגות לא-צפויה (Postgres מתעד זאת כ-gotcha ידוע ב-RLS self-referencing policies). אותה בעיה קיימת גם ב-`customers_select`/`profiles_select` שקוראות ל-`tenant_memberships`.

**הפתרון:** helper functions עם `SECURITY DEFINER` ו-`search_path` מפורש, שעוקפות RLS פנימית (כי הן `SECURITY DEFINER` — רצות בהרשאות היוצר, לא הקורא) ומחזירות רק את המידע המינימלי הנדרש — כך שה-RLS policies עצמן קוראות לפונקציה (לא ל-subquery ישיר על הטבלה המוגנת):

```sql
create or replace function public.user_tenant_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tenant_id from public.tenant_memberships
  where profile_id = auth.uid() and deleted_at is null;
$$;

create or replace function public.user_tenant_role(p_tenant_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.tenant_memberships
  where profile_id = auth.uid() and tenant_id = p_tenant_id and deleted_at is null
  limit 1;
$$;

create or replace function public.is_tenant_admin(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.tenant_memberships
    where profile_id = auth.uid()
      and tenant_id = p_tenant_id
      and role in ('owner', 'admin')
      and deleted_at is null
  );
$$;
```

**חשוב:** גם `tenant_memberships` **עצמה** עדיין צריכה RLS policy — הפונקציות לעיל הן `SECURITY DEFINER` ולכן **עוקפות** RLS כשהן קוראות פנימית ל-`tenant_memberships` (זו הנקודה — הן "רואות הכל" בפנים כדי להחזיר תשובה בטוחה, אך מחזירות רק את המידע הרלוונטי למשתמש הקורא, לא את כל הטבלה). ה-policy על `tenant_memberships` עצמה (סעיף 7) חייבת עדיין להיכתב בזהירות כדי לא ליצור recursion חדשה — ראו הפתרון המדויק שם.

---

## 7. RLS Policies — DDL מלא (מתוקן: ללא recursion, ללא UPDATE policies חופפות, עם WITH CHECK)

```sql
alter table public.tenants enable row level security;
alter table public.tenant_memberships enable row level security;
alter table public.profiles enable row level security;
alter table public.customers enable row level security;

-- ═══════════════════════════════════════════════════════
-- tenants
-- ═══════════════════════════════════════════════════════

create policy tenants_select on public.tenants
  for select using (
    deleted_at is null
    and id in (select public.user_tenant_ids())
  );

-- ניהול tenants (עדכון שם/slug/status) — owner בלבד, לא admin (זו רמת הרשאה גבוהה מ-CRUD רגיל)
create policy tenants_update on public.tenants
  for update using (
    public.user_tenant_role(id) = 'owner'
  )
  with check (
    public.user_tenant_role(id) = 'owner'
  );

-- אין policy ל-INSERT/DELETE על tenants דרך CRUD ישיר כלל — יצירת tenant חדש (signup flow עתידי)
-- ומחיקתו הם RPC/Backend Function ייעודיים, מחוץ להיקף ה-PoC (יצירת ה-tenant הראשון = seed ידני, סעיף 1).

-- ═══════════════════════════════════════════════════════
-- tenant_memberships
-- ═══════════════════════════════════════════════════════

-- SELECT: המשתמש רואה את עצמו + admin/owner רואים את כל חברי אותו tenant
-- שימוש ב-user_tenant_ids()/is_tenant_admin() (SECURITY DEFINER) במקום subquery ישיר על tenant_memberships — מונע recursion (סעיף 6.6)
create policy memberships_select on public.tenant_memberships
  for select using (
    deleted_at is null
    and (
      profile_id = auth.uid()
      or public.is_tenant_admin(tenant_id)
    )
  );

-- ניהול חברות (שינוי role, הוספת/הסרת חבר) — owner/admin בלבד, לא CRUD חופשי ל-member
create policy memberships_insert on public.tenant_memberships
  for insert with check (
    public.is_tenant_admin(tenant_id)
  );

create policy memberships_update on public.tenant_memberships
  for update using (
    public.is_tenant_admin(tenant_id)
  )
  with check (
    public.is_tenant_admin(tenant_id)
    -- הערה: with check זהה ל-using כאן מכוון — מונע מ-admin לשנות tenant_id של רשומת membership
    -- (שינוי tenant_id על membership קיים = "גניבת" הרשאה לחברה אחרת; ראו סעיף 8)
  );

-- מחיקת/שחזור membership (deleted_at) — גם היא RPC ייעודית בעתיד (invite/remove_member), לא CRUD ישיר; מחוץ להיקף PoC

-- ═══════════════════════════════════════════════════════
-- customers
-- ═══════════════════════════════════════════════════════

create policy customers_select on public.customers
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy customers_insert on public.customers
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
  );

-- UPDATE יחידה (לא 2 policies חופפות) — לשדות עסקיים רגילים בלבד.
-- deleted_at אינו נגיש דרך policy זו במעשה (ראו סעיף 6.3: מחיקה/שחזור = RPC נפרד, לא UPDATE גנרי).
-- ה-WITH CHECK מוודא שגם אחרי העדכון tenant_id/deleted_at לא זזו (מונע "העברת" רשומה לטננט אחר).
create policy customers_update on public.customers
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

-- ═══════════════════════════════════════════════════════
-- profiles (ראו גרסה מתוקנת מלאה — מחליפה את הדוגמה הראשונית בסעיף 2)
-- ═══════════════════════════════════════════════════════

create policy profiles_select on public.profiles
  for select using (
    id = auth.uid()
    or id in (
      select tm.profile_id from public.tenant_memberships tm
      where tm.tenant_id in (select public.user_tenant_ids())
        and tm.deleted_at is null
    )
  );

create policy profiles_update_self on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());
```

**הערה על `customers_insert`/`with check ... created_by = auth.uid()`:** זו אכיפה מפורשת שמונעת ממשתמש ליצור רשומה "בשם" משתמש אחר (`created_by` מזויף) — ראו דיון מלא בסעיף 8.

**מה תוקן לעומת הגרסה הקודמת:**
1. אין יותר 2 `UPDATE` policies חופפות על `customers` — מחיקה/שחזור עברו ל-RPC (סעיף 6.3, 6.6).
2. כל policy שהייתה מכילה subquery ישיר על `tenant_memberships` בתוך policy שמגנה על `tenant_memberships`/`customers`/`profiles` — הוחלפה בקריאה ל-helper function `SECURITY DEFINER` (סעיף 6.6), מונעת recursion.
3. נוספו policies לניהול `tenants` (owner-only update) ו-`tenant_memberships` (admin/owner-only insert/update) שלא היו קיימות כלל בגרסה הקודמת.
4. נוסף `WITH CHECK` לכל `UPDATE`/`INSERT` policy (לא רק `USING`) — ראו הרחבה בסעיף 8.
5. נוספה RLS מלאה ל-`profiles` (הייתה חסרה לגמרי).

---

## 8. מי רשאי לשנות `created_by` / `updated_by` / `tenant_id` / `deleted_at`

טבלה מפורשת, לפי דרישה — כי אלו העמודות הכי רגישות מבחינת אבטחה (שינוי בהן = "התחזות" או "בריחה" בין tenants):

| עמודה | מי רשאי לקבוע/לשנות | מנגנון אכיפה |
|--------|------------------------|------------------|
| `created_by` | **אף אחד ידנית** — נקבע אוטומטית ל-`auth.uid()` בזמן `INSERT` בלבד, ולעולם לא משתנה אחר כך | `WITH CHECK (created_by = auth.uid())` על ה-`INSERT` policy (סעיף 7); אין `UPDATE` policy שמאפשרת לשנות את העמודה הזו — כל ניסיון `UPDATE customers SET created_by = ...` נחסם כי `customers_update` policy לא כוללת `created_by` ב-`WITH CHECK`, וב-Postgres RLS `UPDATE` על עמודה שלא מוזכרת ב-`WITH CHECK` **עדיין עובר** אם ה-`WITH CHECK` הכללי מתקיים — **לכן נדרש טריגר נוסף (ראו להלן) שדוחה שינוי מפורש**, RLS `WITH CHECK` לבד לא מספיק למניעת שינוי עמודה ספציפית |
| `updated_by` | נקבע **אוטומטית** ע"י הטריגר `protect_immutable_columns` (ראו להלן) בכל `UPDATE` — לא ניתן לקביעה ידנית מה-Frontend | הטריגר דורס כל ערך שנשלח מה-client עם `auth.uid()` בפועל |
| `tenant_id` | **לעולם לא משתנה** אחרי יצירה — "העברת" רשומה בין tenants אינה תרחיש נתמך ב-Phase 1 | `WITH CHECK` על `customers_update` (סעיף 7) דורש ש-`tenant_id` (החדש, אחרי העדכון) עדיין יהיה בתוך `user_tenant_ids()` של אותו משתמש — זה **לא** מונע שינוי לטננט *אחר* שהמשתמש חבר בו (אם יש לו כמה memberships); למניעה מוחלטת נדרש טריגר נוסף שדוחה כל `UPDATE` שבו `NEW.tenant_id != OLD.tenant_id` |
| `deleted_at` | **רק** דרך RPC (`soft_delete_customer`/`restore_customer`, סעיף 6.3/6.6) — לא CRUD ישיר בכלל | נאכף בכך שאין `deleted_at` ב-`WITH CHECK` המתיר את זה, ובכך שה-RPC functions הן הדרך היחידה שמתועדת ב-Service Layer (`CustomerService`) — **אך זו אכיפת קונבנציה בקוד ה-Frontend, לא אכיפה טכנית מוחלטת ב-DB** אם מישהו יקרא ל-Supabase REST API ישירות עם `PATCH` על `deleted_at`; לאכיפה מוחלטת ב-DB יש להוסיף טריגר `BEFORE UPDATE` שדוחה כל שינוי ל-`deleted_at` שלא מגיע מתוך הפונקציות (למשל בעזרת `current_setting`/session flag) — **מסומן כאן כפער ידוע, לא פתרון סופי; יש להשלים לפני production אמיתי** |

**טריגר מתוקן (מרחיב את סעיף הטריגר הקודם) לאכיפת `created_by`/`tenant_id` immutable:**

```sql
create or replace function public.protect_immutable_columns()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise exception 'created_by cannot be changed';
  end if;
  if new.tenant_id is distinct from old.tenant_id then
    raise exception 'tenant_id cannot be changed';
  end if;
  if new.deleted_at is distinct from old.deleted_at then
    raise exception 'deleted_at must be changed via soft_delete_customer()/restore_customer()';
  end if;
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;

create trigger customers_protect_immutable
  before update on public.customers
  for each row execute function public.protect_immutable_columns();
```

**הערה:** הטריגר הזה הוא המנגנון היחיד לעדכון `updated_at`/`updated_by` ולהגנה על `created_by`/`tenant_id`/`deleted_at` — אין טריגר נוסף/ישן במקביל.

---

## 9. דיאגרמת ER (טקסטואלית) — מעודכן ל-Phase 2

```
tenants (1) ───< (N) tenant_memberships (N) >─── (1) profiles ──(1:1)── auth.users
                          │
                          │ role: owner/admin/member/viewer
                          │
tenants (1) ───< (N) customers
                          │                 │
                          │                 └──< (N) projects   (customer_id FK, real — לא string רופף כמו Base44)
                          │                            │
                          └── created_by / updated_by ──> profiles   (גם על customers וגם על projects)
                                                     │
                                          closed_by ──> profiles   (nullable, לא נגיש עדיין מ-Projects.jsx)
```

---

## 10. עדכון Phase 2 — `projects` (list + create בלבד)

> **תאריך:** 2026-08-12 | **תואם ל:** `docs/PHASE_2_IMPLEMENTATION_PLAN.md`, `supabase/migrations/0003_projects.sql`
> **היקף מצומצם, אושר במפורש:** רק `list`+`create` (המסך `Projects.jsx`). **אין** policy ל-`UPDATE`/`DELETE` בשלב זה — `ProjectDetails.jsx` (שמבצע עריכה/מחיקה/מעברי סטטוס בפועל) עדיין לא תוכנן ולא עבר.

### 10.1 סכמה

```sql
create sequence public.project_number_seq start 1;

create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,

  project_number  text not null default ('P' || lpad(nextval('public.project_number_seq')::text, 6, '0')),
  name            text not null,
  customer_id     uuid not null references public.customers(id),
  customer_name   text not null,
  address         text,
  aluminum_color  text,
  start_date      date,
  target_date     date,
  status          text not null default 'quote' check (status in (
                    'quote', 'negotiation', 'approved', 'ordering',
                    'production', 'installation', 'completed', 'invoiced'
                  )),
  initial_quote      numeric(12,2),
  final_quote        numeric(12,2),
  notes              text,
  settlement_status  text not null default 'open' check (settlement_status in ('open', 'closed')),
  closed_at          date,
  closed_by          uuid references public.profiles(id),

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles(id),
  updated_by     uuid references public.profiles(id),
  deleted_at     timestamptz
);

create unique index projects_project_number_unique on public.projects (project_number) where deleted_at is null;
```

**מיפוי שדות מול `base44/entities/Project.jsonc`:** כל השדות זהים (`name`/`customer_id`/`customer_name`/`status` נשארים `required`, תואם למקור). שני שינויים מכוונים:
1. **`customer_id` הוא FK אמיתי** ל-`customers(id)` — לא `string` רופף כמו ב-Base44 (`base44/entities/Project.jsonc` שדה `customer_id` הוא `"type": "string"` ללא אכיפת קיום).
2. **`closed_by` הוא FK אמיתי** ל-`profiles(id)` — מוכן מראש לפתרון הבאג הידוע (`closed_by` מקודד קשיח כ-`"מנהל"`, `AUDIT_REPORT_2026-08-03.md` סעיף 14.2) כש-`ProjectDetails.jsx` יעבור בעתיד, גם אם עדיין לא נגיש דרך `Projects.jsx`.

### 10.2 פתרון ל-`project_number` — Sequence אמיתי, לא client-side

**הבאג המקורי (Base44/`Projects.jsx`):** `` `P${Date.now().toString().slice(-6)}` `` — לא מובטח ייחודי, נוצר ב-client.

**הפתרון שנבחר (אושר במפורש ע"י המשתמשת, אפשרות B מתוך `PHASE_2_IMPLEMENTATION_PLAN.md` סעיף 5):** `project_number` מוקצה אוטומטית ב-`DEFAULT` expression של הטבלה, דרך `nextval()` על sequence ייעודי — אטומי, מובטח ייחודי, ואינו תלוי בזמן (`Date.now()`). האכיפה כפולה: גם ה-sequence (לא יכול לתת אותו ערך פעמיים), וגם `UNIQUE INDEX` חלקי (`WHERE deleted_at IS NULL`, תואם לדפוס הסטנדרטי שכבר קיים ב-`tenants.slug`).

**הערה על scope:** ה-sequence הוא global (לא per-tenant) — פרויקט של tenant A ופרויקט של tenant B יקבלו מספרים מרצף משותף. זו החלטה מכוונת לפשטות ב-PoC; מספור נפרד לכל tenant (`P-{tenant_slug}-000001`) הוא שיפור עתידי אפשרי, לא דרישה שסוכמה.

### 10.3 RLS — משתמש חוזר ב-helper functions הקיימות, ללא חדשות

```sql
alter table public.projects enable row level security;

create policy projects_select on public.projects
  for select using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
  );

create policy projects_insert on public.projects
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and customer_id in (
      select id from public.customers
      where tenant_id in (select public.user_tenant_ids())
        and deleted_at is null
    )
  );
```

**נקודה שלא הייתה קיימת ב-`customers`:** בדיקת `customer_id in (select id from customers where tenant_id in (...))` בתוך ה-`WITH CHECK` של ה-INSERT. זו לא הגנה עודפת — בלעדיה, משתמש היה יכול תיאורטית ליצור פרויקט המצביע ל-`customer_id` של tenant **אחר** (אם ניחש/מצא UUID תקף), גם ש-RLS על `customers` עצמה הייתה מסתירה ממנו את הלקוח הזה בכל `SELECT` רגיל. זהו סוג הבדיקה שכל FK חוצה-טבלה בסכמה multi-tenant דורש — יש לזכור זאת בכל migration עתידית שמוסיפה FK בין שתי טבלאות tenant-scoped.

**אין `UPDATE`/`DELETE` policy בכוונה** — לא נשכח, לא פער; תואם להיקף המצומצם שאושר (סעיף 10 למעלה). יתווסף רק כש-`ProjectDetails.jsx` יתוכנן במפורש — כדי לא לחזור על הבאג מ-Phase 1 (שתי `UPDATE` policies חופפות ב-`customers`, סעיף 6.3, שנוצר מתכנון RLS מוקדם מדי סביב שימוש משוער ולא קוד בפועל).

### 10.4 GRANT — נכלל מההתחלה, **אך היה חסר GRANT נוסף על ה-sequence (תוקן אחרי בדיקה בפועל)**

```sql
grant select on public.projects to authenticated;
grant insert on public.projects to authenticated;
grant usage on sequence public.project_number_seq to authenticated;
-- אין grant update על הטבלה — תואם להיעדר UPDATE policy (סעיף 10.3). יתווספו יחד.
```

**⚠️ תיקון (2026-08-12, אחרי בדיקה בדפדפן):** הגרסה הראשונה של הסעיף הזה טענה במפורש שאין צורך ב-`GRANT USAGE` על ה-sequence, כי `nextval()` הנקרא מתוך `DEFAULT` "רץ בהרשאות בעל הטבלה". **זו הייתה טענה שגויה** — Postgres דורש `USAGE` על ה-sequence מה-role המתחבר בפועל (`authenticated`) גם כשהקריאה מגיעה מתוך `DEFAULT` expression, לא רק מ-query ישיר. הבאג התגלה רק בזמן ריצה אמיתית (`permission denied for sequence project_number_seq`) — לא נתפס בשום סקירת תכנון. תוקן בפועל דרך `supabase/migrations/0004_projects_sequence_grant_fix.sql`. פירוט מלא: `docs/PHASE_2_IMPLEMENTATION_PLAN.md` סעיף 7 (באג 3).

**לקח כללי לכל migration עתידית:** GRANT על טבלה אינו טרנזיטיבי לאובייקטים אחרים שהיא מפנה אליהם (sequences, functions הנקראות מ-triggers/defaults) — כל אובייקט כזה דורש GRANT מפורש משלו.

### 10.5 Trigger — אותו דפוס בדיוק כמו `customers`

`protect_immutable_columns_projects()` — עותק כמעט זהה ל-`protect_immutable_columns()` המקורי (סעיף 6.6/8), כולל אותו GUC flag משותף (`app.allow_deleted_at_change`) לשימוש עתידי כש-RPC למחיקה רכה של פרויקטים ייכתב. אין עדיין `soft_delete_project`/`restore_project` RPC — לא נדרש בהיקף הנוכחי (אין UI מחיקה), אך הטריגר כבר חוסם `UPDATE` ישיר על `deleted_at` מראש, כדי שלא יהיה חלון זמן שבו העמודה חשופה ללא הגנה.

**קובץ המימוש המלא:** `supabase/migrations/0003_projects.sql`.

---

## נספח — קבצים שאומתו לצורך מסמך זה

**Phase 1:**
- `base44/entities/Customer.jsonc` — מיפוי שדות מלא (נקרא בסבב קודם, סופר כאן שוב לצורך המרה ל-SQL)
- `docs/SECURITY_MODEL.md` — בסיס להשוואה מול ה-RBAC המלא העתידי (roles מצומצמים כאן בכוונה)
- `docs/ARCHITECTURE_DECISIONS.md` — ADR-03, ADR-04

**Phase 2 (נוסף 2026-08-12):**
- `base44/entities/Project.jsonc` — נקרא מחדש לאימות מיפוי שדות (`customer_id`/`closed_by` כ-string רופף במקור, אושר)
- `src/pages/Projects.jsx` — נקרא במלואו, אישר את היקף list+create בלבד (אין update/delete UI במסך זה)
- `docs/PHASE_2_IMPLEMENTATION_PLAN.md` — מקור ההחלטות (היקף, פתרון `project_number`, מקור נתוני לקוחות)

## מה תוקן בסבב הנוכחי (לעומת הגרסה הראשונה של מסמך זה)

1. **RLS recursion ב-`tenant_memberships`** — נפתר באמצעות 3 helper functions בטוחות (`user_tenant_ids`, `user_tenant_role`, `is_tenant_admin`), כולן `SECURITY DEFINER` עם `set search_path = public, pg_temp` מפורש (סעיף 6.6).
2. **2 UPDATE policies חופפות על `customers`** — הוסרו. מחיקה/שחזור עברו ל-RPC functions ייעודיות (`soft_delete_customer`/`restore_customer`) עם בדיקת role מפורשת בתוך הפונקציה, לא CRUD ישיר (סעיף 6.3).
3. **RLS מלאה על `profiles`** — נוספה (הייתה חסרה לגמרי בגרסה הקודמת) — סעיף 2 (טיוטה ראשונית) ו-7 (הגרסה הסופית, ללא recursion).
4. **Policies לניהול `tenants`/`tenant_memberships`** — נוספו (`tenants_update` ל-owner בלבד, `memberships_insert`/`memberships_update` ל-admin/owner) — לא היו קיימות כלל בגרסה הקודמת.
5. **`search_path` מפורש** — כל פונקציית `SECURITY DEFINER` (הישנה `set_updated_at_and_by` שהוחלפה, וכל 3 ה-helper functions, ו-2 ה-RPC functions) כוללת `set search_path = public, pg_temp` — מונע search_path hijacking, בעיית אבטחה ידועה בפונקציות `SECURITY DEFINER` ללא search_path מוגדר.
6. **`WITH CHECK` על כל UPDATE/INSERT policy** — נוסף לכל policy רלוונטית (סעיף 7) — בגרסה הקודמת רוב ה-`UPDATE` policies הכילו רק `USING` בלי `WITH CHECK`, מה שמאפשר תיאורטית לשנות עמודות לערכים לא-חוקיים אחרי המעבר.
7. **מי רשאי לשנות `created_by`/`updated_by`/`tenant_id`/`deleted_at`** — תועד במפורש בטבלה ייעודית (סעיף 8), כולל טריגר `protect_immutable_columns` שאוכף זאת ברמת ה-DB, לא רק ב-RLS (כי RLS `WITH CHECK` לבדו לא מבחין "איזו עמודה" השתנתה בתוך UPDATE).

**נותר לא-פתור במלואו (מסומן במפורש, לא מוסתר):** אכיפת ה-`deleted_at` immutability בטריגר `protect_immutable_columns` נכונה, אך הטריגר עצמו עדיין לא נבדק מול Supabase חי (`node_modules`/Supabase project לא קיימים בסביבה זו) — יש לוודא בפועל, בזמן המימוש, שהטריגר אכן חוסם `PATCH` ישיר על `deleted_at` דרך ה-REST API הגולמי של Supabase (לא רק דרך ה-Service Layer), לפני שנחשב פתרון סופי.

## תיקון נוסף שבוצע בזמן הרכבת קובץ ה-migration בפועל (`supabase/migrations/0001_poc_core.sql`)

**באג אמיתי שהתגלה:** הטריגר `protect_immutable_columns` כפי שתואר במקור בסעיף 8 דוחה **כל** שינוי ב-`deleted_at` ללא תנאי — אבל `soft_delete_customer`/`restore_customer` (סעיף 6.3) **הן עצמן** מבצעות `UPDATE customers SET deleted_at = ...`. כלומר הטריגר, כפי שתוכנן במקור, היה **חוסם את ה-RPC המורשות של עצמו** — כשל לוגי שהיה נתפס רק בזמן הרצה מול DB אמיתי, לא בקריאת קוד.

**התיקון (מיושם בקובץ ה-migration, לא רק מתועד):** נוסף flag זמני ברמת ה-session (`set_config('app.allow_deleted_at_change', 'on'/'off', true)`), שה-RPC functions מפעילות **רק** סביב שורת ה-`UPDATE` הפנימית שלהן. הטריגר בודק את ה-flag הזה: הוא דוחה שינוי ב-`deleted_at` **רק אם** ה-flag לא דלוק — כך ש-RPC מורשית יכולה לבצע את השינוי, אבל `UPDATE` ישיר מה-Frontend (שלא עובר דרך ה-RPC, ולכן לא מדליק את ה-flag) עדיין נחסם.

**לא אומת** — כמו כל שאר הקובץ — מול Supabase חי. זהו תיקון לוגי-תיאורטי בלבד, יש לבדוק בפועל בזמן המימוש.

---

> **סוף מסמך** — 2026-08-03. לא נוצר Database, לא הורץ SQL.
