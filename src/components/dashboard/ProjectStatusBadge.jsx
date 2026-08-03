import { cn } from "@/lib/utils";

const statusConfig = {
  quote: { label: "בהצעה", color: "bg-slate-100 text-slate-700" },
  negotiation: { label: "מו״מ", color: "bg-purple-100 text-purple-700" },
  approved: { label: "מאושר", color: "bg-blue-100 text-blue-700" },
  ordering: { label: "בהזמנת חומר", color: "bg-amber-100 text-amber-700" },
  production: { label: "בייצור", color: "bg-orange-100 text-orange-700" },
  installation: { label: "בהתקנה", color: "bg-cyan-100 text-cyan-700" },
  completed: { label: "הושלם", color: "bg-emerald-100 text-emerald-700" },
  invoiced: { label: "סגור חשבונית", color: "bg-green-100 text-green-700" }
};

export default function ProjectStatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.quote;
  
  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-xs font-medium",
      config.color
    )}>
      {config.label}
    </span>
  );
}