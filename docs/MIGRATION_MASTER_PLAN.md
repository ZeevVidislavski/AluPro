# MIGRATION_MASTER_PLAN.md

## תוכנית אב מרכזית — מעבר מ-Base44 לענן עצמאי

> **תאריך:** 2026-08-01  
> **מטרה:** ריכוז כל תוכנית המעבר והסבר סדר העבודה המומלץ.  
> **מסמכים נלווים:** 10 מסמכים ב-`docs/cloud-migration/`

---

## 1. סקירה

### 1.1 מה אנחנו עושים
מעבירים את מערכת ProjectFlow Pro מ-Base44 (BaaS) לארכיטקטורה עצמאית מבוססת:
- **GitHub** — Source control
- **Vercel** — Frontend hosting + Serverless API
- **PostgreSQL (Supabase)** — Database עצמאי
- **AWS S3** — Storage עצמאי
- **Supabase Auth** — Authentication

### 1.2 למה
- שליטה מלאה בקוד ובנתונים
- חיסכון בעלויות (מעבר ל-SaaS מותאם)
- אפשרות multi-tenant (עסקים מרובים)
- ארכיטקטורה מקצועית + סקיילבילית
- יציאה מ-vendor lock-in

### 1.3 כמל זמן
**~8-9 שבועות** (מתכנת אחד, משרה מלאה)

---

## 2. מפת המסמכים

| # | מסמך | תוכן |
|---|------|------|
| 1 | `CLOUD_MIGRATION.md` | תהליך מעבר כללי: ארכיטקטורה נוכחית → יעד |
| 2 | `BACKEND_MIGRATION_PLAN.md` | אילו מודולים עוברים לשרת, אילו API נדרשים |
| 3 | `DATABASE_MIGRATION.md` | המרת 20 entities ל-PostgreSQL (Prisma schema) |
| 4 | `SECURITY_MODEL.md` | Auth, RBAC, RLS, Access Control |
| 5 | `SAAS_ARCHITECTURE.md` | Multi-tenant, subscription, billing |
| 6 | `CLOUD_CODE_API_PLAN.md` | רשימת כל ה-API endpoints (request/response) |
| 7 | `STORAGE_MIGRATION.md` | העברת קבצים ל-S3, signed URLs |
| 8 | `DEPLOYMENT_ARCHITECTURE.md` | GitHub, Vercel, CI/CD, env vars |
| 9 | `MIGRATION_CHECKLIST.md` | Checklist מלא של כל השלבים |
| 10 | `VENDOR_LOCK_IN_ANALYSIS.md` | ניתוח תלויות Base44 + חלופות |

---

## 3. ארכיטקטורת יעד

```
┌──────────────┐     ┌──────────────┐     ┌────────────────┐
│   GitHub     │────▶│    Vercel    │────▶│  React SPA      │
│  (Source)    │     │  (Frontend + │     │  (Vite build)   │
│              │     │   API)       │     │                 │
└──────────────┘     └──────┬───────┘     └────────┬────────┘
                            │                      │
                            │ Serverless Functions │ fetch
                            ▼                      ▼
                     ┌──────────────┐      ┌─────────────────┐
                     │  API Layer  │      │  PostgreSQL     │
                     │  - Auth      │─────▶│  (Supabase)     │
                     │  - CRUD      │      │  - 20 tables    │
                     │  - Business  │      │  - RLS enabled  │
                     │  - Validation│      └─────────────────┘
                     └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │   Storage    │
                     │  (AWS S3)    │
                     │  - signed URL│
                     └──────────────┘
```

---

## 4. עקרונות מנחים

1. **Frontend נשאר React** — רק מחליפים מקור נתונים (SDK → API client)
2. **Backend הופך authoritative** — חישובים רגישים, validation, RLS
3. **Database רלציוני** — PostgreSQL עם foreign keys
4. **Storage פרטי** — signed URLs (לא public)
5. **Auth מקצועי** — JWT + refresh tokens + httpOnly cookies
6. **ממשק דומה** — `XService.list()` דומה ל-`base44.entities.X.list()` (מקטין שינויים)

