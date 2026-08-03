import { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Wallet,
  Bell,
  Brain,
  Menu,
  X,
  ChevronLeft,
  FileText,
  Tag,
  Stamp
} from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "דשבורד", href: "Dashboard", icon: LayoutDashboard },
  { name: "לקוחות", href: "Customers", icon: Users },
  { name: "פרויקטים", href: "Projects", icon: Building2 },
  { name: "הצעות מחיר", href: "Quotes", icon: FileText },
  { name: "קטלוג דגמים", href: "ModelPricing", icon: Tag },
  { name: "פיננסים", href: "Finance", icon: Wallet },
  { name: "תזכורות", href: "Reminders", icon: Bell },
  { name: "כותרות הדפסה", href: "CompanyHeaders", icon: Stamp },
  { name: "🤖 ניהול חכם", href: "BusinessAgent", icon: Brain },
];

export default function Layout({ children, currentPageName }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 right-0 z-50 h-full w-64 bg-white border-l border-slate-200 transform transition-transform duration-300 lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-slate-100">
          <h1 className="text-xl font-bold text-slate-900">ניהול פרויקטים</h1>
          <button 
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-2 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1">
          {navigation.map((item) => {
            const isActive = currentPageName === item.href;
            return (
              <Link
                key={item.name}
                to={createPageUrl(item.href)}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                  isActive 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <item.icon className={cn(
                  "w-5 h-5",
                  isActive ? "text-blue-600" : "text-slate-400"
                )} />
                {item.name}
                {isActive && <ChevronLeft className="w-4 h-4 mr-auto" />}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:mr-64">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200 lg:hidden">
          <div className="flex items-center justify-between h-16 px-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="p-2 rounded-lg hover:bg-slate-100"
            >
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold text-slate-900">ניהול פרויקטים</h1>
            <div className="w-10" /> {/* Spacer */}
          </div>
        </header>

        {/* Page content */}
        <main>
          {children}
        </main>
      </div>
    </div>
  );
}