# PHASE_10_IMPLEMENTATION_PLAN.md

## תוכנית מימוש Phase 10 — ProjectDetails.jsx (מיגרציה מלאה)

> **תאריך תכנון:** 2026-08-17/18 (לילה שני ברציפות, ללא נוכחות המשתמשת — ראו הערת "עבודה ללא השגחה"). המשתמשת ביקשה: "זה חייב להיות מתוקן לפני העליה לוורסל... מיגרציה מלאה ל-Supabase". אושר במפורש דרך AskUserQuestion.
> **סטטוס:** תכנון + חלק מהקוד. **לא הושלם, לא מוכן ל-deploy כמו שהוא.** ראו סעיף 9 למצב מדויק.

---

## ⚠️ הערת "עבודה ללא השגחה" — קרא/י ראשון

זה השלב **הגדול והמסוכן ביותר** במיגרציה עד כה — מסך יחיד עם 7 ישויות, כולל לוגיקה עסקית רגישה (סגירת התחשבנות, מחיקת פרויקט). בניגוד לכל שלב קודם (1-9), שהיו קטנים מספיק להשלים ולבדוק בישיבה אחת:

- **לא סביר שזה יושלם וייבדק הלילה.** נכתב מה שניתן לכתוב בביטחון (סכמה, שירותים), אך **לא בוצע שינוי בקובץ `ProjectDetails.jsx` עצמו הלילה** — זה השינוי הכי מסוכן (קובץ 1729 שורות, פעולות בלתי הפיכות כמו מחיקת פרויקט), ואני לא רוצה לגעת בו בלי שתהיה לך הזדמנות לעיין בתוכנית לפני שהקוד עצמו משתנה.
- **לא הרצתי שום migration.** כרגיל.
- אם בבוקר אין זמן להשלים את זה לפני ה-deploy: **`ProjectDetails.jsx` יכול להישאר לא-migrated ל-deploy הראשון** — המסכים האחרים כולם עובדים, וזו התנהגות ידועה ותקינה (spinner אינסופי / הודעת שגיאה, לא קריסה של כל האפליקציה). זו לא "חובה מוחלטת", למרות שהמשתמשת ביקשה זאת — יש לשקול deploy עם המגבלה הידועה מול דחיית ה-deploy.

---

## 0. היקף — מיפוי מלא של מה ש-`ProjectDetails.jsx` עושה (1729 שורות, נקרא במלואו)

7 ישויות, כולן דרך `base44.entities.*`:

| ישות | פעולות | הערות |
|---|---|---|
| **`Project`** | `filter({id})`, `update()`, `delete()` | הרשומה המרכזית של המסך. `update()` כולל 3 use-cases שונים: עריכה רגילה (דיאלוג), סגירת התחשבנות (`settlement_status`), פתיחה מחדש |
| **`ClientPayment`** | full CRUD | תת-קומפוננטה `PaymentsSection` |
| **`SupplierOrder`** | full CRUD | תת-קומפוננטה `OrdersSection` |
| **`ProjectQuote`** | full CRUD + **file upload** (`Core.UploadFile`) | תת-קומפוננטה `QuotesSection`. **שים לב:** `Quotes.jsx` (Phase 4) כבר יש לו `ProjectQuoteService.list()/delete()` — אך **`create`/`update` נשארו ב-Base44 בכוונה** (Phase 4 section 9: cross-system UUID risk כי `QuoteEditor.jsx` לא עבר). זו התנגשות תכנונית ישירה עם המסמך הזה — ראו סעיף 3 להחלטה.
| **`Document`** | full CRUD + **file upload** | תת-קומפוננטה `DocumentsSection`. מעולם לא תוכנן (Phase 5 דחה אותו כי אין לו מסך עצמאי) |
| **`Reminder`** | full CRUD | תת-קומפוננטה `RemindersSection`. **שים לב:** `ReminderService` (Phase 5) כבר קיים עם `list/create/update` — **חסר `delete`**, כי `Reminders.jsx` (המסך העצמאי) לא מוחק תזכורות, אבל `ProjectDetails.jsx` כן |
| **`Partner`** | `list()` בלבד (קריאה) | להצגת רשימת שותפים בטפסי תשלום/הזמנה. **`PartnerService.list()` כבר קיים ועובד** — swap ישיר, אין סיכון |
| **`MaterialOrder`+`MaterialOrderItem`** | full CRUD, דרך `MaterialOrdersTab.jsx` + `materialOrderGenerator.js` | **הכי מסובך** — ראו סעיף 1 |

