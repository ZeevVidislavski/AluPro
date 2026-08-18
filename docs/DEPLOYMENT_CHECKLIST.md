# DEPLOYMENT_CHECKLIST.md

## רשימת בדיקות לפני/אחרי העלאה ל-Vercel

> **נכתב:** 2026-08-17 (לילה, לקראת deploy מתוכנן ל-2026-08-17 בבוקר). זו הפעם הראשונה שהמערכת עולה ל-Vercel — נבדק מה שהיה ניתן לבדוק ללא גישה בפועל לפרויקט Vercel (לא נוצר/הוגדר הלילה, רק קוד/config מקומי).

---

## לפני ה-deploy (בדוק/י עכשיו, מקומי)

- [x] **`npm run build` רץ בהצלחה** — נבדק הלילה, `dist/` נוצר תקין (~2.3MB), ללא שגיאות. אזהרת "Base44 Proxy not enabled" היא **צפויה** (אין credentials, ראו הערה למטה) — לא כשל.
- [x] **`npm run test` (Vitest) — 107/107 עוברים**, 3 מדולגים (בכוונה — בדיקת RLS שדורשת credentials אמיתיים).
- [x] **`vercel.json` נוצר הלילה (חדש, לא היה קיים)** — מכיל rewrite ל-SPA routing. **קריטי:** בלי זה, כל ניווט ישיר/רענון לנתיב שאינו `/` (למשל `/Customers`, `/Finance`) **יחזיר 404** ב-Vercel, כי האפליקציה משתמשת ב-`BrowserRouter` (client-side routing) ואין קובץ פיזי בכל נתיב.
- [x] **`.env.example` נוצר הלילה (חדש)** — מתעד את 2 משתני הסביבה הנדרשים בפועל.
- [ ] **הרצת `0011_general_expenses_and_partner_delete.sql`** — ראו `supabase/migrations/README_MORNING.md`. **חייב לרוץ לפני ה-deploy** אם רוצים ש-"הוצאות כלליות" ומחיקת שותפים יעבדו מיד; אחרת המסך עדיין ייטען אך הפעולות האלה ייכשלו (permission denied / relation does not exist).

## משתני סביבה שיש להגדיר ב-Vercel (Project Settings → Environment Variables)

| משתנה | ערך | הערה |
|---|---|---|
| `VITE_SUPABASE_URL` | מ-`.env.local` המקומי | חובה |
| `VITE_SUPABASE_ANON_KEY` | מ-`.env.local` המקומי | חובה — זהו ה-anon key הציבורי, לא ה-service_role key. לוודא שלא בטעות מזינים את ה-service key (שיחשוף גישת admin לכל DB אם ידלוף לקליינט). |

**אין צורך** ב-`VITE_BASE44_APP_ID`/`VITE_BASE44_APP_BASE_URL` — אין credentials זמינים (מגבלה קבועה של הפרויקט, ראו `docs/PHASE_2_IMPLEMENTATION_PLAN.md`), והקוד כבר מתמודד עם היעדרם בחן (`src/lib/app-params.js` מחזיר `null`/`undefined` בלי לזרוק שגיאה, `[base44] Proxy not enabled` היא רק אזהרת קונסול).

## בניית Vercel — הגדרות פרויקט

- **Framework Preset:** Vite (אמור להיות מזוהה אוטומטית)
- **Build Command:** `npm run build` (ברירת מחדל)
- **Output Directory:** `dist` (ברירת מחדל של Vite, לא שונה בפרויקט זה)
- **Install Command:** `npm install` (ברירת מחדל)

## אחרי ה-deploy — לבדוק בדפדפן (על ה-URL של Vercel, לא localhost)

- [ ] טעינת העמוד הראשי (`/`) — לא אמור להיות מסך לבן/שגיאת קונסול קריטית
- [ ] **התחברות (Login)** — Supabase Auth אמור לעבוד זהה למקומי
- [ ] **ניווט + רענון** בנתיב פנימי (למשל `/Customers`, ואז F5) — **הבדיקה הכי חשובה** לוודא ש-`vercel.json` עובד; בלעדיו זו הייתה נקודת הכשל הסבירה ביותר
- [ ] בדיקת מסך אחד שכבר עבר מיגרציה מלאה (למשל `/Customers` או `/Projects`) — CRUD בסיסי
- [ ] בדיקת מסכי Base44 שנשארו (למשל מסך התלוי ב-`ProjectDetails.jsx`) — **צפוי** להיכשל/להראות ריק, כי אין Base44 credentials; זה מוכר וידוע, לא רגרסיה חדשה. חשוב לוודא שזה נכשל *בחן* (הודעת שגיאה ידידותית או מסך ריק) ולא קורס את כל האפליקציה.
- [ ] בדיקת קונסול הדפדפן ל-CORS errors מול Supabase — אם ה-Supabase project מגביל domains, יש להוסיף את דומיין ה-Vercel ל-allowed origins ב-Supabase Auth settings.

## דברים שלא נבדקו/לא ניתן היה לבדוק הלילה (מגבלות עבודה ללא השגחה)

- **לא נוצר/הוגדר פרויקט Vercel בפועל** — זו עדיין פעולה של המשתמשת (יצירת חשבון/פרויקט, חיבור ל-git remote, הגדרת env vars בממשק Vercel).
- **Supabase Auth allowed redirect URLs** — כנראה צריך להוסיף את דומיין הייצור של Vercel לרשימת ה-redirect URLs המורשים ב-Supabase Auth settings (Authentication → URL Configuration). **לא נבדק הלילה** כי אין גישה לממשק Supabase להשוואה מול המצב הנוכחי.
- **בדיקת ביצועים/Lighthouse** — לא בוצעה, לא בהיקף לילה זה.
- **git remote/push בפועל** — לא בוצע שום push. כל השינויים הלילה הם קבצים מקומיים בלבד, ממתינים לסקירה ו-commit על ידי המשתמשת.

---

> **סוף מסמך** — 2026-08-17.
