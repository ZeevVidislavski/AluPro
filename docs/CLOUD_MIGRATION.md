# CLOUD_MIGRATION.md

## תהליך המעבר מ-Base44 לארכיטקטורת Cloud עצמאית

> **תאריך:** 2026-08-01  
> **מטרה:** תכנון מעבר מלא מ-Base44 BaaS לארכיטקטורה עצמאית מבוססת GitHub + Vercel + Cloud Code + DB עצמאי + Storage עצמאי.  
> **הערה:** מסמך תכנון בלבד — ללא שינוי קוד, DB או API.

---

## 1. הארכיטקטורה הנוכחית

### 1.1 רכיבים עיקריים
```
┌──────────────────────────────────────────────────────────┐
│                    Base44 Platform                       │
│  ┌─────────┐  ┌─────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Auth    │  │ Database│  │ Storage  │  │ Integrations│ │
│  │ (built)  │  │ (NoSQL) │  │ (Upload) │  │ (LLM, etc) │  │
│  └─────────┘  └─────────┘  └──────────┘  └────────────┘  │
│         ↑           ↑            ↑              ↑        │
│         └───────────┴────────────┴──────────────┘        │
│                        │                                 │
│                        SDK (@base44/sdk)                 │
└──────────────────────────┬───────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              │   React SPA (Vite)      │
              │   - 11 pages            │
              │   - 24 components        │
              │   - 4 logic modules     │
              │   - TanStack Query     │
              └─────────────────────────┘
```

### 1.2 מאפיינים עיקריים
- **Frontend:** React 18 + Vite + Tailwind + shadcn/ui — רכיב זה נייד ואינו תלוי ב-Base44 לחלוטין (רק ב-SDK client).
- **Backend:** כל הלוגיקה ב-front-end; אין backend functions, אין workflows, אין agents.
- **Database:** NoSQL (MongoDB-style) דרך Base44 SDK — 20 entities.
- **Auth:** מנוהל על-ידי Base44 (tokens, sessions, email verification, invites).
- **Storage:** קבצים נשמרים דרך `Core.UploadFile` — URL ציבורי.
- **Integrations:** רק `Core.UploadFile` בשימוש; `InvokeLLM`, `SendEmail` מותקנים אך לא בשימוש.
- **Hosting:** Base44 פלטפורמה (build + deploy אוטומטי).

### 1.3 תלויות Base44 (נקודות שבירה)
| תלות | קוד | רמת חשיבות |
|------|-----|------------|
| SDK client | `@/api/base44Client` | קריטית — כל קריאות ה-DB וה-auth |
| Entity operations | `base44.entities.X.list/filter/create/update/delete` | קריטית — כל ה-CRUD |
| Auth context | `@/lib/AuthContext` → `base44.auth.*` | קריטית — login/logout/me |
| Upload | `base44.integrations.Core.UploadFile` | בינונית — מסמכים, לוגו, PDF |
| Auth gate | `<AuthProvider>` + `UserNotRegisteredError` | קריטית — routing guard |
| Invite users | `base44.users.inviteUser` | נמוכה — רק admin |
| Analytics | `base44.analytics.track` | נמוכה — לא בשימוש בקוד הנסרק |

---

## 2. הארכיטקטורה המומלצת לאחר המעבר

### 2.1 דיאגרמת יעד
```
┌──────────────┐     ┌──────────────┐     ┌────────────────┐
│   GitHub     │────▶│    Vercel    │────▶│  React SPA     │
│  (Source)    │     │  (Frontend   │     │  (Vite build)  │
│              │     │   Hosting)   │     │                │
└──────────────┘     └──────┬───────┘     └────────┬───────┘
                            │                      │
                            │ API Routes (Vercel)   │ fetch
                            ▼                      ▼
                     ┌──────────────┐      ┌─────────────────┐
                     │  Cloud Code  │      │  Independent DB │
                     │  (Backend)   │─────▶│  (PostgreSQL    │
                     │  - API       │      │   or Supabase)  │
                     │  - Auth      │      └─────────────────┘
                     │  - Business  │
                     │    Logic     │      ┌─────────────────┐
                     │  - Validation│─────▶│  Storage        │
                     └──────┬───────┘      │  (S3 / Supabase │
                            │              │   Storage)      │
                            ▼              └─────────────────┘
                     ┌──────────────┐
                     │   Auth       │
                     │ (Supabase    │
                     │  Auth /      │
                     │  Auth0 /     │
                     │  NextAuth)   │
                     └──────────────┘
```

