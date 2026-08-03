# SECURITY_MODEL.md

## מודל אבטחה לארכיטקטורה החדשה

> **תאריך:** 2026-08-01  
> **מטרה:** תכנון Authentication, Authorization, RLS ו-Access Control מחוץ ל-Base44.

---

## 1. מצב נוכחי

### 1.1 מה יש היום
- **Auth:** מנוהל 100% על-ידי Base44 (tokens, sessions, email verification, invites)
- **Roles:** `admin` / `user` (מובנה ב-User entity)
- **RLS:** ❌ לא מוגדר — כל משתמש מאומת רואה/עורך/מוחק הכל
- **Access Control:** רק הגבלה מובנית: admin יכול לנהל משתמשים
- **Validation:** רק ב-front-end (לא בשרת)

### 1.2 פערים
1. כל משתמש יכול לקרוא את כל הנתונים של כולם
2. אין בידוד בין משתמשים / ארגונים
3. אין audit log
4. אין וולידציה server-side
5. אין rate limiting
6. `closed_by` מקודד קשיח כ-"מנהל" (לא משתמש אמיתי)

---

## 2. Authentication

### 2.1 פתרון מומלץ: Supabase Auth (או Auth0)

**למה Supabase Auth?**
- JWT-based, משתלב עם PostgreSQL RLS
- תומך: אימייל/סיסמה, OAuth (Google, GitHub), magic link, phone
- Row Level Security מובנה
- חינמי עד 50,000 משתמשים חודשיים

### 2.2 זרימת Auth
```
1. Login → Supabase Auth → JWT (access + refresh)
2. Frontend שומר JWT ב-httpOnly cookie (לא localStorage!)
3. כל request ל-API שולח JWT ב-Header: Authorization: Bearer {token}
4. Backend מאמת JWT → מחלץ user_id, role, tenant_id
5. בקשה ל-DB עם RLS (משתמש מוגדר כ-user_id מה-JWT)
```

### 2.3 מודל טוקנים
| טוקן | תוקף | אחסון | מטרה |
|------|------|------|------|
| Access Token | 15 דקות | httpOnly cookie | גישה ל-API |
| Refresh Token | 7 ימים | httpOnly cookie | חידוש access |
| Session | 30 יום | server-side | ניהול session |

### 2.4 זרימות
- **Login:** אימייל + סיסמה → JWT
- **Register:** רק דרך invite (admin) — לא register פתוח
- **Password Reset:** אימייל עם link (זמן תוקף 1 שעה)
- **Email Verification:** חובה לפני login ראשון
- **Logout:** נטרול refresh token + מחיקת cookies
- **Session Timeout:** 30 דקות חוסר פעילות → ניתוק

### 2.5 הגבלות
- Rate limiting: 5 ניסיונות login ב-15 דקות → נעילה 30 דקות
- Password policy: מינימום 8 תווים, אות + מספר
- 2FA: אופציונלי (TOTP) — מומלץ ל-admin

---

## 3. Authorization

### 3.1 מודל תפקידים (RBAC)

```
SuperAdmin (מערכת)
  └── TenantAdmin (ארגון)  [היה: admin]
       └── Manager (מנהל פרויקטים)
            └── User (עובד)  [היה: user]
                 └── Viewer (קריאה בלבד)  [חדש]
```

### 3.2 טבלת הרשאות לפי תפקיד

| פעולה | SuperAdmin | TenantAdmin | Manager | User | Viewer |
|-------|:---:|:---:|:---:|:---:|:---:|
| ניהול ארגון (tenant) | ✅ | ❌ | ❌ | ❌ | ❌ |
| הזמנת משתמשים | ✅ | ✅ | ❌ | ❌ | ❌ |
| ניהול שותפים | ✅ | ✅ | ❌ | ❌ | ❌ |
| יצירת/עריכת פרויקט | ✅ | ✅ | ✅ | ❌ | ❌ |
| מחיקת פרויקט | ✅ | ✅ | ❌ | ❌ | ❌ |
| סגירת התחשבנות | ✅ | ✅ | ❌ | ❌ | ❌ |
| יצירת תשלום/הזמנה | ✅ | ✅ | ✅ | ✅ | ❌ |
| עריכת הצעת מחיר | ✅ | ✅ | ✅ | ❌ | ❌ |
| אישור הצעה | ✅ | ✅ | ❌ | ❌ | ❌ |
| יצירת הזמנת חומר | ✅ | ✅ | ✅ | ✅ | ❌ |
| ניהול קטלוג דגמים | ✅ | ✅ | ❌ | ❌ | ❌ |
| ניהול תבניות | ✅ | ✅ | ✅ | ❌ | ❌ |
| צפייה בפיננסים | ✅ | ✅ | ✅ | ✅ | ✅ |
| צפייה בהתחשבנות | ✅ | ✅ | ❌ | ❌ | ❌ |
| מחיקת נתונים | ✅ | ✅ | ❌ | ❌ | ❌ |
| ניהול התראות | ✅ | ✅ | ✅ | ✅ | ❌ |
| ניהול הגדרות סוכן | ✅ | ✅ | ❌ | ❌ | ❌ |
| ניהול כותרות הדפסה | ✅ | ✅ | ❌ | ❌ | ❌ |

