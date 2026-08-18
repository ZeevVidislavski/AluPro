# PHASE_2_IMPLEMENTATION_PLAN.md

## תוכנית מימוש Phase 2 — Project (List + Create בלבד, ProjectDetails נשאר Base44)

> **תאריך תכנון:** 2026-08-12 | **תאריך מימוש:** 2026-08-12
> **סטטוס:** ✅ **הושלם ואומת בפועל.** יצירת פרויקט (`#P000001`) עבדה מקצה לקצה בדפדפן. ראו סעיף 7 ("מה קרה בפועל") לשני באגים נוספים שנתפסו ותוקנו במימוש, ולסעיף 8 למגבלה ידועה שנותרה פתוחה (משתני Base44 חסרים).
> **תנאי מקדים:** Phase 1 (Customer PoC) הושלם ואומת — ראו `PHASE_1_IMPLEMENTATION_PLAN.md` סעיף 6 ללקחים (GRANT מפורש, אימות UUID ישיר) שיושמו כאן מההתחלה.

---

## 0. היקף — מה כן ומה לא

**כן:** מסך `Projects.jsx` (רשימה + יצירה בלבד) עובר ל-Supabase.

**לא:**
- `ProjectDetails.jsx` **לא** עובר בשלב זה — נשאר על Base44 במלואו. הוא מבצע CRUD מלא (`update`/`delete`) כולל שלושה מעברי סטטוס עם באג ידוע (`closed_by` מקודד קשיח כ-`"מנהל"`, לא user אמיתי — מתועד ב-`AUDIT_REPORT_2026-08-03.md`) — היקף גדול מדי לצעד אחד, יטופל בשלב נפרד עתידי.
- אין migration ל-`ClientPayment`/`SupplierOrder`/`ProjectQuote` בשלב זה — הן עדיין נחוצות (על Base44) כדי ש-`calculateProjectFinancials` ב-`Projects.jsx` ימשיך לעבוד (ראו סעיף 2).
- `@base44/sdk` לא מוסר.

---

## 1. אימות בפועל — מה `Projects.jsx` בפועל עושה (לא מה שתועד קודם)

נקרא במלואו (420 שורות). ממצאים שמתקנים הנחה קודמת מ-`CLAUDE_MIGRATION_REVIEW.md` (שתיאר "CRUD" באופן כללי):

1. **`Projects.jsx` תומך רק ב-List + Create.** אין `updateMutation`/`deleteMutation`, אין UI לעריכה/מחיקה במסך הזה כלל. CRUD מלא קיים רק ב-`ProjectDetails.jsx` (לא עובר כעת).
2. **5 מקורות נתונים נקראים בו-זמנית:** `Project.list('-created_date')`, `Customer.list()`, `ClientPayment.list()`, `SupplierOrder.list()`, `ProjectQuote.list()` — ארבעת האחרונים נשארים Base44 (`ClientPayment`/`SupplierOrder`/`ProjectQuote` עדיין לא הועברו; `Customer.list()` **כבר** אמור לעבור ל-`CustomerService`, כי זה כבר קיים).
3. **`project_number` נוצר ב-client:** `` `P${Date.now().toString().slice(-6)}` `` (שורה 109) — זהו הבאג הידוע (לא ייחודי מובטח, אומת ב-`AUDIT_REPORT_2026-08-03.md` וב-`CLAUDE_MIGRATION_REVIEW.md` סעיף 9). **החלטה נדרשת:** לתקן בסכמה החדשה (constraint + generator בטוח) או לשחזר את ההתנהגות הקיימת? (ראו סעיף 5).
4. **אין error handling** ב-`createMutation` — אותו דפוס חוסר שתוקן ב-`Customers.jsx` ב-Phase 1 (ADR-11). יש לתקן כאן גם.
5. **`customer_id`/`customer_name` הם denormalized strings**, לא FK אמיתי ב-schema המקורי (`base44/entities/Project.jsonc`, אומת) — נבחר ידני מרשימת `customers` (state לוקאלי ב-`handleCustomerChange`).
6. **פילטר URL:** `?customer={id}` נקרא מ-`window.location.search` (שורה 74-78) כדי לסנן פרויקטים לפי לקוח — זה הקישור שנוצר ב-`Customers.jsx` (`createPageUrl("Projects") + \`?customer=${customer.id}\``, אומת קיים כבר בקוד). חייב להמשיך לעבוד עם ה-`customer.id` שמגיע עכשיו מ-Supabase (UUID), לא Base44 ID.
7. **תלות ב-`ProjectStatusBadge.jsx`** (רכיב UI טהור, ללא state/data — לא מושפע מהמעבר) ו-`calculateProjectFinancials` (מ-`src/components/lib/projectFinancials.jsx`, לוגיקה עסקית שנשארת client-side עדיין — Project הוא רק ה-"מארח" של פונקציה זו, לא צריך לשנות אותה עכשיו).

