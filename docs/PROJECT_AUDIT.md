# ProjectFlow Pro — Project Audit Report

> **תאריך יצירה:** 2026-08-01  
> **מטרה:** Handover מקצועי למתכנת חיצוני — מיפוי מלא של המערכת כפי שהיא כיום.  
> **הערה:** מסמך זה הוא תיעוד בלבד. לא בוצעו שינויים בקוד, במבנה הפרויקט או בבסיס הנתונים.

---

## 1. מבנה הפרויקט

### 1.1 סקירה כללית
- **שם הפרויקט:** ProjectFlow Pro (שם פנימי: `base44-app`)
- **סוג:** מערכת לניהול פרויקטים, לקוחות, הצעות מחיר ותזרים מזומנים לעסק אלומיניום
- **פלטפורמה:** Base44 (BaaS — backend-as-a-service)
- **שפת ממשק:** Hebrew (RTL)
- **מספר קבצי מקור:** ~65 קבצי React/JS + ~20 קבצי Entity schema (JSONC)

### 1.2 מבנה תיקיות
```
src/
├── App.jsx                    # Router + Auth gate
├── Layout.jsx                 # Sidebar navigation + RTL layout
├── main.jsx                   # React entry point
├── index.css                  # Tailwind + design tokens
├── pages.config.js            # Auto-generated page routing config (legacy)
├── pages/                     # 11 page components
├── components/
│   ├── ui/                    # shadcn/ui primitives (~40 components)
│   ├── dashboard/             # 6 dashboard widgets
│   ├── finance/              # 1 component (PartnerSettlement)
│   ├── project/               # 2 components (ProfitabilityReport, MaterialOrdersTab)
│   ├── quotes/                # 7 components (editor, modals, cards)
│   ├── models/                # 1 component (ModelComponentsTab)
│   ├── templates/             # 1 component (TemplateComponentsManager)
│   ├── agent/                 # 1 component (SmartFocusCard)
│   └── lib/                   # 4 logic modules (pure functions)
├── lib/                       # Auth context, utils, query-client, app-params
└── utils/index.ts             # createPageUrl helper
base44/
├── config.jsonc               # App metadata
└── entities/                  # 20 entity schema files (JSONC)
```

---

## 2. טכנולוגיות

### 2.1 Frontend Stack
| טכנולוגיה | גרסה | שימוש |
|-----------|-------|-------|
| React | ^18.2.0 | UI framework |
| Vite | ^6.1.0 | Build tool + dev server |
| React Router DOM | ^6.26.0 | Client-side routing |
| Tailwind CSS | ^3.4.17 | Styling |
| shadcn/ui (Radix UI) | ~40 components | UI component library |
| TanStack React Query | ^5.84.1 | Server state / data fetching |
| Lucide React | ^0.475.0 | Icons |
| date-fns | ^3.6.0 | Date formatting (he locale) |
| Recharts | ^2.15.4 | Charts (Bar, Pie, Line) |
| html2canvas + jsPDF | ^1.4.1 / ^4.0.0 | PDF generation from HTML |

### 2.2 Backend Stack
| טכנולוגיה | שימוש |
|-----------|-------|
| Base44 SDK (@base44/sdk ^0.8.41) | Database, Auth, Integrations |
| @base44/vite-plugin ^1.0.30 | Build plugin, HMR, navigation |

### 2.3 חבילות נוספות מותקנות (לא בשימוש בקוד הנסרק)
`react-hook-form`, `zod`, `framer-motion`, `three`, `react-leaflet`, `@hello-pangea/dnd`, `react-quill`, `@stripe/*`, `canvas-confetti`, `moment`, `next-themes`

---

## 3. מסכים ומודולים

### 3.1 רשימת מסכים (Pages)

| # | מסך | נתיב | תיאור |
|---|------|-------|--------|
| 1 | **Dashboard** | `/` | דשבורד ראשי: סיכום יומי, KPIs, פרויקטים פעילים, תזכורות, רווחיות |
| 2 | **Customers** | `/Customers` | ניהול לקוחות: CRUD, סינון, ספירת פרויקטים |
| 3 | **Projects** | `/Projects` | רשימת פרויקטים: CRUD, סינון, כרטיסים פיננסיים |
| 4 | **ProjectDetails** | `/ProjectDetails?id={id}` | ניהול פרויקט בודד: טאבים (תשלומים, הזמנות, הצעות, מסמכים, תזכורות, הזמנות חומר) |
| 5 | **Quotes** | `/Quotes` | רשימת הצעות מחיר + יצירה + מחיקה |
| 6 | **QuoteEditor** | `/QuoteEditor?quote_id={id}` | עורך הצעות מחיר: פריטים, רכיבים, חישובים, PDF, תבניות |
| 7 | **ModelPricing** | `/ModelPricing` | קטלוג דגמים + תבניות + רכיבי ייצור |
| 8 | **CompanyHeaders** | `/CompanyHeaders` | כותרות הדפסה (לוגו + שם חברה) |
| 9 | **Finance** | `/Finance` | ניתוח פיננסי: תרשימים, חובות, התחשבנות שותפים |
| 10 | **Reminders** | `/Reminders` | ניהול תזכורות: טאבים לפי סטטוס, סינון דחיפות |
| 11 | **BusinessAgent** | `/BusinessAgent` | ניהול חכם: התראות, Smart Focus, הגדרות סוכן |

