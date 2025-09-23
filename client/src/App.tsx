import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import NotFound from "@/pages/not-found";
import AuthPage from "@/pages/auth-page";
import Dashboard from "@/pages/dashboard";
import EmployeesList from "@/pages/employees/employees-list";
import EmployeeForm from "@/pages/employees/employee-form";
import EmployeeProfile from "@/pages/employees/employee-profile";
import Documents from "@/pages/documents";
import Reports from "@/pages/reports";
import Audits from "@/pages/audits";
import Settings from "@/pages/settings";
import ApiKeysPage from "@/pages/settings/api-keys";
import UsersManagement from "@/pages/settings/users";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/employees" component={EmployeesList} />
      <ProtectedRoute path="/employees/new" component={EmployeeForm} />
      <ProtectedRoute path="/employees/:id/edit" component={EmployeeForm} />
      <ProtectedRoute path="/employees/:id" component={EmployeeProfile} />
      <ProtectedRoute path="/documents" component={Documents} />
      <ProtectedRoute path="/reports" component={Reports} />
      <ProtectedRoute path="/audits" component={Audits} />
      <ProtectedRoute path="/settings" component={Settings} />
      <ProtectedRoute path="/settings/api-keys" component={ApiKeysPage} />
      <ProtectedRoute path="/settings/users" component={UsersManagement} />
      <Route path="/auth" component={AuthPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
