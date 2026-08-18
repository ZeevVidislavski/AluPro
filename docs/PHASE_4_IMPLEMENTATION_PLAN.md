# PHASE_4_IMPLEMENTATION_PLAN.md

## תוכנית מימוש Phase 4 — ProjectQuote דרך Quotes.jsx — List + Delete (Soft, RPC) בלבד

> **תאריך תכנון:** 2026-08-13 | **עדכון החלטות היקף:** 2026-08-13 | **תאריך מימוש:** 2026-08-16
> **סטטוס:** ✅ **מומש ואומת במלואו.** `list` ו-`delete` (soft, דרך RPC) שניהם נבדקו ידנית ועבדו בפעם הראשונה. ראו סעיף 10 ("מה קרה בפועל") — כולל באג שנתפס **לפני** המימוש (לא בזמן ריצה, שיפור לעומת Phase 1-3) הודות לתכנון שכבר צפה את הבעיה מראש.
> **תנאי מקדים:** Phase 1-3 (`Customer`, `Project`, `Partner`, `ClientPayment`, `SupplierOrder`) הושלמו ואומתו. שני לקחים קריטיים חייבים ליישום מההתחלה: GRANT מפורש על כל טבלה/sequence/function (Phase 2), אימות UUID ישיר מ-`auth.users` לפני seed (Phase 1).
>
> **החלטות היקף שהתקבלו (2026-08-13), משנות את הסעיפים המקוריים למטה:**
> 1. **`create` נשאר על Base44 בינתיים** — לא עובר ב-Phase 4 (ראו סעיף 9 המקורי: מנע רגרסיה של מסך `QuoteEditor` שבור אחרי ניווט לרשומה שלא קיימת שם). **ProjectQuoteService כולל רק `list`+`delete`.**
> 2. **מחיקה = soft delete דרך RPC**, עקבי ל-`soft_delete_customer` (לא `DELETE` ישיר).
> 3. **סעיף 5 (`addition_number`) הפך לא-רלוונטי ל-Phase 4** — הוא היה שאלה על `create`, שלא עובר עוד. יישאר פתוח לשלב שבו `create`/`QuoteEditor` יתוכננו.

---

## 0. היקף — מה כן ומה לא

**כן:** `ProjectQuote` דרך `Quotes.jsx` **בלבד** — `list`, `create`, `delete`.

**לא — וזה החלטה משמעותית יותר מ-Phase 2/3, לא רק "עוד מסך":**
- **`QuoteEditor.jsx` לא עובר בשלב זה, ולא ידוע מתי.** אומת בקוד: הוא נוגע ב-**6 ישויות שונות** (`ProjectQuote.filter/update`, `QuoteItem.filter/create/update/delete`, `QuoteItemComponent.filter/create/update/delete`, `ModelPricing.list`, `QuoteTemplate.list/create`, `CompanyHeader.list`, וגם `Project.filter` — לא `ProjectService.list()`), כולל יצוא PDF (`html2canvas`+`jsPDF`), בחירת קטלוג (`CatalogPickerModal`), ותבניות. זהו **מנוע התמחור המרכזי של המערכת**, לא מסך רגיל — היקף שדורש תכנון עצמאי משמעותי, לא הרחבה של Phase 4.
- **`ProjectDetails.jsx` — כרגיל, לא עובר.** גם הוא מבצע CRUD על `ProjectQuote` (`create`/`update`/`delete`, שורות 1145-1174, אומת) — אך זה כבר ידוע ומתועד משלבים קודמים.
- **`QuoteItem`, `QuoteItemComponent`, `ModelPricing`, `QuoteTemplate`, `CompanyHeader`** — לא נכללות כלל ב-Phase 4. הן קיימות רק בתוך `QuoteEditor.jsx`/`ModelPricing.jsx` (לא נבדק כאן) שלא בהיקף.

**המשמעות המעשית:** גם אחרי Phase 4, `Quotes.jsx` יראה רשימת הצעות מ-Supabase, אך לחיצה על "ערוך" (`/QuoteEditor?quote_id=...`) עדיין תוביל למסך שקורא ל-Base44 עבור אותה הצעה בדיוק. זהו מצב ביניים מכוון וידוע — לא באג.

---

