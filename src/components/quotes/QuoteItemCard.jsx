import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, BookmarkPlus, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { calcComponentValue } from "@/lib/quoteCalculations";

const formatCurrency = (n) =>
  new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(n || 0);

export default function QuoteItemCard({
  item,
  components,
  onUpdateItem,
  onDeleteItem,
  onAddComponents,
  onRemoveComponent,
  onUpdateComponentPrice,
  onUpdateComponentQuantity,
  onSaveAsTemplate,
  isExpanded,
  onToggleExpand,
}) {
  const [editingDesc, setEditingDesc] = useState(false);

  const itemQty = item.quantity || 1;

  const calcCompLine = (comp) => calcComponentValue(comp, item.width_cm, item.height_cm, itemQty);

  const itemTotal = components.reduce((sum, comp) => sum + calcCompLine(comp), 0);

  const handleDimensionChange = (field, value) => {
    onUpdateItem(item.id || item._tempId, { [field]: parseFloat(value) || 0 });
  };

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-card shadow-sm">
      {/* Item Header */}
      <div className="flex items-center gap-3 p-4 bg-background border-b border-border">
        <button onClick={onToggleExpand} aria-label={isExpanded ? "כווץ פריט" : "הרחב פריט"} aria-expanded={isExpanded} className="text-muted-foreground hover:text-foreground">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Dimensions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-[13px] text-muted-foreground">רוחב</span>
            <Input
              type="number"
              value={item.width_cm || ""}
              onChange={e => handleDimensionChange("width_cm", e.target.value)}
              className="w-16 h-8 text-sm text-center tabular-nums" dir="ltr"
              placeholder="0"
            />
          </div>
          <span className="text-muted-foreground/60">×</span>
          <div className="flex items-center gap-1">
            <span className="text-[13px] text-muted-foreground">גובה</span>
            <Input
              type="number"
              value={item.height_cm || ""}
              onChange={e => handleDimensionChange("height_cm", e.target.value)}
              className="w-16 h-8 text-sm text-center tabular-nums" dir="ltr"
              placeholder="0"
            />
          </div>
          <span className="text-[13px] text-muted-foreground">ס"מ</span>
          <span className="text-xs text-muted-foreground/60">|</span>
          <div className="flex items-center gap-1">
            <span className="text-[13px] text-muted-foreground">כמות</span>
            <Input
              type="number"
              value={item.quantity || 1}
              onChange={e => handleDimensionChange("quantity", e.target.value)}
              className="w-14 h-8 text-sm text-center tabular-nums" dir="ltr"
              min={1}
            />
          </div>
        </div>

        {/* Description */}
        <div className="flex-1 min-w-0">
          {editingDesc ? (
            <Input
              autoFocus
              value={item.description || ""}
              onChange={e => onUpdateItem(item.id || item._tempId, { description: e.target.value })}
              onBlur={() => setEditingDesc(false)}
              className="h-8 text-sm"
            />
          ) : (
            <button
              onClick={() => setEditingDesc(true)}
              className="text-sm text-foreground text-right truncate block w-full hover:text-primary"
              title={item.description}
            >
              {item.description || <span className="text-muted-foreground italic">תיאור אוטומטי</span>}
              <Pencil className="w-3 h-3 inline mr-1 text-muted-foreground/60" />
            </button>
          )}
          {(item.width_cm || item.height_cm) && (
            <p className="mt-0.5 inline-flex rounded bg-secondary px-2 py-0.5 text-xs text-muted-foreground tabular-nums" aria-label="נתונים מחושבים">
              {item.width_cm && item.height_cm ? `${((item.width_cm * item.height_cm) / 10000).toFixed(2)} מ"ר | ` : ""}
              {item.width_cm ? `${(item.width_cm / 100).toFixed(2)} מ' רץ ר' | ` : ""}
              {item.height_cm ? `${(item.height_cm / 100).toFixed(2)} מ' רץ ג'` : ""}
            </p>
          )}
        </div>

        {/* Total */}
        <div className="text-left shrink-0">
          <p className="font-bold text-foreground">{formatCurrency(itemTotal)}</p>
          {item.quantity > 1 && (
            <p className="text-xs text-muted-foreground">{formatCurrency(itemTotal / itemQty)} × {item.quantity}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1"
            onClick={onAddComponents}
          >
            <Plus className="w-3 h-3" /> רכיב
          </Button>
          {components.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs gap-1"
              onClick={onSaveAsTemplate}
              title="שמור כתבנית"
              aria-label="שמור כתבנית"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-destructive/70 hover:text-destructive hover:bg-destructive-subtle"
            onClick={onDeleteItem}
            aria-label="מחק פריט"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Components Table */}
      {isExpanded && (
        <div>
          {components.length === 0 ? (
            <div className="px-4 py-5 text-center text-muted-foreground text-sm">
              אין רכיבים — לחץ "+ רכיב" להוספה
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-secondary">
                <tr>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">שם רכיב</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">רוחב × גובה</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">כמות</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">מחיר יחידה</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">סה"כ</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {components.map(comp => {
                  const totalVal = calcCompLine(comp);
                  return (
                    <tr key={comp._tempId || comp.id} className="hover:bg-background">
                      <td className="px-4 py-2 font-medium text-foreground">{comp.name_snapshot}</td>
                      <td className="px-4 py-2 text-muted-foreground text-xs whitespace-nowrap">
                        {item.height_cm && item.width_cm ? `${item.width_cm} × ${item.height_cm} ס"מ` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          value={comp.quantity ?? 1}
                          onChange={e => onUpdateComponentQuantity && onUpdateComponentQuantity(comp.id || comp._tempId, parseFloat(e.target.value) || 1)}
                          className="w-14 h-8 text-xs text-center tabular-nums" dir="ltr"
                          min={1}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          value={comp.price_snapshot}
                          onChange={e => onUpdateComponentPrice(comp.id || comp._tempId, parseFloat(e.target.value) || 0)}
                          className="w-24 h-8 text-xs tabular-nums" dir="ltr"
                        />
                      </td>
                      <td className="px-4 py-2 font-medium text-foreground tabular-nums"><span className="rounded bg-secondary px-2 py-0.5" aria-label="מחושב">{formatCurrency(totalVal)}</span></td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => onRemoveComponent(comp.id || comp._tempId)}
                          aria-label="הסר רכיב"
                          className="text-destructive/60 hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-border">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-xs text-muted-foreground text-left">
                    סכום כולל
                  </td>
                  <td className="px-4 py-2 font-bold text-foreground tabular-nums">{formatCurrency(itemTotal)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </div>
  );
}