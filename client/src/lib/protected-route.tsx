/**
 * @fileoverview Protected Route Component for Authentication
 * 
 * This module provides a wrapper component that protects routes from
 * unauthenticated access. It integrates with the authentication system
 * to check user status and redirect to login when necessary.
 * 
 * @module protected-route
 */

import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

/**
 * Protected route component that requires user authentication
 * 
 * @component
 * @param {Object} props - Component props
 * @param {string} props.path - Route path pattern to match
 * @param {Function} props.component - Component to render when authenticated
 * @returns {React.JSX.Element} Route component with authentication protection
 * 
 * @description
 * Wraps a route component with authentication checks. Shows loading spinner
 * while checking auth status, redirects to /auth for unauthenticated users,
 * and renders the protected component for authenticated users.
 * 
 * Authentication flow:
 * 1. Check if auth is loading -> show spinner
 * 2. Check if user is authenticated -> redirect to /auth if not
 * 3. Render protected component if authenticated
 * 
 * @example
 * ```tsx
 * // Protect the dashboard page
 * <ProtectedRoute 
 *   path="/dashboard" 
 *   component={Dashboard} 
 * />
 * ```
 * 
 * @example
 * ```tsx
 * // Protect employee management pages
 * <ProtectedRoute 
 *   path="/employees/:id?" 
 *   component={EmployeePage} 
 * />
 * ```
 */
export function ProtectedRoute({
  path,
  component: Component,
}: {
  path: string;
  component: () => React.JSX.Element;
}) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-border" />
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/auth" />
      </Route>
    );
  }

  return (
    <Route path={path}>
      <Component />
    </Route>
  )
}
