# CLOUD_CODE_API_PLAN.md

## רשימת API מלאה לאחר המעבר

> **תאריך:** 2026-08-01  
> **מטרה:** רשימה מלאה של כל endpoints עם request/response/auth/validation.  
> **Base URL:** `https://api.projectflow.pro` (או Vercel serverless)

---

## 1. כללי

### 1.1 פורמט
- **Content-Type:** `application/json`
- **Auth:** `Authorization: Bearer {JWT}`
- **תאריכים:** ISO 8601 (`2026-08-01T00:00:00Z`)
- **מטבע:** מספרים (₪), Decimal
- **שפה:** עברית (הודעות שגיאה בעברית)

### 1.2 קודי תגובה
| קוד | משמעות |
|-----|---------|
| 200 | OK |
| 201 | Created |
| 204 | No Content (delete) |
| 400 | Bad Request (validation) |
| 401 | Unauthorized (no/invalid JWT) |
| 403 | Forbidden (no permission) |
| 404 | Not Found |
| 409 | Conflict (duplicate) |
| 429 | Rate Limited |
| 500 | Server Error |

### 1.3 Pagination
```
GET /api/projects?page=1&limit=20&sort=-created_at
Response: {
  data: [...],
  pagination: { page, limit, total, totalPages }
}
```