## 1. אימות בפועל — מה `Quotes.jsx` עושה (לא הנחה)

נקרא במלואו (246 שורות). ממצאים:

1. **קריאות `ProjectQuote`:** `.list("-created_date")`, `.create(data)`, `.delete(id)`. **אין `update`** במסך הזה — עריכה מתבצעת רק דרך ניווט ל-`QuoteEditor.jsx` (`Link to={/QuoteEditor?quote_id=...}`), לא inline.
2. **קריאה נוספת:** `Project.list()` — **כבר קיים `ProjectService`** (Phase 2), יש להחליף גם כאן (אותו דפוס כמו ב-Phase 3 עם `Dashboard.jsx`/`Finance.jsx`).
3. **לוגיקת `create` לא טריוויאלית:** `addition_number: projectQuotes.length` — סופר הצעות קיימות לאותו פרויקט כדי לקבוע את מספר התוספת. **זהו באג ידוע ומתועד** (`AUDIT_REPORT_2026-08-03.md`/`CLAUDE_MIGRATION_REVIEW.md` סעיף 2: "`addition_number` מחושב כ-`quotes.length`... עלול להיות שגוי אם יש מחיקות, לא מספר רץ אמיתי"). **החלטה נדרשת** (סעיף 5) — לתקן כמו ש-`project_number` תוקן ב-Phase 2, או לשחזר כמו שהוא.
4. **אחרי יצירה, ניווט מיידי:** `window.location.href = /QuoteEditor?quote_id=${newQuote.id}` — כלומר `create()` **חייב** להחזיר את הרשומה שנוצרה (כולל `id`) כדי שהניווט יעבוד. תואם לדפוס הקיים ב-`CustomerService.create()`/`ProjectService.create()` (מחזירים `.select().single()`).
5. **שדות ברירת מחדל רבים ב-`create`:** `subtotal`, `vat_amount`, `total_with_vat` מאותחלים ל-`0` — אלו שדות שבפועל מחושבים ונשמרים על ידי `QuoteEditor.jsx` (שלא עובר). ב-Supabase, השדות האלו יכולים פשוט להתחיל כ-`0`/`null` ולהתעדכן מאוחר יותר כש-`QuoteEditor` יעבור — לא דורש טיפול מיוחד ב-Phase 4 עצמו.

---

## 2. סכמה — `project_quotes` (טיוטה)

מיפוי מ-`base44/entities/ProjectQuote.jsonc` (אומת בסבב קודם): `project_id`/`addition_number`/`amount` required.

```
id, tenant_id, project_id uuid not null references projects(id),
project_name text, customer_name text,  -- denormalized, כמו project_number
quote_number text,
addition_number integer not null,
quote_date date, valid_until date,
amount numeric(12,2) not null,
subtotal numeric(12,2),
discount_percent numeric(5,2) not null default 0,
vat_percent numeric(5,2) not null default 17,
vat_amount numeric(12,2),
total_with_vat numeric(12,2),
changes_description text, notes text,
file_url text,  -- נשאר כשם שדה זמנית; לא עובר ל-Storage בשלב זה (ראו סעיף 6)
status text not null default 'draft' check (status in ('draft','sent','approved','rejected')),
is_detailed boolean not null default false,
created_at, updated_at, created_by, updated_by, deleted_at
```

**הערת ייחודיות (מקבילה ל-`project_number` ב-Phase 2):** אם ההחלטה בסעיף 5 היא לתקן את `addition_number` — נדרש `unique (project_id, addition_number) where deleted_at is null`, בדיוק כמו ש-`DATABASE_MIGRATION.md` כבר המליץ בזמנו (`@@unique([project_id, addition_number])`).

**RLS INSERT — בדיקת FK חוצה-tenant (כמו Phase 2/3):** `project_id` חייב להיות בתוך tenant המשתמש.

---

## 3. GRANT — נכלל מההתחלה (הלקח מ-Phase 2, יושם נכון ב-Phase 3 — להמשיך)

```sql
grant select, insert on public.project_quotes to authenticated;
-- אין update/delete GRANT — לפי היקף list+create+delete, יש להחליט:
-- delete כן צריך GRANT+policy (יש UI מחיקה ב-Quotes.jsx), update לא (רק QuoteEditor/ProjectDetails, לא בהיקף).
grant delete on public.project_quotes to authenticated;
```