בנוסף: `base44.integrations.Core.UploadFile` (2 מקומות: `QuotesSection`, `DocumentsSection`) — **Storage, אותו pattern כמו CompanyHeader (Phase 6)**, אך כאן קבצים כלליים (PDF/תמונות/כל סוג), לא רק תמונות לוגו.

---

## 1. הבעיה הקריטית שהתגלתה: `MaterialOrder` תלוי ב-`QuoteEditor.jsx`

`materialOrderGenerator.js` (הפונקציה שמייצרת הזמנות חומר אוטומטית) **קורא ל-`QuoteItem` ו-`QuoteItemComponent`** (שורות 22, 29) — אלו ישויות ש**שייכות בלעדית ל-`QuoteEditor.jsx`**, מסך שגם הוא **לא עבר מיגרציה** ונשאר קבוע מחוץ להיקף בכל שלב קודם (ולא נכלל בבקשה של הלילה — המשתמשת ביקשה `ProjectDetails.jsx`, לא `QuoteEditor.jsx`).

**המשמעות:** אי אפשר למגר את "צור הזמנות חומר" (`handleGenerate` ב-`MaterialOrdersTab.jsx`) בלי גם למגר `QuoteItem`/`QuoteItemComponent` מ-`QuoteEditor.jsx` — וזה מחוץ להיקף שאושר.

**החלטה (טרם מאושרת על ידי המשתמשת — לבדוק בבוקר):** מפצל את Phase 10 לשני חלקים:
- **Phase 10א (הלילה/הבוקר):** 6 מתוך 7 הישויות — `Project`, `ClientPayment`, `SupplierOrder`, `ProjectQuote`, `Document`, `Reminder`. טאב "הזמנות חומר" (`MaterialOrdersTab.jsx`) **נשאר על Base44** באופן זמני ומתועד, בדיוק כמו ש-`QuoteEditor.jsx` עצמו נשאר.
- **Phase 10ב (עתידי, לא בהיקף עכשיו):** `MaterialOrder`/`MaterialOrderItem` + `QuoteItem`/`QuoteItemComponent` — ימתין למיגרציה של `QuoteEditor.jsx` עצמו, כי אי אפשר להפריד אותם.

**זה אומר ש-Phase 10א, גם כשיושלם, לא יסגור את הפער לגמרי** — טאב אחד מתוך 6 בתוך המסך יישאר תלוי ב-Base44. זו הפחתה משמעותית (86% מה-99% הבעיה, גסות), לא סגירה מלאה. **יש לבדוק עם המשתמשת בבוקר אם זה מקובל**, לפני שממשיכים.

---

## 2. הבעיה השנייה: `ProjectQuote.create/update` — התנגשות עם Phase 4

Phase 4 (`Quotes.jsx`) קבע במפורש: `create()`/`update()` נשארים ב-Base44 כי **`QuoteEditor.jsx` (עוד מסך שלא עבר) מנווט אליהם ב-ID אחרי היצירה**, ו-Base44 לא יזהה UUID של Supabase.

**האם אותה בעיה חוזרת כאן?** נבדק: ב-`ProjectDetails.jsx`'s `QuotesSection`, אחרי `createMutation`/`updateMutation` **אין שום ניווט** — הדיאלוג נסגר (`setDialogOpen(false)`) והרשימה מתעדכנת במקום (`invalidateQueries`). **אין קריאה ל-`QuoteEditor.jsx` בשום מקום ב-`ProjectDetails.jsx`.** לכן **אין** את אותו סיכון UUID חוצה-מערכת ב-`ProjectDetails.jsx` הספציפי הזה.

