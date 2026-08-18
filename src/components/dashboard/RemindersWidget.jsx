import { format, isPast, isToday } from "date-fns";
import { he } from "date-fns/locale";
import { Bell, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ReminderService } from "@/services";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const priorityConfig = {
  high: { label: "גבוהה", color: "bg-red-100 text-red-700 border-red-200" },
  medium: { label: "בינונית", color: "bg-amber-100 text-amber-700 border-amber-200" },
  low: { label: "נמוכה", color: "bg-slate-100 text-slate-600 border-slate-200" }
};

export default function RemindersWidget({ reminders }) {
  const queryClient = useQueryClient();

  const markDone = useMutation({
    mutationFn: (id) => ReminderService.update(id, { status: 'done' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reminders'] })
  });

  const sortedReminders = [...reminders]
    .filter(r => r.status === 'open')
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return new Date(a.due_date) - new Date(b.due_date);
    })
    .slice(0, 5);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Bell className="w-5 h-5 text-slate-400" />
          תזכורות פתוחות
        </h3>
        <span className="text-sm text-slate-500">{reminders.filter(r => r.status === 'open').length} פתוחות</span>
      </div>
      <div className="divide-y divide-slate-100">
        {sortedReminders.map((reminder) => {
          const isOverdue = isPast(new Date(reminder.due_date)) && !isToday(new Date(reminder.due_date));
          const isDueToday = isToday(new Date(reminder.due_date));
          
          return (
            <div 
              key={reminder.id} 
              className={cn(
                "p-4 hover:bg-slate-50 transition-colors",
                isOverdue && "bg-red-50"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={cn(
                      "px-2 py-0.5 rounded text-xs font-medium border",
                      priorityConfig[reminder.priority].color
                    )}>
                      {priorityConfig[reminder.priority].label}
                    </span>
                    {isOverdue && (
                      <span className="text-xs text-red-600 font-medium">באיחור!</span>
                    )}
                    {isDueToday && (
                      <span className="text-xs text-amber-600 font-medium">היום</span>
                    )}
                  </div>
                  <h4 className="font-medium text-slate-900 truncate">{reminder.title}</h4>
                  {reminder.project_name && (
                    <p className="text-sm text-slate-500 truncate">{reminder.project_name}</p>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-sm text-slate-400">
                    <Clock className="w-3 h-3" />
                    <span>{format(new Date(reminder.due_date), 'dd/MM/yyyy', { locale: he })}</span>
                  </div>
                </div>
                <button
                  onClick={() => markDone.mutate(reminder.id)}
                  className="p-2 rounded-lg hover:bg-emerald-100 text-slate-400 hover:text-emerald-600 transition-colors"
                  title="סמן כבוצע"
                >
                  <CheckCircle className="w-5 h-5" />
                </button>
              </div>
            </div>
          );
        })}
        {sortedReminders.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            <Bell className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>אין תזכורות פתוחות</p>
          </div>
        )}
      </div>
    </div>
  );
}