# ProjectFlow Pro — ביקורת UI/UX (שלב 1: ניתוח בלבד)

> **היקף:** ניתוח המערכת הקיימת בלבד. לא שונה קוד, לא נוצר Design System, לא בוצעו Commit/Deploy, ולא נעשו בדיקות מול נתוני Production.
> **האפליקציה שנבדקה:** `windows-crm/` (שם פנימי `base44-app`). התיקיות `BusinessAgent/` ו-`window-designer/` (וגרסאות ה-`original`) הן פרויקטים נפרדים ולא נכללו.
> **שיטה:** קריאת קוד וספירות grep על `src/pages`, `src/components` ו-`Layout.jsx` (בלי `components/ui`, אלא אם צוין). המספרים הם קירוב לצורך קביעת סדרי גודל. לא הורצה האפליקציה ולא נבדקו מסכים בדפדפן, ולכן ממצאי רספונסיביות ונגישות מבוססים על הקוד בלבד.

---

## 1. מפת מסכים וניווט

### 1.1 נתיבים (`src/App.jsx`, `src/pages.config.js`)

| נתיב | קובץ | גישה | בתפריט הצד? |
|---|---|---|---|
| `/login`, `/reset-password` | `pages/Login.jsx`, `pages/ResetPassword.jsx` | ציבורי | לא |
| `/` ו-`/Dashboard` | `pages/Dashboard.jsx` | מחובר | כן |
| `/Customers` | `pages/Customers.jsx` | מחובר | כן |
| `/Projects` | `pages/Projects.jsx` | מחובר | כן |
| `/ProjectDetails?id=` | `pages/ProjectDetails.jsx` (1,808 שורות) | מחובר | לא (מגיעים מרשימת פרויקטים) |
| `/ModelPricing` | `pages/ModelPricing.jsx` | מחובר | כן ("קטלוג דגמים") |
| `/Finance` | `pages/Finance.jsx` | מחובר | כן ("פיננסים") |
| `/Reminders` | `pages/Reminders.jsx` | מחובר | כן |
| `/CompanyHeaders` | `pages/CompanyHeaders.jsx` | מחובר | כן ("כותרות הדפסה") |
| `/BusinessAgent` | `pages/BusinessAgent.jsx` | מחובר + תוכנית | כן, מותנה ב-`planHasFeature` ("🤖 ניהול חכם") |
| `/Quotes` | `pages/Quotes.jsx` | מחובר | **לא** (הועבר לדשבורד, `Dashboard.jsx` "moved here from the menu") |
| `/QuoteEditor?quote_id=` | `pages/QuoteEditor.jsx` (790 שורות) | מחובר | לא |
| `/Team` | `pages/Team.jsx` | owner/admin בלבד | כן, מותנה |
| `/Profile` | `pages/Profile.jsx` | מחובר | כן, בתחתית |
| `/admin/tenants`, `/admin/tenants/new`, `/admin/tenants/:id` | `pages/admin/*` | מנהל פלטפורמה | כן, מותנה |
| `*` | `lib/PageNotFound.jsx` | — | — |

### 1.2 מבנה הניווט (`Layout.jsx`)
- Sidebar קבוע בצד ימין (`w-64`, `lg:` ומעלה). במובייל הוא נפתח כ-drawer ביד (`useState`) עם backdrop ו-header עליון.
- פריטי הניווט מוגדרים כמערך `navigation`, אבל "צוות", "מסוף ניהול פלטפורמה" ו"פרופיל" כתובים כל אחד כבלוק JSX משוכפל עם אותם ה-classes.
- סימון פריט פעיל נעשה לפי `currentPageName === href`, אז מסכי עומק לא מסמנים את הוריהם: ב-`QuoteEditor` ו-`ProjectDetails` שום פריט בתפריט לא מודגש.
- `PlatformAdminLayout.jsx` הוא Layout נפרד לגמרי (header כהה ללא sidebar). אין breadcrumbs, ויש רק כפתורי "חזרה" מקומיים (`ArrowRight` / `ChevronLeft` בעמודים בודדים).
- **ניווט מעורב:** `Link`, `navigate()` ו-`window.location.href` בשימוש מעורב. דוגמאות: `Quotes.jsx:77` ו-`ProjectDetails.jsx:206` מבצעים טעינה מלאה במקום ניווט SPA. `QuoteEditor.jsx:91` קורא את ה-id מ-`window.location.search` במקום `useSearchParams`.
- שמות המותג לא עקביים: `index.html` → "AluPro", `Layout.jsx` → "ניהול פרויקטים", `Login.jsx` → "ProjectFlow Pro", `manifest.json` → "CRM".

**המלצה ראשונית:** מערך ניווט אחד שמגדיר גם קבוצות ופריטים מותנים, וקומפוננטת `NavItem` אחת. להוסיף "הצעות מחיר" לתפריט (או לספק נקודת כניסה ברורה), לסמן פריט הורה פעיל במסכי עומק, ולהוסיף breadcrumbs ל-`ProjectDetails` ול-`QuoteEditor`. לאחד שם מוצר.

