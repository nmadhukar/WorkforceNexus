import { useLocation } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
  Home, 
  Users, 
  FileText, 
  BarChart2, 
  Shield, 
  Settings,
  Award,
  ChevronDown,
  ChevronRight,
  Building2,
  FileCheck,
  LayoutDashboard
} from "lucide-react";

const navigationItems = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/employees", label: "Employees", icon: Users },
  { path: "/documents", label: "Documents", icon: FileText },
  { 
    path: "/compliance", 
    label: "Compliance", 
    icon: Award,
    submenu: [
      { path: "/compliance-dashboard", label: "Dashboard", icon: LayoutDashboard },
      { path: "/locations", label: "Locations", icon: Building2 },
      { path: "/licenses", label: "Licenses", icon: Award },
      { path: "/license-types", label: "License Types", icon: FileCheck },
      { path: "/responsible-persons", label: "Responsible Persons", icon: Users },
      { path: "/compliance-documents", label: "Documents", icon: FileText }
    ]
  },
  { path: "/reports", label: "Reports", icon: BarChart2 },
  { path: "/audits", label: "Audits", icon: Shield },
  { path: "/settings", label: "Settings", icon: Settings }
];

export function Sidebar() {
  const [location, navigate] = useLocation();
  const [expandedItem, setExpandedItem] = useState<string | null>("compliance");

  return (
    <nav className="w-64 bg-card border-r border-border h-screen sticky top-0 pt-0">
      <div className="p-6">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const hasSubmenu = 'submenu' in item;
            const isActive = location === item.path || 
              (item.path === "/employees" && location.startsWith("/employees")) ||
              (hasSubmenu && item.submenu?.some(sub => location === sub.path));
            const isExpanded = expandedItem === item.path;
            
            return (
              <li key={item.path}>
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start space-x-3 px-4 py-3 rounded-lg hover:bg-muted",
                    isActive && "bg-muted text-primary nav-item active"
                  )}
                  onClick={() => {
                    if (hasSubmenu) {
                      setExpandedItem(isExpanded ? null : item.path);
                    } else {
                      navigate(item.path);
                    }
                  }}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {hasSubmenu && (
                    isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                  )}
                </Button>
                {hasSubmenu && isExpanded && (
                  <ul className="mt-2 ml-6 space-y-1">
                    {item.submenu?.map((subItem) => {
                      const SubIcon = subItem.icon;
                      const isSubActive = location === subItem.path;
                      return (
                        <li key={subItem.path}>
                          <Button
                            variant="ghost"
                            className={cn(
                              "w-full justify-start space-x-2 px-3 py-2 rounded-lg hover:bg-muted text-sm",
                              isSubActive && "bg-muted text-primary"
                            )}
                            onClick={() => navigate(subItem.path)}
                            data-testid={`nav-${subItem.label.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            <SubIcon className="w-4 h-4" />
                            <span>{subItem.label}</span>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
