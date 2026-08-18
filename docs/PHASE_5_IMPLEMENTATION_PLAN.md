# PHASE_5_IMPLEMENTATION_PLAN.md

## תוכנית מימוש Phase 5 — Reminder (List + Create + Update, ללא Delete) — Document נדחה

> **תאריך תכנון:** 2026-08-16 | **תאריך מימוש:** 2026-08-16
> **סטטוס:** ✅ **מומש ואומת במלואו — בפעם הראשונה ללא שום באג, לא בתכנון ולא בזמן ריצה.** `list`+`create`+`update` נבדקו ידנית בשלושת הקבצים (`Reminders.jsx`, `Dashboard.jsx`, `RemindersWidget.jsx`) ועבדו בניסיון הראשון.
> **תנאי מקדים:** Phase 1-4 הושלמו ואומתו. לקחים חייבים ליישום: GRANT מפורש מההתחלה (כולל sequences/functions), אימות UUID ישיר, בדיקת פערי מזהים חוצי-מערכת (Phase 4) לפני מימוש, לא רק אחריו.

---

## 0. היקף — מה כן ומה לא

**כן:** `Reminder` — `list`, `create`, `update` (רק `status` בפועל, ראו סעיף 1). דרך 3 קבצים: `Reminders.jsx` (מסך ייעודי), `Dashboard.jsx` (קריאה בלבד), `RemindersWidget.jsx` (update בלבד).

**לא:**
- **`Document` נדחה לגמרי מ-Phase 5.** אומת בקוד (Grep): **אין לו מסך ייעודי כלל** — כל שימוש (`create`/`update`/`delete`/`filter`) נמצא אך ורק בתוך `ProjectDetails.jsx` (שורות 115, 1361-1383), שלא עובר. אין "חלק פשוט" של `Document` להוציא כמו שעשינו ל-`ProjectQuote`/`Quotes.jsx` — כל הישות כלואה בתוך המסך שלא עובר. **Document יידחה לשלב שבו `ProjectDetails.jsx` עצמו יתוכנן**, לא ינותח כאן.
- **`ProjectDetails.jsx`** — כרגיל, לא עובר (גם `Reminder` CRUD מלא שם, שורות 1538-1570).
- **`delete`** ל-`Reminder` — אומת בקוד: **אין UI מחיקה** ב-`Reminders.jsx` (רק שינוי `status` ל-`postponed`/`done` דרך `<Select>`). לא נבנה `delete` שלא נדרש, כמו בכל שלב קודם.

---

## 1. אימות בפועל — מה `Reminders.jsx`/`Dashboard.jsx`/`RemindersWidget.jsx` עושים

נקראו במלואם. ממצאים:

1. **`Reminders.jsx`:** `.list('-created_date')`, `.create(data)`, `.update(id, {status})` — קיים **גם** `updateMutation` inline דרך `<Select>` בכל שורת תזכורת (שורה 274), **לא רק** דרך דיאלוג. `update()` בפועל תמיד משנה רק `status`, לא שדות אחרים.
2. **קריאה נוספת:** `Project.list()` (שורה 71) — **כבר קיים `ProjectService`**, יש להחליף (אותו חוב טכני שכבר טופל ב-Phase 3 עבור `Dashboard.jsx`/`Finance.jsx`).
3. **`project_id` הוא אופציונלי בפועל** (אומת: `"required": ["title", "due_date", "priority"]` ב-schema — `project_id` **אינו** ברשימה, בניגוד ל-`Document.project_id` שכן required). יש UI מפורש ("ללא קשר לפרויקט", שורה 363) שמאפשר תזכורת ללא פרויקט כלל. **זה שונה מ-`ProjectQuote`** — אין כאן בעיית ניווט חוצה-מערכת (Phase 4 סעיף 9) כי אין מסך המשך שדורש את אותו ID באותה מערכת. תזכורת שנוצרת ב-Supabase עם `project_id` מ-Supabase **תציג** את `project_name` שנשמר (denormalized, מוזן ב-`handleProjectChange`) — לא תלויה בכך ש-Base44 "יזהה" את ה-ID.
4. **`Dashboard.jsx`:** `Reminder.list()` בלבד (קריאה), מעביר את התוצאה כ-prop ל-`RemindersWidget`.
5. **`RemindersWidget.jsx`:** `Reminder.update(id, {status: 'done'})` בלבד — לא מבצע fetch עצמאי, מקבל `reminders` כ-prop מ-`Dashboard.jsx`.

**מסקנה חשובה:** `Reminder` **אינו** סובל מבעיית ה-UUID החוצה-מערכת שגילינו ב-Phase 4, כי (א) `project_id` אופציונלי ו-(ב) אין ניווט אוטומטי שדורש למצוא רשומה קשורה במערכת אחרת. ניתן להעביר גם `create`, לא רק `list`+`update`.

---

## 2. סכמה — `reminders`

מיפוי מ-`base44/entities/Reminder.jsonc` (אומת): `title`/`due_date`/`priority` required, `project_id` **לא** required.

```sql
create table public.reminders (
  id            uuid primary key default gen_random_uuid(),
  tenant_id     uuid not null references public.tenants(id) on delete cascade,

  project_id    uuid references public.projects(id),  -- nullable, בניגוד ל-projects/client_payments
  project_name  text,
  title         text not null,
  description   text,
  due_date      date not null,
  priority      text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status        text not null default 'open' check (status in ('open', 'done', 'postponed')),

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);
```