---

## 2. טכנולוגיות Frontend וספריות UI (`package.json`)

| תחום | טכנולוגיה |
|---|---|
| Framework / Build | React 18, Vite 6, JavaScript (JSX; `utils/index.ts` הוא הקובץ היחיד ב-TS), `jsconfig.json` |
| Routing | react-router-dom 6 |
| Data | @tanstack/react-query 5, Supabase JS (`lib/supabaseClient.js`, `services/*`); שאריות Base44 (`api/base44Client.js`, `@base44/sdk`, `@base44/vite-plugin`) |
| עיצוב | Tailwind CSS 3.4 + `tailwindcss-animate`, CSS variables בסגנון shadcn, `class-variance-authority`, `clsx`, `tailwind-merge` |
| רכיבי בסיס | shadcn/ui סגנון "new-york" (`components.json`) על Radix UI, 47 קבצים ב-`components/ui/` |
| אייקונים | lucide-react |
| טפסים | react-hook-form + zod + `components/ui/form.jsx` **מותקנים אך לא בשימוש** — כל הטפסים הם `useState` ידני |
| טבלאות | אין ספרייה; `<table>` ידני |
| גרפים | recharts (`ProfitabilityChart`, `components/ui/chart.jsx` לא בשימוש) |
| גרירה | @hello-pangea/dnd (רק ב-`QuoteEditor`) |
| PDF | html2canvas + jsPDF (צילום DOM, לא PDF טקסטואלי) |
| הודעות | shadcn toast (`use-toast` + `Toaster`), וגם `sonner` ו-`react-hot-toast` מותקנים; בפועל רק `use-toast` בשימוש, ורק ב-2 מסכים |
| תאריכים | date-fns (בשימוש) + moment (מותקן, ככל הנראה כבד ומיותר) |
| לא בשימוש / חשד ליתירות | three, react-leaflet, react-quill, react-markdown, @stripe/*, canvas-confetti, framer-motion, embla-carousel, react-day-picker, lodash, moment (דורש אימות לפני הסרה) |
| בדיקות | Vitest — קיימות בדיקות ל-services ול-`agentLogic`; **אין בדיקות UI/רכיבים** |

**המלצה ראשונית:** להחליט על "ספריית הטפסים" האחת (RHF+zod או useState) ועל מערכת הודעות אחת. לבדוק תלויות לא בשימוש לפני כל עבודת Design System, כי הן מנפחות את ה-bundle (`dist/` כולל `purify`, `index.es` וכד').

---

## 3. Design Tokens, רכיבים משותפים ו-Design System חלקי

### מה קיים
- **Tokens ב-`src/index.css` + `tailwind.config.js`:** משתני HSL של shadcn (`--background`, `--primary`, `--muted`, `--destructive`, `--border`, `--radius`, `--chart-1..5`, `--sidebar-*`) כולל ערכת `.dark`. הערכה כולה **אפורה-ניטרלית** (`baseColor: neutral`), והצבע המותגי הכחול לא מוגדר בה.
- **ספריית primitives:** `components/ui/*` (47 קבצים). **בשימוש בפועל רק 12:** button, checkbox, dialog, dropdown-menu, input, label, select, switch, tabs, textarea, toaster/use-toast.
- **רכיבי דומיין משותפים:** `StatsCard`, `ProjectStatusBadge`, `SmartFocusCard`, `QuoteItemCard`, `CatalogPickerModal`, `SelectHeaderModal`, `LoadTemplateModal`, `TemplateModal`, `SupplierPicker`.
- **Utilities:** `cn()`, `lib/formKeyboardNav.js` (ניווט בחצים בטפסי דיאלוג, בשימוש ב-3 מסכים), `CATEGORY_LABELS/COLORS` ב-`lib/quoteCalculations.js`.

### מה חסר (פער מרכזי)
המערכת משתמשת ב-tokens רק בתוך `components/ui/*`. בקוד האפליקציה עצמו:
- **~782** מופעי `bg|text|border-slate-*`, **0** מופעי `bg-primary / text-muted-foreground / bg-card`.
- **44** `bg-blue-600` (ו-`hover:bg-blue-700`) קשיחים על `<Button>` ב-12 קבצים, למרות שה-`variant="default"` של הכפתור הוא **שחור** (`--primary: 0 0% 9%`). בפועל הצבע המותגי הוא `blue-600` הקשיח, והטוקן `primary` לא בשימוש.
- **0** מופעי `dark:` — מצב כהה מוגדר ב-CSS אבל ללא מימוש, ו-`next-themes` מותקן ולא מחובר. מוצג רקע `bg-slate-50` קשיח ב-Layout.
- **41** צבעי hex בקוד JSX (בעיקר `QuotePrintView.jsx`, שעוצב ב-inline styles ב-`#2563eb`, `#64748b` וכו').
- משפחות צבע בשימוש: slate 630, blue 195, red 144, emerald 53, amber 50, green 34, purple 18, orange 16 — בלי הגדרה סמנטית (success/warning/danger/info).
- רדיוסים: `rounded-2xl` 55, `-xl` 51, `-md` 56, `-full` 48, `-lg` 27 — בלי מדרג מוגדר.
- אין טוקנים לטיפוגרפיה, למרווחים או לצללים, ואין הגדרת פונט (נשאר פונט המערכת; `QuotePrintView` מגדיר `Arial` בנפרד).

**המלצה ראשונית:** שלב 2 יכול להתחיל מהגדרת טוקנים סמנטיים (`brand`, `success`, `warning`, `danger`, `info`, `surface`, גדלי טקסט, רדיוסים) כמשתני CSS שממופים ב-Tailwind, ואז להחליף את `blue-600/slate-*` הקשיחים בהדרגה. אפשר לעשות זאת בלי לגעת בלוגיקה.

---

## 4. כפילויות בעיצוב

### 4.1 כפתורים
- `components/ui/button.jsx` קיים עם variants, אך הצבע המותגי מוזרק ידנית (ראו 3): `flex-1 bg-blue-600 hover:bg-blue-700` ×12, `bg-blue-600 hover:bg-blue-700` ×5, `w-full …` ×3, `min-w-32 …` ×1, פעם אחת `bg-green-600` כ-CTA, וכפתורי מחיקה עם `text-red-400/500/300 hover:text-red-600 hover:bg-red-50` בגרסאות שונות (`QuoteItemCard`, `PartnerSettlement`, `ProjectDetails`).
- **29** `<button>` גולמיים ב-15 קבצים (למשל `QuoteItemCard.jsx:114,166`, `QuoteEditor.jsx:682`, `Layout.jsx`) במקום `Button`.
- גדלי כפתורים אד-הוק: `h-7 text-xs` על `size="sm"` (`QuoteItemCard`) מעל גובה מינימלי מומלץ למגע (גבהי 24–28px).
- כפתורי איקון (`size="icon"`) — 27 מופעים, רק אחד עם `title`/`aria-label`.

### 4.2 טפסים
- אותו דפוס `<div className="space-y-1|space-y-2"><Label/><Input/></div>` מועתק בכל קובץ; אין `FormField` (עם label, hint, שגיאה, חובה). סימון שדה חובה (`<span className="text-red-500">*`) מופיע **פעם אחת בלבד** בכל המערכת (`CatalogPickerModal`).
- ולידציה: אין zod/RHF בפועל; הודעות שגיאה בעיקר דרך state מקומי (`error` ב-`Login`) או `disabled` על כפתור.
- גבהי Input: `h-9` (ברירת מחדל), `h-7` ו-`h-6` ב-QuoteEditor, בלי תקן. `Input` בסיסי עם `text-base md:text-sm`.
- שדות מספר עם `parseFloat(...) || 0` — מונע מחיקת הערך (ראו 6.3, משפיע גם על UX וגם על נכונות).
- ניווט מקלדת בטפסים: קיים ושימושי (`formKeyboardNav`, מקשי חיצים ב-`CatalogPickerModal`) אך מיושם בחלק מהמסכים בלבד.

### 4.3 טבלאות
- 16 מופעי `<table>` ב-12 קבצים; **0** שימושים ב-`components/ui/table.jsx`.
- כותרות `<th>` ב-11+ וריאציות class שונות (ספירה: `p-3 text-slate-600` ×14, `text-right px-4 py-3 text-sm font-medium text-slate-600` ×12, `text-right px-3 py-2 …` ×10, `text-right px-4 py-2 text-xs …` ×8, `px-6 py-4 text-xs uppercase tracking-wider` ×5 ועוד). חלק מהכותרות `text-left` (למשל סכומים) וחלקן `text-right`, ו-`uppercase` לא רלוונטי לעברית.
- רק 4 מקומות עם `overflow-x-auto` — טבלאות רחבות (`ProjectDetails`, `Quotes`, `ModelPricing`) עלולות להישבר במובייל.
- אין מצב טעינה לטבלה (אין Skeleton), אין מיון/עימוד.

### 4.4 כרטיסים
- אין שימוש ב-`ui/card.jsx`. מעטפת כרטיס נכתבת ידנית ב-~50 מקומות בוריאציות: `bg-white rounded-2xl border border-slate-200 overflow-hidden` ×19, `… p-6` ×14, `rounded-xl … p-5` ×4, `rounded-xl … overflow-hidden`, `… p-6 hover:shadow-lg`, וכו'. כרטיסי נתונים (`StatsCard`) הם הרכיב היחיד שנעשה בו שימוש חוזר, והוא כולל 5 variants צבעוניים.
- כותרות עמוד: `text-3xl` ×10, `text-2xl` ×9, עם margin-bottom שונה. ריפוד עמוד: `p-6 lg:p-8` ×10, `p-4 lg:p-8` ×1 (`QuoteEditor`), `p-6` ×1; רוחב מקסימלי: `max-w-2xl|4xl|5xl|6xl|7xl` — כולם שונים. 24 מופעי `min-h-screen` על מעטפות עמוד שכבר בתוך Layout (פוגע בגלילה/גובה כשיש header).

### 4.5 חלונות Modal / דיאלוגים
- **שתי שפות:** `ui/dialog` בכל מקום לטפסים, אך **אישור מחיקה = `window.confirm()`** ב-17 מקומות ב-9 קבצים (`ProjectDetails` ×7, `ModelPricing`, `Quotes`, `Team`, `PartnerSettlement`, `MaterialOrdersTab`, `SupplierPicker`, `ModelComponentsTab`, `TemplateComponentsManager`). `alert-dialog.jsx` קיים ולא בשימוש. נוסחי ההודעה שונים ("האם אתה בטוח…", "למחוק?", "למחוק רכיב מהתבנית?").
- ברירת מחדל של `DialogContent` חוסמת סגירה בלחיצה מחוץ לדיאלוג (החלטה טובה שעוזרת נגד אובדן קלט).
- 27 מופעי `DialogContent` בכ-13 צירופי גודל/overflow/dir שונים (`max-w-sm|md|lg|2xl`, עם/בלי `max-h-[90vh] overflow-y-auto`, עם/בלי `dir="rtl"`, ו-`overflow-hidden p-0` אחד). 9 מהם ללא רוחב מפורש, ו-14 מתוך 27 ללא `dir="rtl"`.
- **באג RTL ב-Modal:** Radix מציג את הדיאלוג ב-Portal מחוץ ל-`<div dir="rtl">` של Layout, ו-`index.html` לא מגדיר `dir` או `lang="he"`. לכן 14 מתוך 27 דיאלוגים ללא `dir="rtl"` (בעיקר ב-`Customers`, `ProjectDetails`, `Projects`) עשויים להיפתח ב-LTR: יישור טקסט, מיקום כפתורים, וכפתור X ב-`right-4` (קבוע בקוד של `dialog.jsx`) וכותרת `sm:text-left`. כנ"ל לגבי `SelectContent` (37 מופעים) שנפתח ב-Portal. **דורש אימות בדפדפן.**
- כותרות הדיאלוגים/כפתורי הפעולה לא עקביים: "שמור", "צור תבנית", "הוסף (n)", "אישור" וכו', ומיקום כפתור ראשי/משני משתנה.

### 4.6 סטטוסים
יש לפחות 6 הגדרות נפרדות של תוויות/צבעים לסטטוסים, חלקן לאותו אובייקט עם ערכים שונים:

| קובץ | הגדרה | הערה |
|---|---|---|
| `components/dashboard/ProjectStatusBadge.jsx` | draft/approved/completed → slate/blue/emerald | "מאושר" |
| `pages/Quotes.jsx:15` | draft/sent/approved/rejected → slate/blue/green/red | "אושר" (טקסט שונה), `green` במקום `emerald` |
| `components/dashboard/QuotesList.jsx:5` | draft/approved, רק טקסט ללא צבע | |
| `components/project/ProfitabilityReport.jsx:6` | draft/approved/completed | "מאושר" |
| `components/project/MaterialOrdersTab.jsx:17` | draft/sent/received → slate/**amber**/green | "נשלח" כאן צהוב ובהצעות כחול |
| `pages/ProjectDetails.jsx:964,1270,1658` | הזמנות / הצעות / תזכורות — תוויות מקומיות | |
| `pages/admin/PlatformTenant*.jsx` | `STATUS_LABELS`, `PAYMENT_STATUS_LABELS` — מועתקים בשני הקבצים | |

