# דוח Audit — ProjectFlow Pro (windows-crm)

> **תאריך:** 2026-08-03
> **סוג מסמך:** Audit בלבד — לא בוצע שום שינוי בקוד, במבנה הפרויקט או בבסיס הנתונים.
> **מתודולוגיה:** כל טענה במסמך זה מבוססת על אחד משני מקורות: (א) קריאה ישירה של קובצי קוד בפרויקט, או (ב) מסמך תיעוד קיים ב-`docs/`. כל מקום שבו לא הייתה אפשרות לאמת ישירות מסומן במפורש **"לא אומת"**. שום פרט לא הוסק בניחוש.

---

## 0. הערה מקדימה — חשובה לפני הכל

בבקשת ה-Audit צוינו נתיבים שאינם קיימים בפרויקט:
`docs/base44-current-system/PRD.md`, `ARCHITECTURE.md`, `TECH_STACK.md`, `DATABASE_SCHEMA.md`, `KNOWN_ISSUES.md`.

**נבדק ואומת:** תיקייה בשם `docs/base44-current-system/` אינה קיימת בפרויקט. המסמכים הרלוונטיים נמצאים ישירות תחת `docs/`.

בנוסף, יש להבחין בין **שני סוגי מסמכים שונים לגמרי** שקיימים ב-`docs/`:

| סוג | מסמכים | מה הם מתארים |
|-----|---------|----------------|
| **תיאור המצב הקיים** | `PROJECT_AUDIT.md` | audit מקיף שכבר בוצע ב-2026-08-01, מתאר את הקוד **כפי שהוא היום** |
| **תוכניות יעד עתידיות (טרם מומשו)** | `SAAS_ARCHITECTURE.md`, `SECURITY_MODEL.md`, `DATABASE_MIGRATION.md`, `DEPLOYMENT_ARCHITECTURE.md`, `VENDOR_LOCK_IN_ANALYSIS.md`, `BACKEND_MIGRATION_PLAN.md`, `CLOUD_CODE_API_PLAN.md`, `CLOUD_MIGRATION.md`, `STORAGE_MIGRATION.md`, `MIGRATION_MASTER_PLAN.md`, `MIGRATION_CHECKLIST.md`, `INFRASTRUCTURE_AND_PRODUCTION_CHECKLIST_HE.md` | ארכיטקטורת **יעד** (PostgreSQL, Prisma, Vercel Functions, Supabase Auth, S3, Stripe, RBAC, Multi-tenant) — **אף אחד מהם לא מומש בקוד כיום** |

זהו הפער המרכזי שיש להבין: **הקוד היום = Base44 בלבד**. שום דבר מארכיטקטורת היעד (PostgreSQL/Prisma/Vercel Functions/Supabase/S3/Stripe) אינו קיים בקוד בפועל. הוא מתועד כתוכנית, לא כמצב.

---

## 1. מה המערכת עושה כיום

**ProjectFlow Pro** — מערכת ניהול לעסק אלומיניום (חלונות): לקוחות, פרויקטים, תשלומים, הזמנות ספקים, הצעות מחיר עם עורך מפורט, קטלוג דגמים/רכיבים עם מנוע נוסחאות, הזמנות חומר אוטומטיות, מסמכים, תזכורות, ניתוח פיננסי (כולל התחשבנות שותפים), ומודול "ניהול חכם" (Agent) עם התראות וניקוד עדיפות. ממשק בעברית, RTL.

**מקור:** `docs/PROJECT_AUDIT.md` סעיפים 1–3. אומת מול `src/pages/` (11 קבצי דף תואמים בדיוק לרשימה במסמך) ו-`src/App.jsx`.

11 המסכים: Dashboard, Customers, Projects, ProjectDetails, Quotes, QuoteEditor, ModelPricing, CompanyHeaders, Finance, Reminders, BusinessAgent.

---

## 2. מבנה התיקיות והקוד

