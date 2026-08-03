# STORAGE_MIGRATION.md

## העברת אחסון קבצים מ-Base44 לאחסון עצמאי

> **תאריך:** 2026-08-01  
> **מטרה:** תכנון העברת כל הקבצים מ-Base44 Storage ל-S3 / Supabase Storage.

---

## 1. מצב נוכחי

### 1.1 היכן נשמרים כיום קבצים

| סוג קובץ | Entity | שדה | שיטה |
|----------|--------|------|------|
| מסמכים (חוזה, תוכנית, חשבונית, תמונה, תעודת משלוח) | `Document` | `file_url` | `Core.UploadFile` |
| PDF הצעת מחיר (מועלה ידנית) | `ProjectQuote` | `file_url` | `Core.UploadFile` |
| לוגו חברה | `CompanyHeader` | `logo_url` | `Core.UploadFile` |

### 1.2 מאפיינים
- **URL ציבורי:** קבצים נגישים לכל מי שיש לו הקישור (public URL)
- **ללא הרשאות:** אין בקרת גישה לפי משתמש/תפקיד
- **ללא תוקף:** קישורים תקפים לצמיתות (או עד מחיקה)
- **שם קובץ:** נשמר כפי שהועלה (עלול להיות לא ייחודי)
- **מיקום אחסון:** שרתי Base44 (לא ידוע מיקום פיזי)

### 1.3 סיכונים במצב הנוכחי
1. קבצים חשופים ללא אימות (סודיות)
2. קישורים יפסיקו לעבוד לאחר מעבר (broken links)
3. אין גיבוי עצמאי
4. אין בקורת גודל/סוג
5. אין audit לגישה

---

## 2. פתרון יעד מומלץ

### 2.1 ספק אחסון
**המלצה: AWS S3 (או Cloudflare R2 / Supabase Storage)**

| ספק | יתרון | חיסרון | עלות |
|-----|-------|--------|------|
| **AWS S3** | סטנדרט, אמין, תמיכה רחבה | מורכבות קונפיגורציה | $0.023/GB |
| **Cloudflare R2** | ללא עלות egress, S3-compatible | חדש יותר | $0.015/GB |
| **Supabase Storage** | משולב עם DB+Auth | מוגבל | כלול בplan |

### 2.2 מודל גישה
```
1. Frontend מבקש signed URL מה-API
2. API מאמת JWT + permission
3. API מייצר signed URL (תוקף 5 דקות ל-upload, 1 שעה ל-download)
4. Frontend מעלה/מוריד ישירות מ-S3 (לא דרך השרת)
```

### 2.3 יתרונות
- ✅ קבצים פרטיים — גישה רק עם signed URL
- ✅ תוקף מוגבל — אי אפשר לשתף קישור לצמיתות
- ✅ בקורת גישה — כל request עובר אימות
- ✅ חיסכון ברוחב פס (direct upload/download)
- ✅ Audit log אפשרי (S3 access logs)

---

## 3. מבנה תיקיות (S3)

### 3.1 היררכיית Keys
```
bucket: projectflow-prod
├── tenants/{tenant_id}/
│   ├── documents/
│   │   └── {project_id}/
│   │       └── {document_id}/
│   │           └── {timestamp}_{filename}
│   ├── quotes/
│   │   └── {quote_id}/
│   │       └── {timestamp}_quote.pdf
│   ├── company-headers/
│   │   └── {header_id}/
│   │       └── {timestamp}_logo.png
│   └── exports/
│       └── {user_id}/
│           └── {timestamp}_export.xlsx
```

### 3.2 כללי שמות
- **תחילית:** `tenants/{tenant_id}/` — בידוד tenant
- **תת-תיקיה:** לפי entity (`documents`, `quotes`, `company-headers`)
- **מזהה ייחודי:** `{entity_id}/` — מונע כפילויות
- **שם קובץ:** `{timestamp}_{sanitized_filename}` — מונע התנגשויות
- **Sanitization:** הסרת תווים מיוחדים, רווחים → מקף, lowercase

### 3.3 דוגמאות
```
tenants/abc-123/documents/proj-456/doc-789/20260801_143022_contract.pdf
tenants/abc-123/quotes/quote-012/20260801_150000_quote.pdf
tenants/abc-123/company-headers/hdr-001/20260801_100000_logo.png
```

---

## 4. שמות קבצים

### 4.1 Sanitization Rule
```javascript
function sanitizeFilename(filename) {
  return filename
    .replace(/[^\w\.\-]/g, '_')    // תווים לא חוקיים → _
    .replace(/_+/g, '_')             // רצף _ → _
    .replace(/^_+|_+$/g, '')          // הסרת _ בקצוות
    .toLowerCase()
    .substring(0, 100);              // מקסימום 100 תווים
}
```

### 4.2 יצירת Key
```javascript
function generateFileKey(tenantId, entityType, entityId, filename) {
  const timestamp = new Date().toISOString().replace(/[-:T]/g, '').substring(0, 14);
  const sanitized = sanitizeFilename(filename);
  return `tenants/${tenantId}/${entityType}/${entityId}/${timestamp}_${sanitized}`;
}
```

---

## 5. Signed URLs

### 5.1 Upload Signed URL
```javascript
// יצירה
const uploadUrl = await s3.getSignedUrlPromise('putObject', {
  Bucket: 'projectflow-prod',
  Key: fileKey,
  Expires: 300,  // 5 דקות
  ContentType: contentType,
  ContentLength: maxSize,
});
```

