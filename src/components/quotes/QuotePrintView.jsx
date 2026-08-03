import { format } from "date-fns";
import { he } from "date-fns/locale";
import { calcItemTotal } from "@/lib/quoteCalculations";

const fmt = (n) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n || 0);

export default function QuotePrintView({ quote, items = [], componentsMap = {}, quoteForm, totals, project, companyHeader }) {
  const getKey = (item) => item.id || item._tempId;

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "Arial, sans-serif",
        width: "794px",
        minHeight: "1123px",
        background: "#fff",
        padding: "48px",
        color: "#1e293b",
        fontSize: "14px",
        lineHeight: "1.6"
      }}
    >
      {/* Header - logo + title in one row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "32px", borderBottom: "3px solid #2563eb", paddingBottom: "24px" }}>
        {/* Right: title + dates */}
        <div>
          <h1 style={{ fontSize: "28px", fontWeight: "bold", color: "#2563eb", margin: 0 }}>הצעת מחיר</h1>
          <p style={{ color: "#64748b", margin: "4px 0 0" }}>
            תאריך: {quoteForm.quote_date ? format(new Date(quoteForm.quote_date), "dd/MM/yyyy", { locale: he }) : ""}
          </p>
          {quoteForm.valid_until && (
            <p style={{ color: "#64748b", margin: 0 }}>בתוקף עד: {format(new Date(quoteForm.valid_until), "dd/MM/yyyy", { locale: he })}</p>
          )}
        </div>
        {/* Left: logo / company name */}
        {companyHeader && (
          <div style={{ display: "flex", alignItems: "center", gap: "12px", direction: "ltr" }}>
            {companyHeader.logo_url && (
              <img src={companyHeader.logo_url} alt="logo" style={{ height: "56px", width: "auto", objectFit: "contain" }} />
            )}
            <div style={{ textAlign: "left" }}>
              {companyHeader.company_name && (
                <div style={{ fontSize: "18px", fontWeight: "bold", color: "#1e293b" }}>{companyHeader.company_name}</div>
              )}
              {companyHeader.subtitle && (
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>{companyHeader.subtitle}</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Client */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "32px" }}>
        <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "16px" }}>
          <p style={{ fontWeight: "bold", marginBottom: "8px", color: "#2563eb" }}>לכבוד:</p>
          <p style={{ fontWeight: "bold", fontSize: "16px", margin: "0 0 4px" }}>{quote.customer_name || "—"}</p>
          {project?.address && <p style={{ color: "#64748b", margin: 0 }}>{project.address}</p>}
        </div>
        <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "16px" }}>
          <p style={{ fontWeight: "bold", marginBottom: "8px", color: "#2563eb" }}>פרויקט:</p>
          <p style={{ fontWeight: "bold", fontSize: "16px", margin: "0 0 4px" }}>{quote.project_name}</p>
          {project?.aluminum_color && <p style={{ color: "#64748b", margin: 0 }}>צבע: {project.aluminum_color}</p>}
        </div>
      </div>

      {/* Items */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "32px" }}>
        <thead>
          <tr style={{ background: "#2563eb", color: "#fff" }}>
            <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600" }}>#</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600" }}>תיאור</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600" }}>מידות</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600" }}>כמות</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600" }}>מחיר יחידה</th>
            <th style={{ padding: "10px 12px", textAlign: "right", fontWeight: "600" }}>סה"כ</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const comps = componentsMap[getKey(item)] || [];
            const unitTotal = calcItemTotal(comps, item.width_cm, item.height_cm, 1);
            const lineTotal = calcItemTotal(comps, item.width_cm, item.height_cm, item.quantity || 1);
            return (
              <tr key={idx} style={{ background: idx % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ padding: "10px 12px" }}>{idx + 1}</td>
                <td style={{ padding: "10px 12px" }}>
                  {item.description}
                </td>
                <td style={{ padding: "10px 12px", fontSize: "12px", color: "#64748b" }}>
                  {item.width_cm && item.height_cm ? `${item.width_cm}×${item.height_cm} ס"מ` : "—"}
                </td>
                <td style={{ padding: "10px 12px" }}>{item.quantity}</td>
                <td style={{ padding: "10px 12px" }}>{fmt(unitTotal)}</td>
                <td style={{ padding: "10px 12px", fontWeight: "600" }}>{fmt(lineTotal)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "32px" }}>
        <div style={{ width: "280px" }}>
          {(quoteForm.discount_percent > 0) && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #e2e8f0", fontSize: "13px" }}>
              <span style={{ color: "#64748b" }}>הנחה {quoteForm.discount_percent}%</span>
              <span>-{fmt(totals.linesTotal - totals.subtotal)}</span>
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #e2e8f0", fontSize: "13px" }}>
            <span style={{ color: "#64748b" }}>סכום לפני מע"מ</span>
            <span>{fmt(totals.subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #e2e8f0", fontSize: "13px" }}>
            <span style={{ color: "#64748b" }}>מע"מ {quoteForm.vat_percent}%</span>
            <span>{fmt(totals.vatAmount)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px", background: "#2563eb", color: "#fff", borderRadius: "8px", marginTop: "4px" }}>
            <span style={{ fontWeight: "bold", fontSize: "16px" }}>סה"כ לתשלום</span>
            <span style={{ fontWeight: "bold", fontSize: "16px" }}>{fmt(totals.totalWithVat)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {quoteForm.notes && (
        <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "16px", marginBottom: "24px" }}>
          <p style={{ fontWeight: "bold", marginBottom: "6px" }}>הערות ותנאים:</p>
          <p style={{ color: "#475569", margin: 0 }}>{quoteForm.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px", color: "#94a3b8", fontSize: "12px", textAlign: "center" }}>
        {quoteForm.valid_until
          ? `הצעה זו בתוקף עד ${format(new Date(quoteForm.valid_until), "dd/MM/yyyy", { locale: he })}`
          : "הצעה זו בתוקף ל-30 יום מתאריך ההצעה"}
      </div>
    </div>
  );
}