אותו מושג ("טיוטה", "אושר") מוצג בטקסט ובצבע שונה בין מסכים. רק `ProjectStatusBadge` הוא רכיב; השאר `span` עם `rounded-full text-xs px-2/3 py-1`.

### 4.7 עיצוב ופורמט נוספים
- **פורמט מטבע:** 20 מימושי `Intl.NumberFormat('he-IL', {currency:'ILS'…})` מקומיים ב-17 קבצים (`formatCurrency`/`fmt` מוגדר מחדש בכל קובץ, ובתוך `ProjectDetails.jsx` 4 פעמים). `CatalogPickerModal` משתמש ב-`₪{...toLocaleString}` — פורמט שונה.
- **מצבי טעינה:** `Loader2 animate-spin` ב-28 קבצים עם מעטפת `min-h-screen flex items-center justify-center` מועתקת (10 פעמים). אפס `Skeleton`.
- **מצבי ריק:** ~44 מופעי "אין …" כטקסט עצמאי עם ריפוד וצבע שונים; ללא אייקון/CTA אחיד.
- **הודעות משוב:** `toast` ב-2 מסכים בלבד; במקומות אחרים אין הודעת הצלחה/שגיאה ברורה (או `window.confirm`/state מקומי).
- **אייקונים:** 🤖 אמוג'י בתוך שם פריט ניווט ("🤖 ניהול חכם") בעוד שאר הפריטים אייקוני lucide.

