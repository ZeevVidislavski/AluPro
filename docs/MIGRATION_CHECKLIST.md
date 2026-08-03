# MIGRATION_CHECKLIST.md

## Checklist מסודר לכל שלבי המעבר

> **תאריך:** 2026-08-01  
> **מטרה:** מעקב מלא אחר כל שלבי המעבר מ-Base44 לענן עצמאי.

---

## שלב 0 — הכנה

- [ ] אישור תקציב (Vercel Pro + Supabase Pro + S3 + Stripe)
- [ ] רכישת דומיין `projectflow.pro`
- [ ] יצירת GitHub repository private
- [ ] הזמנת מתכנת חיצוני / הקצאת זמן
- [ ] גיבוי מלא של כל הנתונים ב-Base44 (export JSON)
- [ ] תיעוד נתונים רגישים (סיסמאות, API keys קיימים)
- [ ] הגדרת סביבת פיתוח מקומית (Node 20, PostgreSQL, Redis)

---

## שלב 1 — Repository

- [ ] יצירת GitHub repo `projectflow-pro`
- [ ] הגדרת `.gitignore` (node_modules, .env, dist)
- [ ] העתקת קוד front-end מ-Base44 (ללא `@base44/sdk`)
- [ ] יצירת מבנה תיקיות: `src/`, `api/`, `prisma/`, `docs/`
- [ ] יצירת `vercel.json`
- [ ] יצירת `.env.example`
- [ ] הגדרת branch protection: `main` (חובת PR + CI)
- [ ] הגדרת branch protection: `develop` (חובת CI)
- [ ] יצירת `README.md` עם הוראות התקנה
- [ ] הגדרת GitHub Actions: `ci.yml`, `deploy.yml`

---

## שלב 2 — Database

