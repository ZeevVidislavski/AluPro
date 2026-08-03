# SAAS_ARCHITECTURE.md

## הפיכת המערכת ל-SaaS Multi-Tenant

> **תאריך:** 2026-08-01  
> **מטרה:** תכנון מעבר מ-Single-Tenant ל-SaaS Multi-Tenant.  
> **מצב נוכחי:** Single-Tenant (עסק אלומיניום אחד).

---

## 1. מודל Multi-Tenant

### 1.1 אסטרטגיית Isolation
**המלצה: Shared Database + Shared Schema (עם `tenant_id`)**

| אסטרטגיה | יתרון | חיסרון | התאמה |
|----------|-------|--------|-------|
| Database per tenant | בידוד מלא | יקר, מורכב | ❌ |
| Schema per tenant | בידוד טוב | ניהול migrations מורכב | ⚠️ |
| **Shared DB + tenant_id** | חסכוני, פשוט | חובת RLS קפדני | ✅ |

### 1.2 למה Shared DB?
- עסקי אלומיניום = SME, נפח נתונים קטן-בינוני
- חיסכון בעלויות (DB אחד)
- תחזוקה פשוטה (migrations אחד)
- RLS ב-PostgreSQL מבטיח בידוד

---

## 2. Organization Structure

### 2.1 היררכיית ישויות
```
Platform (מערכת)
  └── Tenant (ארגון / עסק אלומיניום)
       ├── Users (עובדים)
       ├── Partners (שותפים)
       ├── Customers
       ├── Projects
       │    └── ... (כל הישויות העסקיות)
       └── Settings (AgentSettings, CompanyHeaders)
```

### 2.2 טבלת tenants
```prisma
model Tenant {
  id              String   @id @default(uuid())
  name            String              // שם העסק
  slug            String   @unique    // subdomain: mycompany.app.com
  plan            Plan     @default(FREE)
  status          TenantStatus @default(ACTIVE)
  trial_ends_at   DateTime?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
  // קשרים
  users           User[]
  settings        TenantSettings?
  subscription    Subscription?
}
enum Plan { FREE PRO ENTERPRISE }
enum TenantStatus { ACTIVE SUSPENDED CANCELLED }
```

### 2.3 טבלת TenantSettings (הרחבה של AgentSettings)
```prisma
model TenantSettings {
  id                          String  @id @default(uuid())
  tenant_id                   String  @unique
  // הגדרות סוכן (מ- AgentSettings)
  minimum_profit_percent      Float   @default(15)
  cash_flow_warning_threshold Float   @default(-50000)
  max_open_projects           Int     @default(10)
  // ... (שאר שדות AgentSettings)
  // הגדרות עסק
  default_vat_percent         Float   @default(17)
  currency                    String  @default("ILS")
  timezone                    String  @default("Asia/Jerusalem")
}
```

---

## 3. Company Isolation

### 3.1 הוספת `tenant_id` לכל טבלה
```sql
ALTER TABLE customers ADD COLUMN tenant_id UUID NOT NULL REFERENCES tenants(id);
ALTER TABLE projects ADD COLUMN tenant_id UUID NOT NULL REFERENCES tenants(id);
-- ... לכל טבלה עסקית
```