```
src/
├── App.jsx                    # Router + Auth gate — אומת ישירות
├── Layout.jsx                 # Sidebar + RTL layout
├── main.jsx
├── pages.config.js            # routing אוטומטי (legacy, מקור Base44)
├── pages/                     # 11 קבצי דף — אומת (Glob)
├── components/{ui,dashboard,finance,project,quotes,models,templates,agent,lib}/
├── lib/                       # AuthContext, utils, query-client, app-params — אומת (Glob)
└── utils/index.ts
base44/
├── config.jsonc               # אומת: buildCommand/outputDirectory בלבד
└── entities/                  # 20 קובצי JSON Schema — אומת (Glob)
```

**מקור:** `docs/PROJECT_AUDIT.md` סעיף 1.2. אומת ישירות: `src/App.jsx`, `src/lib/AuthContext.jsx`, `src/lib/app-params.js`, `base44/config.jsonc`, ו-Glob של `src/pages/` ו-`src/lib/`.

---

## 3. הטכנולוגיות שבאמת נמצאות בפרויקט

אומת ישירות מ-`package.json`:

**Frontend בשימוש בפועל:** React 18, Vite 6, React Router DOM 6, Tailwind 3, shadcn/ui (Radix), TanStack Query 5, Recharts, date-fns, html2canvas + jsPDF.

**"Backend":** `@base44/sdk` — לא שרת עצמאי, אלא SDK client שמתקשר עם Base44 (BaaS חיצוני). `@base44/vite-plugin` — build plugin.

**מותקנות אך לא בשימוש בקוד שנסרק** (לפי `PROJECT_AUDIT.md`, לא אומת מחדש שורה-שורה בסבב הזה): `react-hook-form`, `zod`, `framer-motion`, `three`, `react-leaflet`, `@hello-pangea/dnd`, `react-quill`, `@stripe/*`, `canvas-confetti`, `moment`, `next-themes`.

**חשוב:** אין בפרויקט Prisma, אין PostgreSQL client, אין Supabase SDK, אין AWS SDK, אין Stripe שרת — כל אלו מוזכרים רק במסמכי תוכנית היעד.

---

## 4. כיצד מתחילים ומריצים את המערכת

**מקור:** `README.md` + `package.json` (אומת ישירות).

```bash
npm install
# יצירת .env.local עם:
VITE_BASE44_APP_ID=<app_id>
VITE_BASE44_APP_BASE_URL=<backend_url>
npm run dev        # vite dev server
npm run build       # vite build → dist/
npm run lint / lint:fix / typecheck / preview
```

**לא אומת:** אין קובץ `.env.local` או `.env.example` בפועל בפרויקט (נבדק — לא קיים). כלומר אין דוגמה מתועדת בקוד עצמו; ההוראה ל-`.env.local` מגיעה מה-README בלבד.

---

## 5. היכן נמצא ה-Frontend

כל הקוד תחת `src/` — אפליקציית React+Vite סטנדרטית, SPA. אין frontend נפרד/רב-אפליקציות.

---

## 6. היכן נמצא ה-Backend

**לא קיים בקוד של הפרויקט.** אין תיקיית `api/`, אין Express/Fastify server, אין Vercel Serverless Functions בקוד. כל הלוגיקה (כולל חישובים פיננסיים, ולידציות, יצירת הזמנות חומר) רצה **בצד הלקוח (frontend)**, וכל שמירה/שליפה של נתונים עוברת ישירות מה-frontend אל Base44 (BaaS חיצוני) דרך `@base44/sdk`.

**אומת:** `src/api/base44Client.js` — client יחיד, אין endpoint מותאם אישית. `base44/` בשורש הפרויקט מכיל רק **הגדרות schema** (`entities/*.jsonc`) ו-`config.jsonc` — לא קוד שרת.

תוכניות ל"backend" עצמאי (Vercel Functions + Prisma) מתועדות ב-`BACKEND_MIGRATION_PLAN.md` ו-`CLOUD_CODE_API_PLAN.md`, אך **טרם מומשו** — לא נמצא קוד תואם.

---

## 7. באיזה Database המערכת משתמשת

