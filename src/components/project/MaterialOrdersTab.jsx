import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MaterialOrderService, MaterialOrderItemService } from "@/services";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw, Package, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { generateMaterialOrders } from "@/lib/materialOrderGenerator";
import { cn } from "@/lib/utils";

const ORDER_TYPE_LABELS = { profiles: "פרופילים", hardware: "פרזול", glass: "זכוכית" };
const ORDER_TYPE_COLORS = {
  profiles: "bg-blue-100 text-primary",
  hardware: "bg-purple-100 text-purple-700",
  glass: "bg-cyan-100 text-cyan-700",
};
const STATUS_LABELS = { draft: "טיוטה", sent: "נשלח", received: "התקבל" };
const STATUS_COLORS = {
  draft: "bg-secondary text-muted-foreground",
  sent: "bg-warning-subtle text-warning",
  received: "bg-success-subtle text-success",
};

export default function MaterialOrdersTab({ projectId, projectName }) {
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState(null);
  const [expandedOrders, setExpandedOrders] = useState({});
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["material-orders", projectId],
    queryFn: () => MaterialOrderService.listByProject(projectId),
    enabled: !!projectId,
  });

  // Keyed by the actual order ids (not just projectId) so this becomes a
  // genuinely new query whenever "עדכן הזמנות" replaces the underlying
  // orders — otherwise React Query treated pre- and post-regeneration
  // fetches as "the same" cached query, and a race between the orders
  // query refetching (new ids) and this one refetching (still old/empty
  // ids at that instant) could leave allItems stuck at an empty result
  // until a full page reload forced a clean refetch. Found in manual
  // testing 2026-08-18.
  const orderIds = orders.map(o => o.id);
  const { data: allItems = [] } = useQuery({
    queryKey: ["material-order-items", projectId, orderIds],
    queryFn: () => MaterialOrderItemService.listByOrders(orderIds),
    enabled: orderIds.length > 0,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) => MaterialOrderService.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["material-orders", projectId] }),
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId) => {
      const items = allItems.filter(i => i.material_order_id === orderId);
      await Promise.all(items.map(i => MaterialOrderItemService.delete(i.id)));
      await MaterialOrderService.delete(orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["material-orders", projectId] });
      queryClient.invalidateQueries({ queryKey: ["material-order-items", projectId] });
    },
  });

  const handleGenerate = async () => {
    setGenerating(true);
    setGenerateError(null);
    try {
      await generateMaterialOrders(projectId, projectName);
      queryClient.invalidateQueries({ queryKey: ["material-orders", projectId] });
      queryClient.invalidateQueries({ queryKey: ["material-order-items", projectId] });
    } catch (err) {
      setGenerateError(err.message || "שגיאה ביצירת הזמנות");
    } finally {
      setGenerating(false);
    }
  };

  const toggleExpand = (id) => setExpandedOrders(prev => ({ ...prev, [id]: !prev[id] }));

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{orders.length} הזמנות חומר</p>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-primary hover:bg-primary-hover"
        >
          {generating ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <RefreshCw className="w-4 h-4 ml-2" />}
          {orders.length > 0 ? "עדכן הזמנות" : "צור הזמנות חומר"}
        </Button>
      </div>

      {generateError && (
        <div className="bg-destructive-subtle border border-red-200 rounded-xl px-4 py-3 text-sm text-destructive">
          {generateError}
        </div>
      )}

      {orders.length === 0 && !generateError && (
        <div className="border border-dashed border-border rounded-xl p-10 text-center text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 text-slate-300" />
          <p>לחץ "צור הזמנות חומר" כדי לייצר רשימות הזמנה מרכיבי הדגמים</p>
        </div>
      )}

      {orders.map(order => {
        const items = allItems.filter(i => i.material_order_id === order.id);
        const isExpanded = expandedOrders[order.id];
        return (
          <div key={order.id} className="bg-white border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <button onClick={() => toggleExpand(order.id)} className="text-muted-foreground hover:text-muted-foreground">
                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              <span className={cn("text-xs px-2 py-1 rounded-full font-medium", ORDER_TYPE_COLORS[order.order_type])}>
                {ORDER_TYPE_LABELS[order.order_type]}
              </span>
              <span className="text-sm text-muted-foreground">{items.length} פריטים</span>
              <div className="flex items-center gap-2 mr-auto">
                <Select
                  value={order.status}
                  onValueChange={(v) => updateStatusMutation.mutate({ id: order.id, status: v })}
                >
                  <SelectTrigger className="h-8 w-28 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">טיוטה</SelectItem>
                    <SelectItem value="sent">נשלח</SelectItem>
                    <SelectItem value="received">התקבל</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-400 hover:text-destructive hover:bg-destructive-subtle"
                  onClick={() => { if (window.confirm("למחוק הזמנה זו?")) deleteOrderMutation.mutate(order.id); }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {isExpanded && (
              <div className="border-t border-border">
                <table className="w-full text-sm">
                  <thead className="bg-background">
                    <tr>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">קוד פריט</th>
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">כמות כוללת</th>
                      {order.order_type === "profiles" && (
                        <th className="text-right px-4 py-2 text-muted-foreground font-medium">אורך כולל (ס"מ)</th>
                      )}
                      <th className="text-right px-4 py-2 text-muted-foreground font-medium">הערות</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map(item => (
                      <tr key={item.id} className="hover:bg-background">
                        <td className="px-4 py-2 font-mono font-medium text-foreground">{item.item_code}</td>
                        <td className="px-4 py-2 text-foreground">{item.total_quantity}</td>
                        {order.order_type === "profiles" && (
                          <td className="px-4 py-2 font-semibold text-primary">
                            {item.total_length != null ? `${item.total_length} ס"מ` : "—"}
                          </td>
                        )}
                        <td className="px-4 py-2 text-muted-foreground text-xs">{item.notes || ""}</td>
                      </tr>
                    ))}
                    {items.length === 0 && (
                      <tr><td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">אין פריטים</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}