---

## 2. מקור נתוני הלקוחות — כבר הוכרע

**אושר במפורש:** אין נתוני Production אמיתיים בכלל (ADR-12) — כלומר אין "לקוחות שנשארו ב-Base44 ומשמשים בפועל". `Customer.list()` בתוך `Projects.jsx` (שורה 88) **חייב** להיות מוחלף ב-`CustomerService.list()` (זהה בדיוק להחלפה שכבר בוצעה ב-`Customers.jsx`) — לא צריך פתרון גישור/דו-מקורי.

**זהו שינוי קוד נוסף שלא היה חלק מ-Phase 1** — `Customers.jsx` היה היחיד שהשתמש ב-`CustomerService` עד כה; `Projects.jsx` הוא הצרכן השני. משמעות: **גם `Projects.jsx` יעבור לשימוש ב-`CustomerService` הקיים**, במקביל למעבר `Project` עצמו ל-Service חדש.

---

## 3. לקחי Phase 1 שחייבים ליישום מההתחלה (לא לחכות לבאג לחזור)

מ-`PHASE_1_IMPLEMENTATION_PLAN.md` סעיף 6 ו-`SUPABASE_SCHEMA_PLAN.md` (אזהרה בראש המסמך):

1. **GRANT מפורש חייב להיות חלק מה-migration הראשונה של `projects`**, לא תיקון נפרד אחר כך:
   ```sql
   grant select, insert, update on public.projects to authenticated;
   ```
   (אין update/delete UI ב-`Projects.jsx` עצמו כרגע, אך `update`/`delete` יידרשו מאוחר יותר עבור `ProjectDetails.jsx` — מומלץ להעניק GRANT מלא כבר עכשיו כדי לא לשכוח שוב, גם אם ה-RLS policies מגבילות בפועל).
2. **אין seed ידני חדש נדרש** — הפרויקטים ייווצרו ע"י המשתמשת בפועל דרך ה-UI (`createMutation`), לא ע"י seed script. אין "משתמש לזהות" כמו ב-Phase 1 — `tenant_id`/`created_by` יוזרקו אוטומטית ע"י ה-Service (כפי שכבר קורה ב-`CustomerService.create`).
3. **אין להניח UUID — לאמת** אם יידרש קישור נוסף לטבלת `auth.users`/`tenant_memberships` (לא צפוי כאן, כי `projects` לא יוצר משתמשים/memberships חדשים).

---

## 4. סכמת `projects` — טיוטה ראשונית (להשלמה ב-`SUPABASE_SCHEMA_PLAN.md` המורחב, לא במסמך זה)

**הערה:** מסמך זה אינו כולל DDL סופי — זה ייכתב כעדכון נפרד ל-`SUPABASE_SCHEMA_PLAN.md` (או קובץ המשך ייעודי), לאחר אישור התוכנית הזו. טיוטת שדות ראשונית, ממופה מ-`base44/entities/Project.jsonc` (אומת בסבב זה):

| שדה Base44 | טור Supabase | הערה |
|---|---|---|
| `project_number` | `project_number text` | **דורש החלטה** — ראו סעיף 5 |
| `name` | `name text not null` | |
| `customer_id` | `customer_id uuid not null references public.customers(id)` | **FK אמיתי** — שיפור לעומת ה-string הרופף ב-Base44 |
| `customer_name` | `customer_name text` | נשאר denormalized (תואם לדפוס הקיים; לא לשנות ארכיטקטורת snapshot בשלב זה) |
| `address` | `address text` | |
| `aluminum_color` | `aluminum_color text` | |
| `start_date` | `start_date date` | |
| `target_date` | `target_date date` | |
| `status` | `status text not null default 'quote' check (status in (...8 values...))` | |
| `initial_quote` | `initial_quote numeric` | **שדה כספי — לשקול `numeric(12,2)` לא `float`, כפי ש-`DATABASE_MIGRATION.md` כבר המליץ** |
| `final_quote` | `final_quote numeric` | same |
| `notes` | `notes text` | |
| `settlement_status` | `settlement_status text not null default 'open' check (...)` | לא נגיש דרך `Projects.jsx` (רק `ProjectDetails.jsx`) — אך השדה קיים בסכמה מהתחלה |
| `closed_at` | `closed_at date` | same |
| `closed_by` | `closed_by uuid references public.profiles(id)` | **שיפור מתוכנן:** FK אמיתי במקום string קשיח `"מנהל"` — לא נגיש עדיין מ-`Projects.jsx`, אך נכון להגדיר FK תקין מההתחלה כדי ש-`ProjectDetails.jsx` העתידי לא יצטרך migration נוספת |