---

## 5. סדר עבודה מומלץ

### שלב 0 — הכנה (שבוע 1)
**מסמכים:** `MIGRATION_CHECKLIST.md` (שלב 0)  
**פעולות:**
- אישור תקציב
- רכישת דומיין
- יצירת GitHub repo
- גיבוי מלא מ-Base44
- הגדרת סביבת פיתוח מקומית

### שלב 1 — Repository (2 ימים)
**מסמכים:** `DEPLOYMENT_ARCHITECTURE.md` (סעיף 2-3)  
**פעולות:**
- יצירת repo + מבנה תיקיות
- העתקת קוד frontend (ללא SDK)
- `vercel.json`, `.env.example`
- Branch protection
- GitHub Actions (CI)

### שלב 2 — Database (שבוע 2)
**מסמכים:** `DATABASE_MIGRATION.md`, `SAAS_ARCHITECTURE.md` (סעיף 2)  
**פעולות:**
- יצירת Supabase project
- Prisma schema מלא
- Migrations
- הוספת `tenant_id` (לעתיד SaaS)
- המרת Float → Decimal (פיננסי)
- סקריפט export מ-Base44
- סקריפט import ל-PostgreSQL
- וולידציה (counts, סכומים)

### שלב 3 — Auth (שבוע 3)
**מסמכים:** `SECURITY_MODEL.md` (סעיף 2-3), `CLOUD_CODE_API_PLAN.md` (סעיף 2)  
**פעולות:**
- הפעלת Supabase Auth
- הגדרת JWT (access + refresh)
- יצירת `AuthContext` חדש
- מיפוי roles (admin → tenantadmin, user → user)
- API endpoints: login, logout, me, refresh, forgot, reset, invite
- Rate limiting
- מיגרציית משתמשים (reset סיסמאות)
- עדכון frontend (`<AuthProvider>`)

### שלב 4 — Backend / API (שבוע 3-5)
**מסמכים:** `BACKEND_MIGRATION_PLAN.md`, `CLOUD_CODE_API_PLAN.md`  
**פעולות:**
- מבנה `api/` (Vercel Functions)
- Middleware: JWT, tenant, permissions, rate-limit
- CRUD לכל 20 entities
- Business logic API (חישובים פיננסיים, התחשבנות, PDF, הזמנות חומר)
- Validation (Zod)
- Error handling אחיד
- Pagination
- Audit log
- בדיקות

**סדר פיתוח API (לפי תלות):**
1. CRUD פשוט: `customers`, `partners`, `company-headers`, `agent-settings`
2. CRUD עם קשרים: `projects`, `reminders`, `documents`
3. CRUD פיננסי: `client-payments`, `supplier-orders`, `general-expenses`
4. חישובים: `/financials`, `/aggregate`, `/settlement`
5. הצעות: `project-quotes`, `quote-items`, `quote-item-components` + חישובים
6. קטלוג: `model-pricing`, `model-components` + חישובים
7. הזמנות חומר: `material-orders` + יצירה אוטומטית
8. Agent: `agent-alerts`, `agent-settings` + ניתוח + smart focus
9. תבניות: `quote-templates`, `quote-template-components`
10. Auth: `users`, invite
11. Storage: signed URLs
12. Cron: morning summary, alert analysis

### שלב 5 — API Client (שבוע 5)
**מסמכים:** `BACKEND_MIGRATION_PLAN.md`, `VENDOR_LOCK_IN_ANALYSIS.md` (סעיף 2.1)  
**פעולות:**
- יצירת `src/api/client.js` (axios)
- Interceptors: JWT, refresh, error
- Services: `customerService`, `projectService`, וכו'
- החלפת `base44.entities.X.*` ב-`XService.*` בכל הקוד
- עדכון query keys (אחידות)
- הסרת `@base44/sdk` ו-`base44Client.js`
- בדיקות: כל דף טוען תקין

