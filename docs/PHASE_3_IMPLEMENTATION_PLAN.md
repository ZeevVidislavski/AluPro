# PHASE_3_IMPLEMENTATION_PLAN.md

## תוכנית מימוש Phase 3 — Partner + ClientPayment + SupplierOrder (List/Filter בלבד)

> **תאריך תכנון:** 2026-08-13 | **תאריך מימוש:** 2026-08-13
> **סטטוס:** ✅ **הושלם ואומת בפועל.** `Partner`, `ClientPayment`, `SupplierOrder` (list/select) עובדים; Dashboard/Finance/Projects נטענים תקין. ראו סעיף 8 ("מה קרה בפועל") — הפעם, בניגוד ל-Phase 1/2, **המימוש עבר ללא באגים חדשים** — שני הלקחים הקודמים (GRANT מפורש מהתחלה, אימות UUID ישיר) יושמו נכון מההתחלה.
> **תנאי מקדים:** Phase 1 (`Customer`) ו-Phase 2 (`Project`, list+create) הושלמו ואומתו. ראו `PHASE_2_IMPLEMENTATION_PLAN.md` סעיף 7-8 ללקחים (GRANT על sequences/functions לא רק טבלאות; סניטציית שדות תאריך ריקים) שיושמו כאן.

---

## 0. היקף — מה כן ומה לא

**כן:**
- `Partner` — טבלה חדשה, CRUD מלא (`list`/`create`/`update`) — נבחרה להיכלל למרות שאין לה מסך ייעודי, כי `ClientPayment`/`SupplierOrder` תלויים בה כ-FK. **הוחלט במפורש** (לא הנחה) להעביר אותה עכשיו במקום להשאיר `partner_id` כ-string רופף.
- `ClientPayment` — **list/filter בלבד**, ללא create/update/delete.
- `SupplierOrder` — **list/filter בלבד**, ללא create/update/delete.

**לא:**
- `ProjectQuote` — **נדחה בכוונה לשלב נפרד**. אושר במפורש: הוא מורכב יותר (CRUD גם ב-`Quotes.jsx` וגם ב-`QuoteEditor.jsx`, לא רק ב-`ProjectDetails.jsx`), ומצדיק תכנון עצמאי.
- `ProjectDetails.jsx` — **לא עובר בשלב זה**. הוא מבצע CRUD מלא על `ClientPayment`/`SupplierOrder`/`ProjectQuote` (`create`/`update`/`delete`, שורות 676-1170, אומת בקוד) — היקף גדול מדי, כמו ב-Phase 2. יישאר על Base44 במלואו.
- `Document`, `Reminder` — נקראים גם הם מ-`ProjectDetails.jsx` אך לא קשורים לקבוצת התלות הנוכחית (`ClientPayment`/`SupplierOrder`/`Partner`) — לא בהיקף.

---

## 1. אימות בפועל — מי קורא למה (לא הנחה, Grep מלא + קריאת קבצים)

**`ClientPayment`+`SupplierOrder` (7 מסכים, כולם list/filter בלבד מחוץ ל-`ProjectDetails.jsx`):**

| קובץ | סוג קריאה | הערה |
|---|---|---|
| `MorningSummary.jsx` | `.list()` שניהם | + `ProjectQuote.list()` — לא בהיקף |
| `BusinessAgent.jsx` | `.list()` שניהם | + `ProjectQuote.list()` — לא בהיקף |
| `Dashboard.jsx` | `.list()` שניהם | **גם** קורא ל-`Project.list('-created_date')` — **כבר** `base44`, לא `ProjectService` — ראו סעיף 5, זה תיקון נדרש נוסף שלא היה בתכנון Phase 2 |
| `Finance.jsx` | `.list()` שניהם | + `ProjectQuote.list()`, `Customer.list()` (עדיין `base44`!) — ראו סעיף 5 |
| `Projects.jsx` | `.list()` שניהם | **כבר עודכן חלקית ב-Phase 2** — `Project`/`Customer` כבר `Service`, אבל `ClientPayment`/`SupplierOrder`/`ProjectQuote` נשארו `base44` בכוונה (מתועד שם) |
| `ProjectDetails.jsx` | `.filter({project_id})` + CRUD מלא | **לא בהיקף Phase 3** — נשאר Base44 |

