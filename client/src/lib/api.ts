/**
 * @fileoverview API Client Library for HR Management System
 * 
 * This module provides organized API functions for all HTTP requests in the HR system.
 * Functions are grouped by domain (employees, documents, reports, etc.) and provide
 * consistent interfaces for data fetching and manipulation.
 * 
 * Features:
 * - Type-safe API calls with proper error handling
 * - Consistent parameter handling and URL construction
 * - Session-based authentication via cookies
 * - Support for pagination, filtering, and search
 * - File upload and download capabilities
 * 
 * @module api
 */

import { apiRequest } from "./queryClient";

/**
 * Employee API functions for managing employee data and related information
 * @namespace employeeApi
 */
export const employeeApi = {
  /**
   * Retrieve employees with optional filtering and pagination
   * 
   * @function getEmployees
   * @param {Object} [params] - Query parameters for filtering employees
   * @param {number} [params.page] - Page number for pagination (1-based)
   * @param {number} [params.limit] - Number of employees per page
   * @param {string} [params.search] - Search term for name or email
   * @param {string} [params.department] - Filter by department
   * @param {string} [params.status] - Filter by employment status
   * @param {string} [params.location] - Filter by work location
   * @returns {Promise<Response>} Fetch response with employee data
   * 
   * @example
   * // Get first page of active employees
   * const response = await employeeApi.getEmployees({
   *   page: 1,
   *   limit: 20,
   *   status: 'active'
   * });
   * const data = await response.json();
   */
  getEmployees: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    status?: string;
    location?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.append(key, String(value));
        }
      });
    }
    return fetch(`/api/employees?${searchParams}`, { credentials: "include" });
  },

  /**
   * Get a specific employee by ID
   * 
   * @function getEmployee
   * @param {number} id - Employee ID
   * @returns {Promise<Response>} Fetch response with employee data
   * 
   * @example
   * const response = await employeeApi.getEmployee(123);
   * const employee = await response.json();
   */
  getEmployee: (id: number) => 
    fetch(`/api/employees/${id}`, { credentials: "include" }),

  /**
   * Create a new employee record
   * 
   * @function createEmployee
   * @param {Object} data - Employee data object
   * @param {string} data.firstName - Employee first name
   * @param {string} data.lastName - Employee last name
   * @param {string} data.workEmail - Work email address
   * @returns {Promise<Response>} Fetch response with created employee
   * @throws {Error} If validation fails or creation fails
   * 
   * @example
   * const newEmployee = await employeeApi.createEmployee({
   *   firstName: 'John',
   *   lastName: 'Doe',
   *   workEmail: 'john.doe@hospital.com'
   * });
   */
  createEmployee: (data: any) => 
    apiRequest("POST", "/api/employees", data),

  /**
   * Update an existing employee record
   * 
   * @function updateEmployee
   * @param {number} id - Employee ID to update
   * @param {Object} data - Partial employee data to update
   * @returns {Promise<Response>} Fetch response with updated employee
   * @throws {Error} If employee not found or update fails
   * 
   * @example
   * const updated = await employeeApi.updateEmployee(123, {
   *   jobTitle: 'Senior Physician',
   *   workLocation: 'Emergency Department'
   * });
   */
  updateEmployee: (id: number, data: any) => 
    apiRequest("PUT", `/api/employees/${id}`, data),

  /**
   * Delete an employee record
   * 
   * @function deleteEmployee
   * @param {number} id - Employee ID to delete
   * @returns {Promise<Response>} Fetch response confirming deletion
   * @throws {Error} If employee not found or deletion fails
   * 
   * @example
   * await employeeApi.deleteEmployee(123);
   */
  deleteEmployee: (id: number) => 
    apiRequest("DELETE", `/api/employees/${id}`),

  /**
   * Get education records for a specific employee
   * 
   * @function getEmployeeEducations
   * @param {number} employeeId - Employee ID
   * @returns {Promise<Response>} Fetch response with education records
   */
  getEmployeeEducations: (employeeId: number) =>
    fetch(`/api/employees/${employeeId}/educations`, { credentials: "include" }),

  /**
   * Add a new education record for an employee
   * 
   * @function createEmployeeEducation
   * @param {number} employeeId - Employee ID
   * @param {Object} data - Education data
   * @param {string} [data.schoolInstitution] - School or institution name
   * @param {string} [data.degree] - Degree obtained
   * @param {string} [data.startDate] - Start date
   * @param {string} [data.endDate] - End date
   * @returns {Promise<Response>} Fetch response with created education record
   */
  createEmployeeEducation: (employeeId: number, data: any) =>
    apiRequest("POST", `/api/employees/${employeeId}/educations`, data),

  /**
   * Get state licenses for a specific employee
   * 
   * @function getEmployeeStateLicenses
   * @param {number} employeeId - Employee ID
   * @returns {Promise<Response>} Fetch response with state license records
   */
  getEmployeeStateLicenses: (employeeId: number) =>
    fetch(`/api/employees/${employeeId}/state-licenses`, { credentials: "include" }),

  /**
   * Add a new state license for an employee
   * 
   * @function createEmployeeStateLicense
   * @param {number} employeeId - Employee ID
   * @param {Object} data - State license data
   * @param {string} data.licenseNumber - License number
   * @param {string} data.state - State of issuance
   * @param {string} [data.issueDate] - Issue date
   * @param {string} [data.expirationDate] - Expiration date
   * @returns {Promise<Response>} Fetch response with created license record
   */
  createEmployeeStateLicense: (employeeId: number, data: any) =>
    apiRequest("POST", `/api/employees/${employeeId}/state-licenses`, data),

  /**
   * Get DEA licenses for a specific employee
   * 
   * @function getEmployeeDeaLicenses
   * @param {number} employeeId - Employee ID
   * @returns {Promise<Response>} Fetch response with DEA license records
   */
  getEmployeeDeaLicenses: (employeeId: number) =>
    fetch(`/api/employees/${employeeId}/dea-licenses`, { credentials: "include" }),

  /**
   * Add a new DEA license for an employee
   * 
   * @function createEmployeeDeaLicense
   * @param {number} employeeId - Employee ID
   * @param {Object} data - DEA license data
   * @param {string} data.licenseNumber - DEA license number
   * @param {string} [data.issueDate] - Issue date
   * @param {string} [data.expirationDate] - Expiration date
   * @returns {Promise<Response>} Fetch response with created DEA license record
   */
  createEmployeeDeaLicense: (employeeId: number, data: any) =>
    apiRequest("POST", `/api/employees/${employeeId}/dea-licenses`, data),
};

