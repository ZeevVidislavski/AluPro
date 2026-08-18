# בוקר טוב — מה להריץ עכשיו

נכתב הלילה (2026-08-17) בזמן שעבדתי לבד לקראת ה-deploy לוורסל. **לא הרצתי שום SQL** — כרגיל, זה תפקידך.

## מה לרוץ

**רק קובץ אחד חדש:** `0011_general_expenses_and_partner_delete.sql`

כל שאר ה-migrations (0001-0010) כבר רצו בישיבות קודמות ומאושרים. 0011 מוסיף:
- טבלה חדשה `general_expenses` (הוצאות כלליות עסקיות ב-`PartnerSettlement.jsx`)
- RPC חדש `soft_delete_partner` על הטבלה הקיימת `partners` — **אין ALTER TABLE**, רק פונקציה + GRANT חדשים. זה סוגר פער שנמצא הלילה: `PartnerSettlement.jsx` מבצע מחיקת שותפים, אבל עד עכשיו לא היה לזה RPC תואם (Phase 3 בנה רק list/create/update).

## סדר פעולות

1. פתחי את Supabase SQL Editor
2. הריצי את `supabase/migrations/0011_general_expenses_and_partner_delete.sql` במלואו
3. את/ה אמורה לראות "Success. No rows returned"
4. **בדיקה חשובה** (מתועדת כסיכון פתוח ב-`docs/PHASE_9_IMPLEMENTATION_PLAN.md` סעיף 2): אחרי ההרצה, נסי למחוק שותף דרך מסך "שותפים ומחירים" (`Finance.jsx` → טאב "התחשבנות שותפים" → "ניהול שותפים" → מחיקה). אם תקבלי שגיאה כמו `deleted_at must be changed via...` — תגידי לי, זה אומר שהטריגר הקיים על `partners` (מ-2026-08-16, Phase 3) לא תומך ב-flag שה-RPC החדש צריך, ויידרש תיקון קטן נוסף.

## בדיקה ידנית מלאה (אחרי ההרצה)

מסך "שותפים ומחירים" → טאב "התחשבנות שותפים":
- **הוצאות כלליות**: הוסיפי הוצאה חדשה, ערכי אותה, מחקי אותה
- **ניהול שותפים**: הוסיפי שותף, ערכי אותו, **מחקי אותו** (זה החלק החדש — לא היה אפשרי לפני הלילה בלי שגיאה)

## מה עוד נעשה הלילה (לא דורש פעולה ממך, למידע בלבד)

- נכתב `.env.example` (חדש, לא היה קיים) שמתעד אילו משתני סביבה נדרשים לוורסל — רק `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`, שניהם כבר קיימים אצלך ב-`.env.local`
- `npm run build` רץ בהצלחה מקומית — ה-build תקין, בלי שגיאות, כולל בלי Base44 credentials (כצפוי — מתועד כ"proxy not enabled", לא כשל)
- ראי `docs/DEPLOYMENT_CHECKLIST.md` (חדש) לרשימת בדיקות מלאה לפני/אחרי ה-deploy לוורסל
- `docs/PHASE_9_IMPLEMENTATION_PLAN.md` (חדש) — התוכנית המלאה של הלילה, כולל כל מה שאומת ולא אומת

## מה לא נגעתי בו הלילה

- `ProjectDetails.jsx` / `QuoteEditor.jsx` — כרגיל, נשארים קבוע מחוץ להיקף
- `MaterialOrder`/`MaterialOrderItem`/`Document` — אומתו הלילה שהם כלואים אך ורק בתוך `ProjectDetails.jsx`, אין להם מסך עצמאי, לא הועברו
- שום migration קודם (0001-0010) לא נערך מחדש