### 3.2 מודולים פונקציונליים

1. **מודול לקוחות** — CRUD מלא, סינון (פרטי/קבלן), חיפוש, קישור לפרויקטים
2. **מודול פרויקטים** — CRUD מלא, סטטוסים (8 שלבי עבודה), סגירת התחשבנות
3. **מודול תשלומי לקוחות** — CRUD מלא, סוגי תשלום (מקדמה/ביניים/סופי), אמצעי תשלום, שותף קולט
4. **מודול הזמנות ספקים** — CRUD מלא, סוג (אלומיניום/פרזול/זכוכית/תוספות), תשלום חלקי, שותף משלם
5. **מודול הצעות מחיר** — הצעה ראשונית + תוספות, סטטוס (טיוטה/נשלח/אושר/נדחה), העלאת PDF
6. **עורך הצעות מחיר** — פריטים עם מידות, רכיבים מקטלוג, חישוב מ"ר/מ' רץ/יחידה, הנחה, מע"מ, ייצוא PDF
7. **מודול תבניות הצעות** — שמירה וטעינה, מחירי snapshot או קטלוג
8. **מודול קטלוג דגמים** — רכיבי תמחור, קטגוריות, שיטות חישוב
9. **מודול רכיבי ייצור** — חישוב אורך/רוחב לפי מידות פתיחה, מנוע נוסחאות דו-שלבי
10. **מודול הזמנות חומר** — יצירה אוטומטית מרכיבי דגמים, סיכום כמויות ואורכים
11. **מודול מסמכים** — CRUD, העלאת קבצים, סוגי מסמכים
12. **מודול תזכורות** — CRUD, דחיפויות (גבוהה/בינונית/נמוכה), סטטוס (פתוח/בוצע/נדחה)
13. **מודול פיננסים** — תרשימים (הכנסות/הוצאות/רווח), חובות לקוחות, חובות ספקים, סינון תאריכים
14. **מודול התחשבנות שותפים** — חישוב cash-basis, פרויקטים סגורים בלבד, העברות בין-שותפים, הוצאות כלליות
15. **מודול ניהול חכם (Agent)** — התראות אוטומטיות, Smart Focus, ניקוד עדיפות, הגדרות
16. **מודול כותרות הדפסה** — לוגו + שם חברה + כיתוב, ברירת מחדל
17. **מודול סיכום בוקר** — תצוגה יומית, dismiss עם localStorage

---

## 4. Components (רכיבי UI)

### 4.1 Components עסקיים (24)

#### Dashboard (6)
| רכיב | קובץ | תיאור |
|------|------|--------|
| StatsCard | `dashboard/StatsCard.jsx` | כרטיס KPI עם variant (default/success/warning/danger/primary) |
| ActiveProjectsTable | `dashboard/ActiveProjectsTable.jsx` | טבלת פרויקטים פעילים עם יתרה ואיחור |
| RemindersWidget | `dashboard/RemindersWidget.jsx` | ווידג'ט תזכורות פתוחות (top 5), סימון כבוצע |
| ProfitabilityChart | `dashboard/ProfitabilityChart.jsx` | תרשים רווחיות אופקי (Bar chart, top 8) |
| MorningSummary | `dashboard/MorningSummary.jsx` | סיכום יומי עם dismiss (localStorage), 4 מדדים |
| ProjectStatusBadge | `dashboard/ProjectStatusBadge.jsx` | Badge צבעוני ל-8 סטטוסים |

#### Quotes (7)
| רכיב | קובץ | תיאור |
|------|------|--------|
| QuoteItemCard | `quotes/QuoteItemCard.jsx` | כרטיס פריט הצעה: מידות, כמות, תיאור, טבלת רכיבים |
| CatalogPickerModal | `quotes/CatalogPickerModal.jsx` | מודל בחירת רכיבים מקטלוג (2 מצבים: quote/template) |
| TemplateModal | `quotes/TemplateModal.jsx` | מודל שמירת פריט כתבנית |
| LoadTemplateModal | `quotes/LoadTemplateModal.jsx` | מודל טעינת תבנית (snapshot/catalog pricing) |
| SelectHeaderModal | `quotes/SelectHeaderModal.jsx` | מודל בחירת כותרת הדפסה |
| QuotePrintView | `quotes/QuotePrintView.jsx` | תצוגת הדפסה A4 (HTML inline styles, RTL) |

