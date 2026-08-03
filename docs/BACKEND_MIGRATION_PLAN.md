# BACKEND_MIGRATION_PLAN.md

## תוכנית העברת לוגיקה עסקית לשרת

> **תאריך:** 2026-08-01  
> **מטרה:** מיפוי מלא של כל מודול לוגיקה — מה נשאר frontend, מה עובר לשרת, אילו API נדרשים.

---

## 1. טבלת החלטות לפי מודול

### 1.1 Logic Modules (קובצי `lib/`)

| מודול | קובץ | פונקציה | Frontend? | Cloud Code? | סיבה |
|-------|------|---------|-----------|------------|------|
| **projectFinancials** | `lib/projectFinancials.jsx` | `calculateProjectFinancials` | ⚠️ שכפול | ✅ עיקרי | חישוב פיננסי — מקור אמת בשרת; frontend משתמש בתוצאה מה-API |
| | | `calculateAggregatedFinancials` | ❌ | ✅ | סיכום רב-פרויקטי — חייב לרוץ בשרת (data volume) |
| **partnerSettlement** | `lib/partnerSettlement.jsx` | `calculateFullPartnerSettlement` | ❌ | ✅ | חלוקת רווחים — אסור שינוי מצד client |
| | | `validateProjectCanClose` | ❌ | ✅ | וולידציה עסקית קריטית לסגירה |
| **agentLogic** | `lib/agentLogic.jsx` | `analyzeProjectAlerts` | ❌ | ✅ | יצירת התראות — צריך לרוץ כ-cron/scheduled |
| | | `shouldResolveAlert` | ❌ | ✅ | לוגיקת ניקוי התראות |
| | | `calculateProjectPriorityScore` | ⚠️ שכפול | ✅ עיקרי | ניקוד — שרת authoritative; frontend יכול להציג |
| | | `calculateBaseMetrics` | ❌ | ✅ | מדדים מצטברים |
| **smartFocus** | `lib/smartFocus.jsx` | `generateSmartFocusTasks` | ❌ | ✅ | משימות עדיפות — צריך נתונים מלאים |
| | | `calculateDailySummary` | ❌ | ✅ | סיכום יומי — צריך aggregation בשרת |
| **quoteCalculations** | `lib/quoteCalculations.js` | `calcComponentValue` | ⚠️ שכפול | ✅ עיקרי | חישוב מחיר — שרת קובע; frontend מציג preview |
| | | `calcItemTotal` | ⚠️ שכפול | ✅ עיקרי | סכום פריט |
| | | `generateDescription` | ✅ | ❌ | תיאור אוטומטי — UI בלבד |
| | | `pricingMethodLabel`, `CATEGORY_LABELS`, `CATEGORY_COLORS` | ✅ | ❌ | Constants — UI בלבד |
| **formulaEngine** | `lib/formulaEngine.js` | `calculateComponents` | ⚠️ שכפול | ✅ עיקרי | חישוב רכיבי ייצור — שרת קובע |
| **materialOrderGenerator** | `lib/materialOrderGenerator.js` | `generateMaterialOrders` | ❌ | ✅ | יצירת הזמנות — חייב transaction + validation |

### 1.2 כלל האצבע
- ✅ **Frontend:** constants, labels, formatters, UI helpers, preview calculations (לתצוגה בלבד)
- ❌ **Cloud Code:** חישובים פיננסיים, חלוקת רווחים, וולידציה, יצירת מסמכים, אגרגציות, ניקוד עדיפות
- ⚠️ **שכפול מותר:** חישוב preview ב-frontend (לחוויה מהירה) + חישוב authoritative בשרת (לשמירה)

---

## 2. API חדשים נדרשים

### 2.1 Entities CRUD (כל entity)
| Endpoint | Method | תיאור |
|----------|--------|--------|
| `/api/{entity}` | GET | list (עם סינון, pagination, sort) |
| `/api/{entity}/{id}` | GET | get by id |
| `/api/{entity}` | POST | create |
| `/api/{entity}/{id}` | PATCH | update |
| `/api/{entity}/{id}` | DELETE | delete |

Entities: `customers`, `projects`, `project-quotes`, `quote-items`, `quote-item-components`, `client-payments`, `supplier-orders`, `documents`, `reminders`, `partners`, `general-expenses`, `model-pricing`, `model-components`, `quote-templates`, `quote-template-components`, `material-orders`, `material-order-items`, `agent-settings`, `agent-alerts`, `company-headers`

### 2.2 Business Logic API (חדשים)
| Endpoint | Method | תיאור | לוגיקה |
|----------|--------|--------|--------|
| `/api/projects/{id}/financials` | GET | חישוב פיננסי מלא | `calculateProjectFinancials` |
| `/api/finance/aggregate` | GET | סיכום רב-פרויקטי | `calculateAggregatedFinancials` |
| `/api/partners/settlement` | GET | התחשבנות שותפים | `calculateFullPartnerSettlement` |
| `/api/projects/{id}/can-close` | POST | וולידציית סגירה | `validateProjectCanClose` |
| `/api/projects/{id}/close-settlement` | POST | סגירת התחשבנות | + update project, create audit |
| `/api/quotes/{id}/calculate` | POST | חישוב הצעה (server-side) | `calcItemTotal` + `calcComponentValue` |
| `/api/quotes/{id}/generate-pdf` | POST | ייצור PDF בשרת | Puppeteer / React-PDF |
| `/api/projects/{id}/material-orders/generate` | POST | יצירת הזמנות חומר | `generateMaterialOrders` (transaction) |
| `/api/models/{id}/components/calculate` | POST | חישוב רכיבים | `calculateComponents` |
| `/api/agent/analyze` | POST | הרצת ניתוח התראות | `analyzeProjectAlerts` |
| `/api/agent/smart-focus` | GET | משימות עדיפות | `generateSmartFocusTasks` |
| `/api/agent/daily-summary` | GET | סיכום יומי | `calculateDailySummary` |
| `/api/agent/alerts/{id}/resolve` | POST | סימון טיפול | + validation |
| `/api/users/invite` | POST | הזמנת משתמש | שליחת אימייל + יצירת record |
| `/api/auth/me` | GET | משתמש נוכחי | מתבסס על JWT |
| `/api/storage/upload-url` | POST | קבלת signed URL | ל-upload ישיר ל-S3 |
| `/api/storage/{key}/download-url` | GET | signed URL להורדה | לקבצים פרטיים |

