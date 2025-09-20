import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Users, 
  FileText, 
  BarChart2, 
  Shield, 
  Settings 
} from "lucide-react";

const navigationItems = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/employees", label: "Employees", icon: Users },
  { path: "/documents", label: "Documents", icon: FileText },
  { path: "/reports", label: "Reports", icon: BarChart2 },
  { path: "/audits", label: "Audits", icon: Shield },
  { path: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const [location, navigate] = useLocation();

  return (
    <nav className="w-64 bg-card border-r border-border h-screen sticky top-0 pt-0">
      <div className="p-6">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path || 
              (item.path === "/employees" && location.startsWith("/employees"));
            
            return (
              <li key={item.path}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start space-x-3 px-4 py-3 rounded-lg hover:bg-muted",
                    isActive && "bg-muted text-primary nav-item active"
                  )}
                  onClick={() => navigate(item.path)}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Button>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