### 3.3 מיפוי מה-roles הנוכחיים
| Base44 | יעד | הערה |
|--------|------|------|
| `admin` | `TenantAdmin` | מנהל הארגון |
| `user` | `User` | עובד רגיל |
| (חדש) | `SuperAdmin` | מנהל מערכת (אתה) |
| (חדש) | `Manager` | מנהל פרויקטים |
| (חדש) | `Viewer` | קריאה בלבד |

---

## 4. Permissions (הרשאות פרטניות)

### 4.1 מודל Permission
```typescript
type Permission =
  | 'tenant:manage'
  | 'users:invite'
  | 'users:delete'
  | 'partners:manage'
  | 'projects:create'
  | 'projects:edit'
  | 'projects:delete'
  | 'projects:close-settlement'
  | 'payments:create'
  | 'payments:edit'
  | 'payments:delete'
  | 'orders:create'
  | 'orders:edit'
  | 'orders:delete'
  | 'quotes:create'
  | 'quotes:edit'
  | 'quotes:approve'
  | 'quotes:delete'
  | 'material-orders:generate'
  | 'catalog:manage'
  | 'templates:manage'
  | 'finance:read'
  | 'settlement:read'
  | 'alerts:manage'
  | 'agent-settings:manage'
  | 'company-headers:manage'
  | 'documents:manage'
  | 'reminders:manage';
```

### 4.2 מיפוי תפקיד → הרשאות
- `SuperAdmin`: כל ההרשאות
- `TenantAdmin`: כל ההרשאות חוץ מ-`tenant:manage`
- `Manager`: `projects:*`, `payments:*`, `orders:*`, `quotes:create/edit`, `material-orders:generate`, `templates:manage`, `finance:read`, `alerts:manage`, `documents:manage`, `reminders:manage`
- `User`: `payments:create/edit`, `orders:create/edit`, `material-orders:generate`, `finance:read`, `alerts:manage`, `reminders:manage`
- `Viewer`: `finance:read` (read-only)

### 4.3 מימוש
```typescript
// middleware
function requirePermission(permission: Permission) {
  return (req, res, next) => {
    if (!req.user.permissions.includes(permission)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

// שימוש
router.post('/api/projects', requirePermission('projects:create'), handler);
router.delete('/api/projects/:id', requirePermission('projects:delete'), handler);
```

---

## 5. Row Level Security (RLS)

### 5.1 מודל RLS ב-PostgreSQL

RLS פועל ברמת ה-DB — כל שאילתה מסוננת אוטומטית לפי המשתמש.

```sql
-- הפעלת RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- מדיניות: משתמש רואה רק פרויקטים של ה-tenant שלו
CREATE POLICY tenant_isolation ON projects
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- הגדרת tenant_id בכל request
SET app.current_tenant_id = '{tenant_uuid}';
SET app.current_user_id = '{user_uuid}';
SET app.current_user_role = 'user';
```

### 5.2 רמות RLS

#### רמה 1 — Tenant Isolation (חובה)
כל טבלה מקבלת `tenant_id`; RLS מבטיח שמשתמש רואה רק נתונים של ה-tenant שלו.

```sql
CREATE POLICY tenant_isolation ON customers
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

#### רמה 2 — Role-Based Visibility
```sql
-- Manager רואה רק פרויקטים שהוא מנהל
CREATE POLICY manager_visibility ON projects
  USING (
    current_setting('app.current_user_role') IN ('superadmin', 'tenantadmin')
    OR manager_id = current_setting('app.current_user_id')::uuid
  );
```

#### רמה 3 — Row Ownership (אופציונלי)
```sql
-- כל משתמש רואה רק מה שיצר
CREATE POLICY own_rows ON documents
  USING (created_by = current_setting('app.current_user_id')::uuid);
