# DEPLOYMENT_ARCHITECTURE.md

## ארכיטקטורת פריסה — GitHub + Vercel

> **תאריך:** 2026-08-01  
> **מטרה:** תיאור תהליך פריסה מלא — source control, build, deploy, CI/CD.

---

## 1. דיאגרמת פריסה

```
┌──────────────┐     push/PR     ┌──────────────────┐
│  Developer   │───────────────▶│     GitHub        │
│  (local)     │                 │  (Source Control) │
└──────────────┘                 └────────┬─────────┘
                                          │ webhook
                       ┌──────────────────┼──────────────────┐
                       ▼                  ▼                  ▼
                ┌────────────┐    ┌──────────────┐   ┌──────────────┐
                │  Vercel    │    │  GitHub       │   │  External    │
                │  (Frontend │    │  Actions      │   │  Services    │
                │   + API)   │    │  (CI/CD)      │   │  - Supabase  │
                └─────┬──────┘    └──────────────┘   │  - S3        │
                      │                               │  - Stripe   │
                      │ env vars                       └──────────────┘
                      ▼
                ┌────────────┐
                │ Production │
                │  URL       │
                └────────────┘
```

---

## 2. GitHub

### 2.1 Repository Structure
```
projectflow-pro/
├── .github/
│   └── workflows/
│       ├── ci.yml              # lint + test + build (on PR)
│       └── deploy.yml         # deploy to Vercel (on merge)
├── src/                       # React frontend
├── api/                       # Vercel Serverless Functions
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── docs/
├── package.json
├── vercel.json
└── README.md
```

### 2.2 Branch Strategy — Git Flow (מותאם)

```
main          ──●──●──●──●──●──●── (production)
                 \  \  \  \  \
develop        ──●──●──●──●──●── (staging)
                \    \    \
feature/*      ──●──●── (feature branches)
hotfix/*            ──●── (critical fixes)
```

| Branch | סביבה | דפלoyי | הגנה |
|--------|--------|--------|------|
| `main` | Production | אוטומטי | חובת PR review + CI pass |
| `develop` | Staging | אוטומטי | חובת CI pass |
| `feature/*` | Preview (Vercel) | ידני/PR | ללא |
| `hotfix/*` | Preview → main | PR ל-main | חובת review |

### 2.3 Commit Convention
```
<type>(<scope>): <subject>

types: feat, fix, docs, style, refactor, test, chore
scopes: auth, projects, quotes, finance, agent, etc.

דוגמה: feat(quotes): הוספת ייצוא PDF בשרת
```

### 2.4 Protection Rules (main)
- חובת 1 reviewer (מינימום)
- חובת CI pass (lint, build, test)
- חובת branch up-to-date עם main
- אין push ישיר (חובת PR)
- אין force push

---

## 3. Vercel

### 3.1 Project Configuration
```json
// vercel.json
{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "functions": {
    "api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 30
    }
  },
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/$1" },
    { "src": "/(.*)", "dest": "/index.html" }
  ],
  "env": {
    "DATABASE_URL": "@database_url",
    "JWT_SECRET": "@jwt_secret",
    "STRIPE_SECRET_KEY": "@stripe_secret",
    "AWS_ACCESS_KEY_ID": "@aws_access_key",
    "AWS_SECRET_ACCESS_KEY": "@aws_secret_key",
    "S3_BUCKET": "projectflow-prod"
  }
}
```

### 3.2 Environments
| Environment | Branch | URL | מטרה |
|-------------|--------|-----|------|
| Production | `main` | `app.projectflow.pro` | ייצור |
| Staging | `develop` | `staging.projectflow.pro` | בדיקות |
| Preview | `feature/*` | `{branch}.vercel.app` | PR review |

### 3.3 Build Process
```
1. npm install (Vercel cache)
2. npx prisma generate
3. npx prisma migrate deploy (production only)
4. npm run build (Vite build → dist/)
5. Deploy dist/ + api/ ל-edge network
6. CDN distribution
```

### 3.4 Vercel Functions
- **Memory:** 1024MB default (configurable)
- **Max Duration:** 30s (Hobby), 300s (Pro)
- **Cold Start:** ~200ms (Node.js)
- **Region:** Default ל-nearest (ישראל → Frankfurt `fra1`)

---

## 4. Environment Variables

### 4.1 רשימת מלאה

| Variable | סביבה | תיאור | דרישה |
|----------|--------|--------|-------|
| `DATABASE_URL` | all | PostgreSQL connection string | `postgresql://...` |
| `JWT_SECRET` | prod, staging | סוד לחתימת JWT | 64+ chars random |
| `JWT_REFRESH_SECRET` | prod, staging | סוד ל-refresh token | 64+ chars random |
| `NEXTAUTH_SECRET` | prod | (אם NextAuth) | |
| `STRIPE_SECRET_KEY` | prod | `sk_live_...` | |
| `STRIPE_WEBHOOK_SECRET` | prod | `whsec_...` | |
| `AWS_ACCESS_KEY_ID` | prod, staging | IAM user | |
| `AWS_SECRET_ACCESS_KEY` | prod, staging | IAM secret | |
| `S3_BUCKET` | prod, staging | `projectflow-prod` | |
| `S3_REGION` | prod, staging | `eu-central-1` | |
| `RESEND_API_KEY` | prod | שליחת אימייל | |
| `FROM_EMAIL` | prod | `noreply@projectflow.pro` | |
| `FRONTEND_URL` | prod | `https://app.projectflow.pro` | |
| `API_URL` | all | `https://api.projectflow.pro` | |
| `SENTRY_DSN` | prod | ניטור שגיאות | |
| `CRON_SECRET` | prod | סוד ל-cron endpoints | |