**הערת FK חוצה-tenant (INSERT policy):** בניגוד ל-`project_quotes`/`client_payments` (שם `project_id` הוא `not null`), כאן הבדיקה חייבת לטפל ב-`project_id IS NULL` בנפרד:
```sql
and (project_id is null or project_id in (
  select id from public.projects where tenant_id in (select user_tenant_ids()) and deleted_at is null
))
```

---

## 3. RLS + GRANT — `list`+`create`+`update` (ללא delete, ללא soft-delete RPC)

תואם ל-Phase 2 (`projects`) יותר מ-Phase 1 (`customers`) — יש `update` אך אין `delete` בהיקף, ולכן:
- **`reminders_update` policy יחידה** (לא 2 חופפות, לקח מ-Phase 1 סעיף 6.3) — מגבילה רק שדות עסקיים (`status`, `title` וכו'), `deleted_at` לא בר-שינוי כלל (אין RPC, אין UI).
- **טריגר `protect_immutable_columns_reminders`** — אותו דפוס, חוסם שינוי `deleted_at` ללא תנאי (בניגוד ל-`customers`/`project_quotes` שיש להם flag לעקוף עבור ה-RPC — כאן אין RPC כזה כלל, אז אין צורך ב-flag).

```sql
grant select, insert, update on public.reminders to authenticated;
```

---

## 4. Service נדרש

**`reminderService.js`** — `list()`, `create(data)`, `update(id, data)`. **אין `delete`** (לא קיים ב-UI, לא ב-schema policies).

---

## 5. עדכוני קוד נדרשים

| קובץ | שינוי |
|---|---|
| `Reminders.jsx` | `Reminder.list/create/update` → `ReminderService.*`; `Project.list()` → `ProjectService.list()` (חוב טכני) |
| `Dashboard.jsx` | `Reminder.list()` → `ReminderService.list()` |
| `RemindersWidget.jsx` | `Reminder.update()` → `ReminderService.update()` |

**3 קבצים** — היקף דומה ל-Phase 4 (קטן יותר מ-Phase 3's 6).

---

## 6. סדר צעדים מוצע

1. Migration: `reminders` + RLS (select/insert/update, כולל בדיקת FK nullable) + GRANT + trigger
2. `reminderService.js` + עדכון `services/index.js`
3. עדכון 3 הקבצים (סעיף 5)
4. בדיקה ידנית: יצירת תזכורת (עם ובלי פרויקט מקושר), שינוי סטטוס דרך `Reminders.jsx` ודרך `RemindersWidget.jsx` (בדשבורד), רשימה נטענת בשניהם
5. בדיקות Vitest ל-`ReminderService`

---

## 7. מה קרה בפועל — פער בין התוכנית לביצוע

**זהו השלב הראשון (מתוך 5) שעבר ללא שום באג — לא בתכנון (כמו Phase 4) ולא בזמן ריצה (כמו Phase 1-3).** כל רכיב עבד בפעם הראשונה:

1. **`Dashboard.jsx` נקרא מחדש** (הפריט שסומן "לא אומת" בגרסה הקודמת) — אישר שהמבנה לא השתנה מאז Phase 3, ושה-swap היחיד הנדרש הוא `Reminder.list()` (שורה 39) — `ProjectQuote.list()` (שורה 44) נשאר Base44 כמתוכנן.
2. **Migration** (`0007_reminders.sql`) רצה בהצלחה בפעם הראשונה — כולל בדיקת ה-FK ה-nullable (`project_id is null or project_id in (...)`) שהייתה שונה מכל migration קודמת.
3. **3 הקבצים** (`Reminders.jsx`, `Dashboard.jsx`, `RemindersWidget.jsx`) עודכנו ונבדקו — כולם עברו קומפילציה נקייה מול שרת ה-dev לפני הבדיקה הידנית.
4. **בדיקה ידנית:** תזכורת חדשה נוצרה ומופיעה במסך `/Reminders`; ה-widget בדשבורד מציג אותה נכון; כפתור "בוצע" (ה-`update` דרך `RemindersWidget.jsx`) עובד — משנה סטטוס בפועל.

**לקח מצטבר:** ההצלחה ללא באגים כאן, בשילוב עם Phase 4 (שבו הבאג נתפס *לפני* הרצה), מרמזת שהתהליך המצטבר של תיעוד לקחים מפורש בכל שלב (GRANT מההתחלה, אימות UUID, בדיקת פערי מזהים חוצי-מערכת) התחיל לשלם את עצמו — לא רק כתיעוד היסטורי, אלא כשיפור מדיד באיכות התכנון של השלבים הבאים.

---

## נספח — קבצים שאומתו לצורך מסמך זה

**לפני המימוש:**
- `src/pages/Reminders.jsx` — נקרא במלואו (391 שורות)
- `src/components/dashboard/RemindersWidget.jsx` — נקרא במלואו (100 שורות)
- `base44/entities/Reminder.jsonc`, `Document.jsonc` — נקראו במלואם
- Grep גלובלי על `base44\.entities\.(Document|Reminder)\b` — 14 מופעים, 6 קבצים — מיפוי מלא בסעיף 0-1

**במהלך המימוש (2026-08-16):**
- `src/pages/Dashboard.jsx` — נקרא מחדש במלואו (הפריט שהיה מסומן "לא אומת") — אישר שהמבנה תואם למה שתוכנן

---

> **סוף מסמך** — 2026-08-16. מומש ואומת במלואו, ללא באגים.