פלוס טורי הבסיס הסטנדרטיים (תואם ל-`customers` table): `id uuid`, `tenant_id uuid not null references tenants(id)`, `created_at`, `updated_at`, `created_by uuid references profiles(id)`, `updated_by`, `deleted_at`.

**RLS:** אותו דפוס בדיוק כמו `customers` (tenant isolation דרך `user_tenant_ids()`, role checks דרך `user_tenant_role()`) — אין צורך ב-helper functions חדשות, אלו שכבר קיימות מ-Phase 1 מספיקות.

---

## 5. שאלה פתוחה שדורשת החלטה — `project_number`

**לא ניתן להכריע בעצמי; זו שאלה עסקית.** שתי אפשרויות:

**אפשרות A — לשחזר את ההתנהגות הקיימת** (`P${Date.now()...}` ב-client, ללא הבטחת ייחודיות): מהיר, לא שובר כלום, אך משמר באג ידוע.

**אפשרות B — לתקן בסכמה החדשה:** `project_number` נוצר ע"י Postgres sequence/RPC אטומי, מובטח ייחודי לכל tenant. משנה קלות את זרימת היצירה ב-`Projects.jsx` (`createMutation` לא יכין את המספר בעצמו — יקבל אותו חזרה מה-`insert`/RPC).

**המלצה:** אפשרות B, כי זה בדיוק סוג הבאג ש-migration אמורה לתקן (לא רק להעביר), ומכיוון שאין Production data — זה הרגע הזול ביותר. אך יש לאשר עם המשתמשת לפני מימוש, בדומה לאישור מפורש שנדרש בכל שינוי סכמה.

---

## 6. סדר צעדים מוצע (בהמתנה לאישור, לא בוצע)

1. עדכון `SUPABASE_SCHEMA_PLAN.md`/migration חדשה: טבלת `projects` + RLS + GRANT (מההתחלה, לא בנפרד) + החלטה על `project_number` (סעיף 5)
2. `src/services/projectService.js` — `list`/`create` בלבד בשלב זה (תואם להיקף המצומצם שאושר), בדפוס זהה ל-`customerService.js`
3. עדכון `src/pages/Projects.jsx`: `base44.entities.Project.*` → `ProjectService.*`, **וגם** `base44.entities.Customer.list()` → `CustomerService.list()` (סעיף 2) — שני swaps, לא אחד
4. הוספת `onError` handling ל-`createMutation` (תיקון הפער, כמו ב-Phase 1)
5. בדיקה ידנית: יצירת פרויקט חדש, שיוך ללקוח מ-Supabase, סינון לפי `?customer=` param, ווידוא ש-`calculateProjectFinancials` (שעדיין קורא ל-Base44 `ClientPayment`/`SupplierOrder`/`ProjectQuote`) ממשיך לעבוד ללא שגיאה גם כשאין להם עדיין נתונים תואמים ב-Project החדש
6. בדיקות Vitest ל-`ProjectService` (תואם לדפוס `customerService.test.js`)

---

## 7. מה קרה בפועל — פער בין התוכנית לביצוע

התוכנית בסעיפים 1-6 התקיימה כמתוכנן: שני ה-swaps (`Project`+`Customer`), הסרת `project_number` client-side, GRANT+RLS כלולים ב-migration אחת. **אך הבדיקה הידנית בדפדפן חשפה שני באגים שהתכנון לא צפה**, שניהם מתוקנים כעת.

### באג 3 — GRANT על sequence לא הספיק ב-GRANT על טבלה בלבד

**מה קרה:** יצירת פרויקט ראשונה נכשלה עם `permission denied for sequence project_number_seq`.

**שורש הבעיה:** `SUPABASE_SCHEMA_PLAN.md` (סעיף 10.4, לפני התיקון) טען במפורש ש-`nextval()` הנקרא מתוך `DEFAULT` expression של טבלה "רץ בהרשאות בעל הטבלה, לא ב-role המתחבר" — ולכן ש-`authenticated` **לא** צריך `GRANT USAGE` על ה-sequence. **הטענה הזו הייתה שגויה.** Postgres דורש `USAGE` על ה-sequence מה-role המתחבר בפועל, גם כשהקריאה מגיעה מתוך `DEFAULT`. זו לא הייתה השערה שנבדקה — נכתבה כעובדה בטוחה במסמך, והתבררה כשגויה רק בזמן ריצה אמיתית.

**תיקון:** `supabase/migrations/0004_projects_sequence_grant_fix.sql` — `GRANT USAGE ON SEQUENCE public.project_number_seq TO authenticated`.

**לקח חשוב, מעבר ללקח ה-GRANT הכללי מ-Phase 1:** GRANT על טבלה **אינו טרנזיטיבי** לאובייקטים אחרים שהיא מפנה אליהם (sequences, functions שנקראות מתוך triggers/defaults). כל אובייקט שנוגע בו path של INSERT/UPDATE — כולל עקיפין — צריך GRANT מפורש משלו. זהו תיקון למסמך `SUPABASE_SCHEMA_PLAN.md` עצמו (עודכן), לא רק לקוד.

