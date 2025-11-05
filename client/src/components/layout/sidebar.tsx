import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
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
  LayoutDashboard,
  ClipboardList,
  User
} from "lucide-react";

// Define all navigation items with their required roles
const allNavigationItems = [
  { 
    path: "/", 
    label: "Dashboard", 
    icon: Home, 
    roles: ["admin", "hr", "employee", "prospective_employee", "viewer"] 
  },
  { 
    path: "/onboarding", 
    label: "Onboarding", 
    icon: ClipboardList, 
    roles: ["prospective_employee"] 
  },
  { 
    path: "/employee-portal", 
    label: "My Portal", 
    icon: User, 
    roles: ["employee"] 
  },
  { 
    path: "/employees", 
    label: "Employees", 
    icon: Users, 
    roles: ["admin", "hr"] 
  },
  { 
    path: "/documents", 
    label: "Documents", 
    icon: FileText, 
    roles: ["admin", "hr", "employee"] 
  },
  { 
    path: "/reports", 
    label: "Reports", 
    icon: BarChart2, 
    roles: ["admin", "hr"] 
  },
  { 
    path: "/audits", 
    label: "Audits", 
    icon: Shield, 
    roles: ["admin", "hr"] 
  },
  { 
    path: "/settings", 
    label: "Settings", 
    icon: Settings, 
    roles: ["admin", "hr"] 
  },
  { 
    path: "/compliance", 
    label: "Compliance", 
    icon: Award,
    roles: ["admin", "hr"],
    submenu: [
      { 
        path: "/compliance-dashboard", 
        label: "Dashboard", 
        icon: LayoutDashboard, 
        roles: ["admin", "hr"] 
      },
      { 
        path: "/locations", 
        label: "Locations", 
        icon: Building2, 
        roles: ["admin", "hr"] 
      },
      { 
        path: "/licenses", 
        label: "Licenses", 
        icon: Award, 
        roles: ["admin", "hr"] 
      },
      { 
        path: "/license-types", 
        label: "License Types", 
        icon: FileCheck, 
        roles: ["admin", "hr"] 
      },
      { 
        path: "/responsible-persons", 
        label: "Responsible Persons", 
        icon: Users, 
        roles: ["admin", "hr"] 
      },
      { 
        path: "/compliance-documents", 
        label: "Documents", 
        icon: FileText, 
        roles: ["admin", "hr"] 
      }
    ]
  }
];

export function Sidebar() {
  const [location, navigate] = useLocation();
  const [expandedItem, setExpandedItem] = useState<string | null>("compliance");
  const { user } = useAuth();
  
  // Filter navigation items based on user role
  const navigationItems = useMemo(() => {
    const userRole = user?.role || "viewer";
    
    return allNavigationItems
      .filter(item => item.roles.includes(userRole))
      .map(item => {
        // Filter submenu items if they exist
        if (item.submenu) {
          const filteredSubmenu = item.submenu.filter(subItem => 
            subItem.roles.includes(userRole)
          );
          // Only include the parent item if it has submenu items after filtering
          if (filteredSubmenu.length > 0) {
            return {
              ...item,
              submenu: filteredSubmenu
            };
          }
          return null;
        }
        return item;
      })
      .filter(item => item !== null);
  }, [user?.role]);

  return (
    <nav className="w-64 bg-card border-r border-border h-screen sticky top-0 pt-0">
      <div className="p-6">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const hasSubmenu = 'submenu' in item;
            const isActive = location === item.path || 
              (item.path === "/employees" && location.startsWith("/employees")) ||
              (item.path === "/employee-portal" && location.startsWith("/employee-portal")) ||
              (item.path === "/onboarding" && location.startsWith("/onboarding")) ||
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
                  data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
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