### 3.2 RLS Policy (לכל טבלה)
```sql
CREATE POLICY tenant_isolation ON customers
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### 3.3 זרימת Request
```
1. JWT → חילוץ user_id
2. DB query: SELECT tenant_id FROM users WHERE id = {user_id}
3. SET app.current_tenant_id = '{tenant_id}'
4. כל שאילתה מסוננת אוטומטית
```

### 3.4 טבלאות שאינן דורשות tenant_id
- `tenants` (עצמה)
- `subscriptions` (billing)
- `audit_logs` (מנוהלת גם ברמת tenant אך ללא RLS — ניהול מערכת)
- `platform_settings` (גלובלי)

### 3.5 קטלוג דגמים — Tenant או Global?
**המלצה: Tenant-specific** (כל עסק מנהל קטלוג משלו).
- `model_pricing.tenant_id` — חובה
- אופציה עתידית: "קטלוג גלובלי" (shared templates) — לא בשלב ראשון.

---

## 4. User Management

### 4.1 טבלת users (מורחבת)
```prisma
model User {
  id            String   @id @default(uuid())
  email         String   @unique
  full_name     String?
  role          UserRole @default(USER)
  tenant_id     String
  tenant        Tenant   @relation(fields: [tenant_id], references: [id])
  status        UserStatus @default(ACTIVE)
  last_login    DateTime?
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
}
enum UserRole { SUPERADMIN TENANTADMIN MANAGER USER VIEWER }
enum UserStatus { ACTIVE INVITED SUSPENDED }
```

### 4.2 הזמנת משתמשים
```typescript
POST /api/users/invite
{
  email: "employee@company.com",
  role: "user",
  tenant_id: "{current_tenant}"  // אוטומטי מ-JWT
}
→ שליחת אימייל עם invite link
→ יצירת record עם status=INVITED
→ משתמש לוחץ → מגדיר סיסמה → status=ACTIVE
```

### 4.3 הגבלות לפי Plan
| תכונה | FREE | PRO | ENTERPRISE |
|------|------|-----|------------|
| משתמשים | 3 | 15 | ללא הגבלה |
| פרויקטים פעילים | 10 | 50 | ללא הגבלה |
| אחסון | 1GB | 10GB | 100GB |
| ניהול חכם (Agent) | ❌ | ✅ | ✅ |
| התחשבנות שותפים | ❌ | ✅ | ✅ |
| תבניות הצעות | 5 | ללא הגבלה | ללא הגבלה |
| כותרות הדפסה | 1 | 5 | ללא הגבלה |
| ייצוא PDF | ✅ | ✅ | ✅ |
| תמיכה | קהילה | אימייל | טלפון + SLA |

---

## 5. Subscription Model

### 5.1 טבלת subscriptions
```prisma
model Subscription {
  id                  String   @id @default(uuid())
  tenant_id           String   @unique
  plan                Plan     @default(FREE)
  status              SubscriptionStatus @default(TRIALING)
  stripe_customer_id  String?
  stripe_subscription_id String?
  current_period_start DateTime?
  current_period_end  DateTime?
  cancel_at_period_end Boolean @default(false)
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt
}
enum SubscriptionStatus { TRIALING ACTIVE PAST_DUE CANCELLED UNPAID }
```

### 5.2 תוכניות
| תוכנית | מחיר חודשי | מחיר שנתי | תכונות עיקריות |
|--------|------------|-----------|----------------|
| **FREE** | ₪0 | ₪0 | 3 משתמשים, 10 פרויקטים, 1GB, בסיסי |
| **PRO** | ₪149 | ₪1,490 | 15 משתמשים, 50 פרויקטים, 10GB, Agent + Settlement |
| **ENTERPRISE** | ₪399 | ₪3,990 | ללא הגבלה, 100GB, תמיכה מלאה |

### 5.3 תהליך Trial
```
1. Sign-up → יצירת tenant + subscription(TRIALING, plan=PRO)
2. trial_ends_at = created_at + 14 ימים
3. תזכורת אימייל: 7 ימים, 3 ימים, 1 יום לפני סיום
4. סיום trial:
   - אם הוסיפו כרטיס → ACTIVE (PRO)
   - אם לא → DOWNGRADE ל-FREE (מגבלות מופעלות)
```

---

## 6. Billing

### 6.1 ספק תשלום
**Stripe** (הפתרון הזמין בישראל)
- Stripe Checkout (hosted page)
- Stripe Customer Portal (ניהול כרטיס, חשבוניות)
- Webhooks לסנכרון סטטוס

### 6.2 זרימת Billing
```
1. User בוחר תוכנית → Stripe Checkout Session
2. תשלום → Stripe Webhook `checkout.session.completed`
   → יצירת subscription ב-DB
3. חידוש חודשי → Webhook `invoice.paid`
   → הארכת current_period_end
4. כשל בתשלום → Webhook `invoice.payment_failed`
   → סטטוס = PAST_DUE + אימייל
5. ביטול → Webhook `customer.subscription.deleted`
   → סטטוס = CANCELLED
