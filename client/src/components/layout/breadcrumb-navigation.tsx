import { useLocation, useParams, Link } from "wouter";
import { Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useQuery } from "@tanstack/react-query";
import type { Employee } from "../../../../shared/schema";

interface BreadcrumbItem {
  label: string;
  path?: string;
}

// Route configuration for breadcrumbs
const routeConfig: Record<string, { label: string; parent?: string }> = {
  "/": { label: "Dashboard" },
  "/employees": { label: "Employees", parent: "/" },
  "/employees/new": { label: "New Employee", parent: "/employees" },
  "/employees/:id": { label: "Employee Profile", parent: "/employees" },
  "/employees/:id/edit": { label: "Edit Employee", parent: "/employees" },
  "/documents": { label: "Documents", parent: "/" },
  "/locations": { label: "Locations", parent: "/" },
  "/licenses": { label: "Licenses", parent: "/" },
  "/license-types": { label: "License Types", parent: "/" },
  "/responsible-persons": { label: "Responsible Persons", parent: "/" },
  "/compliance-documents": { label: "Compliance Documents", parent: "/" },
  "/reports": { label: "Reports", parent: "/" },
  "/audits": { label: "Audits", parent: "/" },
  "/settings": { label: "Settings", parent: "/" },
  "/settings/api-keys": { label: "API Keys", parent: "/settings" },
  "/settings/users": { label: "User Management", parent: "/settings" },
};

function generateBreadcrumbs(pathname: string, employeeName?: string): BreadcrumbItem[] {
  const breadcrumbs: BreadcrumbItem[] = [];
  
  // Find matching route
  let matchedRoute = routeConfig[pathname];
  let currentPath = pathname;
  
  // Handle dynamic routes
  if (!matchedRoute) {
    if (pathname.startsWith("/employees/") && pathname.endsWith("/edit")) {
      matchedRoute = routeConfig["/employees/:id/edit"];
      currentPath = "/employees/:id/edit";
    } else if (pathname.startsWith("/employees/") && pathname.split("/").length === 3) {
      matchedRoute = routeConfig["/employees/:id"];
      currentPath = "/employees/:id";
    }
  }
  
  if (!matchedRoute) {
    return [{ label: "Dashboard", path: "/" }];
  }
  
  // Build breadcrumb chain
  const buildChain = (path: string): void => {
    const route = routeConfig[path];
    if (!route) return;
    
    if (route.parent) {
      buildChain(route.parent);
    }
    
    let label = route.label;
    
    // Customize label for dynamic routes
    if (path === "/employees/:id" && employeeName) {
      label = employeeName;
    } else if (path === "/employees/:id/edit" && employeeName) {
      label = `Edit ${employeeName}`;
    }
    
    breadcrumbs.push({
      label,
      path: path === currentPath ? undefined : path === "/employees/:id" ? pathname.replace("/edit", "") : path,
    });
  };
  
  buildChain(currentPath);
  return breadcrumbs;
}

export function BreadcrumbNavigation() {
  const [location] = useLocation();
  const params = useParams();
  
  // Fetch employee name for employee-specific pages
  const employeeId = params.id ? parseInt(params.id) : null;
  const { data: employee } = useQuery<Employee>({
    queryKey: ["/api/employees", employeeId],
    enabled: !!employeeId && location.startsWith("/employees/"),
  });
  
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : undefined;
  const breadcrumbs = generateBreadcrumbs(location, employeeName);
  
  // Don't show breadcrumbs on the dashboard (home page)
  if (location === "/" || breadcrumbs.length <= 1) {
    return null;
  }
  
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-6 py-3">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((item, index) => (
              <div key={index} className="flex items-center">
                {index > 0 && <BreadcrumbSeparator />}
                <BreadcrumbItem>
                  {item.path ? (
                    <BreadcrumbLink 
                      asChild
                      className="flex items-center gap-1.5"
                      data-testid={`breadcrumb-link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      <Link href={item.path}>
                        {index === 0 && <Home className="w-4 h-4" />}
                        {item.label}
                      </Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage 
                      className="flex items-center gap-1.5"
                      data-testid={`breadcrumb-current-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {index === 0 && <Home className="w-4 h-4" />}
                      {item.label}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </div>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </div>
  );
}