### 1.4 Error Format
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "שם פרויקט נדרש",
    "details": [{ "field": "name", "message": "required" }]
  }
}
```

---

## 2. Auth APIs

### 2.1 POST /api/auth/login
**Request:**
```json
{ "email": "user@example.com", "password": "secret123" }
```
**Response 200:**
```json
{
  "user": { "id": "uuid", "email": "...", "full_name": "...", "role": "tenantadmin", "tenant_id": "uuid" },
  "accessToken": "eyJ...",
  "expiresIn": 900
}
```
**Auth:** לא נדרש  
**Validation:** email (valid), password (min 8)  
**Business Rules:**
- חסימה אחרי 5 ניסיונות כושלים (15 דקות)
- חובת אימייל מאומת
- חובת status=ACTIVE

### 2.2 POST /api/auth/logout
**Response 204:** (ריק)  
**Auth:** נדרש  
**Business Rules:** נטרול refresh token

### 2.3 GET /api/auth/me
**Response 200:**
```json
{
  "user": { "id, email, full_name, role, tenant_id, permissions: [...] }
}
```
**Auth:** נדרש

### 2.4 POST /api/auth/refresh
**Response 200:** `{ accessToken }`  
**Auth:** refresh token (cookie)  
**Business Rules:** סבב חדש של access token

### 2.5 POST /api/auth/forgot-password
**Request:** `{ email }`  
**Response 200:** `{ message: "אימייל נשלח" }`  
**Business Rules:** שליחת link עם token (תוקף 1 שעה)

### 2.6 POST /api/auth/reset-password
**Request:** `{ token, password }`  
**Response 200**  
**Validation:** password (min 8), token (valid, not expired)

### 2.7 POST /api/users/invite
**Request:** `{ email, role: "user" | "manager" }`  
**Response 201:** `{ id, email, status: "invited" }`  
**Auth:** נדרש + permission `users:invite`  
**Business Rules:**
- רק TenantAdmin+ יכול
- בדיקת מכסת משתמשים (plan)
- שליחת אימייל עם invite link
- יצירת record עם status=INVITED

### 2.8 POST /api/users/accept-invite
**Request:** `{ token, full_name, password }`  
**Response 200:** `{ user, accessToken }`  
**Business Rules:** השלמת פרופיל + הפעלת משתמש

### 2.9 GET /api/users
**Response 200:** `{ data: User[] }`  
**Auth:** נדרש + permission `users:invite`  
**Business Rules:** רק משתמשים של אותו tenant

### 2.10 PATCH /api/users/{id}
**Request:** `{ role?, status? }`  
**Response 200:** `User`  
**Auth:** נדרש + permission `users:invite`  
**Business Rules:** לא ניתן לשנות role ל-superadmin

### 2.11 DELETE /api/users/{id}
**Response 204**  
**Auth:** נדרש + permission `users:invite`  
**Business Rules:**
- לא ניתן למחוק את עצמך
- לא ניתן למחוק TenantAdmin אחרון
- soft delete (status=SUSPENDED)

---

## 3. Customers APIs

### 3.1 GET /api/customers
**Query:** `?search=&type=&status=&page=&limit=`  
**Response 200:** `{ data: Customer[], pagination }`  
**Auth:** נדרש

### 3.2 GET /api/customers/{id}
**Response 200:** `Customer`  
**Auth:** נדרש  
**Business Rules:** RLS — רק מאותו tenant

### 3.3 POST /api/customers
**Request:**
```json
{ "name": "...", "customer_type": "private", "phone": "...", "email": "...", "address": "...", "notes": "..." }
```
**Response 201:** `Customer`  
**Auth:** נדרש + permission `projects:create`  
**Validation:**
- name: required, max 200
- customer_type: enum (private/contractor)
- phone: required, regex
- email: optional, valid email
- status: default active

### 3.4 PATCH /api/customers/{id}
**Request:** (חלק משדות)  
**Response 200:** `Customer`  
**Auth:** נדרש

### 3.5 DELETE /api/customers/{id}
**Response 204**  
**Auth:** נדרש + permission `projects:delete`  
**Business Rules:** בדיקה: אין פרויקטים מקושרים (או cascade)

---

## 4. Projects APIs

### 4.1 GET /api/projects
**Query:** `?status=&customer_id=&search=&page=&limit=`  
**Response 200:** `{ data: Project[], pagination }`  
**Auth:** נדרש

### 4.2 GET /api/projects/{id}
**Response 200:** `Project`  
**Auth:** נדרש

### 4.3 POST /api/projects
**Request:**
```json
{
  "name": "...", "customer_id": "uuid", "address": "...",
  "aluminum_color": "...", "start_date": "2026-08-01", "target_date": "2026-12-01",
  "status": "quote", "initial_quote": 50000, "notes": "..."
}
```
**Response 201:** `Project`  
**Auth:** נדרש + permission `projects:create`  
**Validation:**
- name: required
- customer_id: required, FK valid
- status: enum (8 values)
- initial_quote: number ≥ 0
- dates: ISO format

**Business Rules:**
- יצירת `project_number` אוטומטי (unique)
- בדיקת מכסת פרויקטים (plan)

### 4.4 PATCH /api/projects/{id}
**Response 200:** `Project`  
**Auth:** נדרש + permission `projects:edit`  
**Business Rules:**
- שינוי status ל-approved: חובת הצעה מאושרת
- שינוי status ל invoiced: חובת completed

### 4.5 DELETE /api/projects/{id}
**Response 204**  
**Auth:** נדרש + permission `projects:delete`  
**Business Rules:** אין תשלומים/הזמנות/הצעות (או cascade עם אישור)

### 4.6 GET /api/projects/{id}/financials
**Response 200:**
```json
{
  "initial_quote": 50000, "additions_total": 5000, "additions_count": 1,
  "total_sale": 55000, "hasApprovedQuote": true,
  "total_received": 30000, "balance_to_collect": 25000,
  "total_costs": 20000, "total_paid_to_suppliers": 15000, "balance_to_suppliers": 5000,
  "gross_profit": 35000, "profit_percent": 63.6, "cash_flow": 15000
}
```
**Auth:** נדרש + permission `finance:read`  
**Business Rules:** חישוב בשרת (authoritative)

### 4.7 POST /api/projects/{id}/can-close
**Response 200:** `{ canClose: true, errors: [] }`  
**Auth:** נדרש + permission `projects:close-settlement`  
**Business Rules:** `validateProjectCanClose`

### 4.8 POST /api/projects/{id}/close-settlement
**Response 200:** `Project` (עם settlement_status=closed)  
**Auth:** נדרש + permission `projects:close-settlement`  
**Business Rules:**
- בדיקת `validateProjectCanClose`
- עדכון `settlement_status=closed`, `closed_at=today`, `closed_by=current_user`
- audit log

---

## 5. Quotes APIs

### 5.1 GET /api/project-quotes
**Query:** `?project_id=&status=&page=`  
**Response 200:** `{ data: ProjectQuote[], pagination }`

### 5.2 GET /api/project-quotes/{id}
**Response 200:** `ProjectQuote` (כולל items + components)

### 5.3 POST /api/project-quotes
**Request:**
```json
{
  "project_id": "uuid", "addition_number": 0,
  "quote_date": "2026-08-01", "valid_until": "2026-09-01",
  "discount_percent": 0, "vat_percent": 17, "notes": "..."
}
```
**Response 201:** `ProjectQuote`  
**Auth:** נדרש + permission `quotes:create`  
**Business Rules:**
- addition_number ייחודי לפרויקט
- חישוב subtotal/vat/total מתבצע בשרת

### 5.4 PATCH /api/project-quotes/{id}
**Auth:** נדרש + permission `quotes:edit`  
**Business Rules:**
- שינוי status ל approved: חובת סכום > 0 + permission `quotes:approve`

### 5.5 DELETE /api/project-quotes/{id}
**Auth:** נדרש + permission `quotes:delete`  
**Business Rules:** מחיקת cascade של items + components

### 5.6 POST /api/project-quotes/{id}/calculate
**Response 200:**
```json
{
  "linesTotal": 55000, "subtotal": 55000, "vatAmount": 9350, "totalWithVat": 64350
}
```
**Auth:** נדרש  
**Business Rules:** חישוב authoritative בשרת (מתוך items + components)

### 5.7 POST /api/project-quotes/{id}/generate-pdf
**Response 200:** `{ file_url: "signed-url" }`  
**Auth:** נדרש + permission `quotes:edit`  
**Business Rules:** יצירת PDF בשרת (Puppeteer) + שמירה ב-S3

### 5.8 POST /api/project-quotes/{id}/upload-pdf
**Request:** multipart/form-data (file)  
**Response 200:** `{ file_url }`  
**Business Rules:** העלאת PDF חיצוני

---

## 6. Quote Items APIs

### 6.1 GET /api/project-quotes/{quote_id}/items
**Response 200:** `{ data: QuoteItem[] }`

### 6.2 POST /api/project-quotes/{quote_id}/items
**Request:**
```json
{ "width_cm": 120, "height_cm": 90, "quantity": 1, "description": "..." }
```
**Response 201:** `QuoteItem`  
**Business Rules:** חישוב `total_price` בשרת

### 6.3 PATCH /api/quote-items/{id}
### 6.4 DELETE /api/quote-items/{id}

### 6.5 POST /api/quote-items/{id}/components
**Request:**
```json
{ "catalog_item_id": "uuid", "quantity": 1, "price_override": 1200 }
```
**Response 201:** `QuoteItemComponent`  
**Business Rules:** snapshot שם/מחיר מתוך catalog_item

### 6.6 PATCH /api/quote-item-components/{id}
### 6.7 DELETE /api/quote-item-components/{id}

---

## 7. Payments APIs

### 7.1 GET /api/client-payments
**Query:** `?project_id=&payment_date_from=&payment_date_to=`

### 7.2 POST /api/client-payments
**Request:**
```json
{
  "project_id": "uuid", "payment_type": "advance", "amount": 10000,
  "payment_date": "2026-08-01", "payment_method": "transfer",
  "received_by_partner_id": "uuid", "reference": "..."
}
```
**Response 201:** `ClientPayment`  
**Auth:** נדרש + permission `payments:create`  
**Validation:**
- amount: > 0
- payment_type: enum
- payment_method: enum
- payment_date: ISO date
- project_id: FK valid

### 7.3 PATCH /api/client-payments/{id}
### 7.4 DELETE /api/client-payments/{id}

---

## 8. Supplier Orders APIs

### 8.1 GET /api/supplier-orders
### 8.2 POST /api/supplier-orders
**Request:**
```json
{
  "project_id": "uuid", "order_type": "aluminum", "supplier_name": "...",
  "description": "...", "order_amount": 20000, "paid_amount": 0,
  "order_date": "2026-08-01", "payment_date": null, "paid_by_partner_id": "uuid"
}
```
**Validation:**
- order_amount: ≥ 0
- paid_amount: ≤ order_amount
- supplier_name: required

### 8.3 PATCH /api/supplier-orders/{id}
**Business Rules:** עדכון status אוטומטי (ordered/partial/paid) לפי paid_amount

### 8.4 DELETE /api/supplier-orders/{id}

---

## 9. Partners APIs

### 9.1 GET /api/partners
### 9.2 POST /api/partners
**Request:** `{ name, profit_share_percent, active }`  
**Validation:**
- profit_share_percent: 0-100
- סכום כל השותפים צריך להגיע ל-100% (warning, לא block)

### 9.3 PATCH /api/partners/{id}
### 9.4 DELETE /api/partners/{id}
**Business Rules:** אין תשלומים/הזמנות מקושרות

---

## 10. Finance APIs

### 10.1 GET /api/finance/aggregate
**Query:** `?date_from=&date_to=`  
**Response 200:**
```json
{
  "total_income": 150000, "total_expenses": 80000,
  "gross_profit": 70000, "client_debt": 50000, "supplier_debt": 20000,
  "monthly_series": [{ "month": "2026-08", "income": 50000, "expenses": 30000 }],
  "expense_by_category": [{ "category": "salary", "amount": 20000 }]
}
```
**Auth:** נדרש + permission `finance:read`

### 10.2 GET /api/partners/settlement
**Query:** `?until_date=`  
**Response 200:**
```json
{
  "total_income": 150000, "total_project_costs": 80000,
  "total_general_expenses": 10000, "net_business_profit": 60000,
  "closed_projects_detail": [...], "open_projects_detail": [...],
  "partners": [...], "transfers": [...]
}
```
**Auth:** נדרש + permission `settlement:read`  
**Business Rules:** חישוב cash-basis בשרת

---

## 11. Documents APIs

### 11.1 GET /api/documents
### 11.2 POST /api/documents
**Request:**
```json
{ "project_id": "uuid", "document_type": "contract", "name": "...", "file_key": "s3-key", "notes": "..." }
```
**Business Rules:** `file_key` מתקבל מ-upload flow (ראה Storage)

### 11.3 PATCH /api/documents/{id}
### 11.4 DELETE /api/documents/{id}
**Business Rules:** מחיקת קובץ מ-S3

---

## 12. Reminders APIs

### 12.1 GET /api/reminders
### 12.2 POST /api/reminders
### 12.3 PATCH /api/reminders/{id}
### 12.4 DELETE /api/reminders/{id}
### 12.5 POST /api/reminders/{id}/done
**Business Rules:** עדכון status=done + audit

---

## 13. Model Pricing (Catalog) APIs

### 13.1 GET /api/model-pricing
### 13.2 POST /api/model-pricing
**Request:** `{ model_name, category, pricing_method, base_price, notes, is_active }`  
**Validation:**
- pricing_method: enum (sqm/meter_width/meter_height/unit)
- base_price: ≥ 0

### 13.3 PATCH /api/model-pricing/{id}
### 13.4 DELETE /api/model-pricing/{id}
**Business Rules:** אין רכיבי הצעה מקושרים

---

## 14. Model Components (Production) APIs

### 14.1 GET /api/model-pricing/{model_id}/components
### 14.2 POST /api/model-pricing/{model_id}/components
### 14.3 PATCH /api/model-components/{id}
### 14.4 DELETE /api/model-components/{id}
### 14.5 POST /api/model-pricing/{model_id}/components/calculate
**Request:** `{ opening_width: 120, opening_height: 90 }`  
**Response 200:** `[{ id, calculated_length, calculated_width }]`  
**Business Rules:** חישוב `calculateComponents` בשרת

---

## 15. Quote Templates APIs

### 15.1 GET /api/quote-templates
### 15.2 POST /api/quote-templates
### 15.3 PATCH /api/quote-templates/{id}
### 15.4 DELETE /api/quote-templates/{id}
### 15.5 POST /api/quote-templates/{id}/components
### 15.6 PATCH /api/quote-template-components/{id}
### 15.7 DELETE /api/quote-template-components/{id}

---

## 16. Material Orders APIs

### 16.1 GET /api/material-orders
**Query:** `?project_id=`
### 16.2 POST /api/material-orders
### 16.3 PATCH /api/material-orders/{id}
### 16.4 DELETE /api/material-orders/{id}
**Business Rules:** מחיקת cascade של items

### 16.5 POST /api/projects/{project_id}/material-orders/generate
**Response 201:** `{ generated: 3, orders: [...] }`  
**Auth:** נדרש + permission `material-orders:generate`  
**Business Rules:**
- transaction atomic
- מחיקת draft orders קודמים
- יצירה מתוך model_components של הדגמים בפרויקט

---

## 17. Agent APIs

### 17.1 GET /api/agent/alerts
### 17.2 POST /api/agent/alerts/{id}/resolve
### 17.3 POST /api/agent/analyze
**Response 200:** `{ created: 5, resolved: 2 }`  
**Auth:** נדרש + permission `alerts:manage`  
**Business Rules:** הרצת `analyzeProjectAlerts` + upsert alerts

### 17.4 GET /api/agent/smart-focus
**Response 200:** `{ tasks: [...], summary: {...} }`  
**Business Rules:** `generateSmartFocusTasks` + `calculateDailySummary`

### 17.5 GET /api/agent/daily-summary
### 17.6 GET /api/agent/settings
### 17.7 PATCH /api/agent/settings
**Auth:** נדרש + permission `agent-settings:manage`

---

## 18. Company Headers APIs

### 18.1 GET /api/company-headers
### 18.2 POST /api/company-headers
### 18.3 PATCH /api/company-headers/{id}
### 18.4 DELETE /api/company-headers/{id}
### 18.5 POST /api/company-headers/{id}/set-default
**Business Rules:** הסרת default משאר הכותרות

---

## 19. Storage APIs

### 19.1 POST /api/storage/upload-url
**Request:**
```json
{ "filename": "logo.png", "content_type": "image/png", "entity_type": "company_header" }
```
**Response 200:**
```json
{ "upload_url": "https://s3.../signed", "file_key": "company_headers/uuid/logo.png" }
```
**Auth:** נדרש  
**Business Rules:**
- וולידציית content_type
- יצירת signed URL (תוקף 5 דקות)
- יצירת file_key ייחודי

### 19.2 GET /api/storage/{key}/download-url
**Response 200:** `{ download_url: "https://s3.../signed" }`  
**Business Rules:** signed URL להורדה (תוקף 1 שעה)

### 19.3 DELETE /api/storage/{key}
**Response 204**  
**Business Rules:** מחיקת קובץ מ-S3

---

## 20. Cron / Scheduled APIs

### 20.1 POST /api/cron/morning-summary
**Headers:** `X-Cron-Secret: {secret}`  
**Response 200:** `{ processed: 10 }`  
**Business Rules:** לכל tenant — חישוב סיכום + שמירה/שליחה

### 20.2 POST /api/cron/analyze-alerts
### 20.3 POST /api/cron/reminder-notifications

---

## 21. Health & Monitoring

### 21.1 GET /api/health
**Response 200:** `{ status: "ok", timestamp: "..." }`  
**Auth:** לא נדרש

### 21.2 GET /api/health/db
**Response 200:** `{ db: "ok", latency_ms: 5 }`

---

> ראה גם: `BACKEND_MIGRATION_PLAN.md` לסדר פיתוח, `SECURITY_MODEL.md` להרשאות.