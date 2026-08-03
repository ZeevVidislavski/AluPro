import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { he } from "date-fns/locale";
import { 
  Plus, 
  Bell, 
  CheckCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Calendar,
  Building2,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const priorityConfig = {
  high: { label: "גבוהה", color: "bg-red-100 text-red-700 border-red-200", icon: AlertTriangle },
  medium: { label: "בינונית", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  low: { label: "נמוכה", color: "bg-slate-100 text-slate-600 border-slate-200", icon: Bell }
};

export default function Reminders() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("open");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    due_date: new Date().toISOString().split('T')[0],
    priority: 'medium',
    status: 'open',
    project_id: '',
    project_name: ''
  });

  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['all-reminders'],
    queryFn: () => base44.entities.Reminder.list('-created_date')
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => base44.entities.Project.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Reminder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setDialogOpen(false);
      setFormData({
        title: '',
        description: '',
        due_date: new Date().toISOString().split('T')[0],
        priority: 'medium',
        status: 'open',
        project_id: '',
        project_name: ''
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Reminder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
    }
  });

  const handleProjectChange = (projectId) => {
    if (projectId === 'none') {
      setFormData({ ...formData, project_id: '', project_name: '' });
    } else {
      const project = projects.find(p => p.id === projectId);
      setFormData({ ...formData, project_id: projectId, project_name: project?.name || '' });
    }
  };

  const filteredReminders = reminders.filter(r => {
    const matchesStatus = activeTab === 'all' || r.status === activeTab;
    const matchesPriority = priorityFilter === 'all' || r.priority === priorityFilter;
    return matchesStatus && matchesPriority;
  });

  // Sort reminders: overdue first, then by priority, then by date
  const sortedReminders = [...filteredReminders].sort((a, b) => {
    // Open reminders first
    if (a.status === 'open' && b.status !== 'open') return -1;
    if (b.status === 'open' && a.status !== 'open') return 1;
    
    // Then by overdue
    const aOverdue = isPast(new Date(a.due_date)) && !isToday(new Date(a.due_date));
    const bOverdue = isPast(new Date(b.due_date)) && !isToday(new Date(b.due_date));
    if (aOverdue && !bOverdue) return -1;
    if (bOverdue && !aOverdue) return 1;
    
    // Then by priority
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    
    // Then by date
    return new Date(a.due_date) - new Date(b.due_date);
  });

  const openCount = reminders.filter(r => r.status === 'open').length;
  const overdueCount = reminders.filter(r => 
    r.status === 'open' && isPast(new Date(r.due_date)) && !isToday(new Date(r.due_date))
  ).length;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">תזכורות</h1>
            <p className="text-slate-500 mt-1">
              {openCount} פתוחות
              {overdueCount > 0 && (
                <span className="text-red-600 font-medium"> • {overdueCount} באיחור</span>
              )}
            </p>
          </div>
          <Button onClick={() => setDialogOpen(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="w-5 h-5 ml-2" />
            תזכורת חדשה
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
            <TabsList className="bg-white border border-slate-200">
              <TabsTrigger value="open">פתוחות ({openCount})</TabsTrigger>
              <TabsTrigger value="done">בוצעו</TabsTrigger>
              <TabsTrigger value="postponed">נדחו</TabsTrigger>
              <TabsTrigger value="all">הכל</TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="דחיפות" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">כל הדחיפויות</SelectItem>
                <SelectItem value="high">גבוהה</SelectItem>
                <SelectItem value="medium">בינונית</SelectItem>
                <SelectItem value="low">נמוכה</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Reminders List */}
        <div className="space-y-4">
          {sortedReminders.map(reminder => {
            const isOverdue = isPast(new Date(reminder.due_date)) && !isToday(new Date(reminder.due_date));
            const isDueToday = isToday(new Date(reminder.due_date));
            const isDueTomorrow = isTomorrow(new Date(reminder.due_date));
            const config = priorityConfig[reminder.priority];
            const Icon = config.icon;

            return (
              <div 
                key={reminder.id}
                className={cn(
                  "bg-white rounded-2xl border p-6 transition-all hover:shadow-lg",
                  reminder.status === 'done' && "opacity-60",
                  isOverdue && reminder.status === 'open' && "border-red-300 bg-red-50"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn(
                    "p-3 rounded-xl",
                    config.color.replace('text-', 'bg-').replace('border-', '')
                  )}>
                    <Icon className={cn("w-5 h-5", config.color.split(' ')[1])} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className={cn(
                        "font-semibold text-slate-900",
                        reminder.status === 'done' && "line-through"
                      )}>
                        {reminder.title}
                      </h3>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full border",
                        config.color
                      )}>
                        {config.label}
                      </span>
                      {isOverdue && reminder.status === 'open' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                          באיחור!
                        </span>
                      )}
                      {isDueToday && reminder.status === 'open' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                          היום
                        </span>
                      )}
                      {isDueTomorrow && reminder.status === 'open' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                          מחר
                        </span>
                      )}
                    </div>
                    
                    {reminder.description && (
                      <p className="text-slate-600 mb-3">{reminder.description}</p>
                    )}
                    
                    <div className="flex items-center gap-4 text-sm text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{format(new Date(reminder.due_date), 'dd/MM/yyyy', { locale: he })}</span>
                      </div>
                      {reminder.project_name && (
                        <div className="flex items-center gap-1">
                          <Building2 className="w-4 h-4" />
                          <span>{reminder.project_name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <Select 
                    value={reminder.status} 
                    onValueChange={(v) => updateMutation.mutate({ id: reminder.id, data: { status: v } })}
                  >
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">פתוח</SelectItem>
                      <SelectItem value="done">בוצע</SelectItem>
                      <SelectItem value="postponed">נדחה</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}

          {sortedReminders.length === 0 && (
            <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
              <Bell className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <h3 className="text-lg font-medium text-slate-900 mb-1">אין תזכורות</h3>
              <p className="text-slate-500">לא נמצאו תזכורות בקטגוריה זו</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>תזכורת חדשה</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(formData); }} className="space-y-4">
            <div className="space-y-2">
              <Label>כותרת *</Label>
              <Input 
                value={formData.title} 
                onChange={(e) => setFormData({ ...formData, title: e.target.value })} 
                required 
              />
            </div>
            
            <div className="space-y-2">
              <Label>תיאור</Label>
              <Textarea 
                value={formData.description} 
                onChange={(e) => setFormData({ ...formData, description: e.target.value })} 
                rows={3}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>תאריך יעד *</Label>
                <Input 
                  type="date" 
                  value={formData.due_date} 
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })} 
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>דחיפות</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(v) => setFormData({ ...formData, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">נמוכה</SelectItem>
                    <SelectItem value="medium">בינונית</SelectItem>
                    <SelectItem value="high">גבוהה</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>קשר לפרויקט (אופציונלי)</Label>
              <Select 
                value={formData.project_id || 'none'} 
                onValueChange={handleProjectChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="בחר פרויקט" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">ללא קשר לפרויקט</SelectItem>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-4">
              <Button 
                type="submit" 
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                disabled={createMutation.isPending}
              >
                {createMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
                יצירה
              </Button>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                ביטול
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}