#### Project (2)
| רכיב | קובץ | תיאור |
|------|------|--------|
| ProfitabilityReport | `project/ProfitabilityReport.jsx` | דוח רווחיות פנימי להדפסה (gauge, טבלאות) |
| MaterialOrdersTab | `project/MaterialOrdersTab.jsx` | טאב הזמנות חומר: יצירה, סטטוס, מחיקה |

#### Finance (1)
| רכיב | קובץ | תיאור |
|------|------|--------|
| PartnerSettlement | `finance/PartnerSettlement.jsx` | התחשבנות שותפים: 4 טאבים, CRUD שותפים + הוצאות |

#### Agent (1)
| רכיב | קובץ | תיאור |
|------|------|--------|
| SmartFocusCard | `agent/SmartFocusCard.jsx` | כרטיס משימות עדיפות עם סיכום יומי |

#### Models (1)
| רכיב | קובץ | תיאור |
|------|------|--------|
| ModelComponentsTab | `models/ModelComponentsTab.jsx` | ניהול רכיבי ייצור + מחשבון מידות |

#### Templates (1)
| רכיב | קובץ | תיאור |
|------|------|--------|
| TemplateComponentsManager | `templates/TemplateComponentsManager.jsx` | ניהול רכיבי תבנית: הוספה/מחיקה/עריכת מחיר |

#### Shared (1)
| רכיב | קובץ | תיאור |
|------|------|--------|
| Layout | `Layout.jsx` | סיידבר RTL עם 9 פריטי ניווט, mobile drawer |

### 4.2 Logic Modules (4)

| מודול | קובץ | פונקציות ייצוא | תיאור |
|-------|------|-----------------|--------|
| **projectFinancials** | `lib/projectFinancials.jsx` | `calculateProjectFinancials`, `calculateAggregatedFinancials` | חישוב פיננסי מצטבר: מכירה, תקבולים, עלויות, רווח, תזרים |
| **partnerSettlement** | `lib/partnerSettlement.jsx` | `calculateFullPartnerSettlement`, `validateProjectCanClose` | התחשבנות cash-basis, אלגוריתם סילוק חובות, וולידציה |
| **agentLogic** | `lib/agentLogic.jsx` | `analyzeProjectAlerts`, `shouldResolveAlert`, `calculateProjectPriorityScore`, `calculateBaseMetrics` | ניתוח התראות, ניקוד עדיפות 0-100, מדדים בסיסיים |
| **smartFocus** | `lib/smartFocus.jsx` | `generateSmartFocusTasks`, `calculateDailySummary` | מנוע משימות עדיפות (4 סוגי משימות), סיכום יומי |

### 4.3 Lib Utilities

| קובץ | תיאור |
|------|--------|
| `lib/quoteCalculations.js` | חישוב רכיב (sqm/meter/unit), תיאור אוטומטי, labels, colors |
| `lib/formulaEngine.js` | מנוע נוסחאות דו-שלבי לחישוב אורך/רוחב רכיבי ייצור |
| `lib/materialOrderGenerator.js` | יצירת הזמנות חומר מרכיבי דגמים (אסינכרוני, מוחק draft קודם) |
| `lib/AuthContext.jsx` | Auth provider: בדיקת public settings, auth, error handling |
| `lib/query-client.js` | TanStack Query client instance |
| `lib/utils.js` | `cn()` helper (clsx + tailwind-merge) |
| `lib/app-params.js` | App parameters (appId, token) |
| `lib/NavigationTracker.jsx` | עוקב ניווט לאנליטיקה |
| `lib/PageNotFound.jsx` | דף 404 |
| `utils/index.ts` | `createPageUrl()` helper |

### 4.4 shadcn/ui Primitives (~40)
כל הרכיבים ב-`src/components/ui/` — accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, skeleton, slider, sonner, switch, table, tabs, textarea, toggle, toggle-group, tooltip, toaster, use-toast.

---

## 5. Services / API

### 5.1 Base44 SDK
האפליקציה משתמשת ב-Base44 SDK דרך `@/api/base44Client` (pre-initialized client). כל פעולות ה-DB מתבצעות דרך `base44.entities.{EntityName}.{Operation}`.

### 5.2 Entity SDK Operations בשימוש
- `.list()` — רשימת כל הרשומות
- `.list('-created_date')` — רשימה ממוינת
- `.filter({ field: value })` — סינון לפי שדה
- `.get(id)` — שליפה בודדת
- `.create(data)` — יצירה
- `.update(id, data)` — עדכון
- `.delete(id)` — מחיקה

### 5.3 Integrations בשימוש
| Integration | שימוש |
|-------------|-------|
| `Core.UploadFile` | העלאת קבצים (מסמכים, PDF, לוגו) |

