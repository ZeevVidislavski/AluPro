import { format } from "date-fns";
import { he } from "date-fns/locale";
import { AlertTriangle, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProjectStatusBadge from "./ProjectStatusBadge";
import { calculateProjectFinancials } from "@/components/lib/projectFinancials";
import { cn } from "@/lib/utils";

export default function ActiveProjectsTable({ projects, allPayments, allQuotes, allOrders = [] }) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount || 0);
  };

  const isOverdue = (targetDate) => {
    if (!targetDate) return false;
    return new Date(targetDate) < new Date();
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100">
        <h3 className="text-lg font-semibold text-slate-900">פרויקטים פעילים</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-right px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">פרויקט</th>
              <th className="text-right px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">לקוח</th>
              <th className="text-right px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">סטטוס</th>
              <th className="text-right px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">יתרה לגבייה</th>
              <th className="text-right px-6 py-4 text-xs font-medium text-slate-500 uppercase tracking-wider">תאריך יעד</th>
              <th className="px-6 py-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {projects.map((project) => {
              // Calculate financials using centralized function
              const financials = calculateProjectFinancials(project.id, { allQuotes, allPayments, allOrders });
              const overdue = isOverdue(project.target_date) && project.status !== 'completed' && project.status !== 'invoiced';
              
              return (
                <tr key={project.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      {overdue && <AlertTriangle className="w-4 h-4 text-red-500" />}
                      <span className="font-medium text-slate-900">{project.name}</span>
                    </div>
                    {project.project_number && (
                      <span className="text-sm text-slate-500">#{project.project_number}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-600">{project.customer_name}</td>
                  <td className="px-6 py-4">
                    <ProjectStatusBadge status={project.status} />
                  </td>
                  <td className={cn(
                    "px-6 py-4 font-medium",
                    financials.balance_to_collect > 0 ? "text-amber-600" : "text-emerald-600"
                  )}>
                    {formatCurrency(financials.balance_to_collect)}
                  </td>
                  <td className={cn(
                    "px-6 py-4",
                    overdue ? "text-red-600 font-medium" : "text-slate-600"
                  )}>
                    {project.target_date 
                      ? format(new Date(project.target_date), 'dd/MM/yyyy', { locale: he })
                      : '-'
                    }
                  </td>
                  <td className="px-6 py-4">
                    <Link 
                      to={createPageUrl("ProjectDetails") + `?id=${project.id}`}
                      className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
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
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
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