### 4.2 ניהול
- **אחסון:** Vercel Environment Variables (encrypted)
- **סביבות:** Production / Preview / Development (נפרד)
- **Rotation:** JWT secrets כל 90 יום
- **אף פעם:** לא בקוד, לא ב-.env ב-repo

### 4.3 .env.example (לפיתוח מקומי)
```bash
# Copy to .env and fill in
DATABASE_URL=postgresql://...
JWT_SECRET=dev-secret-change-me
STRIPE_SECRET_KEY=sk_test_...
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
S3_BUCKET=projectflow-dev
S3_REGION=eu-central-1
RESEND_API_KEY=...
FROM_EMAIL=noreply@dev.com
FRONTEND_URL=http://localhost:5173
API_URL=http://localhost:3000
```

---

## 5. Deployment Flow

### 5.1 זרימת ייצור (main)
```
1. Developer פותח feature branch
2. PR ל-develop
3. CI רץ: lint + build + test
4. Reviewer מאשר
5. Merge ל-develop → Vercel auto-deploy staging
6. בדיקות ב-staging
7. PR ל-main (או merge develop→main)
8. CI רץ שוב
9. Merge ל-main → Vercel auto-deploy production
10. אימייל/Slack: "Deployed to production"
```

### 5.2 Hotfix
```
1. branch hotfix/* מ-main
2. fix + test
3. PR ל-main (דילוג develop)
4. merge → production deploy
5. cherry-pick / merge ל-develop
```

### 5.3 Rollback
```
Vercel Dashboard → Deployments → "Instant Rollback"
→ revert לגרסה קודמת (תוך שניות)
```

---

## 6. CI/CD (GitHub Actions)

### 6.1 ci.yml (on PR)
```yaml
name: CI
on:
  pull_request:
    branches: [main, develop]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npm run build
      - run: npm test -- --passWithNoTests
```

### 6.2 deploy.yml (on merge)
```yaml
name: Deploy
on:
  push:
    branches: [main, develop]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'
          scope: ${{ secrets.VERCEL_SCOPE }}
```

### 6.3 db-migration.yml (manual/production)
```yaml
name: DB Migration
on:
  workflow_dispatch:
jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

---

## 7. Database (Supabase / Neon)

### 7.1 הגדרה
- **Provider:** Supabase (PostgreSQL 15)
- **Region:** Frankfurt (eu-central-1) — קרוב לישראל
- **Plan:** Pro ($25/חודש) — תומך connection pooling

### 7.2 Connection
```
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
```

### 7.3 Connection Pooling (Vercel)
```javascript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")  // ל-migrations
}
```
- `DATABASE_URL` — pooled (pgBouncer) ל-runtime
- `DIRECT_DATABASE_URL` — ישיר ל-migrations

### 7.4 Backups
- **Supabase:** גיבוי יומי אוטומטי (Point-in-Time Recovery)
- **Retention:** 7 ימים (Pro), 30 ימים (Team)
- **Manual:** `pg_dump` ל-S3 לפני כל deployment גדול

---

## 8. Monitoring & Logging

### 8.1 Error Tracking
- **Sentry** — �שגיאות frontend + backend
- **Vercel Logs** — runtime logs (function invocations)
- **Supabase Logs** — DB queries, auth events

### 8.2 Uptime
- **Vercel Analytics** — Core Web Vitals, traffic
- **UptimeRobot** — ping כל 5 דקות (free)

### 8.3 Alerts
- **Sentry:** שגיאות חדשות → אימייל/Slack
- **Vercel:** deploy failures → אימייל
- **Stripe:** failed payments → webhook → אימייל
- **Supabase:** high CPU/disk → אימייל

---

## 9. Domain & DNS

### 9.1 דומיינים
| דומיין | שימוש | מקור |
|--------|------|------|
| `projectflow.pro` | Landing page | Vercel |
| `app.projectflow.pro` | אפליקציה | Vercel |
| `api.projectflow.pro` | API (אם נפרד) | Vercel / Cloudflare |

### 9.2 DNS Records
```
A     projectflow.pro       → 76.76.21.21 (Vercel)
CNAME app.projectflow.pro   → cname.vercel-dns.com
CNAME *.projectflow.pro     → cname.vercel-dns.com (wildcard ל-tenants)
```

---

## 10. Checklist לפני Production

- [ ] `.env.example` עדכני
- [ ] Secrets ב-Vercel (לא בקוד)
- [ ] Stripe webhook endpoint רשום
- [ ] S3 bucket policy (deny public)
- [ ] CORS מוגדר (רק app.projectflow.pro)
- [ ] Domain מקושר ותקין
- [ ] SSL/TLS תקין (Vercel אוטומטי)
- [ ] DB backups מופעלים
- [ ] Sentry מחובר
- [ ] Uptime monitoring
- [ ] Rate limiting מופעל
- [ ] audit_logs פעיל
- [ ] Stripe in live mode (לא test)
- [ ] אימייל (Resend) מאומת
- [ ] Privacy policy + Terms פרסום

---

> ראה גם: `MIGRATION_CHECKLIST.md` לכל השלבים, `SECURITY_MODEL.md` לאבטחה.