/**
 * Document API functions for managing file uploads, downloads, and document metadata
 * @namespace documentApi
 */
export const documentApi = {
  /**
   * Retrieve documents with optional filtering and pagination
   * 
   * @function getDocuments
   * @param {Object} [params] - Query parameters for filtering documents
   * @param {number} [params.page] - Page number for pagination (1-based)
   * @param {number} [params.limit] - Number of documents per page
   * @param {string} [params.search] - Search term for document name or notes
   * @param {string} [params.type] - Filter by document type
   * @param {number} [params.employeeId] - Filter by specific employee
   * @returns {Promise<Response>} Fetch response with document data
   * 
   * @example
   * // Get license documents for employee
   * const response = await documentApi.getDocuments({
   *   employeeId: 123,
   *   type: 'license'
   * });
   */
  getDocuments: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
    employeeId?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.append(key, String(value));
        }
      });
    }
    return fetch(`/api/documents?${searchParams}`, { credentials: "include" });
  },

  /**
   * Upload a document file with metadata
   * 
   * @function uploadDocument
   * @param {FormData} formData - Form data containing file and metadata
   * @returns {Promise<Response>} Fetch response with uploaded document info
   * @throws {Error} If upload fails or file is invalid
   * 
   * @example
   * const formData = new FormData();
   * formData.append('file', fileInput.files[0]);
   * formData.append('employeeId', '123');
   * formData.append('documentType', 'license');
   * await documentApi.uploadDocument(formData);
   */
  uploadDocument: (formData: FormData) =>
    fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
      credentials: "include"
    }),

  /**
   * Download a document file by ID
   * 
   * @function downloadDocument
   * @param {number} id - Document ID
   * @returns {Promise<Response>} Fetch response with file blob
   * @throws {Error} If document not found or access denied
   * 
   * @example
   * const response = await documentApi.downloadDocument(456);
   * const blob = await response.blob();
   * const url = URL.createObjectURL(blob);
   */
  downloadDocument: (id: number) =>
    fetch(`/api/documents/${id}/download`, { credentials: "include" }),

  /**
   * Delete a document record and associated file
   * 
   * @function deleteDocument
   * @param {number} id - Document ID to delete
   * @returns {Promise<Response>} Fetch response confirming deletion
   * @throws {Error} If document not found or deletion fails
   */
  deleteDocument: (id: number) =>
    apiRequest("DELETE", `/api/documents/${id}`),
};

/**
 * Reports API functions for analytics, statistics, and data export
 * @namespace reportsApi
 */