### 2.3 Scheduled / Cron (חדש)
| Endpoint | תדירות | תיאור |
|----------|--------|--------|
| `/api/cron/morning-summary` | יומי 07:00 | חישוב סיכום בוקר לכל משתמש |
| `/api/cron/analyze-alerts` | כל שעה | ניתוח התראות אוטומטי |
| `/api/cron/reminder-notifications` | יומי 08:00 | שליחת תזכורות דחופות |

---

## 3. חישובים שחייבים בשרת

### 3.1 חישובים פיננסיים
- `total_sale` (initial_quote + additions) — מקור אמת למכירה
- `total_received` — סכום תקבולים
- `balance_to_collect` — יתרה לגבייה
- `total_costs` — עלויות ספקים
- `gross_profit` / `profit_percent` — רווח גולמי
- `cash_flow` — תזרים נטו
- `net_business_profit` — רווח לחלוקה
- `settlement_balance` — מאזן התחשבנות שותף
- `transfers` — העברות נדרשות בין שותפים

### 3.2 חישובי תמחור
- `calcComponentValue` — ערך רכיב לפי שיטה (sqm/meter/unit)
- `calcItemTotal` — סכום פריט (רכיבים × כמות)
- `calculateComponents` — אורך/רוחב מחושב לפי נוסחה
- סכומי הצעה: `subtotal`, `vat_amount`, `total_with_vat` (לאחר הנחה)

### 3.3 חישובי ניקוד
- `priority_score` (0-100) — ניקוד פרויקט
- `urgency_level` — דחיפות משימה
- `impact_label` — תווית השפעה

---

## 4. פעולות שדורשות Validation בשרת

### 4.1 Validation עסקי
| פעולה | כללי validation |
|-------|------------------|
| סגירת התחשבנות פרויקט | `validateProjectCanClose` — יתרה לגבייה = 0, יתרה לספקים = 0, קיימת הצעה מאושרת |
| סטטוס פרויקט → `approved` | חייבת הצעה מאושרת |
| סטטוס פרויקט → `invoiced` | חייב סטטוס קודם `completed` |
| תשלום לקוח | סכום > 0, תאריך תקין, project_id קיים |
| הזמנת ספק | סכום ≥ 0, paid_amount ≤ order_amount, supplier_name לא ריק |
| הצעה מאושרת | addition_number ייחודי לפרויקט |
| יצירת הזמנת חומר | קיימים רכיבי ייצור לדגמים בפרויקט |
| מחיקת פרויקט | אין תשלומים/הזמנות/הצעות מקושרות (או cascade) |
| מחיקת דגם קטלוג | אין רכיבי הצעה מקושרים |
| הזמנת משתמש | אימייל תקין, תפקיד תקין, אינו רשום |

### 4.2 Validation טכני
- שדות required (לפי schema)
- סוגי שדות (number, date, enum)
- טווחים (כמות > 0, אחוז 0-100)
- פורמט תאריך (ISO)
- פורמט אימייל
- גודל קובץ (storage)

### 4.3 Validation אבטחה
- הרשאות (RLS) — האם המשתמש רשאי לפעול על הרשומה
- rate limiting
- input sanitization (XSS, SQL injection)

---

## 5. מודולים שנשארים Frontend בלבד

| מודול | סיבה |
|-------|------|
| `quoteCalculations.pricingMethodLabel` | constant — UI |
| `quoteCalculations.CATEGORY_LABELS` | constant — UI |
| `quoteCalculations.CATEGORY_COLORS` | constant — UI |
| `quoteCalculations.generateDescription` | תיאור אוטומטי לתצוגה |
| פורמט מטבע (`Intl.NumberFormat`) | UI helper |
| פורמט תאריך (`date-fns`) | UI helper |
| `ProjectStatusBadge` config | constant — UI |
| `StatsCard` variants | constant — UI |
| RTL / עברית | UI |

---

## 6. סדר פיתוח API מומלץ

1. **שלב A:** CRUD פשוט — `customers`, `partners`, `company-headers`, `agent-settings`
2. **שלב B:** CRUD עם קשרים — `projects`, `reminders`, `documents`
3. **שלב C:** CRUD פיננסי — `client-payments`, `supplier-orders`, `general-expenses`
4. **שלב D:** חישובים פיננסיים — `/financials`, `/aggregate`, `/settlement`
5. **שלב E:** הצעות מחיר — `project-quotes`, `quote-items`, `quote-item-components` + חישובים
6. **שלב F:** קטלוג + רכיבי ייצור — `model-pricing`, `model-components` + חישובים
7. **שלב G:** הזמנות חומר — `material-orders` + יצירה אוטומטית
8. **שלב H:** Agent — `agent-alerts`, `agent-settings` + ניתוח + smart focus
9. **שלב I:** תבניות — `quote-templates`, `quote-template-components`
10. **שלב J:** Auth — `users`, invite, roles
11. **שלב K:** Storage — signed URLs, upload
12. **שלב L:** Cron — morning summary, alert analysis

---

> ראה גם: `CLOUD_CODE_API_PLAN.md` לפירוט מלא של כל endpoint.