### 2.2 רכיבי יעד מומלצים
| רכיב | פתרון מומלץ | חלופות |
|------|-------------|---------|
| **Source Control** | GitHub (private repo) | GitLab, Bitbucket |
| **Frontend Hosting** | Vercel | Netlify, Cloudflare Pages |
| **Backend API** | Vercel Serverless Functions או Cloud Code (NestJS/Express) | Supabase Edge Functions, Cloudflare Workers |
| **Database** | PostgreSQL (Supabase / Neon / Railway) | MongoDB Atlas (לשמירת דמוי NoSQL) |
| **Auth** | Supabase Auth או Auth0 או NextAuth.js | Clerk, Firebase Auth |
| **Storage** | Supabase Storage או AWS S3 או Cloudflare R2 | Vercel Blob |
| **ORM** | Prisma (PostgreSQL) או Drizzle | TypeORM, Mongoose |
| **Validation** | Zod (כבר מותקן) | Yup, Joi |
| **State Management** | TanStack Query (לשמור) | SWR |
| **PDF Generation** | עבר לשרת — Puppeteer / React-PDF | שמירת html2canvas ב-front (לא מומלץ) |

### 2.3 עקרונות תכנון
1. **Frontend stays React** — ה-UI לא משתנה; רק מחליפים מקור נתונים.
2. **Backend becomes authoritative** — כל validation, חישובים רגישים, ו-RLS עוברים לשרת.
3. **Database רלציוני** — PostgreSQL עם foreign keys ו-joins (המערכת רלציונית באופייה).
4. **Storage עם signed URLs** — גישה מבוקרת לקבצים.
5. **Auth חיצוני** — פתרון auth מקצועי עם JWT + refresh tokens.

---

## 3. חלקים שנשארים כפי שהם

### 3.1 שכבת UI (Frontend)
- ✅ כל 11 הדפים (Dashboard, Customers, Projects, ProjectDetails, Quotes, QuoteEditor, ModelPricing, CompanyHeaders, Finance, Reminders, BusinessAgent)
- ✅ כל 24 רכיבי ה-UI העסקיים
- ✅ כל ~40 רכיבי shadcn/ui
- ✅ עיצוב, Tailwind, RTL, עברית
- ✅ TanStack React Query — נשאר, רק מחליפים queryFn
- ✅ כל ה-Logic Modules (`projectFinancials`, `partnerSettlement`, `agentLogic`, `smartFocus`, `quoteCalculations`, `formulaEngine`, `materialOrderGenerator`) — פונקציות pure, ניתנות להעתקה ישירות
- ✅ React Router — נשאר כמו שהוא
- ✅ date-fns, Recharts, lucide-react — נשארים

### 3.2 מה באמת משתנה ב-frontend
- 🔄 `@/api/base44Client` → נדרש API client חדש (axios/fetch) ל-backend עצמאי
- 🔄 `base44.entities.X.*` → `apiClient.X.*` (אותה ממשק, מימוש אחר)
- 🔄 `@/lib/AuthContext` → מותאם ל-auth החדש (Supabase/NextAuth)
- 🔄 `base44.integrations.Core.UploadFile` → upload ישירות ל-S3/Supabase Storage דרך signed URL
- 🔄 `base44.users.inviteUser` → API endpoint חדש
- 🔄 Auth gate — אותו דפוס, מקור שונה

---

## 4. חלקים שחייבים לעבור לשרת

### 4.1 חישובים פיננסיים רגישים
| חישוב | קובץ נוכחי | סיבה להעברה |
|-------|------------|-------------|
| `calculateProjectFinancials` | `lib/projectFinancials.jsx` | מקור אמת לרווח/יתרה — חייב להיות authoritative |
| `calculateFullPartnerSettlement` | `lib/partnerSettlement.jsx` | חלוקת רווחים — אסור שינוי מצד client |
| `validateProjectCanClose` | `lib/partnerSettlement.jsx` | וולידציה עסקית קריטית |
| `calcComponentValue` / `calcItemTotal` | `lib/quoteCalculations.js` | חישוב מחיר — רגיש |
| `calculateComponents` | `lib/formulaEngine.js` | חישוב רכיבי ייצור |
| `generateMaterialOrders` | `lib/materialOrderGenerator.js` | יצירת הזמנות — צריך transaction |

### 4.2 פעולות שדורשות Validation שרת
- יצירת/עדכון פרויקט (סטטוס, סגירת התחשבנות)
- יצירת/עדכון תשלומים והזמנות ספק
- יצירת/עדכון הצעות מחיר (סטטוס approved)
- סגירת התחשבנות (`closeSettlement`)
- יצירת הזמנות חומר
- הזמנת משתמשים (invite)
- מחיקות (cascade validation)

