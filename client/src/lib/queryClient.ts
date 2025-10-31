/**
 * @fileoverview Query Client Configuration for TanStack Query
 * 
 * This module provides the centralized configuration for data fetching in the HR Management System.
 * It includes utilities for making API requests, handling authentication, and managing cache.
 * 
 * Features:
 * - Automatic error handling for non-OK responses
 * - Session-based authentication with cookies
 * - Configurable 401 (unauthorized) behavior
 * - Optimized cache settings for HR data
 * 
 * @module queryClient
 */

import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * Helper function to check response status and throw on error
 * 
 * @async
 * @function throwIfResNotOk
 * @param {Response} res - Fetch API response object
 * @throws {Error} Throws error with status code and message if response is not ok
 * 
 * @description
 * Checks if the HTTP response is successful (2xx status code).
 * If not, extracts the error message from response body or uses status text.
 * 
 * @example
 * const response = await fetch('/api/employees');
 * await throwIfResNotOk(response); // Throws if not 2xx
 */
async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Make an API request with automatic error handling
 * 
 * @async
 * @function apiRequest
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE, etc.)
 * @param {string} url - API endpoint URL
 * @param {unknown} [data] - Optional request body data (will be JSON stringified)
 * @returns {Promise<Response>} Fetch Response object
 * @throws {Error} If response is not ok (non-2xx status)
 * 
 * @description
 * Utility function for making API requests with consistent configuration:
 * - Automatically includes credentials (cookies) for session-based auth
 * - Sets Content-Type header for JSON when data is provided
 * - Throws descriptive errors for failed requests
 * 
 * @example
 * // GET request
 * const response = await apiRequest('GET', '/api/employees');
 * const employees = await response.json();
 * 
 * @example
 * // POST request with data
 * const response = await apiRequest('POST', '/api/employees', {
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   workEmail: 'john.doe@hospital.com'
 * });
 * const newEmployee = await response.json();
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Check if data is FormData - if so, don't stringify or set Content-Type
  const isFormData = data instanceof FormData;
  
  const res = await fetch(url, {
    method,
    headers: data && !isFormData ? { "Content-Type": "application/json" } : {},
    body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
    credentials: "include", // Include cookies for session-based authentication
  });

  await throwIfResNotOk(res);
  return res;
}

/**
 * Behavior options for handling 401 Unauthorized responses
 */
type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Factory function for creating TanStack Query fetch functions
 * 
 * @function getQueryFn
 * @template T - Expected response type
 * @param {Object} options - Configuration options
 * @param {UnauthorizedBehavior} options.on401 - How to handle 401 responses:
 *   - 'returnNull': Return null (useful for auth checks)
 *   - 'throw': Throw an error (default behavior)
 * @returns {QueryFunction<T>} Query function for TanStack Query
 * 
 * @description
 * Creates a query function with configurable 401 handling.
 * This is particularly useful for the auth check query where 401 is expected
 * for unauthenticated users and shouldn't trigger error states.
 * 
 * @example
 * // For auth check - return null on 401
 * useQuery({
 *   queryKey: ['/api/user'],
 *   queryFn: getQueryFn({ on401: 'returnNull' })
 * });
 * 
 * @example  
 * // For protected resources - throw on 401
 * useQuery({
 *   queryKey: ['/api/employees'],
 *   queryFn: getQueryFn({ on401: 'throw' })
 * });
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Join queryKey array to form URL (e.g., ['/api', 'employees', '1'] -> '/api/employees/1')
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include", // Include session cookies
    });

    // Handle 401 based on configuration
    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

/**
 * TanStack Query Client Instance
 * 
 * @constant {QueryClient} queryClient
 * 
 * @description
 * Centralized query client configuration for the HR Management System.
 * Optimized for server-side session-based authentication and HR data patterns.
 * 
 * Configuration:
 * - queryFn: Default fetch function that throws on 401 (unauthorized)
 * - refetchInterval: Disabled - HR data doesn't change frequently
 * - refetchOnWindowFocus: Disabled - Prevents unnecessary refetches
 * - staleTime: Infinity - Data considered fresh until manually invalidated
 * - retry: Disabled - Failed requests show errors immediately
 * 
 * This configuration is optimized for:
 * - Session-based authentication (not token-based)
 * - HR data that changes infrequently
 * - User-initiated data updates (not real-time)
 * - Clear error states for debugging
 * 
 * @example
 * // Using the query client in a component
 * import { queryClient } from '@/lib/queryClient';
 * 
 * // Invalidate cache after mutation
 * queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
 * 
 * // Set query data directly
 * queryClient.setQueryData(['/api/user'], userData);
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }), // Default: throw on unauthorized
      refetchInterval: false, // No automatic refetching
      refetchOnWindowFocus: false, // Don't refetch on tab focus
      staleTime: Infinity, // Data never becomes stale automatically
      retry: false, // Don't retry failed requests
    },
    mutations: {
      retry: false, // Don't retry failed mutations
    },
  },
});