**מסקנה:** אפשר להוסיף `create`/`update`/`delete` ל-`project_quotes` ב-Supabase, **אך** יש לוודא ש:
- `Quotes.jsx` (Phase 4) ממשיך לעבוד כרגיל — לא לגעת בו
- שני המסכים (`Quotes.jsx` + `ProjectDetails.jsx`) יקראו לאותה טבלה, כשרק `ProjectDetails.jsx` יקבל את יכולות ה-create/update (ב-RLS/Service Layer, לא רק ב-UI)
- **הפער עם `QuoteEditor.jsx` נשאר קיים באופן עצמאי** — `QuoteEditor.jsx` יוצר הצעות מחיר מפורטות (עם `QuoteItem`) בדרך שונה לגמרי מה-`ProjectQuote` הפשוט של `ProjectDetails.jsx`. שתי הזרימות שונות מבחינה מהותית (`is_detailed: true/false`), לא סתירה — Base44 וSupabase יתקיימו זה לצד זה לישות `project_quotes`, בדיוק כמו ש-Base44 ו-Supabase מתקיימים זה לצד זה ל-`CompanyHeader` (Phase 6, `QuoteEditor.jsx` עדיין קורא לגרסת Base44 שלו).

---

## 3. סכמה נדרשת — מיפוי "מה קיים" מול "מה חסר"

### 3.1 `projects` — קיימת (0003), חסר: UPDATE policy + DELETE (soft, RPC)

```sql
create policy projects_update on public.projects
  for update using (
    deleted_at is null
    and tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  )
  with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
  );

-- soft_delete_project RPC — אותו דפוס מדויק כמו כל שאר ה-soft deletes
grant update on public.projects to authenticated;
grant execute on function public.soft_delete_project(uuid) to authenticated;
```

הטריגר הקיים (`protect_immutable_columns_projects`, מ-0003) **כבר תומך** ב-GUC bypass flag — אין צורך לגעת בו, רק להוסיף את ה-RPC שמשתמש בו (בדיוק כמו RPC `soft_delete_partner` שנוסף הלילה הקודמת ל-`partners` בלי ALTER TABLE).

**`closed_by` הוא כבר FK אמיתי ל-`profiles`** (לא string כמו Base44 המקורי, שם זה "מנהל" הארדקוד) — ה-Service צריך להזריק את `auth.uid()` בפועל, לא string קבוע. זהו שיפור אמיתי על ההתנהגות הקיימת (התיעוד ב-0003 כבר צופה את זה: *"closed_by is a real FK to profiles, ready for when ProjectDetails.jsx migrates and stops hardcoding 'מנהל'"*).

### 3.2 `client_payments` / `supplier_orders` — קיימות (0005), SELECT בלבד. חסר: INSERT/UPDATE/DELETE מלא

שתי הטבלאות זהות במבנה למה שנדרש (`project_id not null`, `received_by_partner_id`/`paid_by_partner_id` כ-FK אמיתי ל-`partners`) — **אין צורך ב-ALTER TABLE**, רק policies+RPC+GRANT חדשים.

### 3.3 `project_quotes` — קיימת (0006), SELECT+soft-delete בלבד (Phase 4). חסר: INSERT/UPDATE

```sql
create policy project_quotes_insert on public.project_quotes
  for insert with check (
    tenant_id in (select public.user_tenant_ids())
    and public.user_tenant_role(tenant_id) in ('owner', 'admin', 'member')
    and created_by = auth.uid()
    and project_id in (
      select id from public.projects
      where tenant_id in (select public.user_tenant_ids()) and deleted_at is null
    )
  );

create policy project_quotes_update on public.project_quotes
  for update using (...) with check (...);  -- אותו דפוס

grant insert, update on public.project_quotes to authenticated;
```

הטריגר (`protect_immutable_columns_project_quotes`, מ-0006) **כבר קיים ותומך** ב-GUC bypass (נבנה יחד עם ה-soft-delete RPC ב-Phase 4) — אין צורך לשנות.

**Storage:** `project_quotes.file_url` היום הוא `base44.integrations.Core.UploadFile` → URL ציבורי קבוע. יש לעבור לאותו pattern כמו `CompanyHeader` (Phase 6): bucket פרטי + signed URL. **בקט חדש:** `project-files` (משותף גם ל-`Document`, ראו 3.5) — path: `{tenant_id}/project-quotes/{quote_id}/{timestamp}_{filename}`.

### 3.4 `reminders` — קיימת (0007), select/insert/update. חסר: DELETE (soft, RPC)

```sql
grant execute on function public.soft_delete_reminder(uuid) to authenticated;
```

