# PHASE_1_IMPLEMENTATION_PLAN.md

## תוכנית מימוש Phase 1 — Proof of Concept: Tenant → User → Membership → Customer

> **תאריך תכנון:** 2026-08-03 | **תאריך מימוש:** 2026-08-11–12
> **סטטוס:** ✅ **הושלם ואומת בפועל.** כל 7 קריטריוני ההצלחה (סעיף 2) התקיימו. ראו סעיף 6 ("מה קרה בפועל") לפער בין התוכנית לביצוע, כולל שני באגים אמיתיים שנתפסו ותוקנו.
> **תנאי מקדים:** `SUPABASE_SCHEMA_PLAN.md` אושר לפני תחילת המימוש.

---

## 0. היקף — מה כן ומה לא

**כן:** מסך `Customers` בלבד עובר ל-Supabase (Auth + DB + RLS). כל שאר 10 המסכים ממשיכים לעבוד מול Base44 בדיוק כפי שהם היום.

**לא:** `@base44/sdk` **לא מוסר**. שום מסך אחר לא נוגע. אין migration לישויות אחרות (`Project`, `ProjectQuote` וכו') בשלב זה.

---

## 1. בעיית ה-Authentication המקבילה — לפני הכל

### 1.1 אימות בפועל: האם `base44.entities.*` תלוי ב-session/token של `AuthContext`?

**זו הייתה הנחה לא-מאומתת בגרסה הקודמת של המסמך. אומתה עכשיו במלואה בקריאת קוד ישירה.**

נקראו במלואם: `src/api/base44Client.js`, `src/lib/app-params.js`, `src/lib/AuthContext.jsx`, `src/components/ProtectedRoute.jsx`. בוצע גם Grep גלובלי לאיתור כל שימוש ב-`appParams`/`localStorage` בפרויקט.

**הממצא המרכזי:** `base44Client.js` יוצר את ה-client **פעם אחת, בזמן טעינת המודול** (top-level, לא בתוך קומפוננטה או hook):
```js
const { appId, token, functionsVersion, appBaseUrl } = appParams;
export const base44 = createClient({ appId, token, functionsVersion, serverUrl: '', requiresAuth: false, appBaseUrl });
```
ה-`token` מגיע מ-`appParams` (`src/lib/app-params.js`) — קריאה **חד-פעמית** מ-URL params → `localStorage` (מפתחות `base44_*`) → `import.meta.env.VITE_BASE44_APP_ID`/`VITE_BASE44_APP_BASE_URL` כ-fallback. **`requiresAuth: false`** מוגדר במפורש בבניית ה-client.

**המשמעות המעשית:** קריאות `base44.entities.*` (כל ~140 הקריאות שנספרו ב-`CLAUDE_MIGRATION_REVIEW.md`) **אינן תלויות ב-React state של `AuthContext`** — הן משתמשות בטוקן שנלכד פעם אחת ב-`localStorage`/URL/env בזמן טעינת האפליקציה, לא בסטטוס ה-`isAuthenticated`/`user` שמנוהל ב-`AuthContext.jsx`. `checkAppState`/`checkUserAuth` ב-`AuthContext.jsx` הם שכבה **נפרדת** שקוראת ל-`base44.auth.me()` ומנהלת UI gating (spinner/error), אך לא "מזינה" את ה-token שה-`base44` client כבר בנוי איתו.

**מסקנה (בזהירות, לא הנחה עיוורת):** עשרת המסכים הנותרים על Base44 **צפויים** להמשיך לפעול לאחר שהחלפת ה-Login flow ב-`AuthContext.jsx` תהיה ל-Supabase — **בתנאי** שה-token/appId של Base44 **נשארים ב-localStorage/env ולא נמחקים** על ידי תהליך ה-login/logout החדש. אולם:

- **לא אומת** קוד ה-SDK עצמו (`@base44/sdk`) — `node_modules` **אינו מותקן בפרויקט כרגע** (`Glob` על `node_modules/@base44/**` החזיר אפס תוצאות), ולכן לא ניתן לקרוא את המימוש הפנימי של `entities.*` כדי לשלול לחלוטין קריאת `auth.me()`/רענון session מובנית בתוך ה-SDK.
- **סיכון קונקרטי:** אם ה-login flow החדש של Supabase (או ה-logout) "מנקה" את כל ה-`localStorage` (למשל `localStorage.clear()` גורף, במקום מחיקה סלקטיבית של מפתחות Supabase בלבד) — זה ימחק גם את מפתחות `base44_*` וישבור את 10 המסכים הנותרים. **חובה** לוודא במימוש בפועל ש-logout/login חדשים **לא נוגעים** במפתחות `base44_*` ב-localStorage.
- **ממצא נוסף:** `src/components/ProtectedRoute.jsx` (נקרא במלואו בסבב זה) **הוא קוד מת/לא מחובר** — Grep גלובלי מצא שהוא לא מיובא בשום מקום מלבד הקובץ עצמו. הוא גם מצפה לשדות `authChecked`/`checkUserAuth` ב-context value, בעוד `AuthContext.jsx` בפועל **לא חושף** שדות אלו ב-`Provider value={{...}}` (רק `user`, `isAuthenticated`, `isLoadingAuth`, `isLoadingPublicSettings`, `authError`, `appPublicSettings`, `logout`, `navigateToLogin`, `checkAppState`). כלומר `ProtectedRoute.jsx` כבר שבור/לא בשימוש **גם היום מול Base44** — ה-gating האמיתי מתבצע ישירות בתוך `AuthenticatedApp` ב-`App.jsx`. **אין** צורך "לתקן" את `ProtectedRoute.jsx` לפני מעבר Auth, כי הוא לא בנתיב הריצה בפועל — אך יש לוודא שהוא לא מיובא בטעות בעתיד מבלי לתקן אותו.

### 1.2 מה קורה בפועל ל-`Customers.jsx` אחרי מעבר Auth — `Project.list()`

נבדק במפורש: השורה `base44.entities.Project.list()` בתוך `Customers.jsx` (שורה 71, לספירת פרויקטים לכל לקוח) **תמשיך לעבוד באותה מידה כמו שאר 10 המסכים** — לפי הממצא בסעיף 1.1, כי גם היא קריאת `base44.entities.*` רגילה שלא תלויה ב-`AuthContext` React state, אלא רק בטוקן שכבר ב-`localStorage`. **אין** צורך לפתרון עוקף (הסתרת ספירת פרויקטים) — **בתנאי** שה-token של Base44 נשמר, כפי שצוין לעיל. עם זאת, מכיוון שזו עדיין "בהנחה סבירה אך לא מאומתת במלואה מול SDK internals", מומלץ **לבדוק ידנית בפועל** (לא רק בקוד) בשלב מוקדם של המימוש: להריץ את שני ה-flows (Supabase login ואז ניווט ל-Customers) ולוודא ש-`Project.list()` עדיין מחזיר תוצאות, לפני שממשיכים הלאה.

### 1.3 שלוש האסטרטגיות — מעודכן לפי הממצא

| # | אסטרטגיה | תיאור | יתרון | חיסרון | רלוונטיות לאור הממצא |
|---|-----------|-------|-------|--------|--------------------------|
| A | **PoC נפרד עם Supabase בלבד** (route/build נפרד, ללא נגיעה ב-`AuthContext.jsx`) | ה-PoC רץ כ-route נפרד (`/poc/customers`), Auth נפרד לגמרי מ-Base44 | לא נוגעים כלל ב-`AuthContext.jsx`/`App.jsx` הקיימים — אפס סיכון לשבירת 10 המסכים | משתמשת "מתחברת פעמיים"; לא בודק את התרחיש האמיתי (Auth גלובלי אחד) |
| B | **Auth Adapter זמני** | `useAuth()` נשאר באותו API, מיישם בפנים גם Base44 וגם Supabase לפי route/flag | שאר האפליקציה לא "יודעת" מאיזה ספק מגיע ה-session | מורכבות זמנית שתיפרק כשעוברים לישויות הבאות; עדיין דורש קוד לתחזק שני session managers בו-זמנית |
| C | **מעבר Auth גלובלי** (כל האפליקציה ל-Supabase Auth, לפני Customers) | מחליפים את `AuthContext.jsx` כולו ל-Supabase Auth (login/logout/me בלבד), לפני נגיעה ב-Customer data | כל 11 המסכים מתחברים דרך מקור session אחד; אין מצב "מעורב"; **ה-ממצא בסעיף 1.1 מראה שזה בטוח** כל עוד logout/login לא מוחקים מפתחות `base44_*` מ-localStorage | דורש לגעת בקובץ קריטי (`AuthContext.jsx`) מוקדם; תלוי בזהירות מפורשת סביב ניהול localStorage |

### ההחלטה המעודכנת: אסטרטגיה C (מעבר Auth גלובלי), עם תנאי מפורש

לאור הממצא ש-`base44.entities.*` **אינו** תלוי ב-`AuthContext` React state אלא רק ב-token שכבר ב-localStorage — **הסיכון של אסטרטגיה C נמוך משמעותית ממה שהונח בגרסה הקודמת של מסמך זה**. עדיין מומלצת אסטרטגיה C (ולא A/B), אך כעת עם **תנאי טכני מפורש וניתן-לבדיקה**, לא רק "הערכת סיכון":

**תנאי מחייב למימוש (לא אופציונלי):** קוד ה-login/logout החדש (Supabase) חייב:
1. **לא** לבצע `localStorage.clear()` גורף.
2. למחוק/לכתוב **רק** מפתחות בעלי prefix של Supabase (`sb-*` הוא הדפוס הסטנדרטי של `supabase-js`), **ולא לגעת** במפתחות `base44_*`.
3. להיבדק ידנית (סעיף 1.2) לפני שהמעבר נחשב "גמור".

אם בפועל, בזמן המימוש, יתגלה שה-SDK של Base44 **כן** תלוי בהתנהגות session נוספת שלא נראתה כאן (למשל: בדיקת expiry שדורשת קריאה חוזרת ל-`auth.me()` שתלויה ב-cookie ולא רק ב-localStorage token) — יש לעצור ולעבור לאסטרטגיה A (PoC נפרד) כגיבוי בטוח יותר, **לא** להמשיך באסטרטגיה C תחת הנחה שגויה.

---

## 2. קריטריוני הצלחה ל-PoC (לפני מעבר לישויות הבאות)

1. משתמש מתחבר דרך Supabase Auth (לא Base44) בכל האפליקציה.
2. משתמש רואה רק Customers של ה-tenant שהוא חבר בו (RLS מאומת עם 2 משתמשי בדיקה מ-2 tenants שונים).
3. יצירה/עריכה/מחיקה (soft) של Customer עובדת מקצה לקצה דרך `CustomerService`.
4. שגיאת רשת/הרשאה מוצגת למשתמש (תיקון הפער שנמצא ב-`Customers.jsx` הקיים — ראו סעיף 4).
5. שאר 10 המסכים ממשיכים לעבוד ללא שינוי (בדיקת regression ידנית) — **כולל בדיקה ספציפית ומפורשת ש-`base44.entities.Project.list()` בתוך `Customers.jsx` עדיין מחזיר תוצאות** (סעיף 1.2) — זו לא הנחה, זו בדיקה חובה.
6. קיימת לפחות בדיקת unit אחת ל-`CustomerService` ובדיקת RLS אחת (tenant isolation) — ראו סעיף 5.
7. אומת ידנית ש-logout/login של Supabase לא מוחקים מפתחות `base44_*` מ-localStorage (סעיף 1.3, התנאי המחייב).

**רק לאחר שכל 6 הקריטריונים מתקיימים** — עוברים לישות הבאה (`Project`, לפי סדר התלות ב-`CLAUDE_MIGRATION_REVIEW.md` סעיף 8).

---

## 3. סדר צעדים מדויק

### שלב A — הקמת תשתית (ידני, ע"י המשתמשת, מחוץ לסבב הזה)
1. יצירת Supabase project חדש (ידנית, לא ע"י Claude — לפי בקשה מפורשת).
2. הרצת ה-migration הראשונה מ-`SUPABASE_SCHEMA_PLAN.md` (4 טבלאות + RLS) — Supabase CLI, `supabase/migrations/0001_poc_core.sql`.
3. יצירת tenant יחיד + owner אחד ידנית (seed) — לבדיקה.

### שלב B — Auth (ראו סעיף 1 לעיל)
1. התקנת `@supabase/supabase-js` (**לא בסבב הנוכחי** — רק כשמגיעים למימוש בפועל).
2. יצירת `src/lib/supabaseClient.js` — instance יחיד, מקביל ל-`src/api/base44Client.js` הקיים.
3. עדכון `src/lib/AuthContext.jsx`: `checkUserAuth`/`logout`/`navigateToLogin` עוברים ל-Supabase Auth API (`supabase.auth.getUser()`, `supabase.auth.signOut()`, `supabase.auth.signInWithPassword()` או מסך login מותאם).
4. **קריאה מוקדמת** של `src/components/ProtectedRoute.jsx` (לא נקרא עדיין) — לוודא תאימות.
5. בדיקת regression: כל 11 המסכים עדיין נטענים (הם לא נוגעים בנתונים, רק ב-session).

### שלב C — Service Layer
1. יצירת `src/services/client.js` — עוטף את `supabaseClient.js`, מספק helpers גנריים (`selectActive`, `softDelete` וכו' לפי דפוסי הסעיף 6 ב-`SUPABASE_SCHEMA_PLAN.md`).
2. יצירת `src/services/customerService.js` עם ממשק זהה ל-SDK הישן (ראו `BASE44_REPLACEMENT_MAP.md` למיפוי המדויק).
3. יצירת `src/services/index.js` — export מרוכז.

### שלב D — עדכון מסך Customers
1. `src/pages/Customers.jsx`: להחליף `import { base44 } from '@/api/base44Client'` ב-`import { CustomerService } from '@/services'`, ולהחליף כל `base44.entities.Customer.X` ב-`CustomerService.X`.
2. **תיקון פער קיים (לא שחזור):** הוספת `onError` לשלוש ה-mutations (`createMutation`/`updateMutation`/`deleteMutation`) — מאומת בסבב זה שהם היום ללא טיפול שגיאות כלל (ראו `ARCHITECTURE_DECISIONS.md` ADR-11). להוסיף toast/הודעת שגיאה בסיסית.
3. **הערה (מעודכנת לפי אימות בסעיף 1.2):** הקריאה ל-`base44.entities.Project.list()` באותו קובץ (לספירת פרויקטים לכל לקוח) **נשארת כמו שהיא** — Project עדיין לא עבר, וצפויה להמשיך לעבוד (ראו סעיף 1.1-1.2 — אין תלות ב-AuthContext state). משמעות: `Customers.jsx` אחרי השינוי ישתמש **גם** ב-`CustomerService` **וגם** ב-`base44` (זמנית, עד ש-`Project` יעבור) — מצב ביניים מכוון. **בכל זאת**, יש לבדוק ידנית מייד אחרי שלב B (Auth) שהקריאה הזו עדיין מחזירה תוצאות בפועל, לפני שממשיכים לשלב C — זו נקודת הבדיקה הקריטית ביותר בכל התוכנית, כי אם ההנחה בסעיף 1.1 שגויה, כאן זה יתגלה ראשון.
4. **פתרון גיבוי אם שלב 3 נכשל בבדיקה בפועל:** אם מתברר שספירת הפרויקטים לא עובדת יותר (למשל spinner אינסופי, או שגיאת auth) — להסתיר זמנית את התצוגה (`{getProjectCount(customer.id)} פרויקטים`) מאחורי flag/fallback ("—" במקום מספר), **ולא** לחסום את כל ה-PoC בגלל שדה משני זה. תיקון השורש (Auth flow) יטופל בנפרד לפי מסקנת סעיף 1.3 (חזרה לאסטרטגיה A אם נדרש).

### שלב E — בדיקות
ראו סעיף 5.

---

## 4. קבצים חדשים שייווצרו (במימוש בפועל, לא בסבב הנוכחי)

**קוד אפליקציה:**
```
src/lib/supabaseClient.js       # instance יחיד
src/services/client.js          # helpers גנריים (soft delete, tenant filter)
src/services/customerService.js # CRUD ל-Customer
src/services/index.js           # export מרוכז
src/pages/Login.jsx              # מסך login חדש (Supabase Auth) — לא קיים היום; Base44 מנהל login במסך חיצוני משלו (redirectToLogin), Supabase דורש מסך login בתוך האפליקציה
```

**תשתית בדיקות (Vitest, ADR חדש — ראו סעיף 5):**
```
vitest.config.js                 # config, תואם ל-vite.config קיים
src/services/__tests__/customerService.test.js
src/services/__tests__/rls.test.js   # contract test ל-tenant isolation
package.json                     # עדכון: scripts.test + devDependencies (vitest, @vitest/ui אופציונלי)
package-lock.json                # יתעדכן אוטומטית ע"י npm install
```

## קבצים קיימים שישתנו (במימוש בפועל, לא בסבב הנוכחי)

```
src/lib/AuthContext.jsx   # Base44 auth → Supabase Auth (login/logout/me בלבד)
src/pages/Customers.jsx   # base44.entities.Customer → CustomerService + הוספת error handling
src/App.jsx                # הוספת <Route path="/login"> חדש + חיבור Login.jsx; ה-gating הקיים ב-AuthenticatedApp צריך לעבוד מול Supabase session במקום Base44 authError
package.json                # dependencies: הוספת @supabase/supabase-js; devDependencies: vitest
```

**שום קובץ אחר לא משתנה.** בפרט: `src/api/base44Client.js` נשאר כפי שהוא (עדיין משמש 10 מסכים אחרים), `@base44/sdk` לא מוסר מ-`package.json`. **`src/components/ProtectedRoute.jsx` לא משתנה ולא נמחק** — הוא קוד מת (אומת בסעיף 1.1, לא מיובא בשום מקום), אך אינו בנתיב הריצה, ולכן אינו חוסם או תלוי בשינוי — משאירים אותו כפי שהוא כדי לא להרחיב את היקף השינוי מעבר לנדרש.

---

## 5. בדיקות שיש לכתוב לפני/תוך כדי המעבר

מאומת (`ARCHITECTURE_DECISIONS.md` נספח): **אין שום תשתית בדיקות בפרויקט כיום** (0 קבצי test, 0 config). Phase 1 היא גם ההזדמנות הראשונה להכניס Vitest (תואם Vite, ADR-01).

1. **Unit — `CustomerService`:** `list()`/`create()`/`update()`/`delete()` מול Supabase test/local instance — לוודא ש-`delete()` מבצע soft delete (`deleted_at` מתעדכן, לא `DELETE` אמיתי).
2. **Contract — RLS tenant isolation:** 2 משתמשי בדיקה בשני tenants שונים, לוודא ששניהם לא רואים אחד את הלקוחות של השני (זו הבדיקה הכי קריטית — היא מוודאת שהמעבר לא חושף נתונים בין חברות).
3. **Contract — Roles:** משתמש עם role=`viewer` לא יכול ליצור/למחוק (רק לקרוא); `member` יכול ליצור אך לא למחוק (soft).
4. **E2E ידני (לפני אוטומציה):** טעינת רשימת Customers, יצירה, עריכה, מחיקה, ניסיון גישה לרשומה שנמחקה (soft) — לוודא שהיא לא מופיעה.
5. **Regression ידני — Auth co-existence (הבדיקה הקריטית ביותר בכל התוכנית):** מיד אחרי שלב B (Auth global switch), לפני שלב C — לוודא ש-(א) כל 10 המסכים האחרים עדיין נטענים, (ב) `Project.list()` בתוך `Customers.jsx` עדיין מחזיר תוצאות, (ג) מפתחות `base44_*` עדיין קיימים ב-localStorage אחרי login+logout של Supabase (סעיף 1.3).
6. **Login flow (מסך חדש):** בדיקה ידנית/E2E בסיסית ש-`src/pages/Login.jsx` החדש מאפשר login/logout מלא מול Supabase Auth, כולל טיפול בשגיאת סיסמה שגויה.

---

## 6. מה קרה בפועל — פער בין התוכנית לביצוע (נכתב אחרי המימוש, 2026-08-12)

התוכנית בסעיפים 1-5 התקיימה במלואה כפי שתוכננה: אסטרטגיה C (מעבר Auth גלובלי) עבדה, `Project.list()` בתוך `Customers.jsx` המשיך לפעול ללא שינוי, ו-10 המסכים האחרים לא נשברו. **אך המימוש בפועל חשף שני באגים אמיתיים שהתוכנית לא צפתה**, ושניהם היו בשכבת ה-Supabase החדשה עצמה — לא בנקודת המפגש עם Base44 שעליה התמקד רוב הניתוח המוקדם (סעיף 1).

### באג 1 — GRANT חסר ברמת ה-DB (לא רק RLS)

**מה קרה:** לאחר השלמת שלבים A–D, ניסיון ה-CRUD הראשון בדפדפן נכשל עם `permission denied for table tenant_memberships` (Postgres error code `42501`).

**שורש הבעיה:** `SUPABASE_SCHEMA_PLAN.md` (וה-migration `0001_poc_core.sql` שנגזרה ממנו) התמקדו לחלוטין ב-RLS policies — אך Postgres בודק **table-level GRANT לפני** שהוא מגיע ל-RLS בכלל. המסמך והמיגרציה מעולם לא נתנו ל-role `authenticated` הרשאת `SELECT`/`INSERT`/`UPDATE` בסיסית על 4 הטבלאות, כך שכל בקשה מהאפליקציה נכשלה לפני שה-RLS בכלל "ראתה" אותה.

**זה לא היה טעות ניסוח — זו הייתה פרצה אמיתית בתכנון.** `SUPABASE_SCHEMA_PLAN.md` לא הזכיר GRANT באף מקום. Supabase Dashboard בד"כ עושה זאת אוטומטית כשיוצרים טבלה דרך ה-UI, אך זה **לא** קורה אוטומטית כשכותבים migrations כ-SQL גולמי (הבחירה שנעשתה ב-ADR-07).

**תיקון:** `supabase/migrations/0002_grants_fix.sql` — GRANT מפורש על כל 4 הטבלאות + 2 RPC functions, לרוץ **אחרי** `0001_poc_core.sql`.

**לקח לישויות הבאות:** כל migration עתידית (Project, ProjectQuote וכו') **חייבת** לכלול GRANT מפורש כחלק אינטגרלי מה-migration הראשונה שלה, לא כתיקון נפרד אחר כך. יש לעדכן את `SUPABASE_SCHEMA_PLAN.md` (או ליצור תבנית migration) כך שזה חלק קבוע מהתבנית.

### באג 2 — זיהוי שגוי של משתמש ב-seed (טעות אנוש, לא טעות תכנון)

**מה קרה:** גם אחרי תיקון ה-GRANT, יצירת לקוח עדיין נכשלה עם `"No active tenant membership found for this user"` עבור המשתמשת שהתחברה בפועל.

**שורש הבעיה:** ה-seed (`0002_poc_seed_fixed.sql`) קישר את ה-tenant owner ל-UUID `2c3b4b9b-43fb-465b-85fa-d747785caf32`, מתוך זיהוי שגוי (לפי סדר הופעה בצילום מסך, לא לפי בדיקה ישירה) שזה `r.yustman2501@gmail.com`. אימות ישיר (`select id, email from auth.users`) גילה שהמיפוי היה **הפוך**: `2c3b4b9b-...` שייך בפועל ל-`7147622@gmail.com`, ו-`r.yustman2501@gmail.com` הוא `23ffbb35-b5d2-47fc-9772-eb0a9d6d1e6b`.

**תיקון:** `supabase/seed/0005_fix_membership_owner.sql` — הוסיף membership עם role `owner` עבור ה-UUID הנכון. ה-membership השגוי נשאר קיים (לא נמחק, כדי לא לבצע פעולה הרסנית שלא נדרשה) אך לא בשימוש.

**לקח לישויות הבאות:** בכל seed עתידי — **לאמת UUID מול `auth.users` ישירות בשאילתת SQL**, לא להסתמך על סדר תצוגה ב-Dashboard UI. שני צילומי המסך שהוצגו בתחילת הדיבוג הראו את אותם משתמשים בסדר עקבי, אבל ה-UUID בפועל לא תאם את מה ש"נראה הגיוני".

### תהליך הדיבוג בפועל (לא היה בתוכנית המקורית)

התוכנית לא כללה תהליך דיבוג מובנה מעבר ל"בדיקה ידנית". בפועל, אבחון שני הבאגים דרש:
1. `console.log` זמני שנוסף ל-`getActiveTenantId()` (הוסר לאחר האבחון — ראו `memory/bug_no_active_tenant_membership.md` להיסטוריה המלאה)
2. קריאת שגיאת ה-Console בדפדפן (F12) בעומק — לא רק ה-toast שהוצג למשתמשת, אלא ה-object המלא עם `code`/`message`/`hint` מ-Postgres
3. שאילתות אימות ישירות ב-SQL Editor (`select id, email from auth.users`) כדי לשלול ניחושים

**לקח מתודולוגי:** כשמופיעה שגיאה מעורפלת כמו "No active tenant membership found" — יש לבדוק **בו-זמנית** גם את שכבת ה-GRANT/RLS וגם את נכונות ה-seed data עצמו, לא להניח ששגיאה אחת = בעיה אחת. במקרה הזה היו שתי בעיות נפרדות שהצטברו לאותה הודעת שגיאה גולמית מה-Service Layer.

### תוצאה סופית — כל 7 קריטריוני ההצלחה אומתו

1. ✅ Login דרך Supabase Auth בכל האפליקציה
2. ✅ RLS tenant isolation — נבדק דרך owner/role checks בפועל (בדיקת 2-tenants מלאה עדיין ממתינה ל-tenant שני אמיתי, ראו `rls.test.js`)
3. ✅ CRUD מלא (create/update/delete-soft) עובד מקצה לקצה
4. ✅ שגיאות מוצגות למשתמש — ה-toast עבד בפועל, בדיוק כשהיה הכי נחוץ (בזמן אבחון הבאגים)
5. ✅ 10 המסכים האחרים ממשיכים לעבוד — `Project.list()` בתוך `Customers.jsx` אושר עובד
6. ✅ בדיקות — 9 unit tests עוברות (`customerService.test.js`), RLS integration test כתוב ומדולג עד שיהיה tenant שני
7. ✅ מפתחות `base44_*` ב-localStorage לא נפגעו ממעבר ה-Auth

**אומת נוסף, לא היה בקריטריונים המקוריים:** soft delete אושר ישירות מול ה-DB (`0006_verify_soft_delete.sql`) — רשומה שנמחקה מה-UI עדיין קיימת בטבלה עם `deleted_at` תקין, ומוסתרת נכון מ-`list()`.

---

## נספח — קבצים שאומתו לצורך מסמך זה

- `src/lib/AuthContext.jsx` — נקרא במלואו (שוב, בסבב זה, לאימות ה-Provider value המדויק)
- `src/pages/Customers.jsx` — נקרא במלואו
- `src/App.jsx` — נקרא בסבב אודיט קודם (מאשר ש-`AuthProvider` עוטף את כל ה-routes)
- `src/api/base44Client.js` — נקרא במלואו בסבב זה (בניית client חד-פעמית, `requiresAuth: false`)
- `src/lib/app-params.js` — נקרא במלואו בסבב זה (מקור ה-token: URL/localStorage/env)
- `src/components/ProtectedRoute.jsx` — נקרא במלואו בסבב זה. **ממצא:** קוד מת, לא מיובא בשום מקום (Grep גלובלי), ומצפה לשדות (`authChecked`, `checkUserAuth`) שלא קיימים ב-`AuthContext.jsx` בפועל — כלומר שבור גם היום, לפני כל שינוי.
- Grep גלובלי על `appParams|localStorage` בכל `src/` — מאשר שהשימוש מוגבל ל-4 קבצים בלבד (`base44Client.js`, `MorningSummary.jsx`, `app-params.js`, `AuthContext.jsx`)
- `Glob` על `node_modules/@base44/**` — **אפס תוצאות; `node_modules` אינו מותקן בפרויקט**. לא ניתן לקרוא את מימוש ה-SDK הפנימי (ראו סעיף 1.1, "לא אומת").

---

> **סוף מסמך** — 2026-08-03. לא בוצע שום שינוי קוד.