```

### 6.3 טבלת invoices (חשבוניות SaaS)
```prisma
model Invoice {
  id                String   @id @default(uuid())
  tenant_id         String
  stripe_invoice_id String?
  amount            Float
  currency          String   @default("ILS")
  status            InvoiceStatus
  period_start      DateTime
  period_end        DateTime
  pdf_url           String?
  created_at        DateTime @default(now())
}
enum InvoiceStatus { DRAFT PAID VOID UNPAID }
```

### 6.4 Usage Tracking
```prisma
model UsageRecord {
  id          String   @id @default(uuid())
  tenant_id   String
  metric      String   // 'active_projects', 'storage_bytes', 'users'
  value       Int
  recorded_at DateTime @default(now())
}
```

---

## 7. Company Settings

### 7.1 הגדרות פר-tenant
- שם עסק (tenant.name)
- לוגו (company_headers — כבר קיים)
- מע"מ ברירת מחדל (17%)
- מטבע (ILS)
- אזור זמן (Asia/Jerusalem)
- הגדרות סוכן (agent_settings — כבר קיים, להפוך ל-tenant-specific)
- סף אזהרות
- הפעלת מודולים (Agent, Settlement) — לפי plan

### 7.2 מיפוי מהמצב הנוכחי
| Entity נוכחי | יעד SaaS | שינוי |
|--------------|----------|-------|
| `AgentSettings` | `TenantSettings` | הוספת `tenant_id`, איחוד עם הגדרות כלליות |
| `CompanyHeader` | `CompanyHeader` | הוספת `tenant_id` |
| (חדש) | `Tenant` | ישות ארגון |

---

## 8. Custom Domain (אופציונלי)

### 8.1 מודל Subdomain
```
{tenant_slug}.projectflow.pro
לדוגמה: alon-aluminum.projectflow.pro
```

### 8.2 Custom Domain (ENTERPRISE)
```
manage.alon-aluminum.co.il → CNAME → projectflow.vercel.app
```

### 8.3 מימוש
- Vercel Wildcard Domains
- זיהוי tenant מתוך hostname
- ללא custom domain → subdomain

---

## 9. Onboarding Flow

```
1. נחיתה ב-landing page → "התחל ניסיון חינם"
2. Sign-up (אימייל + סיסמה)
3. יצירת tenant + user(TENANTADMIN) + subscription(TRIALING, PRO)
4. Wizard:
   - שם עסק
   - העלאת לוגו (CompanyHeader)
   - הוספת שותפים (Partners)
   - הגדרות מע"מ
5. לוח בקרה ריק → מתחילים לעבוד
```

---

## 10. Quotas & Limits

### 10.1 בדיקת מכסות ב-runtime
```typescript
async function checkQuota(tenantId: string, metric: string): Promise<boolean> {
  const plan = await getTenantPlan(tenantId);
  const limit = PLAN_LIMITS[plan][metric];
  const usage = await getCurrentUsage(tenantId, metric);
  return usage < limit;
}

// לפני יצירת פרויקט
if (!await checkQuota(tenantId, 'active_projects')) {
  throw new Error('חרגת ממכסת הפרויקטים. שדרג ל-PRO.');
}
```

### 10.2 מכסות לפי plan
```typescript
const PLAN_LIMITS = {
  FREE: { users: 3, active_projects: 10, storage_bytes: 1e9 },
  PRO: { users: 15, active_projects: 50, storage_bytes: 10e9 },
  ENTERPRISE: { users: Infinity, active_projects: Infinity, storage_bytes: 100e9 },
};
```

---

## 11. Data Residency (GDPR / רגולציה ישראלית)

- שרתי DB: EU או US (Supabase) — לאפשר בחירה
- חוק הגנת הפרטיות הישראלי — יישון נתונים
- הסכם מחיקת נתונים (right to erasure)
- ייצוא נתונים (data export)

---

## 12. סדר פיתוח SaaS (לאחר migration בסיסי)

1. הוספת `tenants` table + `tenant_id` לכל טבלה
2. העברת כל הנתונים הקיימים ל-tenant אחד (העסק הנוכחי)
3. הפעלת RLS
4. הוספת `subscriptions` + Stripe
5. בניית onboarding flow
6. בניית tenant management UI (SuperAdmin)
7. בניית customer portal (billing)
8. בניית quotas enforcement

---

> ראה גם: `SECURITY_MODEL.md` ל-RLS מפורט, `DEPLOYMENT_ARCHITECTURE.md` לפריסה.