**המלצה ראשונית:** רכיבים משותפים הקיימים כבר כבסיס — `PageHeader`, `PageContainer`, `Card`, `DataTable`/`Table` (ממומש על `ui/table`), `StatusBadge` עם מפת סטטוסים מרכזית, `ConfirmDialog` (על `alert-dialog`), `FormField`, `EmptyState`, `LoadingState`, `formatCurrency` ב-`lib/format.js`. כולם שכבת תצוגה בלבד.

---

## 5. RTL, רספונסיביות ונגישות

### 5.1 RTL
- RTL מוגדר ידנית ב-`dir="rtl"` על ~25 אלמנטים ברמת עמוד/דיאלוג, **לא** על `<html>`. `index.html` נשאר `lang="en"` וללא `dir`.
- הסתמכות על classes פיזיים: `ml-*` ×60, `mr-*` ×10, `text-right` ×61, `text-left` ×24, `pr/pl` ×5 — **0** שימוש ב-logical properties (`ms-/me-/ps-/pe-/text-start/text-end`). במקרים רבים הערך נבחר "כדי שייראה נכון ב-RTL" (למשל `<Plus className="ml-2"/>` לפני טקסט), מה שנשבר אם הרכיב מוצג ב-LTR (ראו 4.5).
- אייקוני כיוון: `ArrowRight` כ"חזרה", `ChevronLeft` להמשך — נכון ל-RTL אך כתוב כקבוע ולא דרך מנגנון.
- `PlatformAdminLayout` ו-`Layout` שניהם מציבים `dir` בנפרד.
- קיימת הערה מפורשת בקוד (`CatalogPickerModal`) על היפוך חצים — דוגמה טובה שכדאי להפוך לכלל.
- מספרים/מטבע: `he-IL` ללא בעיה; בטבלאות סכומים מיושרים `text-left`/`text-right` לא עקבי.
- PDF (`QuotePrintView`): `dir="rtl"`, צילום DOM באמצעות html2canvas ← טקסט בתמונה, לא ניתן לחיפוש/העתקה.

