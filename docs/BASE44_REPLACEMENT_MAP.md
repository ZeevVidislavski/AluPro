# BASE44_REPLACEMENT_MAP.md

## מפת החלפה — Base44 → Supabase, היקף Phase 1 בלבד (Customer + Auth)

> **תאריך:** 2026-08-03
> **סטטוס:** תכנון בלבד. **לא בוצע שום שינוי קוד.**
> **היקף:** רק הקריאות שרלוונטיות ל-PoC (Customer + Auth הנדרש כתשתית עבורו). למיפוי מלא של כל 20 הישויות ברמת תכנון (לא ביצוע) — ראו `CLAUDE_MIGRATION_REVIEW.md` סעיפים 7-8.

---

## טבלת מיפוי מלאה

| קריאת Base44 קיימת | Service חדש | טבלת Supabase | CRUD ישיר או Backend Function | מסכים מושפעים |
|----------------------|--------------|------------------|----------------------------------|------------------|
| `base44.entities.Customer.list('-created_date')` | `CustomerService.list()` | `customers` | CRUD ישיר (RLS) | `Customers.jsx` |
| `base44.entities.Customer.create(data)` | `CustomerService.create(data)` | `customers` | CRUD ישיר (RLS, role ≥ member) | `Customers.jsx` |
| `base44.entities.Customer.update(id, data)` | `CustomerService.update(id, data)` | `customers` | CRUD ישיר (RLS, role ≥ member) | `Customers.jsx` |
| `base44.entities.Customer.delete(id)` | `CustomerService.delete(id)` — **soft delete** דרך `supabase.rpc('soft_delete_customer', {...})` | `customers` | **RPC function** (`soft_delete_customer`), **לא** CRUD ישיר — תוקן לאחר שזוהה ש-2 UPDATE policies חופפות (הרגילה + המחיקה) אינן דרך בטוחה מספיק להבחין "איזו עמודה" מתעדכנת (ראו `SUPABASE_SCHEMA_PLAN.md` סעיף 6.3) | `Customers.jsx` |
| — (לא קיים היום) | `CustomerService.restore(id)` | `customers` | **RPC function** (`restore_customer`) — בודקת role בתוך הפונקציה לפני `UPDATE deleted_at = null` | אף מסך עדיין (לא ממומש ב-UI ב-Phase 1) |
| `base44.entities.Project.list()` (בשימוש **בתוך** `Customers.jsx` לספירת פרויקטים לכל לקוח, שורה 71 מאומת) | **לא משתנה** — `Project` עדיין לא עבר | — (נשאר Base44) | — | `Customers.jsx` (לא נוגעים בקריאה הזו בשלב זה) |
| `base44.auth.me()` | `AuthService.getCurrentUser()` (בתוך `AuthContext.jsx` המעודכן) | `auth.users` + `profiles` (Supabase Auth) | Supabase Auth API ישיר | **כל 11 המסכים** (Auth הוא global, לא רק Customers — ראו `PHASE_1_IMPLEMENTATION_PLAN.md` סעיף 1) |
| `base44.auth.logout()` | `AuthService.logout()` | — | Supabase Auth API ישיר (`supabase.auth.signOut()`) | כל 11 המסכים |
| `base44.auth.redirectToLogin()` | `AuthService.navigateToLogin()` — מנווט ל-`/login` (route חדש, `src/pages/Login.jsx`) במקום redirect לדומיין חיצוני של Base44 | — | מסך Login חדש בתוך האפליקציה (לא היה קיים — Base44 מנהל login כדף חיצוני נפרד) | כל 11 המסכים |
| — (לא קיים היום, Base44 לא מפריד tenant) | `TenantService.getActiveTenant()` | `tenant_memberships` | CRUD ישיר (RLS, `SELECT` בלבד למשתמש על עצמו) | כל מסך שדורש `tenant_id` בעתיד — ב-Phase 1 רק דרך `CustomerService` בעקיפין |

---

## הערות חשובות לכל שורה

### אימות מקדים — האם `base44.entities.*` תלוי ב-Auth session? (קריטי לכל השורות שנשארות על Base44)

**אומת בפועל בסבב זה** (לא הונח): `src/api/base44Client.js` בונה את ה-`base44` client **פעם אחת בזמן טעינת המודול**, עם `token`/`appId` שנלקחים חד-פעמית מ-`appParams` (URL/`localStorage`/env), ו-`requiresAuth: false`. קריאות `base44.entities.*` **אינן** תלויות ב-React state של `AuthContext.jsx` (`isAuthenticated`/`user`) — הן פועלות מול הטוקן שכבר ב-localStorage, ללא קשר לזרימת ה-login/logout שמנוהלת ב-Context. המשמעות: כל שורה בטבלה למעלה שמסומנת "לא משתנה — נשאר Base44" **צפויה** להמשיך לפעול תקין אחרי שה-Auth יעבור ל-Supabase, **בתנאי מפורש** שה-login/logout החדשים לא מוחקים מפתחות `base44_*` מ-localStorage (פירוט מלא, כולל מה לא ניתן היה לאמת בגלל `node_modules` חסר, ב-`PHASE_1_IMPLEMENTATION_PLAN.md` סעיף 1.1).