**`Partner` (רק `ProjectDetails.jsx`, אומת — Grep על `base44\.entities\.Partner\b` לא בוצע כאן במלואו, יש להריץ לפני מימוש בפועל כדי לוודא שלא נס caller נוסף).**

---

## 2. ממצא קריטי — `Finance.jsx`/`Dashboard.jsx` עדיין קוראים ל-`Customer`/`Project` דרך `base44`, לא `Service`

**זה לא היה חלק מהיקף Phase 1/2 המקורי, אך זהו חוב טכני אמיתי שהצטבר:** `Dashboard.jsx` (שורה 23) ו-`Finance.jsx` (Customer.list, לא אומת מספר שורה כאן) עדיין קוראים ל-`base44.entities.Project.list()`/`base44.entities.Customer.list()` — **למרות** ש-`ProjectService`/`CustomerService` כבר קיימים ועובדים. הסיבה: Phase 1/2 עדכנו רק את `Customers.jsx`/`Projects.jsx` עצמם (המסכים הישירים), לא את כל שאר הצרכנים.

**הוחלט (אושר במפורש):** Phase 3 **כולל** ניקוי `Dashboard.jsx`/`Finance.jsx` להשתמש ב-`ProjectService`/`CustomerService` הקיימים, יחד עם החלפת `ClientPayment`/`SupplierOrder`. לא נחזור לאותם קבצים פעמיים.

---

## 3. סכמה — `partners`, `client_payments`, `supplier_orders` (טיוטה, DDL מלא ב-`SUPABASE_SCHEMA_PLAN.md` בנפרד)

### 3.1 `partners`
מיפוי מ-`base44/entities/Partner.jsonc` (אומת): `name` (required), `profit_share_percent` (required, number), `active` (boolean, default true).

```
id, tenant_id, name text not null, profit_share_percent numeric(5,2) not null,
active boolean not null default true,
created_at, updated_at, created_by, updated_by, deleted_at
```

**הערה:** `profit_share_percent` כ-`numeric(5,2)` (לא `numeric(12,2)` כמו שדות כספיים) — זה אחוז (0-100), לא סכום כסף. שווה לשקול `check (profit_share_percent between 0 and 100)`.

### 3.2 `client_payments`
מיפוי מ-`base44/entities/ClientPayment.jsonc` (אומת): `project_id`/`payment_type`/`amount`/`payment_date` required.

```
id, tenant_id, project_id uuid not null references projects(id),
project_name text (denormalized, כמו customer_name ב-projects),
payment_type text not null check (in ('advance','interim','final')),
amount numeric(12,2) not null,
payment_date date not null,
payment_method text check (in ('cash','check','transfer','credit')),
received_by_partner_id uuid references partners(id),  -- FK אמיתי, לא string
received_by_partner_name text (denormalized),
reference text, notes text,
created_at, updated_at, created_by, updated_by, deleted_at
```

### 3.3 `supplier_orders`
מיפוי מ-`base44/entities/SupplierOrder.jsonc` (אומת): `project_id`/`order_type`/`supplier_name`/`order_amount` required.

```
id, tenant_id, project_id uuid not null references projects(id),
project_name text,
order_type text not null check (in ('aluminum','hardware','glass','extras')),
supplier_name text not null, description text,
order_amount numeric(12,2) not null,
paid_amount numeric(12,2) not null default 0,
order_date date, payment_date date,
paid_by_partner_id uuid references partners(id),
paid_by_partner_name text,
status text not null default 'ordered' check (in ('ordered','partial','paid','received')),
created_at, updated_at, created_by, updated_by, deleted_at
```

**הערת FK חוצה-tenant (כמו ב-Phase 2 סעיף 10.3):** RLS INSERT policies על `client_payments`/`supplier_orders` חייבות לבדוק ש-`project_id` (ו-`received_by_partner_id`/`paid_by_partner_id` אם קיימים) שייכים לאותו tenant — לא רק `tenant_id in (select user_tenant_ids())` על השורה עצמה. אך מכיוון ש-**אין create/update בהיקף Phase 3**, בדיקה זו רלוונטית **רק** ל-`partners` (שכן יש לו create) — לא נדרשת ל-`client_payments`/`supplier_orders` בשלב זה כלל, כי אין להם INSERT policy (list/filter בלבד = SELECT policy יחידה).

---

## 4. RLS — SELECT בלבד ל-`client_payments`/`supplier_orders`, מלא ל-`partners`

