# DATABASE_MIGRATION.md

## תוכנית העברת בסיס הנתונים מ-Base44 ל-PostgreSQL

> **תאריך:** 2026-08-01  
> **מטרה:** המרת 20 entities מ-NoSQL (Base44) ל-PostgreSQL רלציוני עם foreign keys.  
> **ORM מומלץ:** Prisma.

---

## 1. כל ה-Entities והקשרים

### 1.1 דיאגרמת ERD (מותאמת ל-SQL)

```
Customer (1) ───< (N) Project
                      │
                      ├──< (N) ProjectQuote ──< (N) QuoteItem ──< (N) QuoteItemComponent
                      │                                                        │
                      │                                              ModelPricing (N) ──< (N) ModelComponent
                      │
                      ├──< (N) ClientPayment ──> (1) Partner (received_by)
                      ├──< (N) SupplierOrder ──> (1) Partner (paid_by)
                      ├──< (N) Document
                      ├──< (N) Reminder
                      └──< (N) MaterialOrder ──< (N) MaterialOrderItem

GeneralExpense ──> (1) Partner (paid_by)

QuoteTemplate ──< (N) QuoteTemplateComponent ──> (1) ModelPricing

AgentAlert ──> (1) Project
AgentSettings (singleton)
CompanyHeader (standalone)
```

### 1.2 טבלאות מערכת (מובנות Base44 → עמודות רגילות)
| שדה Base44 | עמודה ב-PostgreSQL | סוג | הערה |
|------------|---------------------|-----|------|
| `id` | `id` | UUID PK | `gen_random_uuid()` |
| `created_date` | `created_at` | TIMESTAMP | `DEFAULT now()` |
| `updated_date` | `updated_at` | TIMESTAMP | trigger לעדכון |
| `created_by_id` | `created_by` | UUID FK → users | nullable |

---

## 2. סכמת טבלאות (PostgreSQL + Prisma)

### 2.1 users (מחליף את User המובנה)
```prisma
model User {
  id          String   @id @default(uuid())
  email       String   @unique
  full_name   String?
  role        Role     @default(USER)  // ADMIN | USER
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  // קשרים
  projects    Project[] @relation("CreatedProjects")
  // ...
}
enum Role { ADMIN USER }
```

### 2.2 customers
```prisma
model Customer {
  id            String   @id @default(uuid())
  name          String
  customer_type CustomerType
  phone         String
  email         String?
  address       String?
  notes         String?
  status        CustomerStatus @default(ACTIVE)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  created_by    String?
  projects      Project[]
}
enum CustomerType { PRIVATE CONTRACTOR }
enum CustomerStatus { ACTIVE INACTIVE }
```
**התאמות נדרשות:**
- `customer_type` → enum עם constraint
- `status` → enum
- `phone` → חובה (required ב-Base44)

### 2.3 projects
```prisma
model Project {
  id                String         @id @default(uuid())
  project_number    String?        @unique  // הוספת unique
  name              String
  customer_id       String
  customer          Customer       @relation(fields: [customer_id], references: [id])
  customer_name     String         // denormalized (לשמירת ביצועים)
  address           String?
  aluminum_color    String?
  start_date        DateTime?      @db.Date
  target_date        DateTime?      @db.Date
  status            ProjectStatus  @default(QUOTE)
  initial_quote     Float?
  final_quote       Float?
  notes             String?
  settlement_status SettlementStatus @default(OPEN)
  closed_at         DateTime?      @db.Date
  closed_by         String?
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  created_by        String?
  // קשרים
  quotes            ProjectQuote[]
  payments          ClientPayment[]
  orders            SupplierOrder[]
  documents         Document[]
  reminders         Reminder[]
  materialOrders    MaterialOrder[]
  alerts            AgentAlert[]
}
enum ProjectStatus { QUOTE NEGOTIATION APPROVED ORDERING PRODUCTION INSTALLATION COMPLETED INVOICED }
enum SettlementStatus { OPEN CLOSED }
```
**התאמות נדרשות:**
- `project_number` → הוספת `@unique` (כיום עלול להיות לא ייחודי)
- `status`, `settlement_status` → enums
- `customer_name` → denormalized (נשמר לביצועים, מסונכרן עם customer.name)
- `closed_by` → כיום מחרוזת קשיחה "מנהל"; יש להחליף ב-FK ל-users

