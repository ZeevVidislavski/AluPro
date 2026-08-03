# CLAUDE_MIGRATION_REVIEW.md

## תוכנית Migration מעשית — יציאה מ-Base44

> **תאריך:** 2026-08-03
> **סוג מסמך:** תוכנית בלבד. **לא בוצע שום שינוי קוד, לא נוצר Database, לא הותקנו חבילות.**
> **קלט:** `AUDIT_REPORT_2026-08-03.md`, `DATABASE_MIGRATION.md`, `BACKEND_MIGRATION_PLAN.md`, `SECURITY_MODEL.md`, `STORAGE_MIGRATION.md`, `MIGRATION_MASTER_PLAN.md` + קריאה ישירה בקוד (ראה נספח אימות).
> **הקשר עסקי:** אין נתוני Production אמיתיים ב-Base44 כרגע — כלומר **אין צורך בתסריט cutover עם חלון תחזוקה/הקפאת כתיבות/מיגרציית משתמשים אמיתיים**. זהו יתרון גדול: אפשר לבנות את המערכת החדשה נכון מההתחלה בלי לגרור באגים היסטוריים או לתאם downtime עם לקוחות.

כל החלטה כתובה בפורמט אחיד: **אפשרויות → יתרונות → חסרונות → המלצה → סיכון → מה צריך לאמת בקוד**.

---

## ממצא מקדים חשוב — פער בין מסמכי היעד לקוד בפועל

