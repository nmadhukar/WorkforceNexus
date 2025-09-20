// User types
export interface User {
  id: number;
  username: string;
  role: "admin" | "hr" | "viewer";
  createdAt: string;
}

export interface InsertUser {
  username: string;
  password: string;
  role: "admin" | "hr" | "viewer";
}

// Employee types
export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth?: string;
  personalEmail?: string;
  workEmail: string;
  cellPhone?: string;
  workPhone?: string;
  homeAddress1?: string;
  homeAddress2?: string;
  homeCity?: string;
  homeState?: string;
  homeZip?: string;
  gender?: string;
  birthCity?: string;
  birthState?: string;
  birthCountry?: string;
  driversLicenseNumber?: string;
  dlStateIssued?: string;
  dlIssueDate?: string;
  dlExpirationDate?: string;
  ssn?: string;
  npiNumber?: string;
  enumerationDate?: string;
  jobTitle?: string;
  workLocation?: string;
  qualification?: string;
  medicalLicenseNumber?: string;
  substanceUseLicenseNumber?: string;
  substanceUseQualification?: string;
  mentalHealthLicenseNumber?: string;
  mentalHealthQualification?: string;
  medicaidNumber?: string;
  medicarePtanNumber?: string;
  caqhProviderId?: string;
  caqhIssueDate?: string;
  caqhLastAttestationDate?: string;
  caqhEnabled?: boolean;
  caqhReattestationDueDate?: string;
  caqhLoginId?: string;
  caqhPassword?: string;
  nppesLoginId?: string;
  nppesPassword?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Education types
export interface Education {
  id: number;
  employeeId: number;
  educationType?: string;
  schoolInstitution?: string;
  degree?: string;
  specialtyMajor?: string;
  startDate?: string;
  endDate?: string;
}

// Employment history types
export interface Employment {
  id: number;
  employeeId: number;
  employer?: string;
  position?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
}

// Peer reference types
export interface PeerReference {
  id: number;
  employeeId: number;
  referenceName?: string;
  contactInfo?: string;
  relationship?: string;
  comments?: string;
}

// License types
export interface StateLicense {
  id: number;
  employeeId: number;
  licenseNumber: string;
  state: string;
  issueDate?: string;
  expirationDate?: string;
  status?: string;
}

export interface DeaLicense {
  id: number;
  employeeId: number;
  licenseNumber: string;
  issueDate?: string;
  expirationDate?: string;
  status?: string;
}

export interface BoardCertification {
  id: number;
  employeeId: number;
  boardName?: string;
  certification?: string;
  issueDate?: string;
  expirationDate?: string;
  status?: string;
}

// Document types
export interface Document {
  id: number;
  employeeId: number;
  documentType: string;
  filePath?: string;
  signedDate?: string;
  notes?: string;
  createdAt: string;
}

// Emergency contact types
export interface EmergencyContact {
  id: number;
  employeeId: number;
  name: string;
  relationship?: string;
  phone?: string;
  email?: string;
}

// Tax form types
export interface TaxForm {
  id: number;
  employeeId: number;
  formType: string;
  filePath?: string;
  submittedDate?: string;
  status?: string;
}

// Training types
export interface Training {
  id: number;
  employeeId: number;
  trainingType?: string;
  provider?: string;
  completionDate?: string;
  expirationDate?: string;
  credits?: number;
  certificatePath?: string;
}

// Payer enrollment types
export interface PayerEnrollment {
  id: number;
  employeeId: number;
  payerName?: string;
  enrollmentId?: string;
  enrollmentDate?: string;
  status?: string;
}

// Incident log types
export interface IncidentLog {
  id: number;
  employeeId: number;
  incidentDate: string;
  description?: string;
  resolution?: string;
  reportedBy?: string;
}

// Audit types
export interface Audit {
  id: number;
  tableName: string;
  recordId: number;
  action: string;
  changedBy?: number;
  changedAt: string;
  oldData?: any;
  newData?: any;
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface EmployeesResponse extends PaginatedResponse<Employee> {
  employees: Employee[];
}

export interface DocumentsResponse extends PaginatedResponse<Document> {
  documents: Document[];
}

export interface AuditsResponse extends PaginatedResponse<Audit> {
  audits: Audit[];
}

// Dashboard/Reports types
export interface DashboardStats {
  totalEmployees: number;
  activeEmployees: number;
  expiringSoon: number;
  pendingDocs: number;
}

export interface ExpiringItem {
  employeeId: number;
  employeeName: string;
  itemType: string;
  licenseNumber: string;
  expirationDate: string;
  daysRemaining: number;
}

// Form data types
export interface EmployeeFormData {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth?: string;
  gender?: string;
  ssn?: string;
  personalEmail?: string;
  workEmail: string;
  cellPhone?: string;
  workPhone?: string;
  homeAddress1?: string;
  homeAddress2?: string;
  homeCity?: string;
  homeState?: string;
  homeZip?: string;
  jobTitle?: string;
  workLocation?: string;
  qualification?: string;
  npiNumber?: string;
  enumerationDate?: string;
  medicalLicenseNumber?: string;
  substanceUseLicenseNumber?: string;
  substanceUseQualification?: string;
  mentalHealthLicenseNumber?: string;
  mentalHealthQualification?: string;
  medicaidNumber?: string;
  medicarePtanNumber?: string;
  caqhProviderId?: string;
  caqhIssueDate?: string;
  caqhLastAttestationDate?: string;
  caqhEnabled?: boolean;
  caqhReattestationDueDate?: string;
  caqhLoginId?: string;
  caqhPassword?: string;
  nppesLoginId?: string;
  nppesPassword?: string;
  status?: string;
  birthCity?: string;
  birthState?: string;
  birthCountry?: string;
  driversLicenseNumber?: string;
  dlStateIssued?: string;
  dlIssueDate?: string;
  dlExpirationDate?: string;
}

// Filter types
export interface EmployeeFilters {
  search: string;
  department?: string;
  status?: string;
  location?: string;
}

export interface DocumentFilters {
  search: string;
  type?: string;
  employeeId?: number;
}

export interface AuditFilters {
  search: string;
  tableName?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
}

// System settings types
export interface SystemSettings {
  emailAlertsEnabled: boolean;
  dailyReportsEnabled: boolean;
  weeklyAuditSummaries: boolean;
  licenseExpiryWarningDays: number;
  caqhReattestationWarningDays: number;
}

// API Error types
export interface ApiError {
  message: string;
  details?: any[];
}

// File upload types
export interface FileUploadData {
  employeeId: number;
  documentType: string;
  signedDate?: string;
  notes?: string;
}