### `Customer.*` (4 השורות הראשונות)
זהו הליבה של ה-PoC. שינוי מכני בלבד ב-`Customers.jsx` (import + namespace, לפי ADR-08) — אך **לא** מכני לחלוטין: `delete()` משנה סמנטיקה (soft ולא hard, **וגם** עובר דרך RPC ולא `UPDATE` ישיר — ראו תיקון ב-`SUPABASE_SCHEMA_PLAN.md`), ולכן ה-Service Layer **לא** יכול להיות wrapper "טיפש" סביב Supabase client — הוא צריך ללוגיקה מפורשת (`supabase.rpc('soft_delete_customer', ...)`, לא `DELETE` ולא `UPDATE` גנרי).

### `Customer.restore` — שורה חדשה שלא הייתה קיימת ב-Base44 כלל
Base44 לא תמך ב-soft delete (Audit קודם, `PROJECT_AUDIT.md`: אין audit log, אין versioning) — מחיקה ב-Base44 היא כנראה hard delete. זו יכולת **חדשה** שנוספת במעבר, לא רק "החלפה" — ולכן חייבת Backend Function ולא CRUD ישיר (ראו `SUPABASE_SCHEMA_PLAN.md` סעיף 6.2).

### `Project.list()` בתוך `Customers.jsx`
**קריטי לזכור:** מסך Customers **אינו** עובר ל-100% Supabase ב-Phase 1. הוא ישתמש **בשני מקורות נתונים בו-זמנית** — `CustomerService` (Supabase) עבור לקוחות, ו-`base44.entities.Project.list()` (Base44, ללא שינוי) עבור ספירת הפרויקטים לכל לקוח. זהו מצב ביניים **מכוון**, לא שגיאה — מתועד גם ב-`PHASE_1_IMPLEMENTATION_PLAN.md` שלב D.3. כשהישות `Project` תעבור בעתיד (לפי סדר התלות ב-`CLAUDE_MIGRATION_REVIEW.md` סעיף 8), השורה הזו תתעדכן.

### `auth.*` (3 השורות של Auth)
**אלו לא שינוי מקומי ל-`Customers.jsx`** — הן שינוי גלובלי ב-`AuthContext.jsx` שמשפיע על **כל 11 המסכים בבת אחת** (כי `AuthProvider` עוטף את כל ה-`<Routes>` ב-`App.jsx`, מאומת בסבב אודיט קודם). זו הסיבה שה-Auth migration מתוכננת כצעד **נפרד ומוקדם** משאר ה-PoC (ראו `PHASE_1_IMPLEMENTATION_PLAN.md` סעיף 1) — הסיכון שלה גדול משמעותית מהסיכון של Customer CRUD בלבד, כי טעות כאן שוברת את כל האפליקציה, לא רק מסך אחד.

### `TenantService.getActiveTenant()`
תלוי בהחלטה שתתקבל ב-`SUPABASE_SCHEMA_PLAN.md` סעיף 4 (Active Tenant) — ב-Phase 1 מיושם לפי חלופה 1 (membership יחיד), אך ה-API של ה-Service נשאר יציב גם אם המימוש הפנימי משתנה בעתיד לחלופה 2/3/4.

---

## מה **לא** נכלל במפה הזו (מפורש, כדי למנוע בלבול)

- כל 19 הישויות האחרות (`Project`, `ProjectQuote`, `QuoteItem` וכו') — **לא** ממופות כאן ברמת שורה-שורה; המיפוי התכנוני הכללי שלהן כבר קיים ב-`CLAUDE_MIGRATION_REVIEW.md` סעיף 7-8, אך זו לא "מפת ביצוע" מדויקת כמו כאן — היא תיכתב בנפרד לכל ישות כשמגיעים אליה, לפי סדר התלות.
- `base44.integrations.Core.UploadFile` — לא רלוונטי ל-Customer (אין קבצים בישות זו). ראו `CLAUDE_MIGRATION_REVIEW.md` סעיף 12 לתכנון Storage.
- כל הלוגיקה העסקית הרגישה (`calculateProjectFinancials` וכו', ADR-10) — לא רלוונטית ל-Customer (CRUD טהור בלבד).

---

## נספח — קבצים שאומתו לצורך מסמך זה

- `src/pages/Customers.jsx` — נקרא במלואו, כולל השורה המדויקת (71) של קריאת `Project.list()` בתוך הקובץ
- `src/lib/AuthContext.jsx` — נקרא במלואו (שוב, בסבב הנוכחי, לאימות ה-Provider value המדויק)
- `src/App.jsx` — נקרא בסבב אודיט קודם (מאשר `AuthProvider` גלובלי)
- `src/api/base44Client.js` — נקרא במלואו בסבב הנוכחי (בניית client חד-פעמית, `requiresAuth: false`, לא תלוי ב-React state)
- `src/lib/app-params.js` — נקרא במלואו בסבב הנוכחי (מקור token: URL → localStorage → env)
- `src/components/ProtectedRoute.jsx` — נקרא במלואו בסבב הנוכחי. ממצא: קוד מת, לא מיובא בשום מקום
- `base44/entities/Customer.jsonc` — נקרא בסבב קודם
- `Glob` על `node_modules/@base44/**` — אפס תוצאות; `node_modules` אינו מותקן, לא ניתן לקרוא מימוש SDK פנימי

---

> **סוף מסמך** — 2026-08-03. לא בוצע שום שינוי קוד.
