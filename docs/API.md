# HR Management System - REST API Documentation

## Table of Contents
- [Overview](#overview)
- [Base URL](#base-url)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Error Handling](#error-handling)
- [API Endpoints](#api-endpoints)
  - [Authentication Endpoints](#authentication-endpoints)
  - [Employee Management](#employee-management)
  - [Education Management](#education-management)
  - [Employment History](#employment-history)
  - [Medical Licenses](#medical-licenses)
  - [Board Certifications](#board-certifications)
  - [Peer References](#peer-references)
  - [Emergency Contacts](#emergency-contacts)
  - [Tax Forms](#tax-forms)
  - [Training Records](#training-records)
  - [Payer Enrollments](#payer-enrollments)
  - [Incident Logs](#incident-logs)
  - [Documents](#documents)
  - [Reports](#reports)
  - [Audits](#audits)

## Overview

The HR Management System API is a RESTful API designed specifically for healthcare organizations to manage medical staff information, credentials, and compliance requirements. It provides comprehensive endpoints for employee management, credential tracking, document storage, and regulatory compliance monitoring.

### Key Features
- **Privacy Focused**: Implements privacy safeguards with encryption for sensitive information
- **Audit Logging**: Complete audit trail for all data modifications
- **Role-Based Access**: Three-tier access control (Admin, HR, Viewer)
- **Automated Monitoring**: License expiration tracking with notification system
- **Document Management**: Secure file upload and storage for compliance documents

## Base URL

```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

## Authentication

The API uses session-based authentication with secure cookies. All endpoints except `/api/login`, `/api/register` require authentication.

### Authentication Flow

1. **Register** (first-time setup) or **Login** to obtain a session
2. Session cookie is automatically included in subsequent requests
3. Sessions persist in PostgreSQL database
4. Logout destroys the session

### User Roles

| Role | Permissions |
|------|------------|
| `admin` | Full system access, including deletion and system configuration |
| `hr` | Employee management, document upload, reporting access |
| `viewer` | Read-only access to employee data and reports |

## Rate Limiting

- **Global Limit**: 100 requests per 15-minute window per IP address

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642598400
```

## Error Handling

### Standard Error Response

```json
{
  "error": "Error message",
  "details": [
    {
      "field": "fieldName",
      "message": "Validation error message"
    }
  ]
}
```

### HTTP Status Codes

| Code | Description |
|------|------------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful deletion) |
| 400 | Bad Request - Validation failed |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

## API Endpoints

### Authentication Endpoints

#### POST /api/register
Register a new user account

**Request Body:**
```json
{
  "username": "john.doe",
  "password": "SecurePass123!",
  "role": "hr"  // Optional: "admin", "hr", or "viewer" (default: "hr")
}
```

**Response (201):**
```json
{
  "id": 1,
  "username": "john.doe",
  "role": "hr",
  "createdAt": "2024-01-20T10:00:00Z"
}
```

**Errors:**
- 400: Username already exists

---

#### POST /api/login
Authenticate user and create session

**Request Body:**
```json
{
  "username": "john.doe",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "id": 1,
  "username": "john.doe",
  "role": "hr",
  "createdAt": "2024-01-20T10:00:00Z"
}
```

**Errors:**
- 401: Invalid credentials

---

#### POST /api/logout
End user session

**Response (200):** No content

---

#### GET /api/user
Get current authenticated user with profile information

**Response (200):**
```json
{
  "id": 1,
  "username": "john.doe",
  "email": "john.doe@company.com",
  "role": "hr",
  "createdAt": "2024-01-20T10:00:00Z",
  "requirePasswordChange": false
}
```

**Errors:**
- 401: Not authenticated

---

#### PATCH /api/users/me
Update current user's profile information

**Request Body:**
```json
{
  "email": "newemail@company.com"
}
```

**Response (200):**
```json
{
  "id": 1,
  "username": "john.doe",
  "email": "newemail@company.com",
  "role": "hr",
  "updatedAt": "2024-01-20T14:30:00Z"
}
```

**Errors:**
- 400: Invalid email format
- 401: Not authenticated
- 409: Email already in use

---

#### POST /api/auth/reset-password
Request password reset email

**Access:** Public (no authentication required)
**Rate Limit:** 5 requests per hour per IP

**Request Body:**
```json
{
  "email": "user@company.com"
}
```

**Response (200):**
```json
{
  "message": "If the email exists, a password reset link has been sent"
}
```

**Important:** This endpoint always returns the same response regardless of whether the email exists to prevent user enumeration attacks.

**Errors:**
- 400: Invalid email format
- 429: Too many requests (rate limit exceeded)

**Security Features:**
- No user enumeration
- Rate limiting
- Token expires in 24 hours
- Audit logging

**Email Content:**
If the email exists, user receives:
- Secure reset link with token
- 24-hour expiration notice
- Security warning if not requested

---

#### POST /api/auth/confirm-reset-password
Complete password reset with token

**Access:** Public (requires valid reset token)
**Rate Limit:** 5 requests per hour per IP

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "newPassword": "NewSecurePass@123"
}
```

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Response (200):**
```json
{
  "message": "Password reset successfully"
}
```

**Errors:**
- 400: Invalid or expired reset token
- 400: Password doesn't meet requirements
- 429: Too many requests

**Security Features:**
- Single-use tokens
- Token validation
- Password complexity enforcement
- Automatic token cleanup after use

---

#### POST /api/auth/change-password
Change own password (voluntary)

**Access:** Private (requires authentication)

**Request Body:**
```json
{
  "currentPassword": "CurrentPass@123",
  "newPassword": "NewSecurePass@456"
}
```

**Response (200):**
```json
{
  "message": "Password changed successfully"
}
```

**Errors:**
- 400: Current password incorrect
- 400: New password same as current
- 400: New password doesn't meet requirements
- 401: Not authenticated

---

### Employee Management

#### GET /api/employees
Get paginated list of employees

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 10, max: 100)
- `search` (string): Search by name or email
- `department` (string): Filter by department
- `status` (string): Filter by status (active/inactive)
- `location` (string): Filter by work location

**Response (200):**
```json
{
  "employees": [
    {
      "id": 1,
      "firstName": "John",
      "lastName": "Doe",
      "workEmail": "john.doe@hospital.com",
      "jobTitle": "Physician",
      "workLocation": "Main Hospital",
      "status": "active",
      "ssn": "***-**-1234"  // Masked
    }
  ],
  "total": 50,
  "page": 1,
  "totalPages": 5
}
```

---

#### GET /api/employees/:id
Get single employee details

**Response (200):**
```json
{
  "id": 1,
  "firstName": "John",
  "middleName": "Robert",
  "lastName": "Doe",
  "dateOfBirth": "1980-05-15",
  "personalEmail": "john.personal@email.com",
  "workEmail": "john.doe@hospital.com",
  "cellPhone": "(555) 123-4567",
  "workPhone": "(555) 987-6543",
  "homeAddress1": "123 Main St",
  "homeCity": "Boston",
  "homeState": "MA",
  "homeZip": "02134",
  "gender": "Male",
  "jobTitle": "Physician",
  "workLocation": "Main Hospital",
  "qualification": "MD",
  "npiNumber": "1234567890",
  "medicaidNumber": "MA12345",
  "medicarePtanNumber": "P12345",
  "deaNumber": "BD1234567",
  "caqhProviderId": "12345",
  "status": "active",
  "ssn": "***-**-1234",  // Masked
  "caqhPassword": "***",  // Masked
  "nppesPassword": "***"  // Masked
}
```

**Errors:**
- 404: Employee not found

---

#### POST /api/employees
Create new employee

**Required Role:** `admin` or `hr`

**Request Body:**
```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "workEmail": "jane.smith@hospital.com",
  "dateOfBirth": "1985-03-20",
  "ssn": "123-45-6789",
  "jobTitle": "Nurse Practitioner",
  "workLocation": "Clinic A",
  "status": "active"
}
```

**Response (201):** Created employee object

**Errors:**
- 400: Validation failed
- 403: Insufficient permissions

---

#### PUT /api/employees/:id
Update employee information

**Required Role:** `admin` or `hr`

**Request Body:** Partial employee object with fields to update

**Response (200):** Updated employee object

**Errors:**
- 404: Employee not found
- 403: Insufficient permissions

---

#### DELETE /api/employees/:id
Delete employee (cascades to all related records)

**Required Role:** `admin`

**Response (204):** No content

**Errors:**
- 404: Employee not found
- 403: Insufficient permissions

---

### Education Management

#### GET /api/employees/:id/educations
Get all education records for an employee

**Response (200):**
```json
[
  {
    "id": 1,
    "employeeId": 1,
    "schoolInstitution": "Harvard Medical School",
    "degree": "MD",
    "major": "Medicine",
    "graduationDate": "2008-05-15",
    "startDate": "2004-09-01",
    "endDate": "2008-05-15"
  }
]
```

---

#### POST /api/employees/:id/educations
Add education record

**Required Role:** `admin` or `hr`

**Request Body:**
```json
{
  "schoolInstitution": "Johns Hopkins University",
  "degree": "Residency",
  "major": "Internal Medicine",
  "startDate": "2008-07-01",
  "endDate": "2011-06-30"
}
```

**Response (201):** Created education object

---

#### PUT /api/educations/:id
Update education record

**Required Role:** `admin` or `hr`

---

#### DELETE /api/educations/:id
Delete education record

**Required Role:** `admin` or `hr`

---

### Employment History

#### GET /api/employees/:id/employments
Get employment history

**Response (200):**
```json
[
  {
    "id": 1,
    "employeeId": 1,
    "employer": "Boston General Hospital",
    "position": "Attending Physician",
    "startDate": "2015-08-01",
    "endDate": null,
    "currentEmployer": true,
    "reasonForLeaving": null
  }
]
```

---

#### POST /api/employees/:id/employments
Add employment record

**Required Role:** `admin` or `hr`

---

#### PUT /api/employments/:id
Update employment record

**Required Role:** `admin` or `hr`

---

#### DELETE /api/employments/:id
Delete employment record

**Required Role:** `admin` or `hr`

---

### Medical Licenses

#### State Licenses

##### GET /api/employees/:id/state-licenses
Get all state medical licenses

**Response (200):**
```json
[
  {
    "id": 1,
    "employeeId": 1,
    "licenseNumber": "MA123456",
    "state": "MA",
    "issueDate": "2012-01-15",
    "expirationDate": "2025-01-14",
    "status": "Active"
  }
]
```

##### POST /api/employees/:id/state-licenses
Add state license

**Required Role:** `admin` or `hr`

##### PUT /api/state-licenses/:id
Update state license

**Required Role:** `admin` or `hr`

##### DELETE /api/state-licenses/:id
Delete state license

**Required Role:** `admin` or `hr`

---

#### DEA Licenses

##### GET /api/employees/:id/dea-licenses
Get DEA licenses for controlled substances

**Response (200):**
```json
[
  {
    "id": 1,
    "employeeId": 1,
    "licenseNumber": "BD1234567",
    "state": "MA",
    "issueDate": "2020-03-01",
    "expirationDate": "2026-02-28",
    "schedules": ["II", "III", "IV", "V"]
  }
]
```

##### POST /api/employees/:id/dea-licenses
Add DEA license

**Required Role:** `admin` or `hr`

##### PUT /api/dea-licenses/:id
Update DEA license

**Required Role:** `admin` or `hr`

##### DELETE /api/dea-licenses/:id
Delete DEA license

**Required Role:** `admin` or `hr`

---

### Board Certifications

#### GET /api/employees/:id/board-certifications
Get board certifications

**Response (200):**
```json
[
  {
    "id": 1,
    "employeeId": 1,
    "boardName": "American Board of Internal Medicine",
    "certification": "Internal Medicine",
    "issueDate": "2012-07-01",
    "expirationDate": "2032-12-31",
    "certificateNumber": "123456"
  }
]
```

---

### Peer References

#### GET /api/employees/:id/peer-references
Get professional references

**Response (200):**
```json
[
  {
    "id": 1,
    "employeeId": 1,
    "referenceName": "Dr. Sarah Johnson",
    "relationship": "Colleague",
    "contactInfo": "sarah.johnson@hospital.com",
    "phoneNumber": "(555) 123-4567",
    "yearsKnown": 5
  }
]
```

---

### Emergency Contacts

#### GET /api/employees/:id/emergency-contacts
Get emergency contacts

**Response (200):**
```json
[
  {
    "id": 1,
    "employeeId": 1,
    "name": "Mary Doe",
    "relationship": "Spouse",
    "phone": "(555) 987-6543",
    "email": "mary.doe@email.com",
    "isPrimary": true
  }
]
```

---

### Tax Forms

#### GET /api/employees/:id/tax-forms
Get tax form records

**Response (200):**
```json
[
  {
    "id": 1,
    "employeeId": 1,
    "formType": "W-4",
    "year": 2024,
    "filingStatus": "Married Filing Jointly",
    "allowances": 2,
    "status": "Current"
  }
]
```

---

### Training Records

#### GET /api/employees/:id/trainings
Get training and certification records

**Response (200):**
```json
[
  {
    "id": 1,
    "employeeId": 1,
    "trainingName": "HIPAA Compliance Training",
    "provider": "Healthcare Training Institute",
    "completionDate": "2024-01-15",
    "expirationDate": "2025-01-14",
    "certificateNumber": "HIP-2024-12345",
    "credits": 2
  }
]
```

---

### Payer Enrollments

#### GET /api/employees/:id/payer-enrollments
Get insurance payer enrollments

**Response (200):**
```json
[
  {
    "id": 1,
    "employeeId": 1,
    "payerName": "Blue Cross Blue Shield",
    "providerId": "123456",
    "enrollmentStatus": "Active",
    "effectiveDate": "2020-01-01",
    "terminationDate": null
  }
]
```

---

### Incident Logs

#### GET /api/employees/:id/incident-logs
Get incident and compliance logs

**Response (200):**
```json
[
  {
    "id": 1,
    "employeeId": 1,
    "incidentDate": "2024-01-10",
    "incidentType": "Patient Safety",
    "description": "Near miss event - medication",
    "severity": "low",
    "actionTaken": "Additional training provided",
    "reportedBy": "Supervisor",
    "status": "Resolved"
  }
]
```

---

### Documents

#### GET /api/documents
Get paginated list of all documents

**Query Parameters:**
- `page` (integer): Page number
- `limit` (integer): Items per page
- `search` (string): Search by document type
- `type` (string): Filter by document type
- `employeeId` (integer): Filter by employee

**Response (200):**
```json
{
  "documents": [
    {
      "id": 1,
      "employeeId": 1,
      "documentType": "Medical License",
      "filePath": "/uploads/license_123.pdf",
      "signedDate": "2024-01-15",
      "notes": "MA state license renewal",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "total": 25,
  "page": 1,
  "totalPages": 3
}
```

---

#### POST /api/documents/upload
Upload a new document

**Required Role:** `admin` or `hr`

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `document` (file): File to upload (max 10MB, allowed: jpeg, jpg, png, pdf, doc, docx)
- `employeeId` (integer): Employee ID
- `documentType` (string): Type of document
- `signedDate` (string): Optional date document was signed
- `notes` (string): Optional notes

**Response (201):** Created document object

**Errors:**
- 400: No file uploaded or invalid file type
- 413: File too large

---

#### GET /api/documents/:id/download
Download a document file

**Response:** File download

**Errors:**
- 404: Document or file not found

---

### Reports

#### GET /api/reports/expiring
Get licenses/certifications expiring soon

**Query Parameters:**
- `days` (integer): Days to look ahead (default: 30)

**Response (200):**
```json
[
  {
    "employeeId": 1,
    "employeeName": "John Doe",
    "itemType": "State License",
    "licenseNumber": "MA123456",
    "expirationDate": "2024-02-15",
    "daysRemaining": 25
  }
]
```

---

#### GET /api/reports/stats
Get dashboard statistics

**Response (200):**
```json
{
  "totalEmployees": 150,
  "activeEmployees": 142,
  "expiringSoon": 8,
  "pendingDocs": 5
}
```

---

#### GET /api/export/employees
Export employees to CSV

**Response:** CSV file download

```csv
First Name,Last Name,Job Title,Work Email,Status
John,Doe,Physician,john.doe@hospital.com,active
Jane,Smith,Nurse Practitioner,jane.smith@hospital.com,active
```

---

### Audits

#### GET /api/audits
Get audit logs

**Required Role:** `admin` or `hr`

**Query Parameters:**
- `page` (integer): Page number
- `limit` (integer): Items per page (default: 25)
- `tableName` (string): Filter by table
- `action` (string): Filter by action (INSERT, UPDATE, DELETE)
- `startDate` (date): Filter from date
- `endDate` (date): Filter to date

**Response (200):**
```json
{
  "audits": [
    {
      "id": 1,
      "tableName": "employees",
      "recordId": 1,
      "action": "UPDATE",
      "changedBy": 2,
      "changedAt": "2024-01-20T14:30:00Z",
      "oldData": {"status": "inactive"},
      "newData": {"status": "active"}
    }
  ],
  "total": 500,
  "page": 1,
  "totalPages": 20
}
```

---

### Manual Operations

#### GET /api/cron/check-expirations
Manually trigger license expiration check

**Required Role:** `admin`

**Response (200):**
```json
{
  "message": "Expiration check completed",
  "count": 3,
  "items": [
    {
      "employeeId": 1,
      "itemType": "DEA License",
      "expirationDate": "2024-03-01",
      "daysRemaining": 40
    }
  ]
}
```

## Webhook Events (Future Enhancement)

The system can be configured to send webhook notifications for:
- License expiring within 30/60/90 days
- New employee onboarding completed
- Document upload requiring review
- Incident log created with high/critical severity

## Best Practices

1. **Pagination**: Always use pagination for list endpoints to avoid performance issues
2. **Filtering**: Use query parameters to filter results instead of fetching all data
3. **Error Handling**: Check response status codes and handle errors appropriately
4. **Security**: Never expose sensitive data like full SSN or passwords in logs
5. **Rate Limiting**: Implement exponential backoff for rate limit errors
6. **File Uploads**: Validate file types and sizes on client side before uploading

## Healthcare Compliance Notes

This API is designed with healthcare compliance in mind:

- **Privacy**: All sensitive health information is encrypted at rest and in transit, designed with healthcare privacy in mind
- **Audit Trails**: Complete logging of all data access and modifications
- **Access Control**: Role-based permissions ensure appropriate data access
- **Data Retention**: Audit logs retained for 7 years per compliance requirements
- **Credential Tracking**: Automated monitoring of license expirations
- **Incident Reporting**: Comprehensive incident logging for quality assurance