export const reportsApi = {
  /**
   * Get items (licenses, certifications) expiring within specified days
   * 
   * @function getExpiringItems
   * @param {number} [days=30] - Number of days to look ahead for expirations
   * @returns {Promise<Response>} Fetch response with expiring items
   * 
   * @example
   * // Get items expiring in next 60 days
   * const response = await reportsApi.getExpiringItems(60);
   * const expiringItems = await response.json();
   */
  getExpiringItems: (days: number = 30) =>
    fetch(`/api/reports/expiring?days=${days}`, { credentials: "include" }),

  /**
   * Get employee statistics for dashboard and reports
   * 
   * @function getEmployeeStats
   * @returns {Promise<Response>} Fetch response with employee statistics
   * 
   * @example
   * const response = await reportsApi.getEmployeeStats();
   * const stats = await response.json();
   * // { totalEmployees: 150, activeEmployees: 145, ... }
   */
  getEmployeeStats: () =>
    fetch("/api/reports/stats", { credentials: "include" }),

  /**
   * Export data as CSV file for specified report type
   * 
   * @function exportCSV
   * @param {string} reportType - Type of report to export (employees, licenses, etc.)
   * @returns {Promise<Response>} Fetch response with CSV file
   * 
   * @example
   * const response = await reportsApi.exportCSV('employees');
   * const blob = await response.blob();
   * const url = URL.createObjectURL(blob);
   */
  exportCSV: (reportType: string) =>
    fetch(`/api/export/${reportType}`, { credentials: "include" }),
};

/**
 * Audit API functions for tracking data changes and system activity
 * @namespace auditApi
 */
export const auditApi = {
  /**
   * Retrieve audit logs with optional filtering and pagination
   * 
   * @function getAudits
   * @param {Object} [params] - Query parameters for filtering audit logs
   * @param {number} [params.page] - Page number for pagination (1-based)
   * @param {number} [params.limit] - Number of audit records per page
   * @param {string} [params.tableName] - Filter by table/entity name
   * @param {string} [params.action] - Filter by action type (CREATE, UPDATE, DELETE)
   * @param {string} [params.startDate] - Filter by start date (ISO format)
   * @param {string} [params.endDate] - Filter by end date (ISO format)
   * @returns {Promise<Response>} Fetch response with audit log data
   * 
   * @example
   * // Get employee table changes from last week
   * const response = await auditApi.getAudits({
   *   tableName: 'employees',
   *   startDate: '2024-01-01T00:00:00Z'
   * });
   */
  getAudits: (params?: {
    page?: number;
    limit?: number;
    tableName?: string;
    action?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          searchParams.append(key, String(value));
        }
      });
    }
    return fetch(`/api/audits?${searchParams}`, { credentials: "include" });
  },
};

/**
 * Cron and background job API functions for manual job triggers
 * @namespace cronApi
 */
export const cronApi = {
  /**
   * Manually trigger the expiration check job
   * 
   * @function manualExpirationCheck
   * @returns {Promise<Response>} Fetch response with job execution result
   * @throws {Error} If job execution fails or user lacks permissions
   * 
   * @description
   * Triggers the background job that checks for expiring licenses, certifications,
   * and other time-sensitive items. Normally runs on a schedule but can be triggered
   * manually for immediate updates.
   * 
   * @example
   * // Trigger manual expiration check
   * const response = await cronApi.manualExpirationCheck();
   * const result = await response.json();
   */
  manualExpirationCheck: () =>
    fetch("/api/cron/check-expirations", { credentials: "include" }),
};

/**
 * Settings API functions for system configuration and user management
 * @namespace settingsApi
 */
export const settingsApi = {
  /**
   * Update system settings
   * 
   * @function updateSettings
   * @param {Object} settings - Settings object to update
   * @param {boolean} [settings.emailAlertsEnabled] - Enable email alerts
   * @param {number} [settings.licenseExpiryWarningDays] - Days before expiry to warn
   * @returns {Promise<Response>} Fetch response with updated settings
   * @throws {Error} If update fails or user lacks admin permissions
   */
  updateSettings: (settings: any) =>
    apiRequest("PUT", "/api/settings", settings),

  /**
   * Get all system users
   * 
   * @function getUsers
   * @returns {Promise<Response>} Fetch response with user list
   * @throws {Error} If user lacks admin permissions
   */
  getUsers: () =>
    fetch("/api/users", { credentials: "include" }),

  /**
   * Create a new system user
   * 
   * @function createUser
   * @param {Object} userData - User data for creation
   * @param {string} userData.username - Unique username
   * @param {string} userData.password - User password
   * @param {string} userData.role - User role (admin, hr, viewer)
   * @returns {Promise<Response>} Fetch response with created user
   * @throws {Error} If creation fails or user lacks admin permissions
   */
  createUser: (userData: any) =>
    apiRequest("POST", "/api/register", userData),

  /**
   * Delete a system user
   * 
   * @function deleteUser
   * @param {number} userId - User ID to delete
   * @returns {Promise<Response>} Fetch response confirming deletion
   * @throws {Error} If deletion fails or user lacks admin permissions
   */
  deleteUser: (userId: number) =>
    apiRequest("DELETE", `/api/users/${userId}`),
};