### 4.3 אילו שירותי Base44 בשימוש
| שירות | שימוש נוכחי | יעד מומלץ |
|-------|------------|-----------|
| Database (NoSQL) | 20 entities, CRUD | PostgreSQL (Supabase/Neon) |
| Auth | login/logout/me/invite | Supabase Auth או Auth0 |
| Storage | `UploadFile` (public URL) | S3 / Supabase Storage (signed URLs) |
| SDK client | `@base44/sdk` | API client עצמאי (axios) |
| Hosting | Base44 | Vercel |
| Integrations.UploadFile | מסמכים, לוגו, PDF | S3/Supabase direct upload |
| Analytics | `analytics.track` (לא בשימוש) | Vercel Analytics / PostHog |
| SendEmail | מותקן, לא בשימוש | Resend / SendGrid |

---

## 5. סדר העבודה המומלץ להגירה

### שלב 0 — הכנה (שבוע 1)
1. יצירת GitHub repository private
2. העתקת קוד ה-front-end (ללא `@base44/sdk`)
3. הגדרת Vercel project + environment variables
4. בחירת DB (המלצה: Supabase — DB + Auth + Storage בפלטפורמה אחת)

### שלב 1 — Database Schema (שבוע 2)
1. המרת 20 entities ל-PostgreSQL schema (Prisma)
2. יצירת migrations
3. יצירת seed data
4. וולידציה מול נתונים קיימים (ייצוא מ-Base44)

### שלב 2 — Auth (שבוע 3)
1. הגדרת Supabase Auth / Auth0
2. מיפוי roles (admin/user)
3. החלפת `AuthContext` לפתרון החדש
4. הזמנת משתמשים (endpoint חדש)

### שלב 3 — API Layer (שבוע 3-4)
1. יצירת API routes (Vercel Serverless או Cloud Code)
2. CRUD לכל entity
3. Validation ב-Zod
4. העברת חישובים רגישים לשרת

### שלב 4 — API Client (שבוע 4)
1. יצירת `apiClient` חדש (אותו ממשק כמו `base44.entities`)
2. החלפת imports בכל הדפים/רכיבים
3. עדכון query keys

### שלב 5 — Storage (שבוע 5)
1. הגדרת S3/Supabase Storage
2. יצירת endpoints ל-signed URLs
3. החלפת `UploadFile` ב-upload ישיר ל-storage
4. Migration של קבצים קיימים

### שלב 6 — Security (שבוע 5)
1. מימוש RLS ברמת DB (PostgreSQL Row Level Security)
2. Middleware לבדיקת הרשאות
3. בדיקת גישה per-entity

### שלב 7 — Testing & QA (שבוע 6)
1. בדיקות פונקציונליות מלאות
2. השוואת תוצאות חישובים מול Base44
3. בדיקות אבטחה

### שלב 8 — Cutover (שבוע 6)
1. הקפאת כתיבות ב-Base44
2. ייצוא נתונים סופי
3. Import ל-PostgreSQL
4. החלפת DNS / domain
5. ניטור צמוד (24 שעות)

### שלב 9 — Post-Migration
1. ניטור שגיאות
2. גיבויים
3. תיעוד סופי
4. הוצאת Base44 מייצור

---

## 6. זמני הערכה (כולל סיכון)

| שלב | משך | סיכון |
|------|------|-------|
| 0. הכנה | 1 שבוע | נמוך |
| 1. Database | 1 שבוע | בינוני (המרת NoSQL→SQL) |
| 2. Auth | 1 שבוע | בינוני |
| 3. API Layer | 2 שבועות | גבוה (הכי עבודה) |
| 4. API Client | 1 שבוע | נמוך |
| 5. Storage | 1 שבוע | נמוך |
| 6. Security | 1 שבוע | בינוני-גבוה |
| 7. Testing | 1 שבוע | נמוך |
| 8. Cutover | 2-3 ימים | גבוה |
| **סה"כ** | **~8-9 שבועות** | |

---

## 7. סיכונים עיקריים

1. **אובדן נתונים ב-migration** — חובת גיבוי מלא לפני cutover
2. **הבדלי חישובים** — חישובים פיננסיים חייבים לתת תוצאות זהות
3. **Auth mismatch** — סיסמאות קיימות לא ניתנות להעברה (שאלת reset)
4. **RLS gaps** — כיום אין RLS; מעבר דורש הגדרה מאפס
5. **File URLs שבורים** — קישורי Base44 Storage יפסיקו לעבוד
6. **תלות סמויה ב-SDK** — ייתכנו קריאות שלא נסרקו
7. **זמן downtime ב-cutover** — יש לתכנן חלון תחזוקה

---

> ראה גם: `MIGRATION_MASTER_PLAN.md` לסיכום מרכזי וסדר עבודה.