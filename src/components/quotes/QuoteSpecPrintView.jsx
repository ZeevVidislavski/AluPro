import { format } from "date-fns";
import { he } from "date-fns/locale";
import { formatCurrency as fmt } from "@/lib/format";
import { calcItemTotal } from "@/lib/quoteCalculations";
import { itemAreaSqm, openingLabel, resolveSpec } from "@/lib/quoteSpec";
import WindowSketch from "./WindowSketch";

const cell = { border: "1px solid #cbd5e1", padding: "8px 10px", verticalAlign: "middle" };
const lbl = { fontWeight: "bold" };

function SpecLine({ label, value }) {
  return (
    <div style={{ marginBottom: "2px" }}>
      <span style={lbl}>{label}: </span>
      <span>{value || "—"}</span>
    </div>
  );
}

// "מפרט טכני ודגמים משורטטים". showPrices=true → contractor version (unit
// price + line total per row); false → customer version, same layout, no prices.
export default function QuoteSpecPrintView({ quote, items = [], componentsMap = {}, quoteForm, project, companyHeader, showPrices }) {
  const getKey = (item) => item.id || item._tempId;
  const dateStr = quoteForm?.quote_date ? format(new Date(quoteForm.quote_date), "dd/MM/yyyy", { locale: he }) : "";
  const color = project?.aluminum_color;

  return (
    <div dir="rtl" style={{ fontFamily: "Arial, sans-serif", width: "794px", boxSizing: "border-box", background: "#fff", padding: "32px 28px", color: "#1e293b", fontSize: "12px", lineHeight: "1.5" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #1e293b", paddingBottom: "10px", marginBottom: "14px" }}>
        <div>
          <div style={{ fontSize: "18px", fontWeight: "bold" }}>מפרט טכני ודגמים משורטטים – פרויקט {quote?.project_name || ""}</div>
          <div style={{ color: "#475569", marginTop: "4px" }}>
            תאריך: {dateStr}
            {color ? ` | צבע מובילי: ${color}` : ""}
            {` | מידות בס"מ`}
            {quote?.customer_name ? ` | ${quote.customer_name}` : ""}
          </div>
        </div>
        {companyHeader && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px", direction: "ltr" }}>
            {companyHeader.resolvedLogoUrl && <img src={companyHeader.resolvedLogoUrl} alt="logo" style={{ height: "44px", width: "auto", objectFit: "contain" }} />}
            {companyHeader.company_name && <div style={{ fontWeight: "bold", fontSize: "14px" }}>{companyHeader.company_name}</div>}
          </div>
        )}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#eef2f7" }}>
            <th style={{ ...cell, width: "13%", textAlign: "center" }}>דגם / כמות</th>
            <th style={{ ...cell, width: "30%", textAlign: "center" }}>דגם משורטט (יחסי למידות) ומיקום</th>
            <th style={{ ...cell, textAlign: "center" }}>מידות ומפרט טכני מלא</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => {
            const comps = componentsMap[getKey(item)] || [];
            const qty = item.quantity || 1;
            const unit = calcItemTotal(comps, item.width_cm, item.height_cm, 1);
            const line = calcItemTotal(comps, item.width_cm, item.height_cm, qty);
            const spec = resolveSpec(item, comps);
            const system = spec.system_type;
            const caption = [system, spec.profile_series ? `סדרה ${spec.profile_series}` : ""].filter(Boolean).join(" • ") || item.description;
            return (
              <tr key={getKey(item) || idx}>
                <td style={{ ...cell, textAlign: "center" }}>
                  <div style={{ fontSize: "22px", fontWeight: "bold" }}>{String(idx + 1).padStart(2, "0")}</div>
                  <div style={{ display: "inline-block", background: "#0f172a", color: "#fff", borderRadius: "4px", padding: "0 10px", height: "22px", lineHeight: "20px", fontWeight: "bold", margin: "4px 0" }}>{qty} יח'</div>
                  {item.location && <div style={{ color: "#64748b", fontSize: "11px" }}>{item.location}</div>}
                </td>
                <td style={{ ...cell, textAlign: "center" }}>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <WindowSketch type={item.opening_type} widthCm={item.width_cm} heightCm={item.height_cm} />
                  </div>
                  <div style={{ fontWeight: "bold", fontSize: "13px", marginTop: "4px" }}>{item.location || openingLabel(item.opening_type)}</div>
                  <div style={{ color: "#64748b", fontSize: "10px" }}>{caption}</div>
                </td>
                <td style={cell}>
                  <div style={{ background: "#eef2f7", padding: "0 8px", height: "24px", lineHeight: "22px", marginBottom: "8px", borderRadius: "3px" }}>
                    גובה: <b>{item.height_cm || 0}</b> ס"מ &nbsp;|&nbsp; רוחב: <b>{item.width_cm || 0}</b> ס"מ &nbsp;|&nbsp; שטח ליח': <b>{itemAreaSqm(item).toFixed(2)}</b> מ"ר
                  </div>
                  <SpecLine label="סדרת פרופילים" value={spec.profile_series} />
                  <SpecLine label="צבע אלומיניום" value={color} />
                  <SpecLine label="סוג מערכת" value={system} />
                  <SpecLine label="זיגוג" value={spec.glazing} />
                  <SpecLine label="תריס / רשת" value={spec.shading} />
                  {showPrices && (
                    <div style={{ background: "#eef2f7", padding: "0 8px", height: "24px", lineHeight: "22px", marginTop: "8px", borderRadius: "3px", fontWeight: "bold" }}>
                      מחיר ליחידה: {fmt(unit)} &nbsp;|&nbsp; סה"כ שורה: {fmt(line)}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