```

### 5.3 טבלאות שדורשות RLS
| טבלה | רמת RLS | הערה |
|------|---------|------|
| customers | tenant | בידוד ארגון |
| projects | tenant + role | + manager |
| project_quotes | tenant (דרך project) | |
| quote_items | tenant (דרך quote) | |
| client_payments | tenant + role | |
| supplier_orders | tenant + role | |
| documents | tenant + own (אופציונלי) | |
| reminders | tenant + assignee | הוספת `assignee_id` |
| partners | tenant | |
| general_expenses | tenant + role | |
| model_pricing | tenant | קטלוג פר-tenant |
| model_components | tenant (דרך model) | |
| quote_templates | tenant | |
| material_orders | tenant (דרך project) | |
| agent_alerts | tenant + assignee | |
| agent_settings | tenant (singleton) | record אחד ל-tenant |
| company_headers | tenant | |
| users | tenant + role | |

### 5.4 טבלאות גלובליות (ללא RLS)
- `tenants` (רשימת ארגונים)
- `subscriptions` (מנויים)
- `audit_logs` (ניהול מערכת)

---

## 6. Access Control

### 6.1 API Middleware Stack
```
Request
  → Rate Limiting (100 req/min per IP)
  → CORS Check
  → JWT Validation
  → Tenant Resolution
  → Permission Check (RBAC)
  → RLS Setup (SET app.current_*)
  → Handler
  → Audit Log
  → Response
```

### 6.2 Rate Limiting
| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/auth/login` | 5 | 15 דקות |
| `/api/auth/register` | 3 | שעה |
| `/api/*` (general) | 100 | דקה |
| `/api/storage/upload-url` | 20 | דקה |
| `/api/agent/analyze` | 5 | דקה |

### 6.3 CORS
```javascript
const corsOptions = {
  origin: process.env.FRONTEND_URL,  // רק הדומיין הרשמי
  credentials: true,                // cookies
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Authorization', 'Content-Type'],
};
```

---

## 7. Audit Log

### 7.1 טבלת audit_logs
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  action VARCHAR(50),        -- 'create', 'update', 'delete', 'login', 'close_settlement'
  entity_type VARCHAR(50),   -- 'project', 'payment', 'quote'
  entity_id UUID,
  changes JSONB,             -- { before: {...}, after: {...} }
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT now()
);
```

### 7.2 פעולות שדורשות audit
- login / logout / failed login
- יצירת/עריכת/מחיקת פרויקט
- סגירת התחשבנות
- אישור הצעה
- יצירת/עריכת תשלום/הזמנה
- מחיקת נתונים כלשהם
- הזמנת משתמש
- שינוי תפקיד משתמש

---

## 8. Security Best Practices

### 8.1 סיסמאות
- Hashing: bcrypt (cost 12) או argon2id
- מעולם לא לאחסן plaintext
- Password history: 5 סיסמאות אחרונות (מניעת שימוש חוזר)

### 8.2 Secrets
- כל secrets ב-environment variables (Vercel)
- אף פעם לא בקוד
- Rotation: כל 90 יום (מומלץ)

### 8.3 HTTPS
- אכיפת HTTPS בלבד (Vercel אוטומטי)
- HSTS headers

### 8.4 Headers
```
Content-Security-Policy: default-src 'self'; ...
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### 8.5 Input Validation
- Zod schemas לכל API endpoint
- Sanitization (XSS, SQL injection)
- Max body size (10MB)
- Max query results (pagination)

### 8.6 File Upload Security
- וולידציה: סוג קובץ (MIME), גודל (max 10MB)
- שם קובץ מנוקה (למנוע path traversal)
- אחסון: S3 private bucket + signed URLs
- Antivirus scan (אופציונלי)

### 8.7 Session Security
- httpOnly cookies (לא נגיש ל-JS)
- Secure flag (HTTPS בלבד)
- SameSite: strict (מניעת CSRF)
- Session fixation: חידוש session ID ב-login

### 8.8 Monitoring
- ניטור login נכשלים
- התראה על מחיקות מסיביות
- ניטור גישה לנתונים רגישים (פיננסים)
- Alerting על anomalies

### 8.9 Backup
- גיבוי יומי אוטומטי (PostgreSQL)
- Retention: 30 יום
- בדיקת restore חודשית
- Encryption at rest

### 8.10 Compliance
- GDPR: right to erasure, data export
- Privacy policy
- Data retention policy

---

## 9. מיפוי מ-Base44

| Base44 | יעד | הערה |
|--------|------|------|
| `base44.auth.me()` | `/api/auth/me` + JWT | |
| `base44.auth.logout()` | נטרול JWT + cookie | |
| `base44.auth.redirectToLogin()` | redirect ל-/login | |
| `base44.users.inviteUser()` | `/api/users/invite` + אימייל | |
| `<AuthProvider>` | AuthProvider חדש (Supabase) | |
| `UserNotRegisteredError` | 403 Forbidden | |
| RLS מובנה (admin/user) | RBAC + RLS מלא | |

---

> ראה גם: `SAAS_ARCHITECTURE.md` למודל multi-tenant מלא.