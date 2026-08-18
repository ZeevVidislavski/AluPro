# ARCHITECTURE_DECISIONS.md

## החלטות ארכיטקטורה מאושרות — Phase 0 (תשתית מעבר)

> **תאריך אישור:** 2026-08-03 | **תאריך מימוש Phase 1:** 2026-08-11–12
> **סטטוס:** ✅ **מאושר ומומש.** Phase 1 (Customer PoC) הושלם בפועל ואומת מקצה לקצה — ראו `PHASE_1_IMPLEMENTATION_PLAN.md` סעיף 6 לפירוט מלא של מה שקרה בפועל, כולל שני באגים אמיתיים (GRANT חסר, seed עם UUID שגוי) שנתפסו ותוקנו בזמן המימוש.
> **קלט:** `CLAUDE_MIGRATION_REVIEW.md`, `AUDIT_REPORT_2026-08-03.md` + 7 בדיקות קוד מהסבב הראשון + 4 בדיקות קוד נוספות מסבב התיקונים (`base44Client.js`, `app-params.js`, `AuthContext.jsx` בשנית, `ProtectedRoute.jsx`) — ראה נספח.

מסמך זה מתעד, בפורמט ADR קצר, את 12 ההחלטות שהמשתמשת אישרה במפורש, ואת הנימוקים מאחוריהן. לכל פירוט מלא (אפשרויות/יתרונות/חסרונות) — ראו `CLAUDE_MIGRATION_REVIEW.md`, שם נבחנו החלופות. מסמך זה הוא הרישום הפורמלי של ה**החלטה**, לא הדיון מחדש בה.

---

## ADR-01: להישאר עם React + Vite

**החלטה:** לא לעבור ל-Next.js.
**נימוק:** המערכת היא CRM פנימי (אחרי login), ללא צורך ב-SEO/SSR — אושר במפורש (ADR-02). שינוי framework הוא שכתוב מלא של routing ו-~65 קבצי React ללא תועלת עסקית מקבילה.
**השלכה:** שכבת ה-Backend (Supabase Functions/Edge Functions) חייבת להיות **נפרדת** מה-Frontend build (אין API Routes מובנה כמו ב-Next.js).

## ADR-02: אין SEO/SSR

**החלטה:** אין דרישה לרינדור בצד שרת או לאופטימיזציית מנועי חיפוש.
**נימוק:** מערכת פנים-ארגונית, לא ציבורית. אושר במפורש על ידי המשתמשת.
**השלכה:** מחזק את ADR-01 — אין סיבה טכנית למעבר Next.js.

## ADR-03: המערכת מיועדת בוודאות להפוך ל-Multi-Tenant

**החלטה:** לא Single-tenant זמני — Multi-tenant הוא יעד ודאי, לא ספקולטיבי.
**נימוק:** אושר במפורש על ידי המשתמשת (בניגוד לשאלה הפתוחה שהועלתה ב-`CLAUDE_MIGRATION_REVIEW.md` סעיף 10).
**השלכה ישירה:** ADR-04 (tenant_id מהסכמה הראשונה) הופך מ"מומלץ" ל"מחייב".

## ADR-04: הוספת `tenant_id` כבר מהסכמה הראשונה

**החלטה:** כל טבלה עסקית מקבלת `tenant_id NOT NULL REFERENCES tenants(id)` מרגע היווצרותה, לא כ-migration עתידית.
**נימוק:** אין נתוני Production (ADR-12) — זהו הרגע הזול ביותר להוסיף את העמודה. הוספתה אחרי שיש נתונים דורשת migration + backfill + audit של כל query קיים.
**השלכה:** נדרש להחליט **כיצד** נקבע ה-tenant הפעיל של משתמש (ראו סעיף "Active Tenant" ב-`SUPABASE_SCHEMA_PLAN.md`) — לא רק *שה*-עמודה קיימת, אלא איך משתמשים בה בפועל בכל query.