### 2.4 project_quotes
```prisma
model ProjectQuote {
  id                String       @id @default(uuid())
  project_id        String
  project          Project      @relation(fields: [project_id], references: [id])
  project_name     String       // denormalized
  customer_name    String       // denormalized
  quote_number     String?
  addition_number  Int          // הוספת unique constraint עם project_id
  quote_date       DateTime?    @db.Date
  valid_until      DateTime?    @db.Date
  amount           Float
  subtotal         Float?
  discount_percent Float        @default(0)
  vat_percent      Float        @default(17)
  vat_amount       Float?
  total_with_vat   Float?
  changes_description String?
  notes            String?
  file_url         String?
  status           QuoteStatus  @default(DRAFT)
  is_detailed      Boolean      @default(false)
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt
  created_by       String?
  items            QuoteItem[]

  @@unique([project_id, addition_number])  // חדש
}
enum QuoteStatus { DRAFT SENT APPROVED REJECTED }
```
**התאמות:**
- `addition_number` → `@@unique([project_id, addition_number])` (כיום עלול להיות כפול)
- `status` → enum

### 2.5 quote_items
```prisma
model QuoteItem {
  id          String   @id @default(uuid())
  quote_id    String
  quote       ProjectQuote @relation(fields: [quote_id], references: [id])
  width_cm    Float?
  height_cm   Float?
  quantity    Int       @default(1)
  description String?
  total_price Float?
  sort_order  Int?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  components  QuoteItemComponent[]
}
```

### 2.6 quote_item_components
```prisma
model QuoteItemComponent {
  id                     String        @id @default(uuid())
  quote_item_id          String
  quote_item             QuoteItem     @relation(fields: [quote_item_id], references: [id])
  catalog_item_id        String?       // FK ל-model_pricing (nullable — רכיב ידני)
  catalog_item           ModelPricing? @relation(fields: [catalog_item_id], references: [id])
  name_snapshot          String
  category_snapshot      String?
  pricing_method_snapshot PricingMethod
  price_snapshot         Float
  quantity               Float         @default(1)
  calculated_value       Float?
  sort_order             Int?
  created_at             DateTime @default(now())
  updated_at             DateTime @updatedAt
}
enum PricingMethod { SQM METER_WIDTH METER_HEIGHT UNIT }
```
**התאמות:**
- `pricing_method_snapshot` → enum (ב-Base44: `sqm`/`meter`/`unit` — לשים לב: יש חוסר עקביות בין `meter` ל-`meter_width`/`meter_height`)
- `catalog_item_id` → FK nullable (תומך ברכיבים ידניים)

### 2.7 client_payments
```prisma
model ClientPayment {
  id                     String       @id @default(uuid())
  project_id             String
  project                Project      @relation(fields: [project_id], references: [id])
  project_name           String?      // denormalized
  payment_type           PaymentType
  amount                 Float
  payment_date           DateTime     @db.Date
  payment_method         PaymentMethod
  received_by_partner_id String?
  received_by_partner    Partner?     @relation(fields: [received_by_partner_id], references: [id])
  received_by_partner_name String?
  reference              String?
  notes                  String?
  created_at             DateTime @default(now())
  updated_at             DateTime @updatedAt
  created_by             String?
}
enum PaymentType { ADVANCE INTERIM FINAL }
enum PaymentMethod { CASH CHECK TRANSFER CREDIT }
```

### 2.8 supplier_orders
```prisma
model SupplierOrder {
  id                String      @id @default(uuid())
  project_id        String
  project           Project     @relation(fields: [project_id], references: [id])
  project_name      String?
  order_type        OrderType
  supplier_name     String
  description       String?
  order_amount      Float
  paid_amount       Float       @default(0)
  order_date       DateTime?    @db.Date
  payment_date      DateTime?    @db.Date
  paid_by_partner_id String?
  paid_by_partner   Partner?    @relation(fields: [paid_by_partner_id], references: [id])
  paid_by_partner_name String?
  status            OrderStatus @default(ORDERED)
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  created_by        String?
}
enum OrderType { ALUMINUM HARDWARE GLASS EXTRAS }
enum OrderStatus { ORDERED PARTIAL PAID RECEIVED }
```

### 2.9 documents
```prisma
model Document {
  id            String       @id @default(uuid())
  project_id    String
  project       Project      @relation(fields: [project_id], references: [id])
  project_name  String?
  document_type DocumentType
  name          String
  file_url      String       // יעודכן ל-S3 key
  notes         String?
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  created_by    String?
}
enum DocumentType { CONTRACT PLAN INVOICE PHOTO DELIVERY }
```

