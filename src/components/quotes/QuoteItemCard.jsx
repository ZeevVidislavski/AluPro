import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Save, BookmarkPlus, FileDown, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateDescription, pricingMethodLabel, CATEGORY_LABELS, CATEGORY_COLORS, calcComponentValue } from "@/lib/quoteCalculations";

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
    <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
      {/* Item Header */}
      <div className="flex items-center gap-3 p-4 bg-slate-50 border-b border-slate-100">
        <button onClick={onToggleExpand} className="text-slate-400 hover:text-slate-600">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Dimensions */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400">ר'</span>
            <Input
              type="number"
              value={item.width_cm || ""}
              onChange={e => handleDimensionChange("width_cm", e.target.value)}
              className="w-16 h-7 text-sm text-center"
              placeholder="0"
            />
          </div>
          <span className="text-slate-300">×</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400">ג'</span>
            <Input
              type="number"
              value={item.height_cm || ""}
              onChange={e => handleDimensionChange("height_cm", e.target.value)}
              className="w-16 h-7 text-sm text-center"
              placeholder="0"
            />
          </div>
          <span className="text-xs text-slate-400">ס"מ</span>
          <span className="text-xs text-slate-300">|</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400">כמות</span>
            <Input
              type="number"
              value={item.quantity || 1}
              onChange={e => handleDimensionChange("quantity", e.target.value)}
              className="w-14 h-7 text-sm text-center"
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
              className="h-7 text-sm"
            />
          ) : (
            <button
              onClick={() => setEditingDesc(true)}
              className="text-sm text-slate-700 text-right truncate block w-full hover:text-blue-600"
              title={item.description}
            >
              {item.description || <span className="text-slate-400 italic">תיאור אוטומטי</span>}
              <Pencil className="w-3 h-3 inline mr-1 text-slate-300" />
            </button>
          )}
          {(item.width_cm || item.height_cm) && (
            <p className="text-xs text-slate-400">
              {item.width_cm && item.height_cm ? `${((item.width_cm * item.height_cm) / 10000).toFixed(2)} מ"ר | ` : ""}
              {item.width_cm ? `${(item.width_cm / 100).toFixed(2)} מ' רץ ר' | ` : ""}
              {item.height_cm ? `${(item.height_cm / 100).toFixed(2)} מ' רץ ג'` : ""}
            </p>
          )}
        </div>

        {/* Total */}
        <div className="text-left shrink-0">
          <p className="font-bold text-slate-900">{formatCurrency(itemTotal)}</p>
          {item.quantity > 1 && (
            <p className="text-xs text-slate-400">{formatCurrency(itemTotal / itemQty)} × {item.quantity}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1"
            onClick={onAddComponents}
          >
            <Plus className="w-3 h-3" /> רכיב
          </Button>
          {components.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1"
              onClick={onSaveAsTemplate}
              title="שמור כתבנית"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
            </Button>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
            onClick={onDeleteItem}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Components Table */}
      {isExpanded && (
        <div>
          {components.length === 0 ? (
            <div className="px-4 py-5 text-center text-slate-400 text-sm">
              אין רכיבים — לחץ "+ רכיב" להוספה
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50/50">
                <tr>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">שם רכיב</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">גובה × רוחב</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">כמות</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">מחיר יחידה</th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">סה"כ</th>
                  <th className="px-2 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {components.map(comp => {
                  const totalVal = calcCompLine(comp);
                  return (
                    <tr key={comp.id || comp._tempId} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2 font-medium text-slate-700">{comp.name_snapshot}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs whitespace-nowrap">
                        {item.height_cm && item.width_cm ? `${item.height_cm} × ${item.width_cm} ס"מ` : "—"}
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          value={comp.quantity ?? 1}
                          onChange={e => onUpdateComponentQuantity && onUpdateComponentQuantity(comp.id || comp._tempId, parseFloat(e.target.value) || 1)}
                          className="w-14 h-6 text-xs border-slate-200 text-center"
                          min={1}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          value={comp.price_snapshot}
                          onChange={e => onUpdateComponentPrice(comp.id || comp._tempId, parseFloat(e.target.value) || 0)}
                          className="w-20 h-6 text-xs border-slate-200"
                        />
                      </td>
                      <td className="px-4 py-2 font-medium text-blue-700">{formatCurrency(totalVal)}</td>
                      <td className="px-2 py-2">
                        <button
                          onClick={() => onRemoveComponent(comp.id || comp._tempId)}
                          className="text-red-300 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t border-slate-100">
                <tr>
                  <td colSpan={4} className="px-4 py-2 text-xs text-slate-400 text-left">
                    סכום כולל
                  </td>
                  <td className="px-4 py-2 font-bold text-slate-700">{formatCurrency(itemTotal)}</td>
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