### 5.2 רספונסיביות
- Breakpoints: `lg:` ×32, `sm:` ×18, `md:` ×13, `xl:` 0. Layout פוצל נכון ב-`lg` (sidebar ↔ drawer).
- רשתות: 16 `grid-cols-1` עם `md/lg`, אך 18 מקומות `grid-cols-2/3/4` ללא ברירת מחדל קטנה.
- `useIsMobile` (`hooks/use-mobile.jsx`) לא בשימוש בכלל.
- **סיכוני מובייל:** `QuoteItemCard` — שורת כותרת אחת עם 5 שדות מספר (`w-14/w-16`), תיאור, סכום ושלוש כפתורים בשורה `flex` אחת, וגם `Table` של רכיבים עם 6 עמודות ללא `overflow-x-auto`. `TabsList` ב-`ProjectDetails` עם 6 טאבים עלול לגלוש. עמודי רשימה בטבלאות (`Quotes`, `ModelPricing`).
- אין CSS להדפסה (`@media print`/`print:`).

### 5.3 נגישות
- `aria-*` בקוד האפליקציה: **מופע אחד** (`Login.jsx`). אפס `sr-only` מחוץ ל-`components/ui`.
- **27** כפתורי איקון בלבד (`size="icon"`) ו-29 `<button>` גולמיים, כמעט כולם ללא `aria-label`/שם נגיש (פח, עריכה, הרחבה/כיווץ, X).
- ~132 שימושי `text-slate-300/400` לטקסטים ואייקונים (ניגודיות נמוכה על לבן, לא עומד ב-WCAG AA), ו-147 `text-xs` בגופן קטן, בעיקר במידות/שדות מספר.
- תוויות: 125 `<Label>` מול 31 `htmlFor` — רוב השדות ללא קישור לתווית (אלא אם מעוטפים). `<img>` ×7 — לא נבדק לגבי `alt` לכל אחד.
- מקלדת: Radix מספק focus-trap ו-Escape בדיאלוגים; `QuoteItemCard` משתמש ב-`div`/`button` לגרירה עם `dragHandleProps` (ל-hello-pangea יש תמיכת מקלדת מובנית, אך אין הנחיה למשתמש). עריכת תיאור בלחיצה על טקסט (`button` → `Input`) נגישה חלקית.
- סטטוס/מצב מועבר בצבע בלבד בחלק מהתגיות (אדום/ירוק); `window.confirm` שאינו עקבי עם עיצוב.
- אין "skip to content" ואין `<nav aria-label>`; `<main>` קיים ב-Layout (טוב).

