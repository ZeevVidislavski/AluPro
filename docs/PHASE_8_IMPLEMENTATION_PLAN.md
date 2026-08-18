# PHASE_8_IMPLEMENTATION_PLAN.md

## תוכנית מימוש Phase 8 — AgentSettings + AgentAlert (ניהול חכם / התראות עסקיות)

> **תאריך תכנון:** 2026-08-16
> **סטטוס:** תכנון סופי, ממתין למימוש. **לא בוצע שום שינוי קוד. לא נוצר migration.**
> **תנאי מקדים:** Phase 1-7 הושלמו. Phase 7 (קטלוג רכיבים) ממתין עדיין לבדיקה ידנית בדפדפן על ידי המשתמשת — Phase 8 מתוכנן במקביל, לא תלוי בתוצאה.

---

## 0. היקף — מה כן ומה לא

**כן:** 2 ישויות:
1. **`AgentSettings`** — הגדרות "סוכן חכם" ברמת tenant (סף רווח מינימלי, סף תזרים, וכו'). בפועל **רשומה אחת בלבד** (`settings[0]`) — "singleton per tenant". `list()`, `create()` (רק אם אין רשומה קיימת), `update()`.
2. **`AgentAlert`** — התראות עסקיות אוטומטיות (רווחיות/גבייה/תזרים/עומס/אסטרטגי). `list()`, `filter` בזיכרון (לא query מסונן), `create()`, `update()` (כולל `is_handled: true`).

**קבצי UI מושפעים (2, אומתו בקוד):**
- `src/pages/BusinessAgent.jsx` — המסך הראשי (התראות + ניתוח + הגדרות)
- `src/components/dashboard/MorningSummary.jsx` — כרטיס בדשבורד שקורא את אותן 2 הישויות לקריאה בלבד

**לא:** שני הקבצים גם קוראים `base44.entities.ProjectQuote.list()` (שורה 91 ב-`BusinessAgent.jsx`, שורה 34 ב-`MorningSummary.jsx`) — **נשאר קבוע מחוץ להיקף**, כמו ב-`Dashboard.jsx`/`Finance.jsx` (Phase 3). זה לא באג חדש — `ProjectQuote` נשאר ב-Base44 מאז Phase 4 בכל מקום שלא `Quotes.jsx`.

**אין סיכון UUID חוצה-מערכת:** בניגוד ל-`CompanyHeader`/`ModelPricing` (Phase 6-7), **אף מסך אחר בפרויקט לא צורך `AgentSettings`/`AgentAlert`** — הן "עלה" (leaf) בגרף התלויות, לא נדרשות ל-`QuoteEditor.jsx` או לכל מסך שלא עובר. אין פער תפקודי צפוי מ-Phase זו.

---

## 1. אימות בפועל — מה הקוד עושה

נקראו במלואם: `BusinessAgent.jsx` (466 שורות), `MorningSummary.jsx` (166 שורות), `AgentSettings.jsonc`, `AgentAlert.jsonc`. Grep גלובלי אישר ששני הקבצים הללו הם היחידים שנוגעים בישויות אלו. ממצאים:

1. **`AgentSettings` היא "singleton" בפועל, לא נאכף בסכמה:** אין שדה `tenant_id` ייחודי/constraint שמונע יותר מרשומה אחת — הקוד פשוט מניח `settings[0]` ומתעלם מהשאר. `updateSettingsMutation` (שורה 110-122): אם `settings.length > 0` → `update(settings[0].id, data)`, אחרת → `create(data)`. **יש לשמר בדיוק את ההתנהגות הזו** (לא לאכוף unique constraint חדש שישבור לוגיקה קיימת, אך אפשר להוסיף אינדקס ייחודי חלקי `(tenant_id) where deleted_at is null` בבטחה — כל tenant כבר מוגבל ליצור רשומה אחת דרך הקוד, לא רק דרך ה-DB).
2. **`AgentAlert` — סינון בזיכרון, לא query מסונן:** `list('-created_date')` מביא הכל, הסינון (`is_handled`, `alert_type`, `project_id`) קורה ב-JS (`filter()` על המערך). **לשמר** — לא להוסיף פרמטרים ל-`list()` שלא נתבקשו.
3. **`runAnalysisMutation` (שורות 124-186):** הלוגיקה העסקית המורכבת ביותר בקובץ — עבור כל פרויקט פעיל, מחשבת `calculateProjectFinancials` (קובץ קליינט טהור, לא ישות), מריצה `analyzeProjectAlerts`, ואז לכל alert פוטנציאלי: אם קיים alert פתוח עם אותו `alert_key` → `update()`, אחרת → `create()`. בנוסף בודקת `shouldResolveAlert` על alerts פתוחים קיימים → `update({is_handled: true})`. **זו לוגיקת upsert-לפי-key בצד קליינט, לא ב-DB** — אין unique constraint על `alert_key`, הבדיקה `alerts.find(a => a.alert_key === ... && !a.is_handled)` מסתמכת על ה-`alerts` שכבר נטענו לזיכרון (לא query נפרד). **לשמר בדיוק** — לא להמיר ל-upsert בצד DB, זה שינוי התנהגות לא-מבוקש.
4. **`markHandledMutation`:** `update(alertId, {is_handled: true})` — פשוט, ישיר.
5. **אין `delete` לאף ישות** — לא ב-`AgentSettings` (רק create/update), לא ב-`AgentAlert` (התראות "מטופלות" מסומנות, לא נמחקות). **לא לבנות RPC למחיקה שלא קיימת ב-UI**, עקבי לכל שלב קודם.
6. **`MorningSummary.jsx`:** קריאה בלבד לשתי הישויות (`settings`, `alerts`) — אין mutations כלל. משמש לתצוגת סיכום יומי בדשבורד.

---

## 2. סכמה

```sql
create table public.agent_settings (
  id                            uuid primary key default gen_random_uuid(),
  tenant_id                     uuid not null references public.tenants(id) on delete cascade,

  minimum_profit_percent        numeric not null default 15,
  cash_flow_warning_threshold   numeric not null default -50000,
  max_open_projects             integer not null default 10,
  high_debt_threshold           numeric not null default 100000,
  contractor_priority_weight    numeric not null default 1.5,
  enable_morning_summary        boolean not null default true,
  enable_realtime_alerts        boolean not null default true,
  enable_smart_focus            boolean not null default true,
  max_focus_items               integer not null default 5,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

-- אוכף ברמת ה-DB את מה שהקוד כבר מניח (רשומה אחת פעילה לכל tenant) —
-- לא משנה התנהגות, רק מקשיח הנחה קיימת.
create unique index agent_settings_one_active_per_tenant_idx
  on public.agent_settings (tenant_id) where deleted_at is null;

create table public.agent_alerts (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,

  alert_key       text not null,
  project_id      uuid references public.projects(id),  -- nullable: alert גלובלי (workload) אין project_id
  project_name    text,
  alert_type      text not null check (alert_type in ('profitability','collection','cash_flow','workload','strategic')),
  severity        text not null check (severity in ('low','medium','high','critical')),
  message         text not null,
  details         text,
  is_handled      boolean not null default false,
  priority_score  numeric,
  action_type     text check (action_type in ('collect','follow_up','fix_profit','order_material','supplier_payment','general')),
  action_link     text,
  due_date        date,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);

create index agent_alerts_tenant_id_idx on public.agent_alerts (tenant_id) where deleted_at is null;
create index agent_alerts_alert_key_idx on public.agent_alerts (tenant_id, alert_key) where deleted_at is null and is_handled = false;
```

**הערות עיצוב:**
- `agent_alerts.project_id` **nullable** — כמו `reminders.project_id` (Phase 5), כי alert סוג `workload` הוא גלובלי (`alert_key = 'global|workload'`, שורה 167 ב-`BusinessAgent.jsx`), ללא פרויקט מקושר.
- **אין `delete`, אין RPC, אין soft-delete UI** לאף אחת מהטבלאות — תואם לממצא סעיף 1.5. `deleted_at` עדיין קיים בסכמה לעקביות מבנית עם שאר הטבלאות (ולעתיד), אך אין נתיב שמגיע אליו כרגע.
- אינדקס `agent_alerts_alert_key_idx` הוא אינדקס עזר לביצועים (לא unique — הקוד עצמו, לא ה-DB, אחראי על מניעת כפילויות, ראו סעיף 1.3), עוזר ל-`alerts.find(alert_key === ... && !is_handled)` להיות מהיר גם כ-query עתידי, לא רק סינון בזיכרון.

---

## 3. RLS + Triggers + GRANT

דפוס זהה לכל טבלה קודמת עם `update` אך **בלי** `delete` (הכי קרוב ל-`reminders`, Phase 5) — **אין RPC סופט-דיליט, אין flag לעקיפת `deleted_at`** (הטריגר חוסם שינוי `deleted_at` ללא תנאי, בלי GUC bypass, כי אין נתיב legit לשנות אותו):

```sql
grant select, insert, update on public.agent_settings to authenticated;
grant select, insert, update on public.agent_alerts to authenticated;
```

- RLS `select`/`insert`/`update` policies על שתי הטבלאות, `tenant_id in (select user_tenant_ids())`.
- `agent_alerts` INSERT policy: `project_id is null or project_id in (select id from projects where tenant_id in (...) and deleted_at is null)` — אותו דפוס FK-nullable מ-Phase 5.
- טריגר `protect_immutable_columns_<table>` על שתי הטבלאות — `created_by`/`tenant_id` חסומים תמיד, `deleted_at` חסום תמיד ללא יוצא מן הכלל (אין RPC).

---

## 4. Services נדרשים

- **`agentSettingsService.js`** — `list()`, `create()`, `update(id, data)`. **`upsert(data)`** נוסף — עוטף את הלוגיקה מ-`updateSettingsMutation` (אם קיימת רשומה → update, אחרת → create), כדי ש-`BusinessAgent.jsx` לא יצטרך לשכפל את הלוגיקה בעצמו (רק מזיז אותה מהקומפוננטה ל-Service, לא משנה התנהגות).
- **`agentAlertService.js`** — `list()`, `create()`, `update(id, data)`, **`upsertByKey(alertData)`** — עוטף את הלוגיקה מ-`runAnalysisMutation` (find existing by `alert_key` + `!is_handled` מתוך רשימה שכבר נטענה, create/update בהתאם). **החלטה לדיון:** למקם את לוגיקת ה-"find existing" בתוך ה-Service (מקבל את רשימת ה-alerts הקיימת כפרמטר) או להשאיר אותה ב-`BusinessAgent.jsx` ולחשוף רק `create`/`update` גולמיים מה-Service? **המלצה: להשאיר את ה-find-logic ב-`BusinessAgent.jsx`** (היא תלויה ב-`alerts` שכבר ב-state של הקומפוננטה, ומשלבת אותה ב-Service רק תוסיף אינדירקציה) — ה-Service חושף רק `list/create/update` פשוטים, בדיוק כמו `reminderService.js`.

*(מעדכן את ההחלטה בסעיף 4: אין `upsert`/`upsertByKey` ב-Service — נשאר `list/create/update` בלבד לשתי הישויות, הלוגיקה העסקית (מציאת רשומה קיימת, singleton) נשארת ב-`BusinessAgent.jsx` בדיוק כפי שהיא היום, רק עם קריאות ל-Service במקום ל-Base44).*

---

## 5. עדכוני קוד נדרשים

| קובץ | שינוי |
|---|---|
| `BusinessAgent.jsx` | `base44.entities.AgentAlert/AgentSettings` → `AgentAlertService`/`AgentSettingsService` (2 queries + 3 mutations, כולל הלולאות בתוך `runAnalysisMutation`) |
| `MorningSummary.jsx` | `base44.entities.AgentSettings/AgentAlert` → Services המתאימים (2 queries, קריאה בלבד) |

**2 קבצים** — היקף קטן, דומה ל-Phase 4.

---

## 6. סדר צעדים מוצע

1. Migration: 2 טבלאות + 2 triggers + RLS + GRANT (ללא RPC — אין delete)
2. `agentSettingsService.js` + `agentAlertService.js` + עדכון `services/index.js`
3. עדכון 2 קבצי UI (סעיף 5)
4. בדיקות Vitest ל-2 ה-Services
5. המשתמשת מריצה migration
6. בדיקה ידנית: פתיחת `BusinessAgent.jsx`, שינוי הגדרות (עם/בלי רשומה קיימת), הרצת "הרץ ניתוח" (יוצר/מעדכן/סוגר alerts), סימון alert כטופל, בדיקת `MorningSummary.jsx` בדשבורד
7. עדכון מסמך זה עם "מה קרה בפועל"

---

## 7. מה קרה בפועל

**מומש ואומת במלואו על ידי המשתמשת בדפדפן — ללא באגים.** Migration (`0010_agent_settings_alerts.sql`) רץ בהצלחה בפעם הראשונה — כולל האינדקס הייחודי החלקי על `agent_settings` (singleton per tenant) והטריגרים שחוסמים שינוי `deleted_at` ללא תנאי (אין RPC, אין נתיב legit). 2 השירותים נבדקו גם ב-Vitest (13 בדיקות חדשות, 99 בסה"כ עברו).

בדיקה ידנית שאושרה: שינוי הגדרות סוכן (עם ובלי רשומה קיימת — `updateSettingsMutation`'s create-vs-update logic), הרצת "הרץ ניתוח" (יצירה/עדכון/סגירת alerts), סימון alert כטופל, ותצוגת כרטיס הסיכום היומי (`MorningSummary.jsx`) בדשבורד — הכל עבד כצפוי בניסיון הראשון.

כמתועד בסעיף 0, לא נמצא פער תפקודי דומה ל-`QuoteEditor.jsx` (Phase 6-7) — אף מסך אחר לא תלוי בישויות הללו.

---

## נספח — קבצים שאומתו לצורך מסמך זה

- `src/pages/BusinessAgent.jsx` — נקרא במלואו (466 שורות)
- `src/components/dashboard/MorningSummary.jsx` — נקרא במלואו (166 שורות)
- `base44/entities/{AgentSettings,AgentAlert}.jsonc` — נקראו במלואם
- Grep גלובלי על `base44\.entities\.\w+` בכל `src/pages` ו-`src/components` — אישר ששני הקבצים הנ"ל הם היחידים שנוגעים ב-2 הישויות, ושאין מסך אחר תלוי בהן (בניגוד ל-`CompanyHeader`/`ModelPricing` שגם `QuoteEditor.jsx` תלוי בהן) — **אין פער QuoteEditor צפוי בשלב זה**

---

> **סוף מסמך** — 2026-08-16. מומש ואומת במלואו על ידי המשתמשת בדפדפן. Phase 8 סגור.
