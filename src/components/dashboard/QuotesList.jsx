import { useState } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";

const STATUS_LABELS = { draft: "טיוטה", approved: "אושר" };
const PAGE = 10;

// Replaces the "הצעות מחיר" menu entry: all quotes, newest first, each
// linking straight to the editor.
export default function QuotesList({ quotes: allQuotes, formatCurrency }) {
  const quotes = allQuotes.filter((q) => q.status === "approved");
  const [showAll, setShowAll] = useState(false);
  const rows = showAll ? quotes : quotes.slice(0, PAGE);

  return (
    <div className="bg-white rounded-2xl border border-border overflow-hidden">
      <div className="p-6 border-b border-border flex items-center gap-2">
        <FileText className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">הצעות מחיר מאושרות ({quotes.length})</h3>
      </div>
      {quotes.length === 0 ? (
        <div className="p-8 text-center text-muted-foreground">אין הצעות מחיר מאושרות עדיין</div>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((q) => (
            <Link
              key={q.id}
              to={`/QuoteEditor?quote_id=${q.id}`}
              className="px-6 py-3 flex items-center justify-between gap-4 hover:bg-background"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground truncate">{q.project_name || "ללא פרויקט"}</p>
                <p className="text-sm text-muted-foreground truncate">{q.customer_name || "ללא לקוח"}</p>
              </div>
              <div className="text-left shrink-0">
                <p className="font-medium">{formatCurrency(q.total_with_vat || q.amount || 0)}</p>
                <p className="text-xs text-muted-foreground">{STATUS_LABELS[q.status] ?? q.status}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
      {quotes.length > PAGE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="w-full p-3 text-sm text-primary hover:bg-background border-t border-border"
        >
          {showAll ? "הצג פחות" : `הצג את כל ${quotes.length} ההצעות`}
        </button>
      )}
    </div>
  );
}