תואם להיקף המצומצם — בדיוק כמו ש-Phase 2 לא כלל UPDATE policy ל-`projects`:

```sql
-- partners: CRUD מלא (יש create/update)
create policy partners_select ... for select using (tenant_id in (select user_tenant_ids()) and deleted_at is null);
create policy partners_insert ... for insert with check (tenant_id in (select user_tenant_ids()) and user_tenant_role(tenant_id) in ('owner','admin','member') and created_by = auth.uid());
create policy partners_update ... for update using (...) with check (...);

-- client_payments / supplier_orders: SELECT בלבד
create policy client_payments_select ... for select using (tenant_id in (select user_tenant_ids()) and deleted_at is null);
create policy supplier_orders_select ... for select using (tenant_id in (select user_tenant_ids()) and deleted_at is null);
-- אין INSERT/UPDATE/DELETE policies — תואם להיעדר Service methods מתאימים.
```

**GRANT (הלקח מ-Phase 2, נכלל מההתחלה):**
```sql
grant select, insert, update on public.partners to authenticated;
grant select on public.client_payments to authenticated;
grant select on public.supplier_orders to authenticated;
```

---

## 5. Services נדרשים

1. **`partnerService.js`** — `list`/`create`/`update` (דפוס זהה ל-`customerService.js`, ללא soft-delete RPC בשלב זה — לא נדרש UI מחיקה).
2. **`clientPaymentService.js`** — `list()` בלבד.
3. **`supplierOrderService.js`** — `list()` בלבד.

**שאלה פתוחה:** האם צריך גם `filter(projectId)` (לתמיכה עתידית ב-`ProjectDetails.jsx`) כבר עכשיו, או רק `list()` הגורף (מספיק לכל 5 הצרכנים הנוכחיים שכולם קוראים `.list()` ללא פילטר)? **מומלץ:** רק `list()` עכשיו — `filter()` יתווסף כש-`ProjectDetails.jsx` יתוכנן, כדי לא לבנות API לא-בשימוש (אותו עיקרון שהנחה את הסרת update/delete מ-`ProjectService` ב-Phase 2).

---

## 6. עדכוני קוד נדרשים (8 קבצים — היקף רחב יותר מ-Phase 1/2)

| קובץ | שינוי |
|---|---|
| `Dashboard.jsx` | `base44.entities.ClientPayment/SupplierOrder.list()` → Services; **גם** `base44.entities.Project.list()` → `ProjectService.list()` (חוב מ-Phase 2, סעיף 2) |
| `Finance.jsx` | אותו דבר + `Customer.list()` → `CustomerService.list()` (חוב דומה) |
| `MorningSummary.jsx` | `ClientPayment`/`SupplierOrder` → Services. `ProjectQuote` נשאר `base44` (לא בהיקף) |
| `BusinessAgent.jsx` | אותו דבר |
| `Projects.jsx` | `ClientPayment`/`SupplierOrder` → Services (כבר `Project`/`Customer` עברו ב-Phase 2) |
| `ProjectDetails.jsx` | **לא נוגעים** — נשאר Base44 במלואו |

**היקף שינוי גדול יותר מ-Phase 2** (6 קבצים במקום 1) — כל שינוי הוא import swap מכני (ADR-08), לא שכתוב לוגי, אך יש לבדוק regression בכל אחד בנפרד.

---

## 7. סדר צעדים מוצע

1. Migration: `partners`, `client_payments`, `supplier_orders` + RLS + GRANT (כולל usage/execute על כל sequence/function רלוונטי מההתחלה — לקח Phase 2)
2. `partnerService.js`, `clientPaymentService.js`, `supplierOrderService.js` + עדכון `services/index.js`
3. עדכון 5 הקבצים (סעיף 6) — swap אחד בכל פעם, בדיקה בין כל swap
4. Seed: לפחות `partner` אחד לבדיקה (אין נתוני Production, כרגיל)
5. בדיקה ידנית: Dashboard/Finance/Projects נטענים ללא שגיאות `ClientPayment`/`SupplierOrder`/`Project`/`Customer` (עדיין יהיו שגיאות `ProjectQuote` — מצופה, לא בהיקף)
6. בדיקות Vitest ל-3 ה-Services החדשים

---

## 8. מה קרה בפועל — פער בין התוכנית לביצוע