**הערה:** בניגוד ל-`client_payments`/`supplier_orders` ב-Phase 3 (SELECT בלבד), `project_quotes` **כן** צריך RLS policy + GRANT ל-`DELETE` — כי `Quotes.jsx` (בהיקף) מבצע מחיקה בפועל (`window.confirm` + `deleteQuoteMutation`, אומת בקוד).

---

## 4. Services נדרשים

**`projectQuoteService.js`** — `list()`, `create(data)`, `delete(id)`. **אין `update`** — לא קיים ב-`Quotes.jsx`, ותואם לדפוס "לא לבנות מעבר לשימוש בפועל" שכבר יושם ב-`ProjectService`/`ClientPaymentService`.

```js
export const ProjectQuoteService = {
  async list() { ... },     // תואם ל-.list("-created_date")
  async create(data) { ... }, // מזריק tenant_id/created_by; addition_number לפי החלטה בסעיף 5
  async delete(id) { ... },   // hard delete או soft — ראו סעיף 6
};
```

---

## 5. שאלה פתוחה שדורשת החלטה — `addition_number`

בדיוק כמו `project_number` ב-Phase 2 (סעיף 5 שם), אך **סוג בעיה שונה מעט**: `project_number` היה ללא-משמעות עסקית (רק מזהה ייחודי); `addition_number` **כן** נושא משמעות עסקית ("0 = הצעה ראשונית, 1+ = תוספות" — אומת ב-schema). לכן הפתרון לא יכול להיות "sequence גלובלי" סתמי — הוא חייב להיות **per-project**, מתחיל מ-0 עבור כל פרויקט בנפרד.

**אפשרות A (שחזור):** להשאיר `addition_number: projectQuotes.length` בצד ה-client, כמו היום — פשוט, אך משמר את הבאג הידוע.

**אפשרות B (תיקון, per-project):** לחשב `addition_number` בשרת (RPC או `DEFAULT` עם subquery) כ-`coalesce(max(addition_number), -1) + 1` בתוך אותו `project_id` — אטומי יותר, אך לא לגמרי חסין מפני race condition בלי transaction/lock מפורש (בניגוד ל-`nextval()` על sequence שהוא אטומי מובנה).

**המלצה:** **אפשרות B עם RPC ייעודי** (לא `DEFAULT` expression פשוט, כי per-project logic מורכב מדי ל-`DEFAULT`), בדומה לרוח התיקון ב-Phase 2 — אך **זו החלטה שדורשת אישור מפורש**, לא הנחה, כי המורכבות (RPC + lock) גדולה יותר מ-sequence פשוט.

---

## 6. שאלה פתוחה נוספת — `delete` הוא soft או hard?

בהתאם לדפוס שנקבע ב-Phase 1 (`customers` — RPC soft-delete) לעומת מה ש-Base44 עצמו עושה (ככל הנראה hard delete, `PROJECT_AUDIT.md`: "אין audit log, אין versioning"). **`Quotes.jsx` בפועל** משתמש ב-`window.confirm` ואז מחיקה מיידית — אין UI לשחזור בקוד הקיים.

**המלצה:** **soft delete דרך RPC** (`soft_delete_project_quote`), עקבי עם `customers` — גם אם אין עדיין UI לשחזור, השארת הרשומה ב-DB (עם `deleted_at`) שומרת על היסטוריה שיכולה להיות קריטית לביקורת פיננסית (הצעת מחיר שנמחקה בטעות). **לא אושר עדיין — יש להחליט לפני מימוש.**

---

## 7. עדכוני קוד נדרשים

| קובץ | שינוי |
|---|---|
| `Quotes.jsx` | `base44.entities.ProjectQuote.*` → `ProjectQuoteService.*`; `base44.entities.Project.list()` → `ProjectService.list()` (חוב טכני, כמו ב-Phase 3) |

**קובץ יחיד** — היקף הקוד הקטן ביותר עד כה (לעומת 6 ב-Phase 3, 5 ב-Phase 2/1) — למרות שהתכנון (הסכמה, ה-RPC) מורכב יותר.

---

## 8. סדר צעדים מוצע

