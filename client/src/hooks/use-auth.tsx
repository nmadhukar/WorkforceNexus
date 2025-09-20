/**
 * @fileoverview Authentication Context and Hook for HR Management System
 * 
 * This module provides a React Context and custom hook for managing user authentication
 * throughout the application. It handles login, logout, registration, and maintains
 * the current user's session state.
 * 
 * Features:
 * - Session-based authentication with server-side validation
 * - Automatic session restoration on page reload
 * - Role-based access control (admin, hr, viewer)
 * - Toast notifications for authentication events
 * - Type-safe user data management
 * 
 * @module use-auth
 */

import { createContext, ReactNode, useContext } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * Authentication context type definition
 * Provides user state and authentication methods to child components
 */
type AuthContextType = {
  /** Current authenticated user or null if not logged in */
  user: SelectUser | null;
  /** Loading state for initial authentication check */
  isLoading: boolean;
  /** Error from authentication check */
  error: Error | null;
  /** Mutation for user login */
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  /** Mutation for user logout */
  logoutMutation: UseMutationResult<void, Error, void>;
  /** Mutation for user registration */
  registerMutation: UseMutationResult<SelectUser, Error, RegisterData>;
};

/**
 * Login credentials type
 */
type LoginData = {
  username: string;
  password: string;
};

/**
 * Registration data type
 */
type RegisterData = {
  username: string;
  password: string;
  /** Optional role: 'admin' | 'hr' | 'viewer' (defaults to 'hr') */
  role?: string;
};

/**
 * Authentication context for providing auth state throughout the app
 */
export const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Authentication Provider Component
 * 
 * @component
 * @param {ReactNode} children - Child components that need access to auth context
 * 
 * @description
 * Wraps the application and provides authentication state and methods to all child components.
 * Automatically checks for existing session on mount and restores user state.
 * 
 * @example
 * ```tsx
 * // In App.tsx
 * <AuthProvider>
 *   <Router>
 *     <Routes />
 *   </Router>
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  /**
   * Query to fetch current user from session
   * Returns null on 401 (not authenticated) instead of throwing
   * This allows graceful handling of unauthenticated state
   */
  const {
    data: user,
    error,
    isLoading,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  /**
   * Login mutation for authenticating users
   * 
   * @description
   * Sends credentials to /api/login endpoint and updates user state on success.
   * Shows error toast on failure.
   * 
   * @example
   * ```tsx
   * const { loginMutation } = useAuth();
   * await loginMutation.mutateAsync({ 
   *   username: 'john.doe', 
   *   password: 'password123' 
   * });
   * ```
   */
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const res = await apiRequest("POST", "/api/login", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      // Update query cache with authenticated user
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: RegisterData) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
    },
    onError: (error: Error) => {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
    },
    onError: (error: Error) => {
      toast({
        title: "Logout failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook for accessing authentication context
 * 
 * @hook
 * @returns {AuthContextType} Authentication context with user state and methods
 * @throws {Error} If used outside of AuthProvider
 * 
 * @description
 * Provides access to current user, authentication state, and auth methods.
 * Must be used within an AuthProvider component.
 * 
 * @example
 * ```tsx
 * function ProfilePage() {
 *   const { user, isLoading, loginMutation } = useAuth();
 *   
 *   if (isLoading) return <Spinner />;
 *   if (!user) return <LoginForm />;
 *   
 *   return <Profile user={user} />;
 * }
 * ```
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