**שים לב:** הטריגר הקיים (0007) **חוסם שינוי `deleted_at` ללא תנאי, בלי GUC flag** (כי לא היה RPC כשזה נכתב ב-Phase 5). **זה דורש `create or replace function` על הטריגר הקיים** כדי להוסיף את ה-GUC bypass — לא רק RPC חדש. שונה מ-`projects`/`project_quotes` (שכבר תמכו בזה). **סיכון לתעד:** יש לוודא שההחלפה לא שוברת reminders קיימים באמצע העדכון (בפועל: `create or replace function` הוא atomic, לא אמור להיות סיכון, אך יש לבדוק ידנית אחרי ההרצה).

### 3.5 `documents` — טבלה חדשה לגמרי

```sql
create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  tenant_id      uuid not null references public.tenants(id) on delete cascade,
  project_id     uuid not null references public.projects(id),
  project_name   text,

  document_type  text not null check (document_type in ('contract','plan','invoice','photo','delivery')),
  name           text not null,
  file_url       text not null,  -- יהפוך ל-Storage path, ראו למטה
  notes          text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id),
  updated_by  uuid references public.profiles(id),
  deleted_at  timestamptz
);
```

מלא CRUD + Storage (אותו bucket `project-files`, path `{tenant_id}/documents/{document_id}/{timestamp}_{filename}`).

### 3.6 Storage bucket חדש — `project-files`

בניגוד ל-`company-logos` (Phase 6, רק תמונות), כאן קבצים כלליים: PDF (הצעות מחיר), כל סוג קובץ (מסמכים — חוזים, תוכניות, חשבוניות, תמונות, תעודות משלוח). **המלצה: bucket אחד משותף** ל-`project_quotes`+`documents`, לא שניים נפרדים — אותה RLS logic (`tenant_id` מה-path), אין סיבה אמיתית להפריד.

```sql
insert into storage.buckets (id, name, public) values ('project-files', 'project-files', false);

create policy project_files_select on storage.objects
  for select using (bucket_id = 'project-files' and (storage.foldername(name))[1] in (select public.user_tenant_ids()::text));
create policy project_files_insert on storage.objects
  for insert with check (bucket_id = 'project-files' and (storage.foldername(name))[1] in (select public.user_tenant_ids()::text));
```

**לא אומת מול Supabase חי** (כמו כל Storage migration קודמת) — אך Phase 6 כבר אימת שה-pattern הזה עובד בפועל, אז זהו הסיכון הנמוך ביותר בכל המסמך הזה.

---

## 4. Services נדרשים

| Service | שינוי |
|---|---|
| `projectService.js` | **מורחב**: `get(id)`, `update(id, data)` (מזריק `updated_by`, לא "מנהל" הארדקוד), `closeSettlement(id)`, `reopenSettlement(id)`, `delete(id)` (soft, RPC) |
| `clientPaymentService.js` | **מורחב**: `create`, `update`, `delete` (soft, RPC) |
| `supplierOrderService.js` | **מורחב**: `create`, `update`, `delete` (soft, RPC) |
| `projectQuoteService.js` | **מורחב בזהירות**: `create`, `update` — **חובה לתעד בקוד שזה שונה מ-`Quotes.jsx`'s שימוש** (שם create/update נשארים על Base44 בכוונה, ראו סעיף 2). `uploadFile`/`getFileUrl` חדשים (Storage, כמו CompanyHeaderService) |
| `reminderService.js` | **מורחב**: `delete` (soft, RPC) |
| `documentService.js` | **חדש**: `listByProject`, `create`, `update`, `delete` (soft, RPC), `uploadFile`, `getFileUrl` |
| `partnerService.js` | **ללא שינוי** — `list()` כבר קיים ומכסה את הצורך |

---

## 5. עדכוני קוד ב-`ProjectDetails.jsx` (טרם בוצעו)

כל מקום שקורא `base44.entities.*` (בקובץ הראשי + 5 תת-קומפוננטות: `PaymentsSection`, `OrdersSection`, `QuotesSection`, `DocumentsSection`, `RemindersSection`) עובר ל-Service המתאים. `MaterialOrdersTab.jsx` **לא משתנה** (נשאר Base44, ראו סעיף 1).