### באג 4 — שדות תאריך ריקים (`""`) נדחים ע"י Postgres

**מה קרה:** לאחר תיקון ה-GRANT, יצירה נכשלה שוב עם `invalid input syntax for type date: ""`.

**שורש הבעיה:** `Projects.jsx`'s `emptyProject` state מאתחל `start_date`/`target_date` כ-`''` (string ריק), וטופס ה-HTML `<input type="date">` שולח `''` אם המשתמש לא מילא תאריך. Base44 (NoSQL) כנראה קיבל זאת בשקט; טור `date` ב-PostgreSQL דוחה `''` כערך לא-חוקי (הוא מצפה ל-`NULL` או תאריך תקין בפורמט ISO).

**תיקון:** `ProjectService.create()` (לא `Projects.jsx` עצמו) ממיר `''` ל-`null` עבור `start_date`/`target_date` לפני שליחה ל-DB — נבחר להיות בשכבת ה-Service (נקודת מעבר יחידה לכל הקוראים), לא בקומפוננטה, כדי שהתיקון לא יצטרך שכפול אם/כש-`ProjectDetails.jsx` יעביר גם הוא תאריכים ריקים בעתיד.

**לקח:** דפוסי טפסי HTML קיימים (string ריק כברירת מחדל לשדה תאריך) יכולים להתנגש עם type constraints של PostgreSQL בדרכים ש-Base44/NoSQL הסתיר. יש לבדוק זאת מראש עבור כל שדה `date`/`numeric` נוסף שיועבר בפאזות הבאות, לא להניח שהתנהגות הטופס הקיימת "פשוט תעבוד".

## 8. מגבלה ידועה שנותרה פתוחה — משתני Base44 לא זמינים

**מצב:** למשתמשת **אין גישה לפאנל הניהול של Base44** (לא לחשבון, לא לאדם שיכול למסור מזהים) — הקוד הועבר אליה, לא הבעלות על מערכת Base44 החיצונית. המשמעות: `VITE_BASE44_APP_ID`/`VITE_BASE44_APP_BASE_URL` ב-`.env.local` **לא ניתנים למילוי כרגע ואולי לעולם**.

**ההשלכה על `Projects.jsx`:** שלוש קריאות שעדיין לא עברו (`ClientPayment.list()`, `SupplierOrder.list()`, `ProjectQuote.list()`) נכשלות עם 404 (`.../api/apps/null/entities/...` — ה-`null` מגיע מ-`appId` הריק). `calculateProjectFinancials` מקבל מערכים ריקים, ומציג `₪0` בכל הכרטיסים — **לא שגיאת חישוב, תוצאה ישירה של חוסר גישה לנתוני Base44**.

**החלטה שהתקבלה:** **לא** לנסות "לתקן" את זה עכשיו (אין דרך — אין credentials). להמשיך בסדר המתוכנן ולתעדף את המעבר של `ClientPayment`/`SupplierOrder`/`ProjectQuote` ל-Supabase — ברגע שהם יעברו, השגיאות ייעלמו כי הקוד יפסיק לפנות ל-Base44 לגמרי, לא כי יימצאו המזהים החסרים.

**השלכה על סדר העדיפויות של הישויות הבאות:** מכיוון שאין דרך לתקן את חוסר הגישה ל-Base44 עצמו, יש טיעון חזק **להאיץ** את קצב המעבר של הישויות שעדיין תלויות בו (`ClientPayment`, `SupplierOrder`, `ProjectQuote` — כולן כבר בקבוצה 5 בסדר התלות שתוכנן ב-`CLAUDE_MIGRATION_REVIEW.md` סעיף 8) — לא רק לפי "נוחות תכנון", אלא כי כל עיכוב משאיר שגיאות 404 גלויות במסכים קיימים ללא שום דרך לעקוף אותן מלבד המעבר עצמו.

---

## נספח — קבצים שאומתו לצורך מסמך זה

- `src/pages/Projects.jsx` — נקרא במלואו (420 שורות)
- `base44/entities/Project.jsonc` — נקרא מחדש לאימות מיפוי שדות
- `src/components/dashboard/ProjectStatusBadge.jsx` — נקרא במלואו, אושר כרכיב UI טהור ללא תלות בנתונים
- Grep גלובלי על `base44\.entities\.Project\b` — 9 קבצים משתמשים ב-Project, רק `Projects.jsx` בהיקף השלב הזה
- `supabase/seed/0007_verify_projects_table.sql` — אימות ישיר מול הטבלה שנוצרה (עמודות, RLS, sequence) לפני מימוש הקוד

---

> **סוף מסמך** — 2026-08-12. הושלם ואומת בפועל.