### 2.10 reminders
```prisma
model Reminder {
  id           String        @id @default(uuid())
  project_id   String?
  project     Project?       @relation(fields: [project_id], references: [id])
  project_name String?
  title        String
  description  String?
  due_date     DateTime      @db.Date
  priority     Priority      @default(MEDIUM)
  status       ReminderStatus @default(OPEN)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
  created_by   String?
}
enum Priority { LOW MEDIUM HIGH }
enum ReminderStatus { OPEN DONE POSTPONED }
```

### 2.11 partners
```prisma
model Partner {
  id                  String   @id @default(uuid())
  name                String
  profit_share_percent Float
  active              Boolean  @default(true)
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt
  // קשרים (reverse)
  receivedPayments    ClientPayment[]
  paidOrders          SupplierOrder[]
  paidExpenses        GeneralExpense[]
}
```

### 2.12 general_expenses
```prisma
model GeneralExpense {
  id                  String         @id @default(uuid())
  description         String
  category            ExpenseCategory
  amount              Float
  expense_date        DateTime       @db.Date
  paid_by_partner_id  String
  paid_by_partner     Partner        @relation(fields: [paid_by_partner_id], references: [id])
  paid_by_partner_name String?
  notes               String?
  created_at          DateTime @default(now())
  updated_at          DateTime @updatedAt
  created_by          String?
}
enum ExpenseCategory { RENT SALARY EQUIPMENT MARKETING OTHER }
```

### 2.13 model_pricing (קטלוג)
```prisma
model ModelPricing {
  id            String        @id @default(uuid())
  model_name    String
  category      ModelCategory @default(PRODUCT)
  pricing_method ModelPricingMethod @default(SQM)
  base_price    Float
  notes         String?
  is_active     Boolean       @default(true)
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  created_by    String?
  // קשרים
  components        ModelComponent[]
  quoteComponents   QuoteItemComponent[]
  templateComponents QuoteTemplateComponent[]
}
enum ModelCategory { PRODUCT SERIES STRUCTURE SHUTTER MOTOR MESH ADDON GLASS OTHER }
enum ModelPricingMethod { SQM METER_WIDTH METER_HEIGHT UNIT }
```
**התאמות:**
- איחוד `meter` / `meter_width` / `meter_height` — להשתמש ב-enum יחיד

### 2.14 model_components (רכיבי ייצור)
```prisma
model ModelComponent {
  id              String          @id @default(uuid())
  model_id        String
  model           ModelPricing    @relation(fields: [model_id], references: [id])
  component_type  ComponentType
  item_code       String
  quantity        Float
  length_base     DimensionBase?
  length_op1      Operation       @default(NONE)
  length_val1     Float?
  length_op2      Operation       @default(NONE)
  length_val2     Float?
  width_base      DimensionBase?
  width_op1       Operation       @default(NONE)
  width_val1      Float?
  width_op2       Operation       @default(NONE)
  width_val2      Float?
  calculated_length Float?
  calculated_width  Float?
  notes           String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt
}
enum ComponentType { PROFILE GLASS HARDWARE ACCESSORY }
enum DimensionBase { OPENING_WIDTH OPENING_HEIGHT FIXED }
enum Operation { NONE ADD SUBTRACT MULTIPLY DIVIDE }
```

### 2.15 quote_templates
```prisma
model QuoteTemplate {
  id          String   @id @default(uuid())
  name        String
  description String?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  components  QuoteTemplateComponent[]
}
```

### 2.16 quote_template_components
```prisma
model QuoteTemplateComponent {
  id                String        @id @default(uuid())
  template_id       String
  template          QuoteTemplate @relation(fields: [template_id], references: [id])
  catalog_item_id   String?
  catalog_item      ModelPricing? @relation(fields: [catalog_item_id], references: [id])
  name_snapshot     String
  category_snapshot String?
  pricing_method_snapshot PricingMethod
  price_snapshot    Float
  sort_order        Int?
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
}
```

### 2.17 material_orders
```prisma
model MaterialOrder {
  id           String          @id @default(uuid())
  project_id   String
  project     Project         @relation(fields: [project_id], references: [id])
  project_name String?
  order_type  MaterialOrderType
  status      MaterialOrderStatus @default(DRAFT)
  notes       String?
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
  items       MaterialOrderItem[]
}
enum MaterialOrderType { PROFILES HARDWARE GLASS }
enum MaterialOrderStatus { DRAFT SENT RECEIVED }
```