**המלצה ראשונית:** (א) `lang="he" dir="rtl"` על `<html>` והסרת `dir` מקומי; (ב) מעבר הדרגתי ל-logical properties; (ג) `aria-label` חובה ב-`IconButton`; (ד) העלאת ניגודיות; (ה) מובייל — כרטיס-שורה במקום טבלה. אלה שינויי תצוגה ואינם נוגעים בלוגיקה.

---

## 6. עורך הצעות המחיר — ניתוח מעמיק

### 6.1 מבנה רכיבים

```
pages/QuoteEditor.jsx (790)            ← עמוד + כל ה-state + שמירה + PDF
├─ פרטי הצעה (תאריך / בתוקף עד / מע"מ)          ← JSX inline
├─ DragDropContext / Droppable / Draggable      ← @hello-pangea/dnd
│   └─ components/quotes/QuoteItemCard.jsx (222)
│        ├─ כותרת פריט: ר' × ג' ס"מ, כמות, תיאור (עריכה inline), סה"כ, כפתורים
│        └─ טבלת רכיבים: שם | גובה×רוחב | כמות | מחיר יחידה | סה"כ | מחיקה
├─ בלוק סיכומים (inline ב-QuoteEditor)          ← סכום, הנחה %, לפני מע"מ, מע"מ, סה"כ
├─ הערות (Textarea)
├─ CatalogPickerModal (316)  — בחירת רכיבים מהקטלוג (חיפוש, קטגוריות, מקלדת, עריכת מחיר)
├─ TemplateModal / LoadTemplateModal / SelectHeaderModal
└─ QuotePrintView (148)      — תצוגת הדפסה נסתרת, inline styles, מקור ל-html2canvas/jsPDF
lib/quoteCalculations.js     ← calcComponentValue / calcItemTotal / generateDescription / תוויות וצבעי קטגוריה
```

מודל נתונים: הצעה → פריטים (`QuoteItem`: רוחב, גובה, כמות, תיאור) → רכיבים (`QuoteItemComponent`: snapshot של שם/קטגוריה/שיטת תמחור/מחיר + `quantity`). השמירה מ-state מקומי (`items`, `componentsMap`, `quoteForm`).

### 6.2 חישובים (תיעוד לשימור בעת שדרוג UI)
- **רכיב:** `sqm` = רוחב×גובה/10000 × מחיר × כמות רכיב × כמות פריט; `meter`/`meter_width` = רוחב/100 × …; `meter_height` = גובה/100 × …; `unit` = מחיר × כמות רכיב × כמות פריט; ברירת מחדל 0 (`lib/quoteCalculations.js:6-24`).
- **פריט:** סכום הרכיבים. **הצעה:** `linesTotal` → הנחה באחוזים → `subtotal` → מע"מ → `totalWithVat` (`QuoteEditor.jsx:30-40`).
- המקור נמצא ב-`quoteCalculations.js` ל-2 הרמות הראשונות, אבל `calcQuoteTotals` (רמת ההצעה) **מוגדר בתוך `QuoteEditor.jsx`**, לא בספרייה. חישוב מתבצע במקומות: `QuoteItemCard` (סכום פריט ושורה, בנפרד), `QuoteEditor` (totals + שמירה), `QuotePrintView` (מחיר יחידה ושורה), ושוב בשמירה (`calculated_value`, `total_price`).
- הסכומים נשמרים ב-DB (`subtotal`, `vat_amount`, `total_with_vat`, `amount`, `total_price`) — כלומר כל שינוי בנוסחה משפיע על נתונים שמורים. **אין לגעת בלוגיקה זו בשלבי ה-UI.**

### 6.3 ממצאים (UX + סיכונים עסקיים לתיעוד; לא תוקנו)