## ADR-05: Supabase עבור Database + Auth + Storage — כל השלושה

**החלטה:** לא לפצל לספקים נפרדים (Neon+Auth0+S3).
**נימוק:** גודל הפרויקט (עסק אלומיניום יחיד היום, לפני שיש tenants נוספים) לא מצדיק מורכבות אינטגרציה בין ספקים. RLS ב-PostgreSQL יכול להשתמש ישירות ב-`auth.uid()` של Supabase Auth ללא "תרגום" JWT ידני.
**השלכה:** Vendor lock-in חדש (מ-Base44 ל-Supabase) — אך PostgreSQL רגיל מתחתיו, ניתן לייצוא/הגירה עתידית אם נדרש.

## ADR-06: לא משתמשים ב-Prisma בשלב הראשון

**החלטה:** אין Prisma ORM ב-Phase 1.
**נימוק (הרחבה של מה שהמשתמשת ציינה):** Supabase כבר מספק client (`supabase-js`) שמדבר ישירות מול PostgreSQL עם RLS מובנה. הוספת Prisma כשכבה נוספת בשלב PoC מוסיפה תלות ותצורה (connection pooling נפרד, generate step) לפני שהוכח שה-Service Layer עצמו עובד. ניתן להוסיף Prisma מאוחר יותר **מעל** אותה סכמת SQL, ללא צורך לשכתב את הסכמה.
**השלכה:** ADR-07 — הסכמה מנוהלת ב-SQL גולמי, לא ב-Prisma schema.

## ADR-07: סכמת המסד מנוהלת באמצעות Supabase SQL Migrations

**החלטה:** קובצי `.sql` בתיקיית migrations של Supabase CLI (`supabase/migrations/*.sql`), לא Prisma migrate.
**נימוק:** תואם ל-ADR-06 — ישירות, ללא שכבת תרגום. Supabase CLI כבר תומך ב-migrations מסודרות עם מספור.
**השלכה:** `SUPABASE_SCHEMA_PLAN.md` כתוב כ-SQL DDL ישיר (`CREATE TABLE`, `CREATE POLICY`), לא כ-Prisma schema syntax.

## ADR-08: Service Layer במקום שימוש ישיר ב-`base44` מתוך המסכים

**החלטה:** לבנות שכבת `src/services/*Service.js` עם ממשק זהה ל-SDK הקיים (`.list()/.filter()/.create()/.update()/.delete()`), כדי שההחלפה במסכים תהיה מכנית (import + namespace) ולא שכתוב לוגי.
**נימוק:** אומת בקוד (Grep מלא, `CLAUDE_MIGRATION_REVIEW.md` סעיף 7) שיש **~140 קריאות `base44.entities.*`** פרושות על 20 קבצים — שכתוב ישיר בלי שכבת הפשטה יהיה שכתוב מסיבי בסיכון רגרסיה גבוה.
**השלכה:** `BASE44_REPLACEMENT_MAP.md` הוא המפה המדויקת של אילו קריאות מוחלפות באילו services.

## ADR-09: CRUD פשוט → Supabase SDK ישירות + RLS