### 5.2 Download Signed URL
```javascript
const downloadUrl = await s3.getSignedUrlPromise('getObject', {
  Bucket: 'projectflow-prod',
  Key: fileKey,
  Expires: 3600,  // 1 שעה
  ResponseContentDisposition: `attachment; filename="${originalName}"`,
});
```

### 5.3 תוקף מומלץ
| פעולה | תוקף | סיבה |
|--------|------|------|
| Upload | 5 דקות | מספיק להעלאה |
| Download (preview) | 1 שעה | צפייה באפליקציה |
| Download (attachment) | 1 שעה | הורדה חד-פעמית |

---

## 6. אבטחת קבצים

### 6.1 הגבלות סוג קובץ
```javascript
const ALLOWED_MIME_TYPES = {
  documents: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  quotes: ['application/pdf'],
  'company-headers': ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp'],
};

const MAX_FILE_SIZES = {
  documents: 10 * 1024 * 1024,    // 10MB
  quotes: 10 * 1024 * 1024,        // 10MB
  'company-headers': 2 * 1024 * 1024,  // 2MB
};
```

### 6.2 וולידציה ב-API
```typescript
// POST /api/storage/upload-url
if (!ALLOWED_MIME_TYPES[entityType].includes(contentType)) {
  return 400({ error: 'סוג קובץ לא נתמך' });
}
if (estimatedSize > MAX_FILE_SIZES[entityType]) {
  return 400({ error: 'קובץ גדול מדי' });
}
```

### 6.3 Bucket Policy
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::projectflow-prod/*",
    "Condition": {
      "StringNotEquals": {
        "s3:authType": "REST-SIGNED"
      }
    }
  }]
}
```
> כל גישה חייבת להיות דרך signed URL — אין גישה ציבורית.

### 6.4 Encryption
- **At rest:** S3-SSE (AES-256) — מובנה
- **In transit:** HTTPS (TLS)

### 6.5 Lifecycle Policies
```json
{
  "Rules": [{
    "ID": "Delete incomplete uploads",
    "Status": "Enabled",
    "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 1 }
  }, {
    "ID": "Archive old files",
    "Status": "Enabled",
    "Transitions": [{ "Days": 365, "StorageClass": "GLACIER" }]
  }]
}
```

---

## 7. זרימת Upload (Frontend)

```javascript
// 1. בקשת signed URL
const { upload_url, file_key } = await api.post('/api/storage/upload-url', {
  filename: file.name,
  content_type: file.type,
  entity_type: 'documents',
  estimated_size: file.size,
});

// 2. Upload ישירות ל-S3
await fetch(upload_url, {
  method: 'PUT',
  body: file,
  headers: { 'Content-Type': file.type },
});

// 3. שמירת record ב-DB
await api.post('/api/documents', {
  project_id: projectId,
  document_type: 'contract',
  name: file.name,
  file_key: file_key,
  file_size: file.size,
  mime_type: file.type,
});
```

---

## 8. זרימת Download (Frontend)

```javascript
// 1. בקשת signed URL
const { download_url } = await api.get(`/api/storage/${fileKey}/download-url`);

// 2. פתיחת/הורדת קובץ
window.open(download_url, '_blank');
// או
const response = await fetch(download_url);
const blob = await response.blob();
```

---

## 9. תוכנית Migration

### שלב 1 — הכנת S3
1. יצירת bucket `projectflow-prod`
2. הגדרת lifecycle policies
3. יצירת IAM user עם הרשאות S3
4. הגדרת CORS:
```json
[{
  "AllowedOrigins": ["https://app.projectflow.pro"],
  "AllowedMethods": ["PUT", "GET", "DELETE"],
  "AllowedHeaders": ["*"]
}]
```

### שלב 2 — סקריפט Migration
```javascript
// migrate-storage.js
const files = await base44.entities.Document.list();
const quotes = await base44.entities.ProjectQuote.list();
const headers = await base44.entities.CompanyHeader.list();

for (const doc of files) {
  // 1. הורדה מ-Base44
  const response = await fetch(doc.file_url);
  const buffer = await response.buffer();

  // 2. יצירת key
  const key = `tenants/${tenantId}/documents/${doc.project_id}/${doc.id}/${sanitize(doc.name)}`;

  // 3. Upload ל-S3
  await s3.putObject({ Bucket, Key: key, Body: buffer }).promise();

  // 4. עדכון DB (file_url → file_key)
  await prisma.document.update({ where: { id: doc.id }, data: { file_key: key } });
}
```

### שלב 3 — וולידציה
1. השוואת counts (Base44 vs S3)
2. בדיקת checksums (MD5)
3. בדיקת signed URLs תקינים
4. בדיקת גישה מ-front-end

### שלב 4 — Cutover
1. עדכון כל `file_url` ל-`file_key` בקוד הפרונט
2. החלפת `Core.UploadFile` ב-S3 flow
3. הפעלת bucket policy (deny public)
4. מחיקת קבצים מ-Base44 (לאחר וולידציה מלאה)

---

## 10. סיכונים

1. **אובדן קבצים** — חובת גיבוי לפני מחיקה מ-Base44
2. **קישורים שבורים** — אם יש hardlinks בקוד ל-`file_url` ישן
3. **עלות S3** — ניטור נפח + lifecycle
4. **CORS** — חובת הגדרה נכונה אחרת upload נכשל
5. **Timeout ב-upload גדול** — multipart upload לקבצים > 5MB

---

> ראה גם: `CLOUD_CODE_API_PLAN.md` סעיף 19 (Storage APIs), `DEPLOYMENT_ARCHITECTURE.md` להגדרת environment variables.