- [ ] יצירת Supabase project (region: eu-central-1)
- [ ] יצירת Prisma schema מלא (מתוך `DATABASE_MIGRATION.md`)
- [ ] `npx prisma migrate dev --name init`
- [ ] הוספת `tenant_id` לכל טבלה (לעתיד SaaS)
- [ ] יצירת enums (ProjectStatus, PaymentType, וכו')
- [ ] יצירת indexes (idx_projects_customer_id, וכו')
- [ ] יצירת unique constraints (project_number, [project_id, addition_number])
- [ ] המרת Float פיננסיים → Decimal(12,2)
- [ ] סקריפט export מ-Base44 (Node.js + SDK)
- [ ] הרצת export → JSON files
- [ ] סקריפט import ל-PostgreSQL (Prisma)
- [ ] הרצת import (לפי סדר תלות)
- [ ] וולידציה: counts זהים
- [ ] וולידציה: סכומים פיננסיים זהים
- [ ] וולידציה: קשרים (FK) תקינים
- [ ] הפעלת Point-in-Time Recovery (Supabase)
- [ ] גיבוי ידני ל-S3

---

## שלב 3 — Authentication

- [ ] הפעלת Supabase Auth (או Auth0)
- [ ] הגדרת אימייל/סיסמה provider
- [ ] הגדרת JWT (access 15min, refresh 7d)
- [ ] הגדרת httpOnly cookies
- [ ] יצירת `AuthContext` חדש (מחליף Base44)
- [ ] מיפוי roles: admin → tenantadmin, user → user
- [ ] יצירת `/api/auth/login`
- [ ] יצירת `/api/auth/logout`
- [ ] יצירת `/api/auth/me`
- [ ] יצירת `/api/auth/refresh`
- [ ] יצירת `/api/auth/forgot-password`
- [ ] יצירת `/api/auth/reset-password`
- [ ] יצירת `/api/users/invite`
- [ ] יצירת `/api/users/accept-invite`
- [ ] הגדרת rate limiting (5 ניסיונות / 15 דקות)
- [ ] הגדרת password policy (min 8)
- [ ] הגדרת email verification
- [ ] בדיקת מיגרציית משתמשים קיימים (reset סיסמאות)
- [ ] עדכון `<AuthProvider>` ב-frontend
- [ ] הסרת `UserNotRegisteredError` (להחליף ב-403)
- [ ] בדיקות: login, logout, refresh, forgot, reset, invite

---

## שלב 4 — Backend / API

- [ ] יצירת מבנה `api/` (Vercel Functions)
- [ ] הגדרת middleware: JWT, tenant, permissions, rate-limit
- [ ] CRUD: `customers`
- [ ] CRUD: `projects`
- [ ] CRUD: `project-quotes`
- [ ] CRUD: `quote-items` + `quote-item-components`
- [ ] CRUD: `client-payments`
- [ ] CRUD: `supplier-orders`
- [ ] CRUD: `documents`
- [ ] CRUD: `reminders`
- [ ] CRUD: `partners`
- [ ] CRUD: `general-expenses`
- [ ] CRUD: `model-pricing`
- [ ] CRUD: `model-components`
- [ ] CRUD: `quote-templates` + `quote-template-components`
- [ ] CRUD: `material-orders` + `material-order-items`
- [ ] CRUD: `company-headers`
- [ ] CRUD: `agent-alerts` + `agent-settings`
- [ ] Business: `/api/projects/{id}/financials`
- [ ] Business: `/api/finance/aggregate`
- [ ] Business: `/api/partners/settlement`
- [ ] Business: `/api/projects/{id}/can-close`
- [ ] Business: `/api/projects/{id}/close-settlement`
- [ ] Business: `/api/quotes/{id}/calculate`
- [ ] Business: `/api/quotes/{id}/generate-pdf` (Puppeteer)
- [ ] Business: `/api/projects/{id}/material-orders/generate`
- [ ] Business: `/api/models/{id}/components/calculate`
- [ ] Business: `/api/agent/analyze`
- [ ] Business: `/api/agent/smart-focus`
- [ ] Business: `/api/agent/daily-summary`
- [ ] Validation: Zod schemas לכל endpoint
- [ ] Error handling: פורמט אחיד
- [ ] Pagination: כל list endpoint
- [ ] Audit log: פעולות רגישות
- [ ] בדיקות: כל endpoint

---

## שלב 5 — API Client (Frontend)

- [ ] יצירת `src/api/client.js` (axios instance)
- [ ] יצירת interceptors: JWT, refresh, error
- [ ] יצירת services: `customerService`, `projectService`, וכו'
- [ ] החלפת `base44.entities.X.list()` → `XService.list()`
- [ ] החלפת `base44.entities.X.filter()` → `XService.filter()`
- [ ] החלפת `base44.entities.X.create()` → `XService.create()`
- [ ] החלפת `base44.entities.X.update()` → `XService.update()`
- [ ] החלפת `base44.entities.X.delete()` → `XService.delete()`
- [ ] עדכון כל queryFn ב-TanStack Query
- [ ] עדכון query keys (אחידות: `['projects']` לכולם)
- [ ] הסרת `@base44/sdk` מ-package.json
- [ ] הסרת `src/api/base44Client.js`
- [ ] בדיקות: כל דף טוען נתונים תקין

---

## שלב 6 — Storage

- [ ] יצירת S3 bucket `projectflow-prod`
- [ ] הגדרת IAM user (S3 access)
- [ ] הגדרת bucket policy (deny public)
- [ ] הגדרת CORS (app.projectflow.pro)
- [ ] הגדרת lifecycle (archive 365d, delete incomplete 1d)
- [ ] יצירת `/api/storage/upload-url`
- [ ] יצירת `/api/storage/{key}/download-url`
- [ ] יצירת `/api/storage/{key}` (DELETE)
- [ ] וולידציית content_type + size
- [ ] סקריפט migration: הורדה מ-Base44 → upload ל-S3
- [ ] עדכון `Document.file_url` → `file_key`
- [ ] עדכון `ProjectQuote.file_url` → `file_key`
- [ ] עדכון `CompanyHeader.logo_url` → `logo_file_key`
- [ ] עדכון frontend: upload flow (signed URL)
- [ ] עדכון frontend: download flow (signed URL)
- [ ] בדיקות: upload, download, delete

---

## שלב 7 — Permissions & Security

- [ ] הגדרת RBAC: 5 תפקידים (SuperAdmin, TenantAdmin, Manager, User, Viewer)
- [ ] יצירת permissions matrix (סעיף 3.2 ב-SECURITY_MODEL)
- [ ] מימוש `requirePermission` middleware
- [ ] הפעלת RLS ב-PostgreSQL (כל טבלה)
- [ ] יצירת policies: `tenant_isolation`
- [ ] יצירת policies: `manager_visibility`
- [ ] יצירת policies: `own_rows` (documents אופציונלי)
- [ ] הגדרת `SET app.current_tenant_id` בכל request
- [ ] הגדרת `SET app.current_user_id` בכל request
- [ ] הגדרת `SET app.current_user_role` בכל request
- [ ] בדיקת RLS: משתמש A לא רואה נתונים של משתמש B
- [ ] הגדרת audit_logs table
- [ ] מימוש audit בפעולות רגישות (close_settlement, delete, approve)
- [ ] הגדרת rate limiting (כל endpoint)
- [ ] הגדרת CORS (רק app.projectflow.pro)
- [ ] הגדרת security headers (CSP, HSTS, X-Frame-Options)
- [ ] בדיקות אבטחה (OWASP top 10)

---

## שלב 8 — Business Logic Migration

- [ ] העתקת `calculateProjectFinancials` לשרת
- [ ] העתקת `calculateAggregatedFinancials` לשרת
- [ ] העתקת `calculateFullPartnerSettlement` לשרת
- [ ] העתקת `validateProjectCanClose` לשרת
- [ ] העתקת `analyzeProjectAlerts` לשרת
- [ ] העתקת `shouldResolveAlert` לשרת
- [ ] העתקת `calculateProjectPriorityScore` לשרת
- [ ] העתקת `calculateBaseMetrics` לשרת
- [ ] העתקת `generateSmartFocusTasks` לשרת
- [ ] העתקת `calculateDailySummary` לשרת
- [ ] העתקת `calcComponentValue` לשרת (authoritative)
- [ ] העתקת `calcItemTotal` לשרת (authoritative)
- [ ] העתקת `calculateComponents` לשרת
- [ ] העתקת `generateMaterialOrders` לשרת (עם transaction)
- [ ] השארת `generateDescription` ב-frontend
- [ ] השארת constants (labels, colors) ב-frontend
- [ ] בדיקת התאמת תוצאות: חישובים זהים למקור

---

## שלב 9 — Deployment

- [ ] חיבור GitHub repo ל-Vercel
- [ ] הגדרת environment variables (Production)
- [ ] הגדרת environment variables (Preview)
- [ ] הגדרת domains (app.projectflow.pro)
- [ ] הגדרת wildcard (*.projectflow.pro) לעתיד SaaS
- [ ] בדיקת build: `npm run build` עובר
- [ ] Deploy ראשון ל-preview
- [ ] בדיקות ב-preview
- [ ] Deploy ל-production
- [ ] בדיקת SSL/TLS
- [ ] חיבור Sentry (frontend + backend)
- [ ] חיבור UptimeRobot
- [ ] בדיקת rollback (Vercel)
- [ ] תיעוד deployment process

---

## שלב 10 — Testing

- [ ] בדיקות פונקציונליות: כל 11 דפים
- [ ] בדיקות CRUD: כל entity
- [ ] בדיקות חישובים: השוואה מול Base44
- [ ] בדיקות התחשבנות שותפים
- [ ] בדיקות הצעות מחיר (יצירה, עריכה, PDF)
- [ ] בדיקות הזמנות חומר (יצירה אוטומטית)
- [ ] בדיקות Agent (ניתוח, smart focus)
- [ ] בדיקות Auth (login, logout, reset, invite)
- [ ] בדיקות הרשאות (RLS, RBAC)
- [ ] בדיקות Storage (upload, download, delete)
- [ ] בדיקות mobile (responsive)
- [ ] בדיקות RTL
- [ ] בדיקות ביצועים (Lighthouse)
- [ ] בדיקות אבטחה (OWASP)
- [ ] בדיקות עומס (load testing)
- [ ] בדיקות cutover (תרחיש מלא)

---

## שלב 11 — Cutover (מעבר ייצור)

- [ ] **T-7 ימים:** הקפאת פיתוח תכונות חדשות ב-Base44
- [ ] **T-3 ימים:** תקשורת למשתמשים על מעבר
- [ ] **T-1 יום:** export נתונים סופי מ-Base44
- [ ] **T-1 יום:** import סופי ל-PostgreSQL
- [ ] **T-1 יום:** בדיקת נתונים מלאה
- [ ] **T-0 (חלון תחזוקה, שבת לילה):**
  - [ ] הקפאת כתיבות ב-Base44 (readonly)
  - [ ] export דלתא (שינויים מ-T-1)
  - [ ] import דלתא
  - [ ] החלפת DNS ל-Vercel
  - [ ] בדיקת smoke (login, פרויקט, תשלום, הצעה)
  - [ ] פתיחת מערכת למשתמשים
- [ ] **T+0:** ניטור צמוד (24 שעות)
  - [ ] ניטור שגיאות (Sentry)
  - [ ] ניטור ביצועים
  - [ ] ניטור תלונות משתמשים
- [ ] **T+7 ימים:** סטטוס יציב → הוצאת Base44

---

## שלב 12 — Post-Migration

- [ ] ניטור שגיאות (Sentry) — 30 יום
- [ ] בדיקת גיבויים (restore test)
- [ ] אופטימיזציית ביצועים (queries, CDN)
- [ ] תיעוד סופי (update docs)
- [ ] הסרת גישה ל-Base44
- [ ] ביטול חשבון Base44 (לאחר 90 יום יציב)
- [ ] תכנון שלבים הבאים (SaaS, features חדשות)

---

## סיכום סטטוס

| שלב | תיאור | סטטוס | משך משוער |
|------|--------|-------|-----------|
| 0 | הכנה | ⬜ | 1 שבוע |
| 1 | Repository | ⬜ | 2 ימים |
| 2 | Database | ⬜ | 1 שבוע |
| 3 | Authentication | ⬜ | 1 שבוע |
| 4 | Backend / API | ⬜ | 2 שבועות |
| 5 | API Client | ⬜ | 1 שבוע |
| 6 | Storage | ⬜ | 1 שבוע |
| 7 | Permissions | ⬜ | 1 שבוע |
| 8 | Business Logic | ⬜ | (בתוך שלב 4) |
| 9 | Deployment | ⬜ | 3 ימים |
| 10 | Testing | ⬜ | 1 שבוע |
| 11 | Cutover | ⬜ | 2-3 ימים |
| 12 | Post-Migration | ⬜ | רציף |
| **סה"כ** | | | **~8-9 שבועות** |

---

## סימני סטטוס
- ⬜ לא התחיל
- 🔄 בתהליך
- ✅ הושלם
- ⚠️ חסום / בעיה
- ❌ בוטל

---

> ראה גם: `MIGRATION_MASTER_PLAN.md` לסיכום מרכזי וסדר עבודה.