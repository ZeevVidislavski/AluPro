import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ProjectService, CustomerService, ClientPaymentService, SupplierOrderService, AgentSettingsService, AgentAlertService, ProjectQuoteService } from "@/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  AlertTriangle, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  DollarSign,
  Zap,
  Users,
  Brain,
  Settings as SettingsIcon,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateProjectFinancials } from "@/components/lib/projectFinancials";
import { 
  analyzeProjectAlerts, 
  shouldResolveAlert,
  calculateProjectPriorityScore,
  calculateBaseMetrics
} from "@/components/lib/agentLogic";
import { generateSmartFocusTasks, calculateDailySummary } from "@/components/lib/smartFocus";
import SmartFocusCard from "@/components/agent/SmartFocusCard";

const severityConfig = {
  critical: { icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  high: { icon: AlertTriangle, color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
  medium: { icon: AlertCircle, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
  low: { icon: AlertCircle, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" }
};

const alertTypeLabels = {
  profitability: "רווחיות",
  collection: "גבייה",
  cash_flow: "תזרים מזומנים",
  workload: "עומס עבודה",
  strategic: "אסטרטגי"
};

const alertTypeIcons = {
  profitability: TrendingUp,
  collection: DollarSign,
  cash_flow: Zap,
  workload: Users,
  strategic: Brain
};

export default function BusinessAgent() {
  const [filterType, setFilterType] = useState("all");
  const [showSettings, setShowSettings] = useState(false);
  const [settingsData, setSettingsData] = useState(null);

  const queryClient = useQueryClient();

  // Fetch data
  const { data: alerts = [], isLoading: loadingAlerts } = useQuery({
    queryKey: ['agent-alerts'],
    queryFn: () => AgentAlertService.list()
  });

  const { data: settings = [], isLoading: loadingSettings } = useQuery({
    queryKey: ['agent-settings'],
    queryFn: () => AgentSettingsService.list()
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => ProjectService.list()
  });

  const { data: customers = [] } = useQuery({
    queryKey: ['customers'],
    queryFn: () => CustomerService.list()
  });

  const { data: allQuotes = [] } = useQuery({
    queryKey: ['quotes'],
    queryFn: () => ProjectQuoteService.list()
  });

  const { data: allPayments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => ClientPaymentService.list()
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => SupplierOrderService.list()
  });

  // Mutations
  const markHandledMutation = useMutation({
    mutationFn: (alertId) => AgentAlertService.update(alertId, { is_handled: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-alerts'] })
  });

  const updateSettingsMutation = useMutation({
    mutationFn: (data) => {
      if (settings.length > 0) {
        return AgentSettingsService.update(settings[0].id, data);
      } else {
        return AgentSettingsService.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent-settings'] });
      setShowSettings(false);
    }
  });

  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      const currentSettings = settings[0] || {
        minimum_profit_percent: 15,
        cash_flow_warning_threshold: -50000,
        max_open_projects: 10,
        high_debt_threshold: 100000,
        contractor_priority_weight: 1.5
      };

      const activeProjects = projects.filter(p => !['completed', 'invoiced'].includes(p.status));

      // Analyze each project
      for (const project of activeProjects) {
        const financials = calculateProjectFinancials(project.id, { allQuotes, allPayments, allOrders });
        const projectAlerts = analyzeProjectAlerts(project, financials, currentSettings);

        // Create or update alerts
        for (const alertData of projectAlerts) {
          const existing = alerts.find(a => a.alert_key === alertData.alert_key && !a.is_handled);
          
          if (existing) {
            await AgentAlertService.update(existing.id, {
              severity: alertData.severity,
              message: alertData.message,
              details: alertData.details
            });
          } else {
            await AgentAlertService.create(alertData);
          }
        }

        // Check and resolve alerts
        const projectAlertsList = alerts.filter(a => a.project_id === project.id && !a.is_handled);
        for (const alert of projectAlertsList) {
          if (shouldResolveAlert(alert, financials, currentSettings, activeProjects.length)) {
            await AgentAlertService.update(alert.id, { is_handled: true });
          }
        }
      }

      // Check workload
      if (activeProjects.length > currentSettings.max_open_projects) {
        const workloadKey = 'global|workload';
        const existingWorkload = alerts.find(a => a.alert_key === workloadKey && !a.is_handled);
        
        const workloadAlert = {
          alert_key: workloadKey,
          alert_type: 'workload',
          severity: 'medium',
          message: `עומס עבודה: ${activeProjects.length} פרויקטים פעילים (מקסימום: ${currentSettings.max_open_projects})`,
          details: JSON.stringify({ count: activeProjects.length, max: currentSettings.max_open_projects })
        };

        if (existingWorkload) {
          await AgentAlertService.update(existingWorkload.id, workloadAlert);
        } else {
          await AgentAlertService.create(workloadAlert);
        }
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['agent-alerts'] })
  });

  const currentSettings = settings[0] || {
    minimum_profit_percent: 15,
    cash_flow_warning_threshold: -50000,
    max_open_projects: 10,
    high_debt_threshold: 100000,
    contractor_priority_weight: 1.5,
    enable_morning_summary: true,
    enable_realtime_alerts: true
  };

  // Calculate top priority projects
  const activeProjects = projects.filter(p => !['completed', 'invoiced'].includes(p.status));
  const baseMetrics = calculateBaseMetrics(activeProjects, allQuotes, allPayments, allOrders);
  
  const projectsWithScores = activeProjects.map(project => {
    const customer = customers.find(c => c.id === project.customer_id);
    const financials = calculateProjectFinancials(project.id, { allQuotes, allPayments, allOrders });
    const score = calculateProjectPriorityScore(project, customer, financials, alerts, currentSettings, baseMetrics);
    return { project, score, financials };
  }).sort((a, b) => b.score - a.score).slice(0, 3);

  // Smart Focus
  const smartFocusTasks = (currentSettings.enable_smart_focus !== false)
    ? generateSmartFocusTasks(projects, { allQuotes, allPayments, allOrders }, alerts, customers, currentSettings)
    : [];
  const dailySummary = calculateDailySummary(smartFocusTasks, projects, { allQuotes, allPayments, allOrders }, alerts);

  // Filter alerts
  const filteredAlerts = alerts
    .filter(a => !a.is_handled)
    .filter(a => filterType === "all" || a.alert_type === filterType)
    .sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(amount || 0);
  };

  if (loadingAlerts || loadingSettings) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (showSettings) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-slate-900">הגדרות סוכן</h1>
            <Button variant="outline" onClick={() => setShowSettings(false)}>חזור</Button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
            <div className="space-y-2">
              <Label>אחוז רווח מינימלי (%)</Label>
              <Input
                type="number"
                value={settingsData?.minimum_profit_percent ?? currentSettings.minimum_profit_percent}
                onChange={(e) => setSettingsData({ ...settingsData, minimum_profit_percent: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>סף תזרים שלילי (₪)</Label>
              <Input
                type="number"
                value={settingsData?.cash_flow_warning_threshold ?? currentSettings.cash_flow_warning_threshold}
                onChange={(e) => setSettingsData({ ...settingsData, cash_flow_warning_threshold: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>מקסימום פרויקטים פעילים</Label>
              <Input
                type="number"
                value={settingsData?.max_open_projects ?? currentSettings.max_open_projects}
                onChange={(e) => setSettingsData({ ...settingsData, max_open_projects: parseInt(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>סף חוב גבוה (₪)</Label>
              <Input
                type="number"
                value={settingsData?.high_debt_threshold ?? currentSettings.high_debt_threshold}
                onChange={(e) => setSettingsData({ ...settingsData, high_debt_threshold: parseFloat(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <Label>משקל עדיפות קבלנים</Label>
              <Input
                type="number"
                step="0.1"
                value={settingsData?.contractor_priority_weight ?? currentSettings.contractor_priority_weight}
                onChange={(e) => setSettingsData({ ...settingsData, contractor_priority_weight: parseFloat(e.target.value) })}
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-semibold text-slate-700">🎯 Smart Focus</p>
              <div className="flex items-center justify-between">
                <Label>הפעל Smart Focus</Label>
                <input
                  type="checkbox"
                  checked={settingsData?.enable_smart_focus ?? currentSettings.enable_smart_focus ?? true}
                  onChange={(e) => setSettingsData({ ...settingsData, enable_smart_focus: e.target.checked })}
                  className="w-4 h-4"
                />
              </div>
              <div className="space-y-2">
                <Label>מספר משימות מקסימלי</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={settingsData?.max_focus_items ?? currentSettings.max_focus_items ?? 5}
                  onChange={(e) => setSettingsData({ ...settingsData, max_focus_items: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <Button 
              onClick={() => updateSettingsMutation.mutate(settingsData || currentSettings)}
              className="w-full bg-blue-600 hover:bg-blue-700"
              disabled={updateSettingsMutation.isPending}
            >
              {updateSettingsMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              שמור הגדרות
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">🤖 ניהול חכם</h1>
            <p className="text-slate-600">מערכת התראות וניתוח עסקי אוטומטי</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline"
              onClick={() => setShowSettings(true)}
            >
              <SettingsIcon className="w-4 h-4 ml-2" />
              הגדרות
            </Button>
            <Button 
              onClick={() => runAnalysisMutation.mutate()}
              disabled={runAnalysisMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {runAnalysisMutation.isPending && <Loader2 className="w-4 h-4 ml-2 animate-spin" />}
              הרץ ניתוח
            </Button>
          </div>
        </div>

        {/* Top Priority Projects */}
        {projectsWithScores.length > 0 && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 p-6">
            <h2 className="text-xl font-bold text-slate-900 mb-4">🎯 פרויקטים בעדיפות</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {projectsWithScores.map(({ project, score, financials }, idx) => (
                <div key={project.id} className="bg-white rounded-xl p-4 border border-slate-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-bold text-blue-600">#{idx + 1}</span>
                    <span className="text-sm font-semibold text-slate-600">{score.toFixed(1)} נק'</span>
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-1">{project.name}</h3>
                  <p className="text-sm text-slate-600 mb-2">{project.customer_name}</p>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>רווחיות: {financials.profit_percent?.toFixed(1) || 0}%</div>
                    <div>יתרה: {formatCurrency(financials.balance_to_collect)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Smart Focus */}
        {currentSettings.enable_smart_focus !== false && (
          <SmartFocusCard
            tasks={smartFocusTasks}
            summary={dailySummary}
            isLoading={runAnalysisMutation.isPending}
            onRefresh={() => runAnalysisMutation.mutate()}
            maxItems={currentSettings.max_focus_items || 5}
          />
        )}

        {/* Alerts Section */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">התראות פעילות ({filteredAlerts.length})</h2>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">כל ההתראות</SelectItem>
                  <SelectItem value="profitability">רווחיות</SelectItem>
                  <SelectItem value="collection">גבייה</SelectItem>
                  <SelectItem value="cash_flow">תזרים</SelectItem>
                  <SelectItem value="workload">עומס</SelectItem>
                  <SelectItem value="strategic">אסטרטגי</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {filteredAlerts.length === 0 && (
              <div className="p-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                <p className="text-slate-600">אין התראות פעילות</p>
              </div>
            )}

            {filteredAlerts.map((alert) => {
              const config = severityConfig[alert.severity];
              const Icon = config.icon;
              const TypeIcon = alertTypeIcons[alert.alert_type];

              return (
                <div key={alert.id} className={cn("p-4 hover:bg-slate-50 transition-colors", config.bg, config.border, "border-r-4")}>
                  <div className="flex items-start gap-4">
                    <div className={cn("p-2 rounded-lg", config.bg)}>
                      <Icon className={cn("w-5 h-5", config.color)} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <TypeIcon className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-medium text-slate-500">
                          {alertTypeLabels[alert.alert_type]}
                        </span>
                        {alert.project_name && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="text-xs text-slate-600">{alert.project_name}</span>
                          </>
                        )}
                      </div>
                      <p className="font-medium text-slate-900 mb-2">{alert.message}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(alert.created_date).toLocaleDateString('he-IL')}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => markHandledMutation.mutate(alert.id)}
                      disabled={markHandledMutation.isPending}
                    >
                      סמן כטופל
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}