**הפעם, בניגוד ל-Phase 1 (2 באגים) ו-Phase 2 (2 באגים נוספים), המימוש עבר ללא שום באג חדש שנתפס בזמן ריצה.** ה-migration (כולל GRANT מפורש מהתחלה, לקח מ-Phase 2) רצה בהצלחה בניסיון הראשון, ה-seed עבד בניסיון הראשון (UUID אומת ישירות דרך שאילתה, לקח מ-Phase 1), וכל שלושת המסכים (Dashboard/Finance/Projects) נטענו תקין בבדיקה הידנית הראשונה. שני הלקחים שנצברו בשלבים הקודמים באמת מנעו חזרה על אותן טעויות.

### ממצא שלא היה בתוכנית המקורית — `PartnerSettlement.jsx`

הסעיף "לא אומת" בגרסה המקורית של מסמך זה סימן שלא בוצע Grep מלא על `base44.entities.Partner` לפני המימוש. בוצע כעת (אחרי המימוש): מתברר ש**`ProjectDetails.jsx` אינו הצרכן היחיד** — `src/components/finance/PartnerSettlement.jsx` (רכיב שמוצג בתוך `Finance.jsx`, לפי ADR — לא נבדק כאן אם הוא תמיד mounted) מבצע **CRUD מלא** על `Partner`, כולל `delete` — פעולה שלא קיימת ב-`PartnerService` שנבנה (בכוונה, כי לא זוהה צורך).

**למה זה לא שבר כלום בפועל:** `PartnerSettlement.jsx` **לא עודכן** בסבב הזה (לא היה בהיקף שאושר) — הוא ממשיך לקרוא ל-`base44.entities.Partner.*` בדיוק כמו קודם, ולכן ממשיך לעבוד מול Base44 בלי תלות ב-`PartnerService` החדש. זה **לא באג** — זו רק אישור בדיעבד שסימון "לא אומת" בגרסה הקודמת של המסמך היה נכון להשאיר פתוח, וה"מזל" שזה לא יצר בעיה נובע מכך שהיקף השינוי (5 קבצים ספציפיים) לא כלל את `PartnerSettlement.jsx` מלכתחילה.

**השלכה לתכנון עתידי:** כש-`Partner` יזדקק ל-`delete`/soft-delete (בין אם דרך `PartnerSettlement.jsx` או `ProjectDetails.jsx`, שניהם עדיין על Base44) — יש להוסיף RPC דומה ל-`soft_delete_customer` (לא UPDATE ישיר על `deleted_at`, אותו לקח מ-`SUPABASE_SCHEMA_PLAN.md` סעיף 6.3), ולוודא **שני** הצרכנים מתעדכנים יחד, לא רק אחד.

---

## נספח — קבצים שאומתו לצורך מסמך זה

**לפני המימוש:**
- `base44/entities/ClientPayment.jsonc`, `SupplierOrder.jsonc`, `Partner.jsonc` — נקראו במלואם
- `src/pages/Dashboard.jsx` — נקרא חלקית (60 שורות ראשונות), אישר תלות ב-`Project.list()` דרך `base44` ישיר
- `src/pages/ProjectDetails.jsx` — נקרא חלקית (שורות 95-135), אישר CRUD מלא + תלות ב-`Partner.list()`
- Grep גלובלי על `base44\.entities\.(ClientPayment|SupplierOrder|ProjectQuote)\b` — 8 קבצים, מיפוי מלא בסעיף 1

**אחרי המימוש (השלמת הפערים שסומנו "לא אומת"):**
- Grep מלא על `base44\.entities\.Partner\b` — בוצע. גילה `PartnerSettlement.jsx` כצרכן נוסף עם CRUD מלא (סעיף 8) — לא נבדק לפני המימוש כפי שהיה צריך, אך לא גרם לתקלה בפועל.
- `src/pages/Finance.jsx`, `src/components/dashboard/MorningSummary.jsx`, `src/pages/BusinessAgent.jsx`, `src/pages/Projects.jsx` — נקראו/נערכו במלואם בזמן המימוש בפועל.
- כל 8 הקבצים שעודכנו נבדקו לקומפילציה נקייה מול שרת ה-dev (200, לא 500) לפני הבדיקה הידנית.

---

> **סוף מסמך** — 2026-08-13. הושלם ואומת בפועל.