**נקודות זהירות ספציפיות:**
- `closeSettlementMutation`: `closed_by: "מנהל"` → צריך את ה-`user.id`/שם אמיתי מ-Supabase Auth, לא string קבוע
- `QuotesSection`/`DocumentsSection`'s `handleFileUpload`: `Core.UploadFile` → `Service.uploadFile()`, ואז תצוגת קובץ (`<a href={file_url}>`) → צריך signed URL, לא URL ישיר מה-DB (בדיוק כמו `HeaderLogo` ב-`CompanyHeaders.jsx`, Phase 6)
- מחיקת פרויקט (`deleteProjectMutation`) — **בלתי הפיכה**, יש לוודא שה-RPC `soft_delete_project` בודק הרשאות נכון לפני שנוגעים בזה

---

## 6. סדר צעדים מוצע (לביצוע בבוקר, לא הלילה)

1. **אישור המשתמשת** על חלוקת 10א/10ב (סעיף 1) — לא להניח
2. Migration אחת גדולה: policies/RPCs/GRANTs חדשים על 4 טבלאות קיימות + טבלת `documents` חדשה + bucket `project-files`
3. הרחבת 5 Services קיימים + `documentService.js` חדש
4. עדכון `ProjectDetails.jsx` + 5 תת-קומפוננטות (**לא** `MaterialOrdersTab.jsx`)
5. בדיקות Vitest לכל שירות שהשתנה/נוצר
6. `npm run build` מקומי
7. המשתמשת מריצה migration, בודקת ידנית **כל טאב בנפרד** (תשלומים, הזמנות, הצעות מחיר, מסמכים, תזכורות) + עריכת פרויקט + סגירת התחשבנות + מחיקת פרויקט (**בזהירות**, על פרויקט בדיקה בלבד, לא אמיתי)
8. עדכון מסמך זה

---

## 7. סיכונים פתוחים שדורשים החלטת משתמשת (לא הניח לבד)

1. **חלוקת 10א/10ב** (סעיף 1) — האם קביל שטאב "הזמנות חומר" יישאר על Base44 גם אחרי Phase 10?
2. **מחיקת פרויקט** — פעולה הרסנית. יש UI קיים עם אזהרה ("פעולה זו אינה ניתנת לביטול") אך זה soft-delete ב-DB (ניתן לשחזור ידני ב-SQL) — האם זה מספיק, או שצריך אזהרה נוספת/הרשאות מחמירות יותר (רק owner, לא member)?
3. **Storage bucket משותף** (`project-files` ל-quotes+documents יחד) — האם מקובל, או להפריד ל-2 buckets נפרדים לניהול פשוט יותר בעתיד?

---

## 8. נספח — קבצים שאומתו

- `src/pages/ProjectDetails.jsx` — נקרא במלואו (1729 שורות)
- `src/components/project/MaterialOrdersTab.jsx` — נקרא במלואו
- `src/lib/materialOrderGenerator.js` — נקרא במלואו — **זה שגילה את תלות QuoteItem/QuoteItemComponent**
- `base44/entities/{Project,Document,ProjectQuote,MaterialOrder,MaterialOrderItem}.jsonc` — נקראו במלואם
- `supabase/migrations/{0003_projects,0005_partners_payments_orders,0006_project_quotes,0007_reminders}.sql` — נקראו במלואם, למיפוי "מה קיים כבר"
- `src/services/{projectService,clientPaymentService,supplierOrderService}.js` — נקראו במלואם

---

## 9. מה קרה בפועל

**כל שלוש ההחלטות הפתוחות מסעיף 7 אושרו בפועל על ידי המשתמשת בבוקר** (לא הונחו לבד): תיבת אישור המחיקה הקיימת מספיקה; דלי אחסון משותף אחד ל-quotes+documents (בהתאם לתקדים היחיד שהיה קיים, `company-logos` מ-Phase 6); והוחלט להרחיב את ההיקף לכלול גם את `QuoteEditor.jsx` (ראו `PHASE_11_IMPLEMENTATION_PLAN.md`) כדי לפתור את תלות ה-Material Orders.