### שלב 6 — Storage (שבוע 6)
**מסמכים:** `STORAGE_MIGRATION.md`, `CLOUD_CODE_API_PLAN.md` (סעיף 19)  
**פעולות:**
- יצירת S3 bucket + IAM + policies + CORS
- API: `/api/storage/upload-url`, `/api/storage/{key}/download-url`
- וולידציית content_type + size
- סקריפט migration: הורדה מ-Base44 → upload ל-S3
- עדכון DB (`file_url` → `file_key`)
- עדכון frontend: upload/download flows
- בדיקות

### שלב 7 — Security (שבוע 6)
**מסמכים:** `SECURITY_MODEL.md`  
**פעולות:**
- הגדרת RBAC (5 תפקידים)
- Permissions matrix
- `requirePermission` middleware
- הפעלת RLS ב-PostgreSQL (כל טבלה)
- Policies: `tenant_isolation`, `manager_visibility`, `own_rows`
- הגדרת `SET app.current_*` בכל request
- audit_logs table
- Rate limiting
- CORS
- Security headers
- בדיקות אבטחה (OWASP)

### שלב 8 — Business Logic (בתוך שלב 4)
**מסמכים:** `BACKEND_MIGRATION_PLAN.md` (סעיף 1)  
**פעולות:**
- העתקת כל ה-Logic Modules לשרת
- השארת constants + UI helpers ב-frontend
- בדיקת התאמת תוצאות (מול Base44)

### שלב 9 — Deployment (3 ימים)
**מסמכים:** `DEPLOYMENT_ARCHITECTURE.md`  
**פעולות:**
- חיבור GitHub ↔ Vercel
- Environment variables (Production + Preview)
- Domains (app.projectflow.pro)
- Build test
- Deploy ל-preview → בדיקות → production
- SSL/TLS
- Sentry + UptimeRobot
- בדיקת rollback

### שלב 10 — Testing (שבוע 7)
**מסמכים:** `MIGRATION_CHECKLIST.md` (שלב 10)  
**פעולות:**
- בדיקות פונקציונליות: כל 11 דפים
- בדיקות CRUD: כל entity
- בדיקות חישובים: השוואה מול Base44
- בדיקות Auth, הרשאות, Storage
- בדיקות mobile, RTL
- בדיקות ביצועים, אבטחה, עומס
- בדיקות cutover (תרחיש מלא)

### שלב 11 — Cutover (2-3 ימים)
**מסמכים:** `MIGRATION_CHECKLIST.md` (שלב 11)  
**פעולות:**
- **T-7 ימים:** הקפאת פיתוח ב-Base44
- **T-3 ימים:** תקשורת למשתמשים
- **T-1 יום:** export סופי + import
- **T-0 (שבת לילה):**
  - הקפאת כתיבות ב-Base44
  - export דלתא + import
  - החלפת DNS
  - בדיקת smoke
  - פתיחת מערכת
- **T+0:** ניטור צמוד 24 שעות

### שלב 12 — Post-Migration (רציף)
**מסמכים:** `MIGRATION_CHECKLIST.md` (שלב 12)  
**פעולות:**
- ניטור שגיאות (30 יום)
- בדיקת גיבויים
- אופטימיזציה
- תיעוד סופי
- הסרת גישה ל-Base44
- ביטול חשבון Base44 (לאחר 90 יום יציב)
- תכנון שלבים הבאים (SaaS)

---

## 6. סדר עבודה ויזואלי (Gantt)

```
שבוע:  1    2    3    4    5    6    7    8    9
       │    │    │    │    │    │    │    │    │
0. הכנה     ████
1. Repo      ██
2. DB         ████████
3. Auth            ████████
4. API                  ████████████████
5. Client                      ████████
6. Storage                         ████████
7. Security                        ████████
9. Deploy                              ██
10. Testing                               ████████
11. Cutover                                  ████
12. Post                                        →→→→
```