מסמכי היעד (`DATABASE_MIGRATION.md` וכו') תוכננו כאילו יש כבר Production עם נתונים אמיתיים ומשתמשים פעילים (סעיפי cutover, "T-7 ימים הקפאת פיתוח", "תקשורת למשתמשים על reset סיסמאות"). **מכיוון שאין נתוני Production אמיתיים**, כל השלבים האלו מיותרים ברובם. תוכנית זו שונה מ-`MIGRATION_MASTER_PLAN.md` בכך שהיא **לא כוללת cutover בסגנון "שבת לילה"** — אפשר לבנות את המערכת החדשה כפרויקט חדש, ולבצע ולידציה + החלפה הדרגתית ללא לחץ זמן.

בנוסף אומת בקוד (ולא רק במסמכים) קשר חשוב שהמסמכים לא מדגישים מספיק: `QuoteItemComponent.catalog_item_id` מצביע על `ModelPricing`, וממנו `ModelComponent.model_id` מצביע חזרה לאותו `ModelPricing.id`. זהו **קשר דו-שלבי** (`QuoteItemComponent → ModelPricing → ModelComponent`) שקריטי להזמנות חומר (`materialOrderGenerator.js` עושה בדיוק את המעבר הזה) — יש לוודא שהוא מיוצג נכון בסכמה החדשה.

---

## 1. React+Vite או Next.js?

**אפשרויות:**
- **A. להישאר עם React+Vite (SPA)**
- **B. לעבור ל-Next.js (App Router, SSR/API Routes)**

**יתרונות A (React+Vite):**
- אפס שינוי בכל 11 המסכים, כל ה-routing, וה-146 קבצי קוד הקיימים.
- Vite כבר עובד, מהיר, מוכר לצוות.
- אין צורך ללמוד מודל render חדש (SSR/RSC) על אפליקציה שהיא בעיקרה CRUD פנימי (לא צריכה SEO — היא CRM פנימי מאחורי login).

**חסרונות A:**
- אין API Routes מובנה — צריך backend נפרד (Vercel Functions עצמאיות, או שרת Node נפרד) ו-CORS מתאים.
- אין SSR — לא רלוונטי כרגע (אין דרישת SEO), אך גם לא יהיה בעתיד בלי מיגרציה נוספת.

**יתרונות B (Next.js):**
- API Routes + Frontend באותו repo/deploy — פחות תשתית נפרדת.
- Middleware מובנה לבדיקת JWT לפני render.

**חסרונות B:**
- שכתוב מלא של ה-routing (React Router → App Router), כולל שינוי כל page component ל-convention של Next.
- עקומת למידה + סיכון רגרסיה על מערכת שעובדת.
- CRM פנימי לא נהנה מרוב היתרונות של Next (SEO, ISR, Edge rendering) — התועלת נמוכה ביחס לעלות.

**המלצה:** **להישאר עם React+Vite**, ולהוסיף Backend נפרד (Vercel Serverless Functions או Express קטן) כ-API layer. השינוי הנדרש הוא רק בשכבת הנתונים (`base44.entities.X` → `XService.X`), לא בשכבת ה-UI/routing. מעבר ל-Next.js הוא פרויקט שכתוב שלא מוצדק ע"י שום צורך עסקי שזוהה.

**סיכון:** נמוך (בהישארות ב-Vite) / גבוה (במעבר ל-Next — regression על 11 מסכים ו-~65 קבצי React).

**מה צריך לאמת בקוד:** לא נדרש אימות נוסף — ההחלטה תלויה בדרישה עסקית (SEO/SSR) שלא זוהתה בקוד או בשיחה עם המשתמש. **שאלה פתוחה למשתמש:** האם יש בעתיד הקרוב תוכנית ל-landing page ציבורי הדורש SEO? אם לא — ההמלצה עומדת.

---

## 2. PostgreSQL + Prisma?

**אפשרויות:**
- **A. PostgreSQL + Prisma ORM**
- **B. PostgreSQL + query builder קל יותר (Drizzle / Kysely)**
- **C. להישאר עם NoSQL כלשהו (MongoDB / Firestore)**

**יתרונות A:**
- הנתונים **מובהק רלציוניים** — אומת בקוד: `Project → ProjectQuote → QuoteItem → QuoteItemComponent`, וגם `QuoteItemComponent.catalog_item_id → ModelPricing → ModelComponent` (דו-שלבי, ראה לעיל). זה בדיוק המקרה שבו SQL + FK נכון.
- Prisma type-safe, migrations מובנות, תמיכה טובה ב-Vercel/Supabase.
- כל 20 ה-schemas הקיימים (`base44/entities/*.jsonc`) כבר ממופים ל-Prisma models מלאים ב-`DATABASE_MIGRATION.md` — עבודת מיפוי כבר בוצעה, לא צריך להתחיל מאפס.

**חסרונות A:**
- עקומת למידה אם הצוות לא מכיר Prisma (לא אומת — לא ידוע רמת ההיכרות).
- Migrations דורשות משמעת (אין להריץ prisma migrate ללא review).

**יתרונות B (Drizzle):** קליל יותר, SQL-first, פחות "magic". **חסרונות B:** פחות בשל, community קטנה יותר, docs פחות מקיפים.

**יתרונות C (NoSQL):** התאמה כמעט 1:1 ל-Base44 (פחות שינוי מבני). **חסרונות C:** מוותר בדיוק על מה שה-migration אמור לתקן — FK אמיתיים, ייחודיות (`@@unique`), JOIN יעיל במקום N+1 (ראה סעיף 8 להלן).

**המלצה:** **PostgreSQL + Prisma**, כפי שכבר תוכנן ב-`DATABASE_MIGRATION.md`. הסכמה שם כבר פותרת בעיות אמיתיות שזוהו בקוד:
- `pricing_method_snapshot` ב-`QuoteItemComponent`/`QuoteTemplateComponent` הוא `[sqm, meter, unit]` — **אומת בקוד**, בעוד `ModelPricing.pricing_method` הוא `[sqm, meter_width, meter_height, unit]` — **אומת בקוד, אי-התאמה אמיתית, לא רק חשד תיאורטי**. יש לתקן זאת בסכמה החדשה (Enum מאוחד) *לפני* שממירים, כפי שממילא מומלץ ב-`DATABASE_MIGRATION.md` סעיף 2.6.
- `Decimal(12,2)` לשדות פיננסיים במקום `Float` — כל שדה `amount`/`price`/`quote` היום הוא `"type": "number"` ללא הבחנה — **אומת** בכל קובצי ה-entities שנקראו (Project, ProjectQuote, ClientPayment, SupplierOrder, GeneralExpense, ModelPricing).

**סיכון:** נמוך-בינוני. הסיכון העיקרי הוא ב**המרת הנתונים**, לא בבחירת הטכנולוגיה — אך מכיוון שאין נתוני Production אמיתיים, סיכון זה כמעט מבוטל (ראה סעיף 8).

**מה צריך לאמת בקוד:** נבדקו ואומתו כל 20 קובצי `base44/entities/*.jsonc` בסבב זה (לא רק ב-Audit הקודם) — הסכמה המלאה תואמת את מה שמתואר ב-`DATABASE_MIGRATION.md`, עם החריגה שצוינה (`pricing_method` mismatch).

---

## 3. Supabase (DB + Auth + Storage) — הכל-באחד?

**אפשרויות:**
- **A. Supabase לכל השלושה (DB+Auth+Storage) — מומלץ במסמכי היעד**
- **B. שירותים נפרדים** (Neon/RDS ל-DB, Auth0/Clerk ל-Auth, S3/R2 ל-Storage)
- **C. שילוב: Supabase DB+Storage, Auth נפרד (Clerk/Auth0)**

**יתרונות A:**
- DB, Auth ו-Storage תחת פלטפורמה אחת → RLS ב-PostgreSQL יכול להשתמש ישירות ב-`auth.uid()` של Supabase, ללא "תרגום" JWT ידני.
- Supabase Storage תומך signed URLs באופן דומה ל-S3, ומשולב עם RLS גם ברמת קבצים.
- פחות ספקים, פחות faturas, פחות integration עבודה.
- Free tier מספיק ל-MVP.

**חסרונות A:**
- Vendor lock-in חדש (מ-Base44 ל-Supabase) — פחות "עצמאי" ממה שנשמע, אך זהו lock-in פתוח יותר (PostgreSQL רגיל, ניתן לייצוא/מיגרציה עתידית ל-RDS/self-hosted).
- Auth של Supabase פחות גמיש מ-Auth0/Clerk לתרחישי enterprise (SSO, SAML) — לא רלוונטי כרגע (מערכת פנים-ארגונית קטנה, לפי `PROJECT_AUDIT.md`).

**יתרונות B/C:** גמישות מרבית, כל שירות הכי טוב בתחומו. **חסרונות B/C:** תקורת אינטגרציה גדולה בהרבה — RLS צריך "לדעת" מי המשתמש שהגיע מ-Auth0, זה דורש middleware מותאם. לא מוצדק בגודל הפרויקט הנוכחי (SME יחיד, לא Enterprise).

**המלצה:** **Supabase לכל השלושה (אפשרות A)**, כפי שכבר תוכנן. גודל הפרויקט (עסק אלומיניום יחיד, ~20 entities, ללא נתוני Production) לא מצדיק את המורכבות של שירותים נפרדים. אם בעתיד תידרש הפרדה (Enterprise SSO וכו') — קל יותר להחליף Auth בלבד כשה-DB כבר PostgreSQL רגיל.

**סיכון:** נמוך. Supabase בשל מספיק, ומכיוון שאין Production קיים — אין "יציאה" ממשהו קריטי.

**מה צריך לאמת בקוד:** לא רלוונטי (בחירת שירות עתידי) — אך יש לבדוק בפועל את מגבלות ה-Free/Pro tier של Supabase (connection pooling limits, storage quota) מול נפח הנתונים הצפוי, שלא ידוע כרגע. **שאלה פתוחה:** מה נפח הקבצים/רשומות הצפוי בשנה הראשונה? (לא אומת — לא קיים מידע בקוד).

---

## 4. Backend נפרד או Supabase ישירות מה-Frontend?

**אפשרויות:**
- **A. Frontend מדבר ישירות עם Supabase (REST/JS SDK + RLS policies) — ללא backend נפרד**
- **B. Backend נפרד (Vercel Functions) בין ה-Frontend ל-Supabase, לכל הלוגיקה העסקית**
- **C. היברידי: CRUD פשוט ישירות מול Supabase (RLS), לוגיקה עסקית מורכבת דרך Backend Functions**

**יתרונות A:** הכי מהיר לפתח, הכי פחות קוד. RLS ב-PostgreSQL אכן יכול לאכוף `tenant_id`/permissions ברמת השורה.

**חסרונות A — קריטי:** **אומת בקוד** של `partnerSettlement.jsx` ו-`materialOrderGenerator.js` — אלו לא CRUD פשוטים. `calculateFullPartnerSettlement` מבצע: איסוף תשלומים/הזמנות/הוצאות של פרויקטים סגורים בלבד, חישוב cash-position לכל שותף, ואז **אלגוריתם greedy לחישוב העברות בין שותפים** (creditors/debtors matching, לולאת `while` עם `remaining` balances). זו לוגיקה שאסור להריץ בצד לקוח (ניתנת למניפולציה) ולא ניתן לבטא כ-RLS policy או SQL view פשוט. באופן דומה `generateMaterialOrders` מבצע 4 שאילתות תלויות ברצף + מחיקת draft קודם + יצירה מרובה — פעולה שצריכה **transaction אטומית**, לא סדרת קריאות client-side נפרדות (כפי שקורה היום, ומסומן כבעיית N+1 גם ב-Audit הקודם).

**יתרונות B:** כל הלוגיקה העסקית (חישובים פיננסיים, סגירת התחשבנות, יצירת הזמנות חומר) מקבלת מקום מרכזי, ניתנת לבדיקה (unit tests), ומוגנת מהרצה כפולה/מניפולציה מצד הלקוח.

**חסרונות B:** תשתית נוספת (Vercel Functions / Express), deploy נפרד, latency נוסף (Frontend→Backend→DB במקום Frontend→DB ישיר) לפעולות CRUD פשוטות.

**המלצה:** **אפשרות C — היברידי**, בדיוק כפי שכבר ממופה ב-`BACKEND_MIGRATION_PLAN.md` סעיף 1.2 ("כלל האצבע"):
- CRUD פשוט (`customers`, `partners`, `company-headers`, `agent-settings`, ואפילו `projects`/`documents`/`reminders` הבסיסיים) → ישירות מול Supabase + RLS.
- לוגיקה שאסור להריץ בצד לקוח → **Backend Functions בלבד**: `calculateFullPartnerSettlement`, `validateProjectCanClose`, `generateMaterialOrders`, `analyzeProjectAlerts`, וחישובי מחיר authoritative (`calcComponentValue`, `calcItemTotal`, `calculateComponents`).

**סיכון:** בינוני. הסיכון המרכזי הוא לא להחליט נכון היכן עובר הגבול (CRUD מול לוגיקה) — טעות תגרום לבאג אבטחה (חישוב פיננסי שניתן למניפולציה מ-DevTools) או לביצועים גרועים (backend מיותר ל-CRUD פשוט).

**מה צריך לאמת בקוד:** אומת ישירות בסבב זה — `src/components/lib/partnerSettlement.jsx` (150 שורות, אלגוריתם transfers), `src/lib/materialOrderGenerator.js` (112 שורות, transaction-like flow), `src/components/lib/projectFinancials.jsx` (חישוב authoritative). **לא אומת:** `src/components/lib/agentLogic.jsx` ו-`src/components/lib/smartFocus.jsx` — יש לקרוא אותם לפני מימוש בפועל.

---

## 5. אילו פעולות חייבות לרוץ בצד השרת

מבוסס על `BACKEND_MIGRATION_PLAN.md` סעיף 3, **מסונן ומאומת מול קוד בפועל** (רק מה שבאמת קיים ורץ היום):

| פעולה | קובץ מקור (אומת) | למה שרת בלבד |
|-------|-------------------|----------------|
| `calculateFullPartnerSettlement` + `validateProjectCanClose` | `src/components/lib/partnerSettlement.jsx` | חלוקת רווחים בין שותפים — אסור מניפולציה client-side; אלגוריתם transfers מורכב |
| `generateMaterialOrders` | `src/lib/materialOrderGenerator.js` | מוחק+יוצר רשומות מרובות ברצף — צריך transaction אטומית, כרגע רץ כ-4+ קריאות client נפרדות (N+1 מאומת) |
| `calculateProjectFinancials` / `calculateAggregatedFinancials` | `src/components/lib/projectFinancials.jsx` | מקור אמת לכל מסך פיננסי — אם client מחשב לבד, אפשר לזייף רווחיות מוצגת |
| חישוב מחיר רכיב/פריט הצעה (`calcComponentValue`, `calcItemTotal`) | **לא אומת בסבב זה** — קובץ `quoteCalculations.js` לא נקרא | לפי המסמך: שרת אמור לקבוע את הסכום הסופי הנשמר, גם אם client מציג preview |
| `calculateComponents` (אורך/רוחב רכיבי ייצור) | `src/lib/formulaEngine.js` | נוסחת two-step שנקבעת ב-`ModelComponent` — קובעת גם עלויות ייצור וגם הזמנות חומר, לא אמורה להיות ניתנת לעריכה מה-client בזמן שמירה |
| ולידציית סגירת פרויקט | `src/components/lib/partnerSettlement.jsx::validateProjectCanClose` | תלוי ב-`calculateProjectFinancials` — אותה סיבה |

**חשוב:** `agentLogic.jsx` ו-`smartFocus.jsx` **לא נקראו בסבב זה** — מומלץ לקרוא לפני שמחליטים אם הם "שרת בלבד" (כפי שטוען `BACKEND_MIGRATION_PLAN.md`) או שחלקם יכולים להישאר client-side (התראות זה לא בהכרח נתון רגיש כמו חלוקת כסף).

**סיכון:** אם לא כל אלו יעברו לשרת יחד עם ה-migration — המערכת החדשה תשחזר בדיוק את הבעיה הקיימת ("`closed_by` מקודד קשיח כ'מנהל'" — אומת ב-Audit הקודם, נובע מזה שאין user context אמיתי בפעולת סגירה היום).

**מה צריך לאמת בקוד לפני מימוש:** `src/components/lib/agentLogic.jsx`, `src/components/lib/smartFocus.jsx`, `src/lib/quoteCalculations.js` — שלושתם לא נקראו בשום סבב עד כה.

---

## 6. כיצד להחליף את `@base44/sdk`

**אפשרויות:**
- **A. Service Layer עם ממשק זהה ל-SDK** (`XService.list()/.filter()/.create()/.update()/.delete()`) שמדבר עם Supabase/Backend
- **B. שימוש ישיר ב-Supabase JS client + TanStack Query בכל מסך (ללא שכבת הפשטה)**
- **C. GraphQL layer (Apollo/urql) מעל Postgres**

**יתרונות A:** **אומת בקוד** — כל 11 העמודים + כל component עסקי קוראים ל-`base44.entities.{Entity}.{method}()` בפורמט אחיד לחלוטין (ראה טבלת שימושים בסעיף 7). שכבת Service עם אותו חתימת-פונקציה הופכת את ההחלפה ל-**mechanical find/replace** במקום שכתוב לוגי.

**חסרונות A:** תחזוקה נוספת (עוד שכבת קוד), וסיכון "leaky abstraction" אם Supabase queries דורשות פרמטרים ש-Base44 SDK לא תמך בהם (pagination format, error shape).

**יתרונות B:** פחות שכבות, פחות "magic". **חסרונות B:** דורש שכתוב כל אחד מ-~140 קריאות `base44.entities.X` (אומת — ראה גרפ בסעיף 7) בנפרד, בכל אחד מ-20+ קבצים — שכתוב מסיבי, סיכון רגרסיה גבוה, מנוגד ישירות לדרישה "לא לשכתב את כל המסכים".

**חסרונות C:** overkill מוחלט לפרויקט בגודל הזה; דורש GraphQL server + schema + resolvers — תשתית שלמה נוספת.

**המלצה:** **אפשרות A — Service Layer**, בדיוק כפי שכבר מתועד ב-`VENDOR_LOCK_IN_ANALYSIS.md` סעיף 2.1 ו-`MIGRATION_MASTER_PLAN.md` שלב 5. זו ההחלטה שהופכת migration שלם למשימה ניתנת לניהול. פירוט מלא בסעיף 7 הבא.

**סיכון:** נמוך אם ה-interface נשמר קפדני; **בינוני-גבוה אם נעשה בחיפזון** — אם ה-Service layer לא מכסה בדיוק את כל הפרמטרים ש-Base44 תמך (`.filter({field: value})`, `.list('-created_date')`), חלק מהמסכים ישברו בשקט (למשל מיון הפוך).

**מה צריך לאמת בקוד:** אומת — נבדק ישירות `src/api/base44Client.js` (client יחיד, ללא wrapper קיים) ו-Grep מלא של כל שימושי `base44.entities.*` (ראה סעיף 7).

---

## 7. Service Layer — כדי לא לשכתב את כל המסכים

**אומת בקוד:** גרפ מלא של שימושים (Grep על `base44\.entities\.\w+` בכל `src/`) מראה **~140 קריאות פרושות על פני 20 קבצים**: `Dashboard.jsx`, `Projects.jsx`, `ProjectDetails.jsx` (הכי כבד — 20+ קריאות), `QuoteEditor.jsx`, `Customers.jsx`, `Finance.jsx`, `Quotes.jsx`, `ModelPricing.jsx`, `Reminders.jsx`, `CompanyHeaders.jsx`, `BusinessAgent.jsx`, ורכיבים: `PartnerSettlement.jsx`, `MaterialOrdersTab.jsx`, `ModelComponentsTab.jsx`, `TemplateComponentsManager.jsx`, `RemindersWidget.jsx`, `MorningSummary.jsx`, וגם `src/lib/materialOrderGenerator.js`.

כל קריאה קיימת היום היא באחד מ-5 הפורמטים הבאים (אומת): `.list()`, `.list('-created_date')`, `.filter({field: value})`, `.get(id)`, `.create(data)`, `.update(id, data)`, `.delete(id)`.

**עיצוב מומלץ:**

```
src/services/
├── client.js              # instance יחיד (axios/supabase-js), interceptors
├── customerService.js
├── projectService.js
├── projectQuoteService.js
├── quoteItemService.js
├── quoteItemComponentService.js
├── clientPaymentService.js
├── supplierOrderService.js
├── documentService.js
├── reminderService.js
├── partnerService.js
├── generalExpenseService.js
├── modelPricingService.js
├── modelComponentService.js
├── quoteTemplateService.js
├── quoteTemplateComponentService.js
├── materialOrderService.js
├── materialOrderItemService.js
├── agentSettingsService.js
├── agentAlertService.js
├── companyHeaderService.js
├── businessLogicService.js  # קורא ל-Backend Functions: financials, settlement, material-orders/generate וכו'
└── index.js                # export מרוכז — כדי לאפשר `import { CustomerService } from '@/services'`
```

**ממשק אחיד לכל service (לדוגמה `customerService.js`):**
```js
export const CustomerService = {
  list: (sort) => supabase.from('customers').select('*').order(...),   // מחליף .list()/.list('-created_date')
  filter: (params) => supabase.from('customers').select('*').match(params), // מחליף .filter({...})
  get: (id) => supabase.from('customers').select('*').eq('id', id).single(),
  create: (data) => supabase.from('customers').insert(data).select().single(),
  update: (id, data) => supabase.from('customers').update(data).eq('id', id).select().single(),
  delete: (id) => supabase.from('customers').delete().eq('id', id),
};
```

**שינוי בקוד הקיים:** רק שורת ה-import + שם ה-namespace. לדוגמה ב-`Dashboard.jsx` (אומת שורה 23):
```diff
- import { base44 } from '@/api/base44Client';
- ...base44.entities.Project.list()
+ import { ProjectService } from '@/services';
+ ...ProjectService.list()
```
זהו שינוי מכני (find/replace מבוקר), לא שכתוב לוגי — בדיוק המטרה.

**יתרונות:** מינימום regression risk, ניתן להעביר entity-by-entity (לא all-or-nothing), כל page ממשיך לעבוד עם TanStack Query בדיוק כפי שהוא היום (רק ה-`queryFn` משתנה).

**חסרונות:** קובץ service לכל entity = תחזוקה נוספת; יש לוודא שה-error shape (מה שנזרק בשגיאה) תואם למה שה-UI כבר מצפה לו (`.catch`/`onError` handlers קיימים).

**סיכון:** נמוך, בתנאי שמעבירים **entity אחד בכל פעם** ובודקים את כל המסכים שמשתמשים בו לפני מעבר ל-entity הבא.

**מה צריך לאמת בקוד לפני מימוש:** יש לבדוק את טיפול השגיאות בפועל (`onError` / `try-catch`) בכל page — לא נבדק בסבב זה, רק זוהו הקריאות עצמן.

---

## 8. סדר העברת 20 הישויות

מבוסס על סדר התלות **שכבר קיים ומתועד** ב-`DATABASE_MIGRATION.md` סעיף 6 שלב 3, **מאומת מול קשרי הישויות בפועל** (כל 20 קבצי `.jsonc` נקראו בסבב זה):

| # | קבוצה | ישויות | תלות (FK-in) |
|---|-------|--------|----------------|
| 1 | עצמאיות | `Customer`, `Partner`, `CompanyHeader`, `AgentSettings` | אין תלות נכנסת |
| 2 | קטלוג (עצמאי) | `ModelPricing` | אין תלות נכנסת (אך `ModelComponent` תלוי בו) |
| 3 | קטלוג-תלוי | `ModelComponent` | ← `ModelPricing.id` (אומת: `model_id`) |
| 4 | פרויקט ליבה | `Project` | ← `Customer.id` |
| 5 | תלויי-פרויקט (שכבה 1) | `ProjectQuote`, `ClientPayment`, `SupplierOrder`, `Document`, `Reminder`, `MaterialOrder` | ← `Project.id`; `ClientPayment`/`SupplierOrder` גם ← `Partner.id` |
| 6 | תלויי-הצעה | `QuoteItem` | ← `ProjectQuote.id` |
| 7 | תלויי-פריט + קטלוג | `QuoteItemComponent` | ← `QuoteItem.id` **וגם** ← `ModelPricing.id` (nullable, `catalog_item_id`) |
| 8 | תלויי-הזמנת-חומר | `MaterialOrderItem` | ← `MaterialOrder.id` |
| 9 | תבניות (עצמאי) | `QuoteTemplate` | אין תלות נכנסת |
| 10 | תלויי-תבנית + קטלוג | `QuoteTemplateComponent` | ← `QuoteTemplate.id` **וגם** ← `ModelPricing.id` (nullable) |
| 11 | הוצאות | `GeneralExpense` | ← `Partner.id` |
| 12 | Agent | `AgentAlert` | ← `Project.id` (nullable) |

**סדר יבוא מומלץ (שרשור הטבלה לעיל):**
1. `Customer`, `Partner`, `CompanyHeader`, `AgentSettings`, `ModelPricing`, `QuoteTemplate` (כולם ללא תלות נכנסת — יכולים לרוץ במקביל)
2. `ModelComponent` (תלוי ב-1)
3. `Project` (תלוי ב-`Customer`)
4. `ProjectQuote`, `ClientPayment`, `SupplierOrder`, `Document`, `Reminder`, `MaterialOrder`, `GeneralExpense`, `AgentAlert` (תלויים ב-3 ו/או ב-`Partner`)
5. `QuoteItem` (תלוי ב-`ProjectQuote`)
6. `QuoteItemComponent`, `QuoteTemplateComponent` (תלויים ב-5/`QuoteTemplate` וב-`ModelPricing`)
7. `MaterialOrderItem` (תלוי ב-`MaterialOrder`)

**יתרון קריטי מהמצב הנוכחי (אין Production אמיתי):** אין צורך בסקריפט export/import עם ולידציית counts/checksums בין Base44 לבין ה-DB החדש (כפי שתוכנן ב-`DATABASE_MIGRATION.md` שלבים 2-5) — **אין מה לייצא**. אפשר לבנות את סכמת ה-DB החדשה ולמלא אותה ישירות מ-seed/dev data, ולוותר לגמרי על שלבי המרה/וולידציה שתוכננו למקרה של Production אמיתי.

**סיכון:** נמוך מאוד בהינתן שאין נתונים אמיתיים להעביר — הסיכון המרכזי הוא רק **תכנון סכמה שגוי** (למשל FK type mismatch), לא אובדן נתונים.

**מה צריך לאמת בקוד:** אומת — קריאה ישירה של כל 20 קבצי `base44/entities/*.jsonc` בסבב זה (רשימת שדות מלאה, `required`, `enum` וקשרי `_id`).

---

## 9. אילו קשרים חסרים בין הישויות

מבוסס על קריאה ישירה של כל 20 ה-schemas (**אומת בסבב זה**, לא רק מצוטט מ-`DATABASE_MIGRATION.md`):

1. **`QuoteItemComponent.catalog_item_id → ModelPricing`** — קיים כשדה `string` חופשי (לא FK אמיתי) ב-schema; **אין** אכיפת existence ברמת ה-DB היום (Base44 NoSQL). ב-Postgres צריך `@relation` עם `onDelete: SetNull` (הרכיב יכול להיות "ידני", ללא קטלוג — `catalog_item_id` הוא nullable כבר היום).
2. **`ModelComponent.model_id → ModelPricing`** — אותו מצב; זהו הקשר השני בשרשרת הדו-שלבית (`QuoteItemComponent → ModelPricing ← ModelComponent`) שקריטי ל-`generateMaterialOrders` (אומת בקוד: `materialOrderGenerator.js` שורות 36-50 בונה בדיוק את המיפוי הזה בזמן ריצה, ב-client, כי אין JOIN).
3. **`Project.closed_by`** — שדה `string` חופשי, לא FK ל-User — **אומת** גם ב-schema וגם בכך ש-Audit הקודם מצא ערך hardcoded `"מנהל"`. יש להפוך ל-FK אמיתי + לחייב async user context מה-Backend (לא ניתן היום כי אין Auth אמיתי בקוד).
4. **`ClientPayment.received_by_partner_id` / `SupplierOrder.paid_by_partner_id` / `GeneralExpense.paid_by_partner_id`** → `Partner` — קיימים כ-`string`, ללא FK אמיתי היום.
5. **`Document.project_id`** — `required` ב-schema (אומת), בעוד ש-`Reminder.project_id` **אינו required** (אומת: `Reminder.jsonc` — `project_id` לא ברשימת `required`, כלומר תזכורת יכולה להיות "עצמאית" ללא פרויקט). זהו הבדל אמיתי שצריך לשקף ב-Prisma (`project_id String?` ב-Reminder בלבד, לא ב-Document).
6. **אין קשר בין `AgentAlert` ל-`User`** (מי טיפל בהתראה) — אין שדה כזה כלל בסכמה (אומת: `AgentAlert.jsonc` — אין `resolved_by`/`assigned_to`).
7. **`user_id` / `created_by` חסר לגמרי** בכל 20 ה-entities — אין אף שדה `created_by_id` מוצהר ב-schema (זה שדה built-in של Base44 שלא מופיע ב-JSON Schema הגלוי, לפי ה-Audit הקודם, **לא אומת ישירות בסבב זה** אם הוא אכן מוחזר ב-runtime API).

**סיכון:** בינוני — אם ה-FKs לא ייאכפו נכון ב-Prisma (`onDelete` policy), מחיקת `ModelPricing` עלולה לשבור הצעות מחיר קיימות שמצביעות עליו דרך snapshot. **חשוב לשים לב:** רוב השדות ב-`QuoteItemComponent`/`QuoteTemplateComponent` הם "snapshot" (`name_snapshot`, `price_snapshot`, `pricing_method_snapshot`) בדיוק כדי **לא** להיות תלויים ב-FK בזמן ריצה (by design, אומת גם ב-Audit הקודם סעיף 14.1) — יש לשמר את דפוס ה-snapshot בסכמה החדשה, לא "לתקן" אותו ל-JOIN חי.

**מה צריך לאמת בקוד:** האם `created_by_id` אכן מוחזר מ-Base44 API בפועל — דורש קריאה ל-response actual של הקריאות (לא ניתן לאמת מקריאת schema files בלבד; נדרשת בדיקה מול Base44 החי אם עדיין רלוונטי, או שאלה למשתמש).

---

## 10. הוספת `tenant_id` כבר מההתחלה

**אפשרויות:**
- **A. להוסיף `tenant_id` לכל טבלה כבר בסכמה הראשונה (גם אם יש רק tenant אחד כרגע)**
- **B. לבנות Single-tenant עכשיו, להוסיף `tenant_id` ב-migration נפרדת בעתיד (כפי שתוכנן ב-`SAAS_ARCHITECTURE.md`)**

**יתרונות A:**
- **מכיוון שאין Production אמיתי** — זה הרגע הזול ביותר להוסיף `tenant_id`. הוספת עמודה ל-DB ריק היא free; הוספתה אחרי שיש נתונים דורשת migration + backfill + בדיקת null-safety בכל query.
- מונע לגמרי את הצורך העתידי ב-"שלב נפרד, מורכב" שה-`VENDOR_LOCK_IN_ANALYSIS.md` עצמו מסמן (טבלת סיכום, שורה "SaaS 🔴").
- RLS policies מהיום הראשון כוללות `tenant_id` — לא צריך לשכתב RLS פעמיים.

**חסרונות A:**
- תוספת מורכבות מיידית (כל query צריך `tenant_id` context) גם אם יש רק tenant אחד כרגע.
- אם המוצר לעולם לא הופך ל-multi-tenant (המשתמש לא אישר את זה כיעד ודאי) — זו עבודה שלא תנוצל.

**חסרונות B:** בדיוק ההפך מ-A — יקר בהרבה לתקן מאוחר יותר; ולפי `SAAS_ARCHITECTURE.md` (מסמך שכבר קיים בפרויקט) — כיוון multi-tenant **כן** מתוכנן.

**המלצה:** **אפשרות A** — להוסיף `tenant_id UUID NOT NULL` לכל טבלה עסקית מהיום הראשון (רשימה מדויקת: כל 20 הישויות **מלבד** טבלאות שיהיו גלובליות למערכת בעתיד — לא זוהו כאלה כרגע מלבד אולי הגדרות מערכת עתידיות). ליצור `tenant` יחיד ב-seed ("ProjectFlow Pro — Default Tenant") ולקשר אליו את כל הרשומות, כדי ש-RLS policies יעבדו מהיום הראשון גם עם tenant בודד. זה בדיוק מה שממילא מתוכנן ב-`SAAS_ARCHITECTURE.md` סעיף 3.1, רק שממומש עכשיו ולא כ-migration נפרדת אחר כך.

**סיכון:** נמוך — אין נתונים קיימים לסבך; הסיכון היחיד הוא לשכוח `tenant_id` בשאילתה כלשהי (bug אבטחה) — יש לאכוף זאת ב-Backend Service layer (כל query עובר דרך פונקציה מרכזית שמזריקה `tenant_id` אוטומטית, לא ידנית בכל endpoint).

**מה צריך לאמת בקוד:** לא רלוונטי — זו החלטת תכנון קדימה. **שאלה פתוחה למשתמש:** האם multi-tenant הוא באמת יעד ודאי (יש עסק אלומיניום אחד היום), או שזו הייתה תוכנית ספקולטיבית שכדאי לדחות? המסמכים הקיימים (`SAAS_ARCHITECTURE.md`) מניחים כן, אך זו החלטה עסקית שהמסמך הנוכחי לא יכול לקבוע בעצמו.

---

## 11. הרשאות Server-Side

**אפשרויות:**
- **A. RLS ב-PostgreSQL (Supabase) בלבד**
- **B. Permission checks רק ב-Backend Functions (application-level), ללא RLS**
- **C. שכבה כפולה: RLS + application-level permission checks**

**יתרונות A:** RLS אוכף ברמת ה-DB — גם אם באג ב-backend "שוכח" לסנן, ה-DB עדיין חוסם. הכי בטוח למידע רגיש (פיננסי).
**חסרונות A:** RLS policies מורכבות לדבג; קשה "להסביר" הרשאות עסקיות מורכבות (כמו "Manager רואה רק פרויקטים שהוא מנהל") רק ב-SQL.

**יתרונות B:** קל יותר לכתוב לוגיקת הרשאות מורכבת ב-JS/TS רגיל (permissions matrix כפי שכבר מתוכנן ב-`SECURITY_MODEL.md` סעיף 4). **חסרונות B — קריטי:** בלי RLS, Supabase JS client מה-frontend (אם נבחר בסעיף 4 גישה היברידית עם CRUD ישיר) **חושף את כל הטבלה** לכל משתמש עם anon key תקף, ללא הגנה ברמת ה-DB.

**המלצה:** **אפשרות C — שכבה כפולה**, בדיוק כפי שכבר מתועד ב-`SECURITY_MODEL.md`:
- **RLS ברמה 1 (חובה):** `tenant_isolation` על כל טבלה — משתמש רואה רק שורות של ה-tenant שלו. זו הגנת הבסיס שחייבת להיות ב-DB (לא ניתן לסמוך רק על client/backend).
- **Permission checks ברמה 2 (Backend Functions):** RBAC לפי action (`projects:delete`, `settlement:read` וכו', כבר ממופה ב-`SECURITY_MODEL.md` סעיף 4.1-4.2) — נבדק ב-middleware לפני שהבקשה מגיעה ל-DB בכלל.
- **חשוב:** ה-CRUD הישיר-מה-Frontend (מסעיף 4) חייב להישען אך ורק על RLS ברמה 1 (tenant isolation) — לא לסמוך על frontend "שלא יראה" כפתור מחיקה. פעולות הדורשות RBAC עדין יותר (Manager vs Viewer) **חייבות לעבור דרך Backend Functions**, לא CRUD ישיר.

**סיכון:** גבוה אם ממומש חלקית — "אין RLS" הוא כבר סיכון #1 שזוהה ב-Audit הקודם על המערכת הקיימת; לא לשחזר את אותה טעות במערכת החדשה.

**מה צריך לאמת בקוד:** **לא ניתן לאמת** — Roles (`admin`/`user`) לא נמצאו בשימוש מפורש בשום קובץ שנקרא עד כה (כולל AuthContext.jsx שנקרא בסבב הקודם). יש לבדוק אם קיים שימוש ב-role בקוד שטרם נסרק (`src/components/**`, `Layout.jsx`) לפני שמניחים שהמודל `admin`/`user` בלבד תקף.

---

## 12. העברת `UploadFile` ל-Storage חדש

**אומת בקוד בסבב זה:** `base44.integrations.Core.UploadFile({ file })` נקרא בדיוק ב-2 מקומות: `src/pages/ProjectDetails.jsx` (שורות 1177-1184, upload PDF להצעת מחיר; שורות 1387-1394, upload מסמך פרויקט). שני המקומות מחזירים `{ file_url }` ומכניסים ישירות ל-state (`setFormData`). **לא אומת:** קריאת upload ב-`CompanyHeaders.jsx` — הקובץ מכיל שדה `logo_url` אך לא נמצאה שם קריאת `UploadFile` בפועל בשורות שנקראו (1-45) — ייתכן שהיא בהמשך הקובץ שלא נקרא, יש לבדוק.

**אפשרויות:**
- **A. Supabase Storage (signed URLs)**
- **B. AWS S3 (signed URLs) — כפי שמתוכנן ב-`STORAGE_MIGRATION.md`**
- **C. Cloudflare R2**

**יתרונות A:** אם כבר נבחר Supabase ל-DB+Auth (סעיף 3) — Storage שם משולב עם אותו RLS ואותו client SDK, אין ספק שלישי נוסף.
**חסרונות A:** Free tier storage מוגבל (יש לבדוק מול נפח קבצים צפוי — לא אומת).

**יתרונות B (S3):** סטנדרט תעשייתי, כבר מתוכנן ב-`STORAGE_MIGRATION.md` עם מבנה keys מלא (`tenants/{tenant_id}/documents/{project_id}/{document_id}/...`) — עבודת תכנון כבר קיימת. **חסרונות B:** ספק שלישי נוסף, IAM נפרד, לא מנצל RLS PostgreSQL ישירות (Storage policies נפרדות).

**יתרונות C (R2):** ללא עלות egress. **חסרונות C:** ready-made plan פחות מפורט בפרויקט הזה.

**המלצה:** **Supabase Storage**, בהמשך ישיר להחלטה בסעיף 3 (Supabase לכל השלושה) — פחות ספקים, RLS מאוחד. אם בעתיד נפח הקבצים גדול משמעותית ועלות Storage הופכת לגורם — ניתן לעבור ל-R2/S3 בנפרד (Storage הוא הרכיב הכי קל להחלפה לפי `VENDOR_LOCK_IN_ANALYSIS.md` — "🟢 נמוכה").

**מבנה תיקיות מומלץ** (מתאים ל-`tenant_id` שכבר בהחלטה #10):
```
{tenant_id}/documents/{project_id}/{document_id}/{timestamp}_{filename}
{tenant_id}/quotes/{quote_id}/{timestamp}_quote.pdf
{tenant_id}/company-headers/{header_id}/{timestamp}_logo.png
```

**זרימת migration בפועל (2 שינויים בלבד בקוד, לא יותר, כי אין קבצים קיימים להעביר):**
```diff
- const { file_url } = await base44.integrations.Core.UploadFile({ file });
- setFormData({ ...formData, file_url });
+ const { file_key } = await StorageService.upload(file, { entityType: 'documents', entityId: projectId });
+ setFormData({ ...formData, file_key });
```
שדה ה-DB עובר מ-`file_url` ל-`file_key` (כפי ש-`STORAGE_MIGRATION.md` כבר ממליץ) — התצוגה/הורדה דורשת קריאה נפרדת ל-signed URL בזמן render, לא URL קבוע בשדה.

**סיכון:** נמוך — **אין קבצים אמיתיים להעביר** (אין Production), כך שכל סעיף 9 ב-`STORAGE_MIGRATION.md` ("תוכנית Migration" עם סקריפט הורדה+checksums) **מיותר לגמרי**. ההגדרה יכולה להתחיל נקייה.

**מה צריך לאמת בקוד:** האם יש קריאת `UploadFile` נוספת ב-`CompanyHeaders.jsx` (שורות מעבר ל-45 שלא נקראו) או במקום אחר שה-Grep לא תפס (למשל בתוך string דינמי) — לוודא לפני שמניחים שיש רק 2 מקומות.

---

## 13. אילו מסכים אפשר להעביר ראשונים

**קריטריון בחירה:** מסכים עם הכי מעט תלות בלוגיקה עסקית מורכבת (סעיף 5) והכי פחות entities קשורים — **מאומת** מול Grep שבוצע בסעיף 7.

| עדיפות | מסך | Entities מעורבים (אומת) | סיבוכיות | הערה |
|--------|-----|---------------------------|-----------|------|
| 1 (ראשון) | **Customers** | `Customer`, `Project` (ספירה בלבד) | נמוכה | CRUD טהור, ללא חישובים |
| 2 | **CompanyHeaders** | `CompanyHeader` | נמוכה | CRUD + upload יחיד; טוב לבדוק את Storage migration בפריסה קטנה |
| 3 | **Reminders** | `Reminder`, `Project` | נמוכה-בינונית | CRUD עם סינון, ללא חישוב כספי |
| 4 | **ModelPricing** | `ModelPricing`, `ModelComponent`, `QuoteTemplate`, `QuoteTemplateComponent` | בינונית | CRUD מרובה-entities אך ללא חישוב פיננסי authoritative (formulaEngine הוא preview) |
| 5 | **Projects** (רשימה) | `Project`, `Customer`, `ClientPayment`, `SupplierOrder`, `ProjectQuote` | בינונית-גבוהה | תלוי ב-`calculateProjectFinancials` — דורש ש-Backend financials API כבר קיים |
| 6 | **Dashboard** | 5 entities + `calculateProjectFinancials` | גבוהה | דורש כמעט את כל שאר ה-Services מוכנים קודם |
| 7 (אחרון) | **QuoteEditor**, **ProjectDetails**, **Finance/PartnerSettlement**, **BusinessAgent** | כל 20 ה-entities בין כולם | גבוהה מאוד | תלויים בכל Backend Functions (סעיף 5) — לא ניתנים להעברה חלקית |

**המלצה:** להתחיל ב-**Customers** כ-proof-of-concept מלא (Service Layer + Supabase + RLS + tenant_id) — מסך פשוט שמוודא שכל מרכיבי הארכיטקטורה עובדים יחד, לפני שמשקיעים במסכים המורכבים.

**סיכון:** נמוך בסדר המוצע. הסיכון היחיד הוא לנסות להעביר `QuoteEditor`/`ProjectDetails` מוקדם מדי — הם הכי גדולים (`ProjectDetails.jsx` עם 20+ קריאות `base44.entities`, אומת) ותלויים בהכל.

**מה צריך לאמת בקוד:** אומת במלואו מתוך גרפ הקריאות בסעיף 7.

---

## 14. אילו בדיקות צריך לכתוב לפני כל מעבר

**אומת:** אין קובצי test בפרויקט כיום (`PROJECT_AUDIT.md` סעיף 12, "אין בדיקות" — **לא אומת מחדש בסבב זה** באמצעות Glob של `*.test.*`/`*.spec.*`, אך שום `package.json` script לא מריץ טסטים חוץ מ-lint/typecheck, מה שתומך בממצא).

**המלצה — לפני שמעבירים entity/מסך כלשהו:**

1. **Unit tests ללוגיקה הפיננסית טהורה (עדיפות עליונה):**
   - `calculateProjectFinancials` / `calculateAggregatedFinancials` — עם קלטים ידועים, כדי לוודא שה-**Backend implementation מחזיר בדיוק את אותן תוצאות** כמו ה-frontend logic הקיימת (זוהי "בדיקת רגרסיה" שמוודאת שהמעבר לא שינה חישוב כספי).
   - `calculateFullPartnerSettlement` — כולל בדיקת אלגוריתם ה-transfers (מקרי קצה: שותף יחיד, כמה creditors מול debtor יחיד, סכומים שווים).
   - `calculateComponents` (formulaEngine) — כל שילוב `length_base`/`op1`/`op2` (`add`/`subtract`/`multiply`/`divide`/`none`).
   - `validateProjectCanClose` — מקרי הצלחה/כישלון (יתרה לגבייה > 0, יתרה לספקים > 0, אין הצעה מאושרת).

2. **Integration tests ל-Service Layer:** לכל entity service — `create`/`update`/`delete`/`list`/`filter` מול Supabase test instance (לא production), כדי לוודא שה-interface שנשמר תואם למה שה-UI מצפה.

3. **Contract tests ל-RLS:** משתמש A לא יכול לקרוא/לכתוב רשומות של `tenant_id` אחר — קריטי לפני שמפעילים multi-tenant אמיתי (סעיף 10). זו בדיקת אבטחה, לא רק פונקציונליות.

4. **E2E smoke test לכל מסך שעובר** (לפי סדר סעיף 13): טעינת רשימה, יצירה, עריכה, מחיקה — לפני ואחרי המעבר, כדי לוודא feature parity.

5. **בדיקת Storage flow (upload+signed URL) בבידוד** לפני שמחברים ל-`ProjectDetails`/`CompanyHeaders` — כי שני המקומות היחידים שנמצאו (סעיף 12) חשובים לתפקוד היומיומי.

**סיכון אם מדלגים:** בלי בדיקות ללוגיקה הפיננסית — סיכון ממשי שהמרה בין `Float`↔`Decimal` (סעיף 2) תשנה תוצאות rounding בשקט, וזה בדיוק התרחיש ש-`DATABASE_MIGRATION.md` מזהיר מפניו ("סיכון #5 — הבדלי rounding").

**מה צריך לאמת בקוד:** אין — זו המלצת תהליך, לא ממצא. **יש לוודא בפועל** (לפני תחילת מימוש) שאין קובצי test נסתרים ב-`src/**/__tests__/` שה-Glob המקורי לא תפס.

---

## סיכום החלטות (טבלה מרכזת)

| # | נושא | המלצה | סיכון |
|---|------|-------|-------|
| 1 | Frontend Framework | להישאר React+Vite | נמוך |
| 2 | Database | PostgreSQL + Prisma | נמוך-בינוני |
| 3 | DB+Auth+Storage | Supabase (הכל) | נמוך |
| 4 | Backend | היברידי — CRUD ישיר (RLS) + Backend Functions ללוגיקה עסקית | בינוני |
| 5 | לוגיקה server-side חובה | financials, settlement, material-orders, formula engine | — |
| 6 | SDK replacement | Service Layer עם ממשק זהה | נמוך (אם ממושמע) |
| 7 | Service Layer מבנה | 20+ services לפי entity, גישה אחידה | נמוך |
| 8 | סדר 20 ישויות | 7 שכבות תלות, ללא cutover (אין Production) | נמוך מאוד |
| 9 | קשרים חסרים | `catalog_item_id`, `model_id`, `closed_by`, `*_partner_id` — כולם ל-FK אמיתי; לשמר snapshot pattern | בינוני |
| 10 | tenant_id | להוסיף מהיום הראשון (DB ריק = זול) | נמוך |
| 11 | הרשאות | RLS (tenant isolation) + RBAC ב-Backend Functions | גבוה אם חלקי |
| 12 | Storage | Supabase Storage, רק 2 מקומות קוד להחליף | נמוך |
| 13 | סדר מסכים | Customers → CompanyHeaders → Reminders → ModelPricing → Projects → Dashboard → (הכבדים) | נמוך |
| 14 | בדיקות | Unit על לוגיקה פיננסית לפני כל מעבר entity | — |

---

## נספח — קבצים שנקראו ואומתו ישירות בסבב זה (בנוסף לאלו שב-AUDIT_REPORT)

- `docs/DATABASE_MIGRATION.md`, `BACKEND_MIGRATION_PLAN.md`, `SECURITY_MODEL.md`, `STORAGE_MIGRATION.md`, `MIGRATION_MASTER_PLAN.md` (חלקם נקראו גם בסבב האודיט הקודם)
- **כל 20 קובצי `base44/entities/*.jsonc`** — נקראו במלואם בסבב זה (Customer, Project, ProjectQuote, QuoteItem, QuoteItemComponent, ClientPayment, SupplierOrder, Document, Reminder, Partner, GeneralExpense, ModelPricing, ModelComponent, QuoteTemplate, QuoteTemplateComponent, MaterialOrder, MaterialOrderItem, AgentSettings, AgentAlert, CompanyHeader)
- `src/components/lib/projectFinancials.jsx`, `src/components/lib/partnerSettlement.jsx` — נקראו במלואם
- `src/lib/formulaEngine.js`, `src/lib/materialOrderGenerator.js` — נקראו במלואם
- `src/pages/CompanyHeaders.jsx` (שורות 1-45 בלבד)
- Grep מלא של `base44\.entities\.\w+` בכל `src/` — ~140 שימושים ב-20 קבצים
- Grep של `UploadFile`/`base44.integrations` — 2 קבצים בלבד: `CompanyHeaders.jsx`, `ProjectDetails.jsx`
- `src/pages/ProjectDetails.jsx` — רק אזור ה-`UploadFile` (שורות ~1177-1394), **לא הקובץ המלא** (הקובץ ארוך, 1500+ שורות)

**לא נקראו בסבב זה** (לא אומתו, ומומלץ לקרוא לפני מימוש בפועל):
- `src/components/lib/agentLogic.jsx`, `src/components/lib/smartFocus.jsx`
- `src/lib/quoteCalculations.js`
- `src/Layout.jsx` (לבדוק שימוש ב-role)
- `src/pages/ProjectDetails.jsx`, `src/pages/QuoteEditor.jsx` במלואם (רק אזורים ספציפיים נבדקו)
- `docs/CLOUD_CODE_API_PLAN.md`, `docs/CLOUD_MIGRATION.md`, `docs/SAAS_ARCHITECTURE.md` — נקראו בסבב הקודם (Audit), לא סיכם מחדש כאן

---

## מה לא בוצע (לפי דרישת המשתמש)

- **לא נוצר Database.**
- **לא שונה schema.**
- **לא הותקנו חבילות** (Prisma, Supabase SDK וכו').
- **לא בוצע שום שינוי קוד** בפרויקט.

לפני תחילת מימוש בפועל — יש לקבל אישור מפורש על כל אחת מ-14 ההחלטות שבמסמך זה, ובפרט על שתי השאלות הפתוחות שסומנו (עתיד multi-tenant בסעיף 10; יעד SEO/SSR בסעיף 1).

---

> **סוף מסמך תוכנית Migration** — 2026-08-03.