**Base44** (BaaS) — מסד נתונים מנוהל, לא ידוע אם PostgreSQL/NoSQL בפועל בצד Base44 עצמו (**לא אומת** — Base44 הוא שירות חיצוני סגור, אין גישה לבדוק את המימוש הפנימי שלו). מנקודת המבט של הקוד: כל entity מוגדר כ-JSON Schema תחת `base44/entities/*.jsonc`, וגישה מתבצעת דרך `base44.entities.{Name}.{list/filter/get/create/update/delete}()` — API שדומה ל-NoSQL (ללא joins; אגרגציות מתבצעות ב-client).

**20 ישויות** (אומת — Glob של `base44/entities/`): Customer, Project, ProjectQuote, QuoteItem, QuoteItemComponent, ClientPayment, SupplierOrder, Document, Reminder, Partner, GeneralExpense, ModelPricing, ModelComponent, QuoteTemplate, QuoteTemplateComponent, MaterialOrder, MaterialOrderItem, AgentSettings, AgentAlert, CompanyHeader.

**PostgreSQL אינו קיים בפועל** — הוא מתועד רק כיעד עתידי ב-`DATABASE_MIGRATION.md` (סכמת Prisma מלאה, שם קובץ מטעה פוטנציאלית לקורא שאינו מבחין בין תוכנית לביצוע).

---

## 8. כיצד מתבצעת ההתחברות

**אומת ישירות** מ-`src/lib/AuthContext.jsx` ו-`src/lib/app-params.js`:

1. `appParams` (מ-`app-params.js`) קורא `appId`/`token` מפרמטרי URL, ואז מ-`localStorage` (מפתחות `base44_*`), עם fallback ל-`import.meta.env.VITE_BASE44_APP_ID` / `VITE_BASE44_APP_BASE_URL`.
2. `AuthProvider` (ב-mount) קורא ל-`GET /api/apps/public/prod/public-settings/by-id/{appId}` (מול Base44).
3. אם קיים token → `base44.auth.me()` לאימות המשתמש.
4. שגיאות 403 מסווגות ל-`auth_required` (redirect ל-login של Base44) או `user_not_registered`.
5. Logout: `base44.auth.logout()` — מנוהל ע"י ה-SDK.

**אין** מימוש JWT/session עצמאי בקוד — הכל מוקצה ל-Base44. תוכנית מעבר ל-Supabase Auth + JWT מתועדת ב-`SECURITY_MODEL.md`, **לא מומשה**.

**Roles:** רק `admin`/`user` (מובנה ב-Base44 User entity) — **לא אומת ישירות בקוד** (לא נמצא שימוש מפורש ב-role בקבצים שנסרקו בסבב זה; מבוסס על `PROJECT_AUDIT.md`).

---

## 9. היכן נשמרים קבצים

לפי `PROJECT_AUDIT.md` ו-`VENDOR_LOCK_IN_ANALYSIS.md`: `base44.integrations.Core.UploadFile({ file })` מחזיר `file_url` ציבורי קבוע, המאוחסן בשדות כמו `Document.file_url`, `ProjectQuote.file_url`, `CompanyHeader.logo_url`. **לא אומת ישירות בסבב זה** (לא נקרא קובץ שמבצע את הקריאה בפועל) — מבוסס על תיעוד קיים באודיט הקודם.

אין S3/Storage עצמאי בקוד — זו תוכנית עתידית (`STORAGE_MIGRATION.md`).

---

## 10. אילו חלקים עדיין תלויים ב-Base44

