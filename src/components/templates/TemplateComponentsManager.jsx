import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Pencil } from "lucide-react";
import CatalogPickerModal from "@/components/quotes/CatalogPickerModal";

const PRICING_METHOD_LABELS = {
  sqm: 'מ"ר',
  meter: "מ' רץ",
  meter_width: "מ' רץ",
  meter_height: "מ' גובה",
  unit: "יחידה"
};

export default function TemplateComponentsManager({ templateId, comps, catalogItems = [] }) {
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["all-template-components"] });

  const updateCompMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QuoteTemplateComponent.update(id, data),
    onSuccess: invalidate
  });

  const deleteCompMutation = useMutation({
    mutationFn: (id) => base44.entities.QuoteTemplateComponent.delete(id),
    onSuccess: invalidate
  });

  const handleAddFromCatalog = async (selectedItems) => {
    await Promise.all(selectedItems.map((item, idx) =>
      base44.entities.QuoteTemplateComponent.create({
        template_id: templateId,
        catalog_item_id: item.id,
        name_snapshot: item.model_name,
        pricing_method_snapshot: item.pricing_method,
        price_snapshot: item.base_price,
        sort_order: comps.length + idx
      })
    ));
    invalidate();
    setPickerOpen(false);
  };

  return (
    <div className="border-t border-slate-100">
      <table className="w-full text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">רכיב</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">שיטת חישוב</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-slate-500">מחיר שמור</th>
            <th className="px-2 py-2 w-20 text-left">
              <button
                onClick={() => setPickerOpen(true)}
                className="text-blue-500 hover:text-blue-700 flex items-center gap-1 text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> הוסף
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {comps.map(comp => (
            <tr key={comp.id} className="hover:bg-slate-50/50">
              <td className="px-4 py-2 font-medium text-slate-700">{comp.name_snapshot}</td>
              <td className="px-4 py-2 text-slate-500 text-xs">{PRICING_METHOD_LABELS[comp.pricing_method_snapshot]}</td>
              <td className="px-4 py-2">
                <Input
                  type="number"
                  defaultValue={comp.price_snapshot}
                  onBlur={e => {
                    const val = parseFloat(e.target.value);
                    if (val !== comp.price_snapshot) {
                      updateCompMutation.mutate({ id: comp.id, data: { price_snapshot: val } });
                    }
                  }}
                  className="w-24 h-6 text-xs"
                />
              </td>
              <td className="px-2 py-2">
                <button
                  onClick={() => { if (window.confirm("למחוק רכיב מהתבנית?")) deleteCompMutation.mutate(comp.id); }}
                  className="text-red-300 hover:text-red-600"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
          {comps.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-4 text-center text-slate-400 text-xs">
                אין רכיבים — לחץ "הוסף" להוספת רכיב ראשון
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <CatalogPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        catalogItems={catalogItems}
        mode="quote"
        onConfirm={handleAddFromCatalog}
      />
    </div>
  );
}