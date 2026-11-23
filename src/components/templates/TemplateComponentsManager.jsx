import { useState } from "react";
import { confirmAction } from "@/components/shared/confirm";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QuoteTemplateComponentService } from "@/services";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";
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
    mutationFn: ({ id, data }) => QuoteTemplateComponentService.update(id, data),
    onSuccess: invalidate
  });

  const deleteCompMutation = useMutation({
    mutationFn: (id) => QuoteTemplateComponentService.delete(id),
    onSuccess: invalidate
  });

  const handleAddFromCatalog = async (selectedItems) => {
    await Promise.all(selectedItems.map((item, idx) =>
      QuoteTemplateComponentService.create({
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
    <div className="border-t border-border">
      <table className="w-full text-sm">
        <thead className="bg-background">
          <tr>
            <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">רכיב</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">שיטת חישוב</th>
            <th className="text-right px-4 py-2 text-xs font-medium text-muted-foreground">מחיר שמור</th>
            <th className="px-2 py-2 w-20 text-left">
              <button
                onClick={() => setPickerOpen(true)}
                className="text-blue-500 hover:text-primary flex items-center gap-1 text-xs font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> הוסף
              </button>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {comps.map(comp => (
            <tr key={comp.id} className="hover:bg-slate-50/50">
              <td className="px-4 py-2 font-medium text-foreground">{comp.name_snapshot}</td>
              <td className="px-4 py-2 text-muted-foreground text-xs">{PRICING_METHOD_LABELS[comp.pricing_method_snapshot]}</td>
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
                  onClick={async () => { if (await confirmAction("למחוק רכיב מהתבנית?")) deleteCompMutation.mutate(comp.id); }}
                  className="text-red-300 hover:text-destructive"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </td>
            </tr>
          ))}
          {comps.length === 0 && (
            <tr>
              <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground text-xs">
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