### 5.4 אינטגרציות חיצוניות / Connectors
- **אין connectors מאושרים** (OAuth)
- **אין backend functions** ב-`base44/functions/`
- **אין workflows** ב-`base44/workflows/`
- **אין agents** ב-`base44/agents/`

---

## 6. Hooks

### 6.1 Custom Hooks
- `useAuth()` — מ-`@/lib/AuthContext` — מחזיר `{ user, isAuthenticated, isLoadingAuth, isLoadingPublicSettings, authError, appPublicSettings, logout, navigateToLogin, checkAppState }`

### 6.2 Hooks בשימוש (React + ספריות)
- `useState`, `useEffect`, `useMemo`, `useRef`
- `useQuery`, `useMutation`, `useQueryClient` (TanStack React Query)
- `useContext` (דרך AuthContext)

---

## 7. Routes

### 7.1 טבלת ניתוב מלאה

| נתיב | רכיב | מקור רישום | Layout |
|-------|------|------------|--------|
| `/` | Dashboard | pagesConfig (mainPage) | ✓ LayoutWrapper |
| `/BusinessAgent` | BusinessAgent | pagesConfig loop | ✓ LayoutWrapper |
| `/Customers` | Customers | pagesConfig loop | ✓ LayoutWrapper |
| `/Finance` | Finance | pagesConfig loop | ✓ LayoutWrapper |
| `/ProjectDetails` | ProjectDetails | pagesConfig loop | ✓ LayoutWrapper |
| `/Projects` | Projects | pagesConfig loop | ✓ LayoutWrapper |
| `/Reminders` | Reminders | pagesConfig loop | ✓ LayoutWrapper |
| `/Quotes` | Quotes | **Route מפורש** ב-App.jsx | ✓ LayoutWrapper |
| `/QuoteEditor` | QuoteEditor | **Route מפורש** ב-App.jsx | ✓ LayoutWrapper |
| `/ModelPricing` | ModelPricing | **Route מפורש** ב-App.jsx | ✓ LayoutWrapper |
| `/CompanyHeaders` | CompanyHeaders | **Route מפורש** ב-App.jsx | ✓ LayoutWrapper |
| `*` | PageNotFound | catch-all | ללא Layout |

### 7.2 הערת ניתוב חשובה
הקבצים `Quotes`, `QuoteEditor`, `ModelPricing`, `CompanyHeaders` רשומים כ-`<Route>` מפורשים ב-`App.jsx` **מחוץ** ללולאת pagesConfig, ואינם מופיעים ב-`pages.config.js`. יש לשמור עליהם בעת שינוי ה-router.

### 7.3 Auth Gate
כל הראוטים עטופים ב-`<AuthProvider>` → `AuthenticatedApp` שבודק:
1. `isLoadingPublicSettings` / `isLoadingAuth` → spinner
2. `authError` → `UserNotRegisteredError` או redirect ל-login
3. רינדור `<Routes>`

---

## 8. מבנה בסיס הנתונים

### 8.1 סקירה
בסיס הנתונים מנוהל על-ידי Base44. כל entity מוגדרת כ-JSON Schema ב-`base44/entities/{Name}.jsonc`. שדות מובנים בכל רשומה (לא מוגדרים ב-schema): `id`, `created_date`, `updated_date`, `created_by_id`.

### 8.2 שדות מערכת (Built-in)
| שדה | סוג | תיאור |
|------|-----|--------|
| id | string | מזהה ייחודי |
| created_date | datetime | תאריך יצירה |
| updated_date | datetime | תאריך עדכון אחרון |
| created_by_id | string | מזהה יוצר |

### 8.3 Row Level Security (RLS)
- **לא מוגדר** באף entity — כל הרשומות נגישות לכל משתמש מאומת.
- ישות `User` משתמשת ב-RLS מובנה של הפלטפורמה (admin/user).

---

## 9. ישויות (Entities) — 20 ישויות

### 9.1 טבלת ישויות