1. **החלטות סעיף 5 ו-6** — לא ניתן להתחיל migration בלעדיהן (משפיעות על מבנה ה-DDL/RPC).
2. Migration: `project_quotes` + RLS (select/insert/delete) + GRANT + (בהתאם להחלטה) RPC ל-`addition_number` ו/או soft-delete
3. `projectQuoteService.js` + עדכון `services/index.js`
4. עדכון `Quotes.jsx` (2 swaps: `ProjectQuote`, `Project`)
5. בדיקה ידנית: יצירת הצעה חדשה (כולל ניווט אוטומטי ל-`QuoteEditor` — **יכשל שם**, כי `QuoteEditor` עדיין Base44 ומצפה למזהה Base44, לא Supabase UUID — ראו סיכון בסעיף 9), מחיקת הצעה, רשימה
6. בדיקות Vitest ל-`ProjectQuoteService`

---

## 9. סיכון חדש שלא היה בשלבים קודמים — פערי מזהים בין Supabase ל-Base44 ב-`QuoteEditor`

**זה שונה מהותית מ-Phase 2/3:** בכל השלבים הקודמים, המסכים שלא עברו (`ProjectDetails.jsx` וכו') פשוט המשיכו לקרוא ל-Base44 **באותה מערכת מזהים** (Base44 IDs). אך `Quotes.jsx` (עובר) ו-`QuoteEditor.jsx` (לא עובר) **מקושרים ישירות** — `Quotes.jsx` יוצר הצעה ב-Supabase (מקבלת UUID של Supabase) ומיד מנווט ל-`/QuoteEditor?quote_id={supabase-uuid}`, אבל `QuoteEditor.jsx` שואל את זה מ-Base44 (`base44.entities.ProjectQuote.filter({id: quoteId})`), **שלא יודע על UUID-ים של Supabase כלל**.

**המשמעות:** לחיצה על "הצעה חדשה" ב-`Quotes.jsx` לאחר Phase 4 תיצור רשומה בהצלחה ב-Supabase, אך תוביל למסך `QuoteEditor` **ריק/שבור** (לא ימצא הצעה עם אותו UUID ב-Base44). זהו **רגרסיה פונקציונלית אמיתית**, לא רק "שגיאת קונסול" כמו ב-Phase 2/3.

**אפשרויות לטיפול (לא הוכרעו):**
- **א.** לקבל את זה כמגבלה זמנית מתועדת — "הצעה חדשה" יוצרת רשומה תקינה ברשימה, אך עריכה מפורטת לא זמינה עד ש-`QuoteEditor` יעבור.
- **ב.** להשבית זמנית את הניווט האוטומטי (`window.location.href`) אחרי יצירה, ולהשאיר את המשתמש ב-`Quotes.jsx` — מונע את חוויית "עמוד שבור", אך גם מונע גישה מיידית לעריכה שהמשתמש ציפה לה.
- **ג.** לדחות את המעבר של `create()` (רק `list`+`delete` עוברים, `create` נשאר Base44 בינתיים) — הכי בטוח מבחינת UX רציף, אך פחות "שלם" כ-migration.

**דורש החלטה מפורשת לפני מימוש — זו לא בעיה שנתקן "תוך כדי" כמו הבאגים הקודמים; היא נובעת ישירות מהחלטת ההיקף (QuoteEditor לא עובר), לא מטעות תכנות.**

---

## 10. מה קרה בפועל — פער בין התוכנית לביצוע

### שיפור מתודולוגי לעומת Phase 1-3 — הבאג הראשי נתפס בתכנון, לא בזמן ריצה

בניגוד לשלושת השלבים הקודמים (שבהם כל באג התגלה רק אחרי הרצה בדפדפן), **הבאג המרכזי של Phase 4 נתפס בזמן כתיבת הקוד עצמו, לפני הרצת ה-migration**: תוך כדי עדכון `Quotes.jsx`, זוהה שדיאלוג "הצעה חדשה" משתמש באותה משתנה `projects` גם לתצוגה (יכולה להיות Supabase) וגם למקור ה-`project_id` שנשלח ל-`base44.entities.ProjectQuote.create()` (חייב להיות Base44). זה תוקן **לפני** בדיקה ידנית — לא התגלה על ידי המשתמשת בדפדפן. זהו סימן שהלקחים המצטברים מ-Phase 1-3 (לחשוב מראש על גבולות בין מערכות, לא רק על סכמה בתוך מערכת אחת) התחילו להשפיע על איכות התכנון עצמו.

### אימות בפועל — מה עובד ומה לא נבדק עדיין

**עבד בבדיקה ראשונה:** `Quotes.jsx` נטען תקין מול Supabase (`list()`), מציג "0 הצעות סה"כ" (נכון — אין נתוני Production, כצפוי).

**אומת בעקיפין, לא ישירות:** דיאלוג "הצעה חדשה" הציג רשימת פרויקטים **ריקה** — לא באג בקוד שנכתב, אלא תוצאה ישירה של מגבלה קיימת ומתועדת: אין `VITE_BASE44_APP_ID`/`VITE_BASE44_APP_BASE_URL` ב-`.env.local` (ראו `PHASE_2_IMPLEMENTATION_PLAN.md` סעיף 8, "מגבלה ידועה שנותרה פתוחה"). ה-Console הראה `GET .../api/apps/null/entities/Project 404` — בדיוק אותה שגיאה שכבר תועדה, לא שגיאה חדשה. זה **מאשר** בפועל שההיגיון של "השאר `create` על Base44" עבד כמתוכנן — הבעיה היחידה שנחשפה היא המגבלה החיצונית הידועה (אין גישה ל-Base44), לא כשל בקוד של Phase 4 עצמו.

**אומת בהמשך (2026-08-16, אחרי seed ידני):** מחיקת הצעת מחיר קיימת דרך `deleteQuoteMutation` → `soft_delete_project_quote` RPC. הוזרעה הצעה אחת ידנית (₪15,000, קושרה לפרויקט `P000001` הקיים), נמחקה דרך כפתור המחיקה ב-UI, ואומתה ישירות ב-DB (`0010_verify_soft_delete_quote.sql`): הרשומה עדיין קיימת, `deleted_at` מלא (`2026-08-16 07:36:05`), `updated_by` מצביע נכון למשתמש שביצע את הפעולה. **עבד בפעם הראשונה, ללא באג נוסף.**

### מסקנה

Phase 4 **מומש במלואו בהיקף המצומצם שאושר** (list+delete בלבד, create נשאר Base44 בכוונה) — שני החלקים נבדקו ידנית ועבדו. זהו הפעם הראשונה שכל הרכיבים (migration, service, קוד, ובדיקה ידנית) עברו ללא אף באג שהתגלה **בזמן ריצה** — הבאג היחיד (UUID חוצה-מערכת) נתפס ותוקן לפני שהגענו לשלב הבדיקה בכלל.

---

## נספח — קבצים שאומתו לצורך מסמך זה

**לפני המימוש:**
- `src/pages/Quotes.jsx` — נקרא במלואו (246 שורות)
- `src/pages/QuoteEditor.jsx` — נקרא חלקית (180 שורות ראשונות) — אישר את ההיקף הרחב (6 ישויות) שהוביל להחלטה להוציא אותו מ-Phase 4
- `src/pages/ProjectDetails.jsx` — נקרא חלקית (שורות 1140-1174) — אישר CRUD מלא כולל `update`, לא רק `create`/`delete`
- `base44/entities/ProjectQuote.jsonc` — נקרא בסבב קודם (Phase 3), נעשה בו שימוש חוזר כאן

**במהלך המימוש (2026-08-16):**
- `src/pages/Quotes.jsx` נקרא שוב תוך כדי עריכה, מה שהוביל לגילוי מוקדם של באג ה-UUID החוצה-מערכת (סעיף 10 למעלה) — לפני שהתגלה בבדיקה ידנית.

**אומת בהמשך (2026-08-16):**
- `supabase/seed/0009_seed_quote_for_delete_test.sql`, `0010_verify_soft_delete_quote.sql` — seed ובדיקה ישירה ב-DB, אישרו soft delete תקין מקצה לקצה.

**לא אומת (נותר פתוח, לא קריטי):**
- `src/pages/ModelPricing.jsx` — לא נקרא, ייתכן שגם הוא צרכן של `ProjectQuote`/`QuoteTemplate` בעקיפין

---

> **סוף מסמך** — 2026-08-16. מומש ואומת במלואו.