### 2.18 material_order_items
```prisma
model MaterialOrderItem {
  id               String       @id @default(uuid())
  material_order_id String
  material_order   MaterialOrder @relation(fields: [material_order_id], references: [id])
  item_code        String
  total_quantity   Float
  total_length     Float?
  notes            String?
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt
}
```

### 2.19 agent_settings (singleton)
```prisma
model AgentSettings {
  id                          String  @id @default(uuid())
  minimum_profit_percent      Float   @default(15)
  cash_flow_warning_threshold Float   @default(-50000)
  max_open_projects           Int     @default(10)
  high_debt_threshold         Float   @default(100000)
  contractor_priority_weight  Float   @default(1.5)
  enable_morning_summary      Boolean @default(true)
  enable_realtime_alerts      Boolean @default(true)
  enable_smart_focus          Boolean @default(true)
  max_focus_items             Int     @default(5)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt
}
```

### 2.20 agent_alerts
```prisma
model AgentAlert {
  id            String     @id @default(uuid())
  alert_key     String     // project_id|alert_type
  project_id    String?
  project       Project?   @relation(fields: [project_id], references: [id])
  project_name  String?
  alert_type    AlertType
  severity      Severity
  message       String
  details       String?    // JSON
  is_handled    Boolean    @default(false)
  priority_score Float?
  action_type   ActionType?
  action_link   String?
  due_date      DateTime?  @db.Date
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt

  @@unique([alert_key])  // הוספת unique
}
enum AlertType { PROFITABILITY COLLECTION CASH_FLOW WORKLOAD STRATEGIC }
enum Severity { LOW MEDIUM HIGH CRITICAL }
enum ActionType { COLLECT FOLLOW_UP FIX_PROFIT ORDER_MATERIAL SUPPLIER_PAYMENT GENERAL }
```

### 2.21 company_headers
```prisma
model CompanyHeader {
  id           String   @id @default(uuid())
  name         String
  company_name String?
  logo_url     String?   // יעודכן ל-S3 key
  subtitle     String?
  is_default   Boolean  @default(false)
  created_at   DateTime @default(now())
  updated_at   DateTime @updatedAt
}
```

---

## 3. שדות שדורשים התאמה

| Entity | שדה | בעיה | פתרון |
|--------|------|------|-------|
| Project | `project_number` | עלול לא ייחודי | `@unique` constraint |
| ProjectQuote | `addition_number` | מחושב כ-`count`, עלול כפול | `@@unique([project_id, addition_number])` |
| Project | `closed_by` | מחרוזת קשיחה "מנהל" | FK ל-users |
| QuoteItemComponent | `pricing_method_snapshot` | חוסר עקביות (`meter` vs `meter_width`) | enum יחיד מאוחד |
| ModelPricing | `pricing_method` | אין `meter` ב-enum הנוכחי | `ModelPricingMethod` enum |
| AgentAlert | `alert_key` | מחרוזת מורכבת | `@unique` + trigger ליצירה |
| AgentSettings | (singleton) | יכולים להיות כמה records | constraint: רק record אחד |
| כל ה-entities | `created_by_id` | string | FK ל-users (nullable) |

---

## 4. שדות תלויים ב-Base44

| שדה | תלות | פתרון |
|------|------|-------|
| `id` | Base44 UUID | PostgreSQL UUID default |
| `created_date` | Base44 auto | `created_at` + trigger |
| `updated_date` | Base44 auto | `updated_at` + trigger |
| `created_by_id` | Base44 auth context | JWT claim → `created_by` |
| `file_url` (Document) | Base44 Storage | S3 key + signed URL |
| `file_url` (ProjectQuote) | Base44 Storage | S3 key |
| `logo_url` (CompanyHeader) | Base44 Storage | S3 key |

---

## 5. שדות חדשים מומלץ להוסיף

### 5.1 Multi-tenant (לעתיד — ראה SAAS_ARCHITECTURE.md)
| Entity | שדה חדש | סוג | תיאור |
|--------|---------|-----|--------|
| כל ה-entities | `tenant_id` | UUID FK → tenants | בידוד בין ארגונים |

### 5.2 אודיט והיסטוריה
| Entity | שדה חדש | סוג | תיאור |
|--------|---------|-----|--------|
| כל ה-entities | `deleted_at` | TIMESTAMP? | soft delete |
| כל ה-entities | `version` | Int | optimistic locking |
| כל ה-entities | `last_modified_by` | UUID FK → users | מי עדכן אחרון |

