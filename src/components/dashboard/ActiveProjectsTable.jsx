import { format } from "date-fns";
import { formatCurrency } from "@/lib/format";
import { he } from "date-fns/locale";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProjectStatusBadge from "./ProjectStatusBadge";
import { calculateProjectFinancials } from "@/components/lib/projectFinancials";
import { cn } from "@/lib/utils";

export default function ActiveProjectsTable({ projects, allPayments, allQuotes, allOrders = [] }) {

  const isOverdue = (targetDate) => {
    if (!targetDate) return false;
    return new Date(targetDate) < new Date();
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">פרויקטים פעילים</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-secondary">
            <tr>
              <th className="text-start px-6 py-4 text-[13px] font-semibold text-foreground">פרויקט</th>
              <th className="text-start px-6 py-4 text-[13px] font-semibold text-foreground">לקוח</th>
              <th className="text-start px-6 py-4 text-[13px] font-semibold text-foreground">סטטוס</th>
              <th className="text-start px-6 py-4 text-[13px] font-semibold text-foreground">יתרה לגבייה</th>
              <th className="text-start px-6 py-4 text-[13px] font-semibold text-foreground">תאריך יעד</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {projects.map((project) => {
              // Calculate financials using centralized function
              const financials = calculateProjectFinancials(project.id, { allQuotes, allPayments, allOrders });
              const overdue = isOverdue(project.target_date) && project.status !== 'completed';
              
              return (
                <tr key={project.id} className="hover:bg-background transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {overdue && <AlertTriangle className="w-4 h-4 text-destructive" />}
                      <span className="font-medium text-foreground">{project.name}</span>
                    </div>
                    {project.project_number && (
                      <span className="text-sm text-muted-foreground">#{project.project_number}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">{project.customer_name}</td>
                  <td className="px-6 py-4">
                    <ProjectStatusBadge status={project.status} />
                  </td>
                  <td className={cn(
                    "px-6 py-4 font-medium",
                    financials.balance_to_collect > 0 ? "text-warning" : "text-success"
                  )}>
                    {formatCurrency(financials.balance_to_collect)}
                  </td>
                  <td className={cn(
                    "px-6 py-4",
                    overdue ? "text-destructive font-medium" : "text-muted-foreground"
                  )}>
                    {project.target_date 
                      ? format(new Date(project.target_date), 'dd/MM/yyyy', { locale: he })
                      : '-'
                    }
                  </td>
                  <td className="px-6 py-4">
                    <Link 
                      to={createPageUrl("ProjectDetails") + `?id=${project.id}`}
                      className="text-primary hover:text-primary flex items-center gap-1"
                    >
                      <span>פרטים</span>
                      <ChevronLeft className="w-4 h-4" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {projects.length === 0 && (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  אין פרויקטים פעילים
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}