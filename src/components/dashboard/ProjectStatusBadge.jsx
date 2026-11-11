import { cn } from "@/lib/utils";

const statusConfig = {
  draft: { label: "טיוטה", color: "bg-slate-100 text-slate-700" },
  approved: { label: "מאושר", color: "bg-blue-100 text-blue-700" },
  completed: { label: "הושלם", color: "bg-emerald-100 text-emerald-700" }
};

export default function ProjectStatusBadge({ status }) {
  const config = statusConfig[status] || statusConfig.draft;
  
  return (
    <span className={cn(
      "px-3 py-1 rounded-full text-xs font-medium",
      config.color
    )}>
      {config.label}
    </span>
  );
}