---

## 7. סיכונים עיקריים ומתיחות

| סיכון | רמה | מתיחות |
|-------|------|---------|
| אובדן נתונים ב-migration | גבוה | גיבוי מלא לפני כל שלב + וולידציה |
| הבדלי חישובים פיננסיים | גבוה | בדיקת השוואה מול Base44 לפני cutover |
| Reset סיסמאות למשתמשים | בינוני | תקשורת מראש + אשף reset פשוט |
| RLS gaps | בינוני | בדיקות אבטחה יסודיות (שלב 7, 10) |
| קישורי קבצים שבורים | בינוני | Migration מלא + עדכון DB |
| Downtime ב-cutover | גבוה | חלון תחזוקה (שבת לילה) |
| תלות סמויה ב-SDK | בינוני | חיפוש יסודי אחר קריאות שלא נסרקו |
| עלות תפעול חודשית | נמוך | Vercel Pro ($20) + Supabase Pro ($25) + S3 (~$5) + Stripe (2.9%) |

---

## 8. עלויות משוערות

### 8.1 עלות מעבר (חד-פעמית)
| פריט | עלות |
|------|------|
| מתכנת (8-9 שבועות) | לפי תעריף |
| דומיין (שנתי) | ~$15 |
| **סה"כ חד-פעמי** | משתנה |

### 8.2 עלות תפעול חודשית (לאחר מעבר)
| שירות | תוכנית | עלות חודשית |
|-------|---------|------------|
| Vercel | Pro | $20 |
| Supabase | Pro | $25 |
| AWS S3 | pay-as-you-go | ~$5 |
| Stripe | per-transaction | 2.9% + ₪1.20 |
| Resend (אימייל) | Starter | $20 |
| Sentry | Team | $26 |
| **סה"כ (ללא עסקאות)** | | **~$96/חודש** |

> השוואה: Base44 — תלוי בתוכנית הנוכחית (לרוב יקר יותר ל-SME).

---

## 9. תוצרים סופיים

לאחר השלמת כל השלבים, יהיו ברשותך:
1. ✅ Repository GitHub פעיל עם CI/CD
2. ✅ אפליקציה מותקנת ב-Vercel (production + staging)
3. ✅ PostgreSQL עם 20 טבלאות + RLS
4. ✅ Auth מקצועי (JWT + cookies)
5. ✅ API layer מלא (CRUD + business logic)
6. ✅ Storage ב-S3 עם signed URLs
7. ✅ Security model (RBAC + RLS + audit)
8. ✅ אפשרות SaaS (multi-tenant ready)
9. ✅ ניטור (Sentry + uptime)
10. ✅ תיעוד מלא (10 מסמכים + audit)

---

## 10. השלבים הבאים (לאחר מעבר)

1. **SaaS Activation** — הפעלת multi-tenant, onboarding, billing (ראה `SAAS_ARCHITECTURE.md`)
2. **Features חדשות** — WhatsApp notifications, Excel export, advanced reports
3. **אופטימיזציה** — caching (Redis), CDN, query optimization
4. **Mobile App** — React Native (אותו API)
5. **Integrations** — חשבשבת, Google Calendar, Slack

---

## 11. קריאה לפעולה

1. קרא את כל 10 המסמכים ב-`docs/cloud-migration/`
2. התחל ב-`MIGRATION_CHECKLIST.md` — סמן כל שלב
3. פתח את ה-GitHub repo הראשון
4. התקדם שלב אחרי שלב, ללא דילוג
5. בכל שלב — וולידציה מלאה לפני מעבר לבאא
6. ב-cutover — חלון תחזוקה + ניטור 24 שעות

---

> **סוף מסמך מאסטר** — ProjectFlow Pro Cloud Migration Master Plan, 2026-08-01  
> כל המסמכים המפורטים נמצאים ב-`docs/cloud-migration/