**כל המערכת.** לפי `VENDOR_LOCK_IN_ANALYSIS.md` (טבלת סיכום סעיף 3), רכיבי הליבה התלויים ב-Base44:
- SDK Client (כל ה-DB CRUD)
- Database (הנתונים עצמם מנוהלים ב-Base44)
- Authentication (login/logout/me/invite)
- Storage (`UploadFile`)
- Hosting/Build (`@base44/vite-plugin`, deploy מנוהל ע"י Base44)
- `pages.config.js` — routing אוטומטי שנוצר ע"י Base44 (אומת: `src/App.jsx` עדיין מייבא וקורא ל-`pagesConfig`)

**לא בשימוש בקוד אך זמינים ב-Base44** (לפי המסמך, לא אומת ישירות): InvokeLLM, SendEmail, GenerateImage/Video/Speech, TranscribeAudio, ExtractData, Analytics tracking.

---

## 11. אילו משתני סביבה דרושים (ללא חשיפת סודות)

**אומת בפועל בקוד** (`src/lib/app-params.js`):
| משתנה | חובה? | הערה |
|-------|-------|------|
| `VITE_BASE44_APP_ID` | כן (ברירת מחדל ל-URL/localStorage) | מזהה האפליקציה ב-Base44 |
| `VITE_BASE44_APP_BASE_URL` | כן (fallback דומה) | כתובת ה-backend של Base44 |
| `VITE_BASE44_FUNCTIONS_VERSION` | לא, אופציונלי | גרסת functions (אם רלוונטי) |

**לא קיים בפרויקט** קובץ `.env.example` בפועל — נבדק ולא נמצא. הרשימה המפורטת ב-`DEPLOYMENT_ARCHITECTURE.md` (DATABASE_URL, JWT_SECRET, STRIPE_SECRET_KEY, AWS_ACCESS_KEY_ID וכו') שייכת **כולה לתוכנית העתידית** — אף אחד מהם אינו נדרש להרצת הקוד הקיים היום.

---

## 12. הבדלים בין המסמכים לקוד

| נושא | מה כתוב במסמכי היעד | מה קיים בפועל בקוד | פער |
|------|----------------------|----------------------|-----|
| Database | PostgreSQL + Prisma, 20 טבלאות רלציוניות עם RLS | Base44-managed, NoSQL-style, ללא הבדלה בין enums לטקסט חופשי | מלא — לא מומש |
| Auth | Supabase Auth, JWT (access+refresh), httpOnly cookies, RBAC 5 תפקידים | Base44 SDK בלבד, `admin`/`user` בלבד | מלא — לא מומש |
| Backend/API | Vercel Serverless Functions, ~30+ endpoints מתועדים | אין קוד שרת כלל בפרויקט | מלא — לא מומש |
| Storage | AWS S3 + signed URLs | Base44 `UploadFile`, URL ציבורי קבוע (לפי audit קודם, לא אומת ישירות כעת) | מלא — לא מומש |
| Multi-tenant | `tenant_id` בכל טבלה, RLS לפי tenant | Single-tenant, אין `tenant_id` בשום entity (אומת: לא מופיע בשמות שדות `base44/entities/*`) | מלא — לא מומש |
| Deployment | GitHub → Vercel, CI/CD, branch protection | Base44 מנהל build/deploy (`base44/config.jsonc`); לא נמצאו workflows של GitHub Actions בפרויקט | מלא — לא מומש (**לא אומת** קיום/העדר `.github/workflows` בסבב זה) |
| Billing | Stripe, טבלאות Subscription/Invoice | לא קיים כלל בקוד | מלא — לא מומש |

**מסקנה:** מסמכי היעד הם תוכנית מתועדת היטב אך **לא בוצע אף שלב ממנה בקוד**. אין דיסוננס טעות — המסמכים עצמם מוגדרים כתוכנית ("מתכננים מעבר"), אך שם קובץ כמו `DATABASE_MIGRATION.md` עלול להטעות קורא חדש לחשוב שהמעבר בוצע חלקית.

---

## 13. סיכונים וחלקים חסרים

מבוסס על `docs/PROJECT_AUDIT.md` סעיף 14 (לא אומת מחדש שורה-שורה בסבב זה, אלא צוטט ישירות מהאודיט הקיים):

**אבטחה (קריטי):**
- **אין RLS** — כל משתמש מאומת רואה/עורך/מוחק את כל הנתונים, ללא הבדלה בין ארגונים/משתמשים.
- **אין ולידציה server-side** — הכל בצד הלקוח בלבד.
- `closed_by` מקודד קשיח כמחרוזת `"מנהל"` בלוגיקת סגירת התחשבנות (לא user אמיתי).

**עקביות נתונים:**
- Query Key mismatch — Dashboard/MorningSummary משתמשים ב-`['quotes']`/`['payments']`/`['orders']` בעוד שאר המערכת ב-`['all-quotes']` וכו' — סיכון ל-caching כפול ונתונים לא מסונכרנים.
- `pricing_method` — חוסר עקביות בין `meter`/`meter_width`/`meter_height`.
- `project_number` ו-`addition_number` — לא מובטחת ייחודיות (`P${Date.now()...}` עלול להתנגש; `addition_number` מחושב כ-`quotes.length`, לא מספר רץ אמיתי).

**תשתית (לפי `INFRASTRUCTURE_AND_PRODUCTION_CHECKLIST_HE.md`, סטטוס עדכני שם):**
```
Production: טרם הוקם
ארכיטקטורה סופית: טרם אושרה
Multi-Tenancy: דורש בדיקה
גיבויים: טרם הוגדרו
```

**חסרים תפקודית** (מ-`PROJECT_AUDIT.md` סעיף 12): אין audit log, אין ניהול מלאי, אין חשבוניות מס רשמיות, אין בדיקות אוטומטיות (tests), אין multi-tenant, אין notifications (push/email).

---

## 14. סדר עבודה מומלץ

בהתבסס על `VENDOR_LOCK_IN_ANALYSIS.md` סעיף 6 ו-`MIGRATION_MASTER_PLAN.md` (תוכנית מתועדת, טרם החל ביצועה):

1. **החלטה עסקית ראשונה:** האם המעבר מ-Base44 בכלל נדרש כרגע, או שהעדיפות היא לתקן את הפערים הקריטיים (RLS/ולידציה) תוך המשך עבודה על Base44 — נושא זה דורש החלטת בעלים, לא טכני בלבד.
2. אם ממשיכים במעבר: להתחיל ב-**Database** (הבסיס לכל השאר), עם גיבוי מלא לפני כל שלב.
3. לשמור על ממשק service דומה ל-SDK הקיים (`XService.list()` ≈ `base44.entities.X.list()`) כדי לצמצם שינויים ב-frontend.
4. לתקן תחילה בעיות עקביות קיימות (Query keys, `pricing_method`, ייחודיות `project_number`/`addition_number`) — לפני migration, כדי לא להעביר את הבאגים למערכת החדשה.
5. Auth ו-RLS יחד — לא להפריד, כי RLS תלוי ב-JWT claims מ-Auth.
6. Cutover רק אחרי testing מלא + חלון תחזוקה מתוכנן + תקשורת מראש למשתמשים (reset סיסמאות צפוי).

**לא אומת בסבב זה:** האם קיימת כרגע תוכנית זמנים/תקציב מאושרת בפועל למעבר — זו שאלה עסקית שלא ניתן לענות עליה מקריאת קוד.

---

## נספח — קבצים שנקראו ואומתו ישירות בסבב Audit זה

- `docs/PROJECT_AUDIT.md`, `SAAS_ARCHITECTURE.md`, `SECURITY_MODEL.md`, `DATABASE_MIGRATION.md`, `DEPLOYMENT_ARCHITECTURE.md`, `VENDOR_LOCK_IN_ANALYSIS.md`, `MIGRATION_MASTER_PLAN.md`, `MIGRATION_CHECKLIST.md`, `INFRASTRUCTURE_AND_PRODUCTION_CHECKLIST_HE.md`
- `README.md`, `package.json`, `base44/config.jsonc`
- `src/App.jsx`, `src/lib/AuthContext.jsx`, `src/lib/app-params.js`, `src/api/base44Client.js`
- מבנה תיקיות: `src/pages/*`, `src/lib/*`, `base44/entities/*` (Glob בלבד — לא כל קובץ נקרא לעומק)

**לא נקראו בסבב זה** (לא אומתו): `docs/BACKEND_MIGRATION_PLAN.md`, `docs/CLOUD_CODE_API_PLAN.md`, `docs/CLOUD_MIGRATION.md`, `docs/STORAGE_MIGRATION.md`, קבצי הרכיבים העסקיים (`src/components/**`), מודולי הלוגיקה (`src/components/lib/*.jsx`), תוכן מלא של `base44/entities/*.jsonc`, קיום/העדר `.github/workflows/`.

---

> **סוף דוח Audit** — 2026-08-03. לא בוצעו שינויים, מחיקות, התקנות או migrations.