**החלטה:** פעולות CRUD בסיסיות (Customer, Partner, CompanyHeader וכו') נקראות ישירות מה-Frontend מול Supabase, עם RLS כשכבת ההגנה היחידה הנדרשת.
**נימוק:** אין לוגיקה עסקית רגישה בפעולות אלו — הן "מה שאתה רואה זה מה שאתה שומר". RLS ב-PostgreSQL מספיק להגנה (tenant isolation + role checks בסיסיים).
**השלכה:** מסך Customers (ADR-11) יכול לעבוד ללא Backend Function כלל — רק Service Layer + RLS.

## ADR-10: לוגיקה עסקית רגישה → Backend Functions בלבד

**החלטה:** הפונקציות הבאות **אסור** שירוצו כ-authoritative בצד לקוח — הן נשארות client-side רק כ-preview (אם בכלל), אך השמירה הסופית עוברת דרך Backend Function:
- `calculateProjectFinancials`, `calculateAggregatedFinancials`
- `calculateFullPartnerSettlement`, `validateProjectCanClose`
- `generateMaterialOrders`
- חישובי מחיר סופיים (`calcComponentValue`, `calcItemTotal`)
- Formula engine (`calculateComponents`) כאשר נשמרת תוצאה עסקית מחייבת

**נימוק:** אושר במפורש על ידי המשתמשת. מאומת בקוד (סבב זה + `CLAUDE_MIGRATION_REVIEW.md`) שכל הפונקציות הללו הן חישובים כספיים/חלוקת רווחים/יצירת רשומות מרובות — לא ניתן להשאיר אותן ניתנות למניפולציה client-side.

**תוספת מהבדיקות שבוצעו בסבב זה** (לא היו בדוח הקודם): נקראו במלואם `src/components/lib/agentLogic.jsx` ו-`src/components/lib/smartFocus.jsx` — שתיהן תלויות ישירות ב-`calculateProjectFinancials` (`calculateBaseMetrics`, `calculateProjectPriorityScore`, `analyzeProjectAlerts`, `shouldResolveAlert`, `generateSmartFocusTasks`, `calculateDailySummary`). מכיוון שכל הפלט שלהן (ניקוד עדיפות, התראות) נגזר ישירות מנתונים כספיים authoritative, הן שייכות לאותה קטגוריה — **גם הן חייבות לרוץ מול נתונים authoritative מהשרת**, גם אם עצם ה"ניקוד" אינו כסף ישיר. הוחלט: ברגע שמעבירים את `calculateProjectFinancials` לשרת (ישויות עתידיות, לא Customers), `agentLogic`/`smartFocus` יעברו יחד איתה — הן קוראות לה כתלות ישירה ולא ניתן להפריד.

נקרא גם `src/lib/quoteCalculations.js` — מאשר ש-`calcComponentValue`/`calcItemTotal` הן בדיוק "חישובי המחיר הסופיים" שאושרו כ-server-only. נמצא גם ממצא נלווה: `pricingMethodLabel` ממפה גם `"meter"` וגם `"meter_width"` לאותה תווית UI ("מ' רץ רוחב") — תומך בממצא הקודם (`CLAUDE_MIGRATION_REVIEW.md` סעיף 2) שיש אי-עקביות אמיתית בין ה-enum של `QuoteItemComponent.pricing_method_snapshot` (`[sqm, meter, unit]`) לזה של `ModelPricing.pricing_method` (`[sqm, meter_width, meter_height, unit]`) — יש לתקן זאת בסכמה החדשה כשמגיעים לישויות אלו (לא רלוונטי ל-Customers PoC).

## ADR-11: מסך Customers כ-Proof of Concept ראשון

**החלטה:** המודול הראשון שעובר בפועל הוא Tenant → User → Tenant Membership → Customer → מסך Customers — לא Projects, לא QuoteEditor.
**נימוק:** הכי פשוט מבין 11 המסכים — CRUD טהור, entities מעורבים מינימליים (`Customer`, ו-`Project` לקריאה בלבד לספירה), ללא תלות בלוגיקה עסקית רגישה (ADR-10). מאפשר לוודא ש-Tenant+Auth+RLS+Service Layer עובדים יחד לפני שמשקיעים במסכים המורכבים (`ProjectDetails.jsx` לבדו מכיל 20+ קריאות `base44.entities`).
**ממצא חדש מהבדיקה שבוצעה בסבב זה:** `src/pages/Customers.jsx` נקרא במלואו (380 שורות) — **אין שום טיפול שגיאות** בשלוש ה-mutations (`createMutation`/`updateMutation`/`deleteMutation`): רק `onSuccess` מוגדר, אין `onError`, אין try/catch, אין toast. כשל רשת "נעלם" מבחינת המשתמש היום. **המרה ל-Service Layer תכלול תיקון זה** — לא לשחזר את החוסר במערכת החדשה (ראו `PHASE_1_IMPLEMENTATION_PLAN.md`).

## ADR-12: אין נתוני Production להעביר

**החלטה:** אין export/import מ-Base44, אין checksums, אין חלון תחזוקה, אין תיאום reset סיסמאות.
**נימוק:** אושר במפורש — אין נתונים אמיתיים ב-Base44 כרגע.
**השלכה:** מבטל את רוב שלבי ה-cutover שתוכננו ב-`MIGRATION_MASTER_PLAN.md`/`MIGRATION_CHECKLIST.md` (שלבים 2 חלקים, 11 במלואו). ניתן לבנות את הסכמה החדשה ולמלא ב-seed data בלבד.

---

## למה לא ליצור מיד פרויקט Supabase?

זו שאלה שהמשתמשת עצמה ניסחה וענתה עליה, ומתועדת כאן כהחלטה רשמית: **לפני יצירת ה-DB בפועל צריך הסכמה מפורשת על מבנה הליבה** — Tenant, User, קשר בין חברות למשתמשים (Membership), Customer, Roles, RLS. טעות במבנה הזה משפיעה על **כל 20 הישויות העתידיות**, כי כולן יירשו את דפוס ה-`tenant_id`+RLS מה-4 טבלאות הראשונות. לעומת זאת, לאחר אישור `SUPABASE_SCHEMA_PLAN.md` — ניתן להקים Supabase בצורה מסודרת ולהתחיל **רק** ב-Tenant → User → Tenant Membership → Customer → מסך Customers, כ-Proof of Concept קטן (Auth, חברה, הרשאות, Database, Service Layer, CRUD — הכול במודול אחד) לפני שנוגעים בפרויקטים, הצעות מחיר וחישובים כספיים.

---

## נספח ב' — ממצא קריטי מסבב התיקונים: `base44.entities.*` אינו תלוי ב-`AuthContext` session

אומת ישירות (`src/api/base44Client.js`, `src/lib/app-params.js`) שה-`base44` client נבנה **פעם אחת** בזמן טעינת המודול, עם token שנלכד חד-פעמית מ-URL/`localStorage`/env, ו-`requiresAuth: false`. כלומר קריאות `base44.entities.*` (כל 10 המסכים שיישארו על Base44 אחרי PoC) **אינן** קוראות ל-React state של `AuthContext` — הן פועלות באופן עצמאי לחלוטין מזרימת ה-login/logout. המשמעות המעשית: מעבר `AuthContext.jsx` ל-Supabase Auth **לא צפוי** לשבור את שאר האפליקציה, **בתנאי מפורש** שלוגיקת ה-logout/login החדשה לא מוחקת מפתחות `base44_*` מ-`localStorage` (למשל `localStorage.clear()` גורף). **לא אומת:** מימוש פנימי של `@base44/sdk` עצמו — `node_modules` אינו מותקן בסביבה זו, כך שלא ניתן לשלול קריאת session/auth נוספת שמובנית בתוך ה-SDK עצמו ולא נראית מרמת הקוד שכתבנו. פירוט מלא, כולל 3 אסטרטגיות מעודכנות והתנאי המחייב למימוש — ב-`PHASE_1_IMPLEMENTATION_PLAN.md` סעיף 1.

נמצא גם: `src/components/ProtectedRoute.jsx` הוא **קוד מת** — לא מיובא בשום מקום בפרויקט (Grep גלובלי), ומצפה לשדות (`authChecked`, `checkUserAuth`) שלא קיימים בפועל ב-`Provider value` של `AuthContext.jsx` — כלומר הוא כבר שבור/לא-בשימוש גם היום, לפני כל שינוי. אין צורך "לתקן" אותו כתנאי מקדים למעבר Auth.

## נספח ג' — תיקוני אבטחה ב-`SUPABASE_SCHEMA_PLAN.md` (סבב שני)

בעקבות בדיקה חוזרת, תוקנו 8 פערים בתכנון ה-RLS/סכמה שהיו בגרסה הראשונה: RLS recursion אפשרי ב-`tenant_memberships` (נפתר עם helper functions `SECURITY DEFINER`), שתי `UPDATE` policies חופפות שאפשרו תיאורטית עקיפת מגבלת role על מחיקה (נפתר: מחיקה/שחזור עברו ל-RPC functions ייעודיות), היעדר RLS מוחלט על `profiles` (נוסף), היעדר policies לניהול `tenants`/`tenant_memberships` עצמן (נוספו), היעדר `search_path` מפורש בפונקציות `SECURITY DEFINER` (נוסף — מונע search_path hijacking), היעדר `WITH CHECK` בחלק מה-`UPDATE` policies (נוסף לכולן), והיעדר תיעוד/אכיפה מפורשים למי רשאי לשנות `created_by`/`updated_by`/`tenant_id`/`deleted_at` (נוסף, כולל טריגר `protect_immutable_columns`). פירוט מלא בכל תיקון — `SUPABASE_SCHEMA_PLAN.md` סעיפים 6-8, וסיכום ב"מה תוקן" בסוף אותו מסמך.

---

## נספח — ממצאים חדשים מ-7 בדיקות הקוד שבוצעו בסבב זה

בנוסף לממצאים שכבר שולבו ב-ADR-10 ו-ADR-11 לעיל:

1. **`src/Layout.jsx`** — נקרא במלואו (110 שורות). **אין שום שימוש ב-role/permissions בקוד** — תפריט הניווט הוא מערך סטטי (`navigation`), ללא בדיקת `user.role`, `isAdmin`, או דומה, בשום מקום. ממצא שלילי חשוב: **אין היום שום UI gating לפי הרשאות** בכל הפרויקט — כל משתמש מאומת רואה את כל 9 פריטי התפריט. יש להביא זאת בחשבון בעיצוב ה-roles ב-`SUPABASE_SCHEMA_PLAN.md` — לא קיים היום דפוס קיים לחקות, צריך לבנות מאפס.

2. **`src/pages/CompanyHeaders.jsx`** — נקרא במלואו (154 שורות). **קריאת `Core.UploadFile` אחת בלבד** (שורה 53, בתוך `handleUpload`) — מתקן ממצא קודם שסומן "לא אומת". יחד עם 2 הקריאות שכבר אומתו ב-`ProjectDetails.jsx` (סבב קודם) — **סה"כ 3 קריאות UploadFile בכל הפרויקט**, לא יותר. רלוונטי לתכנון Storage עתידי (לא לשלב Customers הנוכחי, כי Customer אינו כולל קבצים).

3. **בדיקת תשתית בדיקות (`Glob`)** — `**/*.test.*`, `**/*.spec.*`, `**/__tests__/**`, `vitest.config.*`, `jest.config.*` — **כולם החזירו אפס תוצאות**. אין שום תשתית בדיקות אוטומטיות בפרויקט כיום — לא רק "לא נמצאו קבצי test" אלא גם אין test runner מוגדר כלל. מומלץ להוסיף Vitest (תואם Vite, ADR-01) כחלק מ-Phase 1, לא בהמשך.

---

## קבצים שאומתו בסבב זה (בנוסף לאלו שכבר תועדו ב-2 המסמכים הקודמים)

- `src/components/lib/agentLogic.jsx` — נקרא במלואו
- `src/components/lib/smartFocus.jsx` — נקרא במלואו
- `src/lib/quoteCalculations.js` — נקרא במלואו
- `src/Layout.jsx` — נקרא במלואו
- `src/pages/CompanyHeaders.jsx` — נקרא במלואו
- `src/pages/Customers.jsx` — נקרא במלואו
- Glob לאיתור קובצי test/config — בוצע, אפס תוצאות בכל 5 הדפוסים שנבדקו

---

> **סוף מסמך ADR** — 2026-08-03. לא בוצע שום שינוי קוד.