### 5.3 שדות עסקיים
| Entity | שדה חדש | סוג | תיאור |
|--------|---------|-----|--------|
| Project | `actual_close_date` | Date? | תאריך סגירה בפועל (מול target_date) |
| Project | `profit_margin_actual` | Float? | רווח בפועל (מחושב) |
| ClientPayment | `invoice_number` | String? | מספר חשבונית |
| SupplierOrder | `invoice_number` | String? | מספר חשבונית ספק |
| ProjectQuote | `pdf_file_key` | String? | מפתח S3 (מחליף file_url) |
| Document | `file_key` | String? | מפתח S3 |
| Document | `file_size` | Int? | גודל קובץ |
| Document | `mime_type` | String? | סוג קובץ |
| CompanyHeader | `logo_file_key` | String? | מפתח S3 |

### 5.4 אינדקסים מומלצים
```sql
CREATE INDEX idx_projects_customer_id ON projects(customer_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_settlement_status ON projects(settlement_status);
CREATE INDEX idx_payments_project_id ON client_payments(project_id);
CREATE INDEX idx_payments_payment_date ON client_payments(payment_date);
CREATE INDEX idx_orders_project_id ON supplier_orders(project_id);
CREATE INDEX idx_quotes_project_id ON project_quotes(project_id);
CREATE INDEX idx_quotes_status ON project_quotes(status);
CREATE INDEX idx_reminders_due_date ON reminders(due_date);
CREATE INDEX idx_reminders_status ON reminders(status);
CREATE INDEX idx_alerts_project_id ON agent_alerts(project_id);
CREATE INDEX idx_alerts_is_handled ON agent_alerts(is_handled);
```

---

## 6. תוכנית Migration

### שלב 1 — Schema Creation
1. יצירת Prisma schema מלא (מסמך זה)
2. `npx prisma migrate dev --name init`
3. יצירת enums, indexes, constraints
4. וולידציה: `npx prisma studio`

### שלב 2 — Data Export מ-Base44
1. כתיבת סקריפט export (Node.js) שקורא כל entity דרך SDK
2. שמירה כ-JSON לקבצים (`export/customers.json`, וכו')
3. מיפוי שדות (camelCase → snake_case אם נדרש)
4. המרת תאריכיך (ISO strings)

### שלב 3 — Data Import ל-PostgreSQL
1. סקריפט import (Node.js + Prisma)
2. סדר יבוא (לפי תלות):
   - `users` → `partners` → `customers` → `company_headers` → `agent_settings`
   - `projects` → `project_quotes` → `quote_items` → `quote_item_components`
   - `model_pricing` → `model_components`
   - `quote_templates` → `quote_template_components`
   - `client_payments` → `supplier_orders` → `general_expenses`
   - `documents` → `reminders`
   - `material_orders` → `material_order_items`
   - `agent_alerts`
3. המרת `id` (אם פורמט שונה)
4. בדיקת ייחודיות (project_number, addition_number)

### שלב 4 — File Migration
1. ייצוא כל `file_url` מ-Base44 Storage
2. העלאה ל-S3/Supabase Storage
3. עדכון `file_key` ב-DB (מפתח חדש)

### שלב 5 — Validation
1. השוואת counts (כל entity — Base44 vs PostgreSQL)
2. השוואת סכומים פיננסיים
3. בדיקת קשרים (foreign keys תקינים)
4. בדיקת ייחודיות

### שלב 6 — Cutover
1. הקפאת כתיבות ב-Base44
2. Export דלתא (שינויים מאז export הראשון)
3. Import דלתא
4. החלפת אפליקציה ל-PostgreSQL
5. ניטור

---

## 7. סיכונים

1. **אובדן נתונים** — חובת גיבוי לפני כל שלב
2. **כפילויות id** — אם Base44 משתמש בפורמט אחר מ-UUID
3. **קשרים שבורים** — orphaned records (למשל `catalog_item_id` שנמחק)
4. **תאריכים** — timezone (Asia/Jerusalem) — חובת UTC אחיד
5. **סכומים פיננסיים** — הבדלי rounding (Float vs Decimal) — **מומלץ Decimal(12,2) במקום Float**

### המלצה קריטית
> החלף את כל שדות ה-`Float` הפיננסיים ב-`Decimal @db.Decimal(12,2)` כדי למנוע בעיות rounding.

---

> ראה גם: `SECURITY_MODEL.md` להגדרת RLS ב-PostgreSQL.