| # | ממצא | קבצים | חומרה |
|---|---|---|---|
| 1 | **אי-עקביות מע"מ:** ברירת מחדל 18 (`QuoteEditor:45`, `Quotes:66`, `ProjectDetails:1178`), fallback בטעינה 17 (`QuoteEditor:106`), fallback בחישוב 17 (`:37`), fallback בשדה 18 (`:605`). בנוסף `parseFloat(...) \|\| 18` מונע הזנת 0% (הערך חוזר ל-18), ו-`\|\| 17` בחישוב הופך 0 ל-17. | `QuoteEditor.jsx` | **גבוהה** (כספי) |
| 2 | **הכותרת "גובה × רוחב"** בטבלת הרכיבים מציגה `height × width`, בעוד שבכותרת הפריט הסדר "ר' × ג'" (רוחב × גובה). בהדפסה `width×height`. סדר מידות לא עקבי. | `QuoteItemCard.jsx:236,250`, `QuotePrintView.jsx` (עמודת מידות: רוחב×גובה) | בינונית |
| 3 | **אין חיווי איזה חישוב חל על כל רכיב** (מ"ר / מ' רץ / יחידה): `pricingMethodLabel` מיובא ב-`QuoteItemCard` ולא מוצג. המשתמשת רואה מחיר יחידה בלי יחידת מידה. | `QuoteItemCard.jsx:6,261` | בינונית |
| 4 | **כותרת פריט עמוסה** — שורה אחת עם 10 אלמנטים (חץ, ר', ג', כמות, תיאור, מ"ר/מ' רץ, סה"כ, +רכיב, תבנית, מחיקה). במובייל לא שמיש. תיאור נחתך (`truncate`). | `QuoteItemCard.jsx:113-222` | גבוהה (UX) |
| 5 | **מחיקת פריט/רכיב ללא אישור ובלי ביטול** (בניגוד לשאר המערכת עם `window.confirm`), ומחיקת פריט שמור מבצעת קריאות DB מיידיות (`deleteItem`). | `QuoteEditor.jsx:195`, `QuoteItemCard.jsx:213,271` | גבוהה |
| 6 | **שדות מספר:** `value={item.quantity \|\| 1}` ו-`parseFloat(v)\|\|0` ⇒ אי אפשר למחוק את הספרה כדי להקליד מחדש (קופץ ל-1/0); כמות רכיב `\|\| 1`. אין `step`/`min` עקבי, אין ולידציית שלילי. | `QuoteItemCard.jsx:124,147,256` | בינונית |
| 7 | **מחיר רכיב ניתן לעריכה inline** אך ללא הבחנה בין מחיר קטלוג למחיר שונה; אין אינדיקציה "שונה מהקטלוג" ולא איפוס. | `QuoteItemCard.jsx:262`, `CatalogPickerModal.jsx` | נמוכה-בינונית |
| 8 | **תיאור אוטומטי** מתעדכן בהוספה/הסרת רכיב וגורס עריכה ידנית של תיאור (`generateDescription` → `updateItem`). המשתמשת לא מקבלת אזהרה או אינדיקציה. | `QuoteEditor.jsx:229,241` | בינונית |
| 9 | **שמירה אוטומטית**: חיווי טוב ("נשמר אוטומטית") אך יחד עם כפתור "שמור" — מבלבל; אין חיווי שגיאת שמירה (`try/finally` בלבד, בלי catch או הודעה). אין התראה על שינויים שלא נשמרו ביציאה (נשמר ב-cleanup, לא ב-`beforeunload`). | `QuoteEditor.jsx:268-285,395-409,578-588` | גבוהה |
| 10 | **בלוק סיכומים** אינו דביק (sticky), רחוק מהפריטים ברשימות ארוכות. שדה ההנחה ברוחב 64px עם `h-7`. חסר חיווי שההנחה היא על כלל ההצעה. | `QuoteEditor.jsx:692-723` | בינונית |
| 11 | **ה-PDF** מבוסס צילום DOM: טקסט כתמונה, תלוי ב-`setTimeout(500)`, חיתוך עמודים בהערכה, ללא שורות רכיבים פנימיות — מציג רק שורה לכל פריט. עיצוב ב-inline styles שאינם משתמשים בטוקנים. | `QuoteEditor.jsx:497-550`, `QuotePrintView.jsx` | בינונית |
| 12 | **סדר פריטים בגרירה** בלי חיווי יעד ומקלדת; `GripVertical` ב-`text-slate-300` (ניגודיות נמוכה), הידית מחוץ לכרטיס עם `pt-5` קשיח. | `QuoteEditor.jsx:646-653` | נמוכה |
| 13 | **ארכיטקטורה:** כל ה-state, השמירה, ה-PDF והגרירה בקובץ אחד בן 790 שורות; ה-id נקרא מ-`window.location.search`; שם משתנה `quoteId` מסונכרן ב-effect. | `QuoteEditor.jsx:43-93` | תחזוקה |
| 14 | מודאל הקטלוג: UX מקלדת מצוין (Ctrl+Enter, חיצים) אך לא מתועד בממשק מעבר לשורת הדרכה קטנה, והוא מחבר שני מצבים (`quote`/`template`) עם state שאינו מתאפס כשהדיאלוג נסגר ב-X. | `CatalogPickerModal.jsx` | נמוכה |
| 15 | `ProjectDetails` מכיל גם הוא פעולות הצעה (`QuotesSection`) וגם יצירת הצעה ב-`Quotes.jsx`/`ProjectDetails.jsx` — כפל מסלולי כניסה לעורך עם `window.location.href` מול `navigate`. | `ProjectDetails.jsx:1153-1420`, `Quotes.jsx:66-77` | נמוכה |

### 6.4 המלצה ראשונית לעורך (בלי שינוי חישוב)
- פיצול ל: `QuoteHeaderForm`, `QuoteItemRow` (תצוגה מצומצמת + פרטים נפתחים), `ComponentsTable`/`ComponentRow`, `QuoteTotalsPanel` (sticky, מקבלת `totals` מוכנים), `AutosaveIndicator`, `QuotePdfButton`. כל הקומפוננטות מקבלות props — ה-state וה-save נשארים כפי שהם.
- להעביר את `calcQuoteTotals` ל-`lib/quoteCalculations.js` **כהעברה בלבד** (ללא שינוי נוסחה) ולכסות בבדיקות לפני כל מגע בעורך; לפתור את אי-עקביות המע"מ כהחלטה עסקית נפרדת.
- כרטיס פריט מעבר מובייל: עמודות מתקפלות, תוויות יחידת חישוב, סיכום פריט מודגש.
- אישור מחיקה אחיד (`ConfirmDialog`) וחיווי שגיאת שמירה.

---

## 7. אילו רכיבים אפשר לשפר רוחבית בלי לפגוע בלוגיקה העסקית

סדר לפי תשואה/סיכון (הכול שכבת תצוגה בלבד — props ו-classes):

| עדיפות | רכיב / שינוי | חל על | סיכון |
|---|---|---|---|
| 1 | `lang="he" dir="rtl"` ב-`index.html` + בדיקת Portals (Dialog/Select) | כל המערכת | נמוך |
| 2 | טוקן צבע מותגי (`brand`) והחלפת `bg-blue-600` ב-`Button variant` | 44 מופעים, 12 קבצים | נמוך |
| 3 | `formatCurrency` אחד (`lib/format.js`) | 17 קבצים | נמוך (בדיקת פלט זהה) |
| 4 | `StatusBadge` + מפת סטטוסים מרכזית | 6+ קבצים | נמוך |
| 5 | `ConfirmDialog` במקום `window.confirm` | 17 מקומות, 9 קבצים | בינוני-נמוך (שומרים את ה-handler) |
| 6 | `PageHeader` + `PageContainer` (כותרת, ריפוד, `max-w`) | 17+ מסכים | נמוך |
| 7 | `Card`, `EmptyState`, `LoadingState`/`Skeleton` | רוחבי | נמוך |
| 8 | `DataTable`/`Table` אחיד + `overflow-x-auto` + כרטיסי-שורה במובייל | 12 קבצים | בינוני |
| 9 | `FormField` (label + שגיאה + חובה + hint) ו-`NumberInput` (ללא אילוץ ל-0/1 בזמן הקלדה) | רוחבי; ב-`QuoteEditor` רק אחרי בדיקות | בינוני |
| 10 | `IconButton` עם `aria-label` חובה | 27+29 מופעים | נמוך |
| 11 | ניווט: `NavItem` אחד, breadcrumbs, פריט הורה פעיל | `Layout.jsx` | נמוך |
| 12 | פיצול `QuoteEditor` / `ProjectDetails` לרכיבי משנה | 2 קבצים גדולים | בינוני-גבוה (דורש בדיקות לפני) |
| 13 | מצב כהה (אופציונלי) | לאחר מעבר לטוקנים | בהמשך |

**מה לא לגעת בו בשלב העיצוב:** `lib/quoteCalculations.js`, `calcQuoteTotals`, `saveOnce`/ה-autosave ב-`QuoteEditor`, `lib/formulaEngine.js`, `components/lib/projectFinancials.jsx`, `partnerSettlement.jsx`, `services/*`, סכמת ה-DB והרשאות (RLS).

---

## 8. תנאים מקדימים והערות לשלב הבא
1. **אין בדיקות UI.** לפני שינויים בעורך ההצעות מומלץ להוסיף בדיקות לחישובים (`quoteCalculations`, `calcQuoteTotals`) ובדיקות ויזואליות/רכיב לרכיבים המשותפים.
2. **אימות בדפדפן נדרש** (לא בוצע בשלב זה): RTL בדיאלוגים ובתפריטי Select, מובייל, ו-Lighthouse/axe לנגישות. מומלץ לבצע על נתוני בדיקה/Staging בלבד.
3. **החלטות מוצר פתוחות:** שם המוצר, צבע מותגי, האם מצב כהה נדרש, האם "הצעות מחיר" חוזרת לתפריט, מע"מ ברירת מחדל (17% או 18%), האם PDF טקסטואלי נדרש.
4. **ניקוי תלויות** (three, leaflet, quill, stripe וכו') ו-`components/ui` הלא בשימוש (35 מתוך 47 קבצים) — לשיקול לפני בניית ה-Design System, כדי שלא יתווספו רכיבים כפולים.
5. המסמך מתעד מצב קיים ואינו מחייב מימוש. לא בוצע שום שינוי קוד, ממשק, API או DB.