| # | Entity | שדות נדרשים | תיאור |
|---|--------|-------------|--------|
| 1 | **Customer** | name, customer_type, phone | לקוח (פרטי/קבלן), סטטוס active/inactive |
| 2 | **Project** | name, customer_id, customer_name, status | פרויקט: 8 סטטוסים, סגירת התחשבנות |
| 3 | **ProjectQuote** | project_id, addition_number, amount | הצעה/תוספת: 4 סטטוסים, מע"מ, הנחה |
| 4 | **QuoteItem** | quote_id, quantity | פריט הצעה: מידות (ס"מ), כמות, תיאור |
| 5 | **QuoteItemComponent** | quote_item_id, name_snapshot, pricing_method_snapshot, price_snapshot | רכיב פריט: snapshot שם/מחיר, כמות |
| 6 | **ClientPayment** | project_id, payment_type, amount, payment_date | תשלום לקוח: 3 סוגים, 4 אמצעים, שותף קולט |
| 7 | **SupplierOrder** | project_id, order_type, supplier_name, order_amount | הזמנת ספק: 4 סוגים, 4 סטטוסים, שותף משלם |
| 8 | **Document** | project_id, document_type, name, file_url | מסמך: 5 סוגים |
| 9 | **Reminder** | title, due_date, priority | תזכורת: 3 דחיפויות, 3 סטטוסים |
| 10 | **Partner** | name, profit_share_percent | שותף: אחוז שותפות, active |
| 11 | **GeneralExpense** | description, amount, expense_date, paid_by_partner_id | הוצאה כללית: 5 קטגוריות, שותף משלם |
| 12 | **ModelPricing** | model_name, category, pricing_method, base_price | דגם/רכיב קטלוג: 9 קטגוריות, 4 שיטות תמחור |
| 13 | **ModelComponent** | model_id, component_type, item_code, quantity | רכיב ייצור: 4 סוגים, מנוע נוסחאות (length/width) |
| 14 | **QuoteTemplate** | name | תבנית הצעה |
| 15 | **QuoteTemplateComponent** | template_id, name_snapshot, pricing_method_snapshot, price_snapshot | רכיב תבנית: snapshot |
| 16 | **MaterialOrder** | project_id, order_type | הזמנת חומר: 3 סוגים (profiles/hardware/glass), 3 סטטוסים |
| 17 | **MaterialOrderItem** | material_order_id, item_code, total_quantity | פריט הזמנת חומר: כמות + אורך כולל |
| 18 | **AgentSettings** | (אין שדות נדרשים) | הגדרות סוכן: 9 פרמטרים |
| 19 | **AgentAlert** | alert_key, alert_type, severity, message | התראה: 5 סוגים, 4 חומרות, 6 סוגי פעולה |
| 20 | **CompanyHeader** | name | כותרת הדפסה: לוגו, שם חברה, כיתוב |

---

## 10. פיצ'רים שעובדים במלואם

1. ✅ **ניהול לקוחות** — CRUD מלא, סינון, חיפוש, קישור לפרויקטים
2. ✅ **ניהול פרויקטים** — CRUD מלא, 8 סטטוסים, סגירת/פתיחת התחשבנות
3. ✅ **ניהול תשלומי לקוחות** — CRUD מלא, 3 סוגים, 4 אמצעים, שותף קולט
4. ✅ **ניהול הזמנות ספקים** — CRUD מלא, 4 סוגים, 4 סטטוסים, שותף משלם
5. ✅ **ניהול הצעות מחיר (רשימה)** — CRUD מלא, יצירה מפרויקט, מחיקה
6. ✅ **ניהול הצעות מחיר (ProjectDetails)** — הצעה ראשונית + תוספות, העלאת PDF, מחיקה
7. ✅ **עורך הצעות מחיר מפורט** — פריטים, רכיבים, מידות, חישובים, הנחה, מע"מ, ייצוא PDF
8. ✅ **קטלוג דגמים/רכיבים** — CRUD מלא, קטגוריות, שיטות תמחור
9. ✅ **רכיבי ייצור** — CRUD מלא, מנוע נוסחאות דו-שלבי, מחשבון מידות
10. ✅ **תבניות הצעות** — יצירה מקטלוג/מפריט, טעינה (snapshot/catalog), CRUD רכיבים
11. ✅ **הזמנות חומר** — יצירה אוטומטית מרכיבי דגמים, סטטוס, מחיקה
12. ✅ **ניהול מסמכים** — CRUD מלא, העלאת קבצים, 5 סוגים
13. ✅ **ניהול תזכורות** — CRUD מלא, 3 דחיפויות, 3 סטטוסים, סינון
14. ✅ **כותרות הדפסה** — CRUD מלא, לוגו, ברירת מחדל
15. ✅ **דוח רווחיות פנימי** — הדפסה, gauge, טבלאות תשלומים/עלויות/תזרים
16. ✅ **פיננסים** — תרשימים (Bar/Pie/Line), חובות לקוחות/ספקים, סינון תאריכים
17. ✅ **התחשבנות שותפים** — cash-basis, פרויקטים סגורים, העברות, הוצאות כלליות, CRUD שותפים
18. ✅ **סיכום בוקר** — 4 מדדים, dismiss יומי
19. ✅ **ניהול חכם (Agent)** — התראות, Smart Focus, ניקוד עדיפות, הגדרות
20. ✅ **חישובים פיננסיים מרכזיים** — `calculateProjectFinancials` משמש את כל המודולים
21. ✅ **ולידציית סגירת פרויקט** — בדיקת יתרות לפני סגירת התחשבנות
22. ✅ **RTL** — כל הממשק בעברית, RTL, date-fns he locale
23. ✅ **Auth** — בדיקת auth + public settings, redirect ל-login, UserNotRegisteredError

---

## 11. פיצ'רים שקיימים חלקית

1. ⚠️ **מודל הזמנות חומר** — יצירה אוטומטית עובדת, אך **אין ייצוא PDF** להזמנות חומר (רק תצוגת טבלה)
2. ⚠️ **ניהול חכם (Agent)** — התראות נוצרות ידנית (לחצור "הרץ ניתוח"), **אין אוטומציה** (no workflows/scheduled triggers)
3. ⚠️ **סיכום בוקר** — מבוסס localStorage (לא נשמר בשרת), מופיע פעם ביום לפי `toDateString()`
4. ⚠️ **הדפסת הצעת מחיר** — ייצוא PDF דרך html2canvas + jsPDF (תמונה, לא טקסט נבחר), תמיכה בכותרת חברה
5. ⚠️ **ניווט mobile** — סיידבר מתקפל (drawer), אך **אין ניווט תחתון** (bottom nav)
6. ⚠️ **חיפוש בקטלוג** — חיפוש טקסט חופשי בלבד, **אין חיפוש לפי קוד פריט** ב-CatalogPickerModal
7. ⚠️ **עריכת פריט הצעה** — ניתן לערוך מחיר רכיב וכמות inline, אך **לא ניתן לשנות סדר פריטים** (drag-and-drop)

---

## 12. פיצ'רים חסרים

1. ❌ **אין RLS** — כל הנתונים נגישים לכל משתמש מאומת (לא מוגדר הרשאות לפי משתמש/תפקיד)
2. ❌ **אין אוטומציה / Workflows** — אין triggers מתוזמנים, אין entity triggers, אין connector triggers
3. ❌ **אין backend functions** — כל הלוגיקה ב-front-end
4. ❌ **אין אינטגרציות חיצוניות** — אין OAuth connectors, אין שליחת אימייל, אין חיבור לחשבשבת/WhatsApp
5. ❌ **אין דוחות מתקדמים** — אין ייצוא Excel, אין דוחות מותאמים אישית
6. ❌ **אין ניהול מלאי** — אין מעקב מלאי בפועל
7. ❌ **אין חשבוניות מס / קבלות** — רק תיעוד תשלומים, לא יצירת מסמכים רשמיים
8. ❌ **אין מולטי-טננט** — מערכת single-tenant
9. ❌ **אין ניהול גרסאות** — אין versioning להצעות מחיר (רק addition_number)
10. ❌ **אין הודעות / נוטיפיקציות** — רק התראות ב-DB (AgentAlert), אין push/email notifications
11. ❌ **אין Dark Mode** — tokens מוגדרים ב-index.css אך אין מעבר dark mode ב-UI
12. ❌ **אין בדיקות (Tests)** — אין קבצי test
13. ❌ **אין ניהול משתמשים** — רק admin יכול להזמין משתמשים (platform built-in)
14. ❌ **אין חישוב עמלות / מע"מ מתקדם** — מע"מ קבוע 17%, אין התאמה
15. ❌ **אין היסטוריית שינויים** — אין audit log / change tracking

---

## 13. תלות בין מודולים

### 13.1 גרף תלות (Component → Logic)

```
Dashboard
├── projectFinancials.calculateProjectFinancials
├── ActiveProjectsTable → projectFinancials
├── ProfitabilityChart → projectFinancials
├── MorningSummary → projectFinancials
└── RemindersWidget (standalone)

Projects
├── projectFinancials.calculateProjectFinancials
└── ProjectStatusBadge (shared)

ProjectDetails
├── projectFinancials.calculateProjectFinancials
├── partnerSettlement.validateProjectCanClose
├── ProfitabilityReport → projectFinancials
├── MaterialOrdersTab → materialOrderGenerator
│   └── materialOrderGenerator → formulaEngine.calculateComponents (indirect)
├── PaymentsSection (inline component)
├── OrdersSection (inline component)
├── QuotesSection (inline component)
├── DocumentsSection (inline component)
└── RemindersSection (inline component)

Finance
├── projectFinancials.calculateProjectFinancials
└── PartnerSettlement → partnerSettlement.calculateFullPartnerSettlement
    └── → projectFinancials.calculateProjectFinancials

BusinessAgent
├── projectFinancials.calculateProjectFinancials
├── agentLogic (analyzeProjectAlerts, shouldResolveAlert, calculateProjectPriorityScore, calculateBaseMetrics)
├── smartFocus (generateSmartFocusTasks, calculateDailySummary)
│   └── → projectFinancials.calculateProjectFinancials
└── SmartFocusCard (presentation)

QuoteEditor
├── quoteCalculations (calcComponentValue, calcItemTotal, generateDescription)
├── QuoteItemCard → quoteCalculations
├── CatalogPickerModal → quoteCalculations (CATEGORY_LABELS, CATEGORY_COLORS)
├── QuotePrintView → quoteCalculations
└── html2canvas + jsPDF (PDF export)

ModelPricing
├── quoteCalculations (CATEGORY_LABELS, CATEGORY_COLORS)
├── ModelComponentsTab → formulaEngine (calculateComponents)
├── CatalogPickerModal (template mode)
└── TemplateComponentsManager → CatalogPickerModal
```

### 13.2 תלות נתונים (Entity → Entity)

```
Customer ←→ Project (customer_id)
Project → ProjectQuote (project_id)
Project → ClientPayment (project_id)
Project → SupplierOrder (project_id)
Project → Document (project_id)
Project → Reminder (project_id)
Project → MaterialOrder (project_id)

ProjectQuote → QuoteItem (quote_id)
QuoteItem → QuoteItemComponent (quote_item_id)
QuoteItemComponent → ModelPricing (catalog_item_id, snapshot)
ModelPricing → ModelComponent (model_id)

QuoteTemplate → QuoteTemplateComponent (template_id)
QuoteTemplateComponent → ModelPricing (catalog_item_id, snapshot)

MaterialOrder → MaterialOrderItem (material_order_id)

ClientPayment → Partner (received_by_partner_id)
SupplierOrder → Partner (paid_by_partner_id)
GeneralExpense → Partner (paid_by_partner_id)

Project → Partner (settlement: closed_by — hardcoded "מנהל")

AgentAlert → Project (project_id, alert_key)
AgentSettings → (standalone, single record)
CompanyHeader → (standalone)
```

### 13.3 Query Key תלות (React Query)

| Query Key | נצרך על-ידי |
|-----------|-------------|
| `['projects']` | Dashboard, Projects, ProjectDetails, Finance, BusinessAgent, Customers, Reminders |
| `['all-payments']` | Dashboard, Finance |
| `['all-orders']` | Dashboard, Finance |
| `['all-quotes']` | Dashboard, Finance, Quotes, QuoteEditor |
| `['customers']` | Customers, Projects, BusinessAgent |
| `['partners']` | ProjectDetails, PartnerSettlement |
| `['general-expenses']` | PartnerSettlement |
| `['reminders']` | Reminders, Dashboard |
| `['agent-alerts']` | BusinessAgent, MorningSummary |
| `['agent-settings']` | BusinessAgent, MorningSummary |
| `['project', id]` | ProjectDetails |
| `['project-payments', id]` | ProjectDetails |
| `['project-orders', id]` | ProjectDetails |
| `['project-documents', id]` | ProjectDetails |
| `['project-reminders', id]` | ProjectDetails |
| `['project-quotes', id]` | ProjectDetails |
| `['quote', id]` | QuoteEditor |
| `['quote-items', id]` | QuoteEditor |
| `['quote-item-components', id]` | QuoteEditor |
| `['catalog-items']` | QuoteEditor, ModelPricing |
| `['quote-templates']` | QuoteEditor, ModelPricing |
| `['company-headers']` | QuoteEditor, CompanyHeaders |
| `['material-orders', id]` | MaterialOrdersTab |
| `['material-order-items', id]` | MaterialOrdersTab |
| `['model-components', id]` | ModelComponentsTab |
| `['all-model-components']` | ModelPricing |
| `['all-template-components']` | ModelPricing, TemplateComponentsManager |

---

## 14. באגים ידועים / מגבלות

### 14.1 מגבלות ארכיטקטורה
1. **כל הלוגיקה ב-front-end** — אין server-side validation; נתונים נשלפים ב-full list ומסוננים ב-client (לא מותאם לנפחי נתונים גדולים)
2. **N+1 queries** — `materialOrderGenerator.js` ו-`QuoteEditor` מבצעים `Promise.all` עם `filter()` לכל פריט/רכיב בנפרד (בעיית ביצועים פוטנציאלית)
3. **Snapshot pricing** — רכיבי הצעה שומרים מחיר כ-snapshot; שינוי מחיר בקטלוג לא משפיע על הצעות קיימות (by design)

### 14.2 מגבלות ידועות
4. **MorningSummary** — משתמש ב-`localStorage` ל-dismiss, לא מסונכרן בין מכשירים
5. **Agent alerts** — נוצרות ידנית בלבד; `runAnalysisMutation` משתמש ב-`await` בלולאה (sequential, לא parallel) — עלול להיות איטי
6. **ProjectDetails** — `useMemo` ל-`financials` מחושב לפני early return (תוקן כבר, Rules of Hooks מתואם)
7. **מספר פרויקט** — `P${Date.now().toString().slice(-6)}` — עלול להיות לא ייחודי במקרה קיצון
8. **addition_number** — מחושב כ-`quotes.length` ביצירה, עלול להיות שגוי אם יש מחיקות (לא מספר רץ אמיתי)
9. **PDF export** — `html2canvas` מייצא תמונה (לא טקסט), גודל קובץ גדול, לא ניתן לחפש בו
10. **`closed_by`** — מקודד קשיח כ-"מנהל" ב-`closeSettlementMutation` (לא משתמש ב-user הנוכחי)
11. **Query Key mismatch** — Dashboard ו-MorningSummary משתמשים ב-`['quotes']` ו-`['payments']` ו-`['orders']`, בעוד שאר המערכת משתמשת ב-`['all-quotes']` ו-`['all-payments']` ו-`['all-orders']` — **עלול לגרום ל-caching כפול ונתונים לא מסונכרנים**

### 14.3 אבטחה
12. **אין RLS** — כל משתמש מאומת יכול לקרוא/כתוב/מחוק את כל הנתונים
13. **אין validation server-side** — כל ה-validation ב-front-end
14. **`window.confirm()`** — שימוש נרחב ב-`window.confirm()` למחיקות (לא UX אופטימלי, אך עובד)

---

## 15. אזורים שדורשים תיעוד נוסף

1. **מודל התחשבנות שותפים** — הלוגיקה ב-`partnerSettlement.jsx` מורכבת (cash-basis, אלגוריתם סילוק חובות); התיעוד המובנה בקוד (JSDoc) חלקי
2. **מנוע נוסחאות רכיבי ייצור** — `formulaEngine.js` — אין תיעוד של תרחישי שימוש ודוגמאות
3. **מנוע Smart Focus** — `smartFocus.jsx` — נוסחאות הניקוד מתועדות חלקית (הערות inline), אך אין הסבר על סדר העדיפויות העסקי
4. **מנוע ניתוח התראות** — `agentLogic.jsx` — ספי חומרה ותנאים מתועדים, אך אין מסמך עסקי
5. **חישובים פיננסיים** — `projectFinancials.jsx` — מודל "הצעה מצטברת" (initial + additions) מתועד ב-JSDoc, אך אין דיאגרמה
6. **יצירת הזמנות חומר** — `materialOrderGenerator.js` — תהליך מורכב (6 שלבים), אין דיאגרמת זרימה
7. **מערכת ניתוב** — `pages.config.js` מול `App.jsx` — המנגנון הדואלי (auto-generated + explicit routes) עלול לבלבל
8. **Query Key convention** — אין מסמך מרכזי של query keys; חלק מהמפתחות לא עקביים (`['quotes']` מול `['all-quotes']`)

---

## 16. הערכת יכולת הפקת מסמכי Handover

| מסמך | האם ניתן להפיק? | הערה |
|-------|------------------|------|
| **PRD** | ✅ כן | כל הפיצ'רים, המודולים והמסכים ממופים. ניתן להפיק PRD מלא מתוך ה-audit. |
| **Architecture** | ✅ כן | מבנה הפרויקט, הטכנולוגיות, התלותים, ה-routing וה-query keys ממופים. ניתן להפיק דיאגרמת ארכיטקטורה. |
| **ERD** | ✅ כן | כל 20 הישויות עם שדות, סוגים, enums, required fields, וקשרים בין ישויות — ממופים במלואם. |
| **Database Schema** | ✅ כן | כל קבצי `base44/entities/*.jsonc` נסרקו ומתועדים. הסכמות מלאות (JSON Schema). |
| **API Documentation** | ⚠️ חלקי | ה-SDK operations בשימוש מתועדות (list/filter/create/update/delete). אין backend functions או endpoints מותאמים אישית. ה-API הוא Base44 SDK בלבד. ניתן להפיק מסמכי API אך הם יתארו את ה-SDK הסטנדרטי. |
| **Business Logic** | ✅ כן | כל מודולי הלוגיקה נסרקו ומתועדים. חישובים פיננסיים, התחשבנות, ניקוד, וחישובי רכיבים — מלאים. |
| **Deployment Guide** | ⚠️ חלקי | פרטי ה-build (`vite build`, `outputDirectory: ./dist`) מתועדים ב-`base44/config.jsonc`. ה-deployment מתבצע על Base44. אין מסמך deployment מפורט (CI/CD, environments, secrets) — חסר. ניתן להפיק מדריך בסיסי מתוך `config.jsonc` + `package.json`. |

### סיכום
- **5 מתוך 7 מסמכים** ניתנים להפקה מלאה מתוך הקוד (PRD, Architecture, ERD, Database Schema, Business Logic).
- **2 מסמכים** ניתנים להפקה חלקית (API Documentation, Deployment Guide) — דורשים השלמה ידנית.
- **נתונים חסרים עיקריים:** אין backend functions, אין workflows, אין secrets מוגדרים, אין CI/CD, אין environment variables מתועדים, אין tests, אין RLS, אין מסמכי API מותאמים אישית.

---

> **סוף מסמך** — ProjectFlow Pro Project Audit, 2026-08-01