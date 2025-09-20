import { apiRequest } from "./queryClient";

// Employee API functions
export const employeeApi = {
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

  getEmployee: (id: number) => 
    fetch(`/api/employees/${id}`, { credentials: "include" }),

  createEmployee: (data: any) => 
    apiRequest("POST", "/api/employees", data),

  updateEmployee: (id: number, data: any) => 
    apiRequest("PUT", `/api/employees/${id}`, data),

  deleteEmployee: (id: number) => 
    apiRequest("DELETE", `/api/employees/${id}`),

  // Related data
  getEmployeeEducations: (employeeId: number) =>
    fetch(`/api/employees/${employeeId}/educations`, { credentials: "include" }),

  createEmployeeEducation: (employeeId: number, data: any) =>
    apiRequest("POST", `/api/employees/${employeeId}/educations`, data),

  getEmployeeStateLicenses: (employeeId: number) =>
    fetch(`/api/employees/${employeeId}/state-licenses`, { credentials: "include" }),

  createEmployeeStateLicense: (employeeId: number, data: any) =>
    apiRequest("POST", `/api/employees/${employeeId}/state-licenses`, data),

  getEmployeeDeaLicenses: (employeeId: number) =>
    fetch(`/api/employees/${employeeId}/dea-licenses`, { credentials: "include" }),

  createEmployeeDeaLicense: (employeeId: number, data: any) =>
    apiRequest("POST", `/api/employees/${employeeId}/dea-licenses`, data),
};

// Document API functions
export const documentApi = {
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

  uploadDocument: (formData: FormData) =>
    fetch("/api/documents/upload", {
      method: "POST",
      body: formData,
      credentials: "include"
    }),

  downloadDocument: (id: number) =>
    fetch(`/api/documents/${id}/download`, { credentials: "include" }),

  deleteDocument: (id: number) =>
    apiRequest("DELETE", `/api/documents/${id}`),
};

// Reports API functions
export const reportsApi = {
  getExpiringItems: (days: number = 30) =>
    fetch(`/api/reports/expiring?days=${days}`, { credentials: "include" }),

  getEmployeeStats: () =>
    fetch("/api/reports/stats", { credentials: "include" }),

  exportCSV: (reportType: string) =>
    fetch(`/api/export/${reportType}`, { credentials: "include" }),
};

// Audit API functions
export const auditApi = {
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

// Cron/Background job API functions
export const cronApi = {
  manualExpirationCheck: () =>
    fetch("/api/cron/check-expirations", { credentials: "include" }),
};

// Settings API functions
export const settingsApi = {
  updateSettings: (settings: any) =>
    apiRequest("PUT", "/api/settings", settings),

  getUsers: () =>
    fetch("/api/users", { credentials: "include" }),

  createUser: (userData: any) =>
    apiRequest("POST", "/api/register", userData),

  deleteUser: (userId: number) =>
    apiRequest("DELETE", `/api/users/${userId}`),
};