**מומש בפועל (2026-08-18, תחת Auto Mode):**
1. **`0012_project_details.sql`** — migration מלאה: 4 טבלאות קיימות הורחבו (projects, client_payments, supplier_orders, project_quotes) עם policies/RPCs/GRANTs חדשים; טבלת `documents` חדשה; bucket `project-files` משותף; **תיקון התנהגות לטריגר הקיים על `reminders`** (הוספת GUC-bypass flag, כי RPC חדש נוסף).
2. **6 Services הורחבו/נוצרו:** `projectService.js` (get/update/closeSettlement/reopenSettlement/delete — `closed_by` עכשיו FK אמיתי במקום המחרוזת הקבועה "מנהל"), `clientPaymentService.js`, `supplierOrderService.js`, `reminderService.js` (delete), `projectQuoteService.js` (create/update/uploadFile/getFileUrl — **ורק** עבור `ProjectDetails.jsx`, לא `Quotes.jsx`), `documentService.js` (חדש לגמרי).
3. **`ProjectDetails.jsx` עודכן במלואו** — כל 5 תת-הקומפוננטות (`PaymentsSection`, `OrdersSection`, `QuotesSection`, `DocumentsSection`, `RemindersSection`) הוחלפו ל-Services. `MaterialOrdersTab.jsx` **לא נגע**, כמתוכנן — נשאר על Base44 עד ש-Phase 11 יסגור את התלות המלאה.
4. **תבנית upload דו-שלבית** (צור-רשומה-קודם) יושמה עבור `ProjectQuoteService`; עבור `DocumentService` (ש-`file_url` שלו `not null`, לא ניתן ליצור רשומה ריקה כמו ב-quotes) נבחרה גישה חלופית: path זמני מבוסס timestamp בצד לקוח, לא תלוי ב-id אמיתי מה-DB.
5. **`npm run build` + Vitest (140/140 עוברים)** — נבדק אחרי כל שלב, אין רגרסיות.

**Migration `0012` הורץ בהצלחה על ידי המשתמשת ואומת ידנית** — כל הפעולות בתוך `ProjectDetails.jsx` נבדקו ועבדו: תשלומים, הזמנות ספקים, הצעות מחיר בתוך הפרויקט (כולל upload קובץ), מסמכים (כולל upload), תזכורות (כולל מחיקה — הפעולה החדשה), עריכת פרטי פרויקט, סגירת/פתיחת התחשבנות. **טאב "הזמנות חומר" עדיין תלוי ב-Base44 כמתועד** (לא רגרסיה, תלות ידועה ב-`QuoteItem`/`QuoteItemComponent` בדרך שדורשת עדכון נפרד ל-`materialOrderGenerator.js` — לא בוצע הלילה).

---

## 10. הזמנות חומר — נסגר (2026-08-18, אחרי Phase 11)

מכיוון ש-Phase 11 מיגר את `QuoteItem`/`QuoteItemComponent` במלואם, התלות שחסמה את טאב "הזמנות חומר" הוסרה. מומש:

- **`0015_material_orders.sql`** — טבלאות `material_orders`+`material_order_items` חדשות, אותו דפוס soft-delete+RPC כמו כל טבלה אחרת עם delete בפרויקט (Base44 המקורי עושה hard delete כאן — סטייה מכוונת לעקביות, כמו ב-`quote_items`).
- **`materialOrderService.js` + `materialOrderItemService.js`** — חדשים.
- **`materialOrderGenerator.js`** עודכן במלואו — כל 6 קריאות ה-Base44 הוחלפו ל-Services (`ProjectQuoteService.listByProject`, `QuoteItemService.listByQuote`, `QuoteItemComponentService.listByQuoteItems`, `ModelComponentService.listByModel`, `MaterialOrderService`, `MaterialOrderItemService`) — הלוגיקה העסקית (אגרגציה לפי order_type+item_code) לא שונתה כלל.
- **`MaterialOrdersTab.jsx`** עודכן — swap מכני, ללא שינוי UI.
- Vitest: 149/149 עוברים (9 בדיקות חדשות). Build תקין.

**כל ה-7 הישויות של `ProjectDetails.jsx` עברו מיגרציה מלאה. Phase 10 סגור לחלוטין.**

---

> **סוף מסמך** — נכתב 2026-08-17/18 לילה, מומש ואומת 2026-08-18 בבוקר. **Phase 10 סגור במלואו** (כולל הזמנות חומר).
