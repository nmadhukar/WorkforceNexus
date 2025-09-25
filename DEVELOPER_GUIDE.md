# HR Management System - Comprehensive Developer Guide

## Table of Contents

1. [Project Overview & Features](#project-overview--features)
2. [Quick Start Setup](#quick-start-setup)
3. [Architecture Overview](#architecture-overview)
4. [Development Workflow](#development-workflow)
5. [API Documentation](#api-documentation)
6. [Database Schema](#database-schema)
7. [Testing Guidelines](#testing-guidelines)
8. [Deployment Instructions](#deployment-instructions)
9. [Troubleshooting](#troubleshooting)

---

## Project Overview & Features

The HR Management System is a comprehensive web application designed specifically for healthcare organizations to manage medical staff information, credentials, and regulatory compliance. Built with modern technologies and designed with healthcare privacy in mind, it provides a secure, scalable solution for HR departments in hospitals and medical facilities.

### 🏥 Healthcare-Focused Features

- **Employee Management**: Complete profiles for medical professionals
- **Credential Tracking**: Medical licenses, DEA registrations, board certifications
- **Compliance Monitoring**: Automated expiration tracking and alerts
- **Document Management**: Secure storage and signing workflows
- **Audit Trail**: Complete activity logging for regulatory compliance
- **Role-Based Access**: Admin, HR, and Viewer roles with permission control

### 🔐 Security & Compliance

- **Privacy-First Design**: Sensitive data encryption at rest and in transit
- **Healthcare Compliance**: Built with healthcare privacy requirements in mind
- **Secure Authentication**: Session-based auth with API key support
- **Password Reset Security**: Token-based recovery with email verification
- **Comprehensive Auditing**: Full audit trail for all data modifications
- **File Storage Security**: Local and AWS S3 support with encryption
- **Email Security**: Encrypted credential storage, rate limiting, enumeration protection

### 🚀 Modern Technology Stack

- **Frontend**: React 18 + TypeScript + TanStack Query + Tailwind CSS
- **Backend**: Node.js + Express + Drizzle ORM + PostgreSQL
- **Authentication**: Passport.js with session management
- **File Storage**: Local filesystem with AWS S3 integration
- **Email Service**: AWS SES integration for notifications
- **Form Management**: DocuSeal integration for document signing

---

## Quick Start Setup

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 18+** - JavaScript runtime environment
- **PostgreSQL 14+** - Database server (can use Neon serverless)
- **npm or yarn** - Package manager
- **Git** - Version control

**Optional but Recommended:**
- **AWS Account** - For S3 storage and SES email services
- **DocuSeal Account** - For document signing workflows

### Environment Variables Setup

Create a `.env` file in the root directory with the following variables:

```bash
# Required - Database Configuration
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Required - Session Security
SESSION_SECRET=your-secret-key-min-32-chars

# Optional - AWS S3 Storage
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your_bucket_name
AWS_S3_ENDPOINT=  # Optional, for S3-compatible services

# Optional - AWS SES Email Service
AWS_SES_FROM_EMAIL=noreply@yourcompany.com
AWS_SES_REGION=us-east-1
AWS_SES_ACCESS_KEY_ID=your_ses_access_key_id  # Can also use general AWS keys
AWS_SES_SECRET_ACCESS_KEY=your_ses_secret_key

# Optional - Email Configuration
ENCRYPTION_KEY=your-32-char-encryption-key  # For encrypting stored credentials
EMAIL_FROM_NAME=HR Management System

# Optional - DocuSeal Integration
DOCUSEAL_API_KEY=your_docuseal_api_key
DOCUSEAL_BASE_URL=https://api.docuseal.co

# Optional - Application Configuration
PORT=5000
NODE_ENV=development
MAX_FILE_SIZE=10485760  # 10MB in bytes
SESSION_MAX_AGE=86400000  # 24 hours in milliseconds
RATE_LIMIT_WINDOW=900000  # 15 minutes in milliseconds
RATE_LIMIT_MAX=100  # Max requests per window
```

### Database Setup and Migrations

1. **Set up PostgreSQL Database**
   ```bash
   # Option 1: Using Neon (recommended for production)
   # Sign up at https://neon.tech and create a database
   # Copy the connection string to DATABASE_URL

   # Option 2: Local PostgreSQL
   createdb hr_management_system
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Run Database Migrations**
   ```bash
   # Push schema to database
   npm run db:push

   # If you encounter data-loss warnings during development
   npm run db:push --force
   ```

### Package Installation

```bash
# Install all dependencies
npm install

# Verify installation
npm run check  # TypeScript type checking
```

### Running the Development Server

```bash
# Start the development server (frontend + backend)
npm run dev
```

This command starts:
- **Express backend** on port 5000
- **Vite frontend dev server** (proxied through backend)
- **Hot module replacement** for fast development

Access the application at: `http://localhost:5000`

### Initial Setup

1. **Create Admin User**: Navigate to `/auth` and register the first user
2. **Configure Services**: Go to Settings to configure AWS S3, SES, and DocuSeal
3. **Test Upload**: Upload a test document to verify file storage
4. **Create Sample Employee**: Add a test employee to verify the workflow

---

## Email System Architecture

### AWS SES Integration

The HR Management System uses Amazon Simple Email Service (SES) for reliable email delivery. The integration provides:

#### Configuration Management
- **Database Storage**: SES credentials stored encrypted in `sesConfigurations` table
- **Encryption**: AES-256 encryption for access keys and secrets
- **Dynamic Configuration**: Admin can update SES settings through UI
- **Multi-Region Support**: Configure different AWS regions for optimal delivery

#### Email Services

##### Password Reset Flow
1. User requests password reset via `/api/auth/reset-password`
2. System generates cryptographically secure token (32 bytes, base64url)
3. Token stored with 24-hour expiration in database
4. Email sent via SES with personalized reset link
5. User clicks link, redirected to reset page with token
6. New password submitted with token to `/api/auth/confirm-reset-password`
7. Token validated, password updated, token cleared

##### Invitation Email System
- **Employee Onboarding**: Automated emails for new employee invitations
- **Reminder System**: Up to 3 reminders with increasing urgency
- **Token Management**: Unique invitation tokens with 7-day expiration
- **Tracking**: Email status tracked in `emailReminders` table

#### Email Templates

##### HTML Templates
- Responsive design with inline CSS
- Mobile-optimized layout
- Company branding support
- Progressive urgency styling for reminders:
  - Initial: Blue (#2563EB)
  - First Reminder: Blue
  - Second Reminder: Orange (#F59E0B)
  - Final Reminder: Red (#DC2626)

##### Plain Text Templates
- Accessibility fallback
- Clear formatting without HTML
- All critical information preserved
- Link URLs fully visible

#### Database Schema

```sql
-- SES Configuration Table
sesConfigurations
├── id (PK)
├── region (AWS region)
├── accessKeyId (encrypted)
├── secretAccessKey (encrypted)
├── fromEmail (verified sender)
├── fromName (display name)
├── enabled (boolean)
├── verified (boolean)
└── lastVerifiedAt (timestamp)

-- Email Tracking Table
emailReminders
├── id (PK)
├── employeeId (FK)
├── emailType (invitation|reminder|password_reset)
├── emailAddress
├── token (unique)
├── expiresAt
├── reminderCount
├── lastReminderSent
└── status (pending|sent|completed|expired)
```

#### Development Environment

In development without SES configured:
- Emails logged to console with full content
- Token displayed in response (dev mode only)
- No actual email sending
- All SES API calls mocked

#### Security Considerations

##### Email Enumeration Protection
- Same response for all password reset requests
- No indication if email exists in system
- Rate limiting on reset endpoints
- Audit logging for all attempts

##### Token Security
- Cryptographically secure random generation
- Single-use tokens (cleared after use)
- Time-limited validity (24 hours for reset, 7 days for invitations)
- Constant-time token comparison

##### Credential Security
- AWS credentials encrypted at rest
- Decryption only when needed
- Support for environment variable override
- Regular credential rotation recommended

---

## Authentication & Security

### Password Reset Flow

The system implements a secure password reset mechanism:

1. **Request Reset**
   - User enters email on login page
   - System validates email format
   - Generates secure token if user exists
   - Sends email with reset link (or logs success regardless)

2. **Email Delivery**
   - AWS SES sends professionally formatted email
   - Contains secure link with token parameter
   - Link expires after 24 hours
   - Includes security warning if not requested

3. **Reset Password**
   - User clicks link, directed to reset page
   - Token validated against database
   - New password must meet complexity requirements:
     - Minimum 8 characters
     - At least one uppercase letter
     - At least one lowercase letter
     - At least one number
     - At least one special character
   - Password hashed with scrypt before storage

4. **Security Features**
   - No user enumeration (same response for all emails)
   - Rate limiting (5 requests per hour per IP)
   - Single-use tokens
   - Automatic token expiration
   - Audit logging of all reset attempts

### Session Management

- PostgreSQL-backed session store
- Secure session cookies
- Automatic session cleanup
- Configurable session timeout

### API Key Authentication

- Alternative to session-based auth
- Scoped permissions per key
- Automatic expiration support
- Rate limiting per key

---

## Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────┐
│                 Client Browser                      │
│             (React + TypeScript)                    │
│  ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │   Routing   │ │ State Mgmt   │ │  Components  │ │
│  │  (Wouter)   │ │ (TanStack Q) │ │ (shadcn/ui)  │ │
│  └─────────────┘ └──────────────┘ └──────────────┘ │
└────────────────────┬────────────────────────────────┘
                     │ HTTP/HTTPS (Session + API Keys)
┌────────────────────▼────────────────────────────────┐
│                Express Server                       │
│ ┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ │    Auth     │ │  Validation  │ │    Audit     │  │
│ │ (Passport)  │ │ (Zod + Exp)  │ │   Logging    │  │
│ └─────────────┘ └──────────────┘ └──────────────┘  │
│ ┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ │   Routes    │ │   Storage    │ │   Services   │  │
│ │  (RESTful)  │ │ (Interface)  │ │ (S3/SES/DS)  │  │
│ └─────────────┘ └──────────────┘ └──────────────┘  │
└────────────────────┬────────────────────────────────┘
                     │ Drizzle ORM
┌────────────────────▼────────────────────────────────┐
│             PostgreSQL Database                     │
│                     (Neon)                          │
│ ┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ │   Users     │ │  Employees   │ │   Related    │  │
│ │  Sessions   │ │  Documents   │ │  Entities    │  │
│ │   Audits    │ │   API Keys   │ │ (11 tables)  │  │
│ └─────────────┘ └──────────────┘ └──────────────┘  │
└──────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│              External Services                      │
│ ┌─────────────┐ ┌──────────────┐ ┌──────────────┐  │
│ │   AWS S3    │ │   AWS SES    │ │  DocuSeal    │  │
│ │ (Documents) │ │   (Email)    │ │   (Forms)    │  │
│ └─────────────┘ └──────────────┘ └──────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Tech Stack Overview

#### Frontend Architecture

**Core Technologies:**
- **React 18** - Component-based UI library with hooks
- **TypeScript** - Type safety and enhanced developer experience
- **Vite** - Fast build tool with hot module replacement
- **Wouter** - Lightweight client-side routing (2KB)

**State Management:**
- **TanStack Query v5** - Server state management with caching
- **React Hook Form** - Form state management with validation
- **Zod** - Runtime type validation and schema definition

**UI & Styling:**
- **Tailwind CSS** - Utility-first CSS framework
- **shadcn/ui** - Accessible, customizable component library
- **Radix UI** - Unstyled, accessible UI primitives
- **Lucide React** - Beautiful, customizable icons

#### Backend Architecture

**Core Technologies:**
- **Node.js** - JavaScript runtime environment
- **Express.js** - Fast, unopinionated web framework
- **TypeScript** - Type safety across frontend and backend
- **Drizzle ORM** - Type-safe database toolkit

**Authentication & Security:**
- **Passport.js** - Authentication middleware with local strategy
- **Express Session** - Session management with PostgreSQL store
- **API Keys** - Bearer token authentication for external integrations
- **bcrypt/scrypt** - Secure password hashing
- **Express Rate Limit** - API rate limiting protection

**Data Layer:**
- **PostgreSQL** - Robust relational database
- **Neon** - Serverless PostgreSQL for production
- **Drizzle Kit** - Database migration tooling

#### Project Structure

```
hr-management-system/
├── client/                     # Frontend application
│   ├── src/
│   │   ├── components/         # Reusable React components
│   │   │   ├── entity-managers/   # CRUD managers for entities
│   │   │   ├── forms/             # Multi-step form components
│   │   │   ├── layout/            # Header, sidebar, main layout
│   │   │   ├── tables/            # Data table components
│   │   │   └── ui/                # shadcn/ui components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── lib/                # Utilities and helpers
│   │   ├── pages/              # Route components and views
│   │   └── main.tsx            # Application entry point
│   └── index.html              # HTML template
│
├── server/                     # Backend application
│   ├── middleware/             # Express middleware
│   │   ├── apiKeyAuth.ts       # API key authentication
│   │   ├── audit.ts            # Audit trail logging
│   │   ├── encryption.ts       # Data encryption utilities
│   │   └── validation.ts       # Request validation (Zod)
│   ├── services/               # Business logic services
│   │   ├── cronJobs.ts         # Scheduled tasks
│   │   ├── docusealService.ts  # DocuSeal integration
│   │   ├── s3Service.ts        # AWS S3 operations
│   │   └── sesService.ts       # AWS SES email service
│   ├── uploads/                # Local document storage
│   ├── utils/                  # Utility functions
│   ├── auth.ts                 # Authentication setup
│   ├── db.ts                   # Database connection
│   ├── index.ts                # Server entry point
│   ├── routes.ts               # API route definitions
│   ├── storage.ts              # Storage interface layer
│   └── vite.ts                 # Vite SSR integration
│
├── shared/                     # Shared code between frontend/backend
│   └── schema.ts               # Database schema and TypeScript types
│
├── docs/                       # Documentation
│   ├── API.md                  # Detailed API documentation
│   └── DEVELOPER.md            # Original developer guide
│
├── package.json                # Dependencies and scripts
├── drizzle.config.ts           # Database configuration
├── vite.config.ts              # Vite build configuration
├── tailwind.config.ts          # Tailwind CSS configuration
└── tsconfig.json               # TypeScript configuration
```

### Authentication and Authorization Flow

#### Session-Based Authentication (Web UI)

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant B as Backend
    participant D as Database
    
    U->>F: Enter credentials
    F->>B: POST /api/login
    B->>D: Validate user
    D-->>B: User data
    B->>B: Create session
    B-->>F: Set session cookie
    F->>U: Redirect to dashboard
    
    Note over F,B: Subsequent requests include session cookie
    F->>B: GET /api/employees (with cookie)
    B->>B: Validate session
    B-->>F: Employee data
```

#### API Key Authentication (External Apps)

```mermaid
sequenceDiagram
    participant A as External App
    participant B as Backend
    participant D as Database
    
    A->>B: GET /api/employees<br/>Authorization: Bearer hrms_live_...
    B->>B: Extract API key
    B->>D: Validate key hash
    D-->>B: Key data + permissions
    B->>B: Check permissions
    alt Valid key + permissions
        B-->>A: Employee data
    else Invalid
        B-->>A: 401 Unauthorized
    end
```

### File Storage Architecture

The system supports both local filesystem and AWS S3 storage with automatic fallback:

```mermaid
graph TD
    A[File Upload] --> B{S3 Configured?}
    B -->|Yes| C[Upload to S3]
    B -->|No| D[Upload to Local]
    
    C --> E[Store metadata in DB<br/>storageType: 's3']
    D --> F[Store metadata in DB<br/>storageType: 'local']
    
    G[File Download Request] --> H{Check storageType}
    H -->|s3| I[Generate Presigned URL]
    H -->|local| J[Serve from filesystem]
    
    I --> K[Return temporary URL]
    J --> L[Stream file content]
```

### Email Service Integration

Email notifications are handled through AWS SES:

- **License Expiration Alerts**: Automated notifications for expiring credentials
- **Employee Invitations**: Welcome emails with login instructions
- **Document Signing**: DocuSeal integration for form completion alerts
- **System Notifications**: Admin alerts for critical events

---

## Development Workflow

### Git Workflow

1. **Feature Development Process**
   ```bash
   # Create feature branch
   git checkout -b feature/employee-profiles
   
   # Make changes and test locally
   npm run dev
   
   # Run type checking and linting
   npm run check
   
   # Commit with conventional format
   git add .
   git commit -m "feat: add employee profile enhancements"
   
   # Push and create PR
   git push origin feature/employee-profiles
   ```

2. **Commit Message Convention**
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation updates
   - `style:` Code style changes (no logic changes)
   - `refactor:` Code refactoring
   - `test:` Test additions or changes
   - `chore:` Build process or dependency updates

### Code Style Guidelines

#### TypeScript Standards
- **Strict Mode**: All TypeScript features enabled
- **Type Safety**: Explicit types for function parameters and returns
- **Shared Types**: Use types from `@shared/schema.ts`
- **Error Handling**: Comprehensive try-catch blocks

#### React Conventions
- **Functional Components**: Use hooks instead of class components
- **Custom Hooks**: Extract complex logic into reusable hooks
- **Props Interface**: Define interfaces for all component props
- **Data Fetching**: Use TanStack Query for all server communication

#### Naming Conventions
- **Components**: PascalCase (`EmployeeForm`, `DocumentTable`)
- **Functions**: camelCase (`getUserById`, `validateLicense`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`, `MAX_FILE_SIZE`)
- **Files**: kebab-case (`employee-form.tsx`, `api-client.ts`)

#### Code Organization
- **Single Responsibility**: Each function/component has one clear purpose
- **Barrel Exports**: Use index files for clean imports
- **Error Boundaries**: Wrap components that might throw errors
- **Loading States**: Always show loading indicators for async operations

### Database Development

#### Schema Changes
```bash
# 1. Modify shared/schema.ts
# 2. Push changes to database
npm run db:push

# 3. If data loss warning appears (development only!)
npm run db:push --force
```

#### Storage Interface
- **Repository Pattern**: Use `storage.ts` interface for all database operations
- **Type Safety**: All methods use typed parameters and return values
- **Error Handling**: Consistent error responses across all operations
- **Transactions**: Use database transactions for multi-table operations

### Development Commands

```bash
# Development
npm run dev              # Start development server
npm run check           # TypeScript type checking
npm run build          # Build for production
npm run start          # Start production server

# Database
npm run db:push        # Push schema changes to database
npm run db:push --force # Force push (development only)

# Testing (when implemented)
npm run test           # Run unit tests
npm run test:e2e       # Run end-to-end tests
npm run test:coverage  # Run tests with coverage
```

### Debugging Guidelines

#### Backend Debugging
```javascript
// Add request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, req.body);
    next();
  });
}

// Add response timing
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
  });
  next();
});
```

#### Frontend Debugging
```typescript
// TanStack Query DevTools (development only)
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'

function App() {
  return (
    <>
      <MyApp />
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </>
  )
}
```

---

## API Documentation

### Base URL and Authentication

```
Development: http://localhost:5000/api
Production: https://your-domain.com/api
```

The API supports two authentication methods:

1. **Session-based** (for web UI): Automatic cookie-based authentication
2. **API Key-based** (for external apps): Bearer token authentication

### Authentication Endpoints

#### POST /api/register
Register a new user account (first-time setup)

**Request:**
```json
{
  "username": "john.doe",
  "password": "SecurePass123!",
  "role": "hr"  // Optional: "admin", "hr", or "viewer"
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

#### POST /api/login
Authenticate user and create session

**Request:**
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

#### POST /api/logout
End user session

**Response (200):** No content

#### GET /api/user
Get current authenticated user

**Response (200):**
```json
{
  "id": 1,
  "username": "john.doe",
  "role": "hr",
  "createdAt": "2024-01-20T10:00:00Z"
}
```

### Employee Management Endpoints

#### GET /api/employees
Get paginated list of employees

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 10, max: 100)
- `search` (string): Search by name or email
- `department` (string): Filter by department
- `status` (string): Filter by status (active/inactive)
- `location` (string): Filter by work location

**Headers:**
```
Authorization: Bearer hrms_live_your_api_key_here  # For API key auth
# OR session cookie for web UI
```

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
      "ssn": "***-**-1234"  // Masked for security
    }
  ],
  "total": 50,
  "page": 1,
  "totalPages": 5
}
```

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

#### POST /api/employees
Create new employee

**Required Role:** `admin` or `hr`

**Request:**
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

**Response (201):** Created employee object (with masked sensitive data)

#### PUT /api/employees/:id
Update employee information

**Required Role:** `admin` or `hr`

**Request:** Partial employee object with fields to update

**Response (200):** Updated employee object

#### DELETE /api/employees/:id
Delete employee (cascades to all related records)

**Required Role:** `admin`

**Response (204):** No content

### Document Management Endpoints

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
      "fileName": "license_123.pdf",
      "storageType": "s3",
      "fileSize": 245760,
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

#### POST /api/documents/upload
Upload a new document

**Required Role:** `admin` or `hr`

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `document` (file): File to upload (max 10MB)
- `employeeId` (integer): Employee ID
- `documentType` (string): Type of document
- `signedDate` (string): Optional date document was signed
- `notes` (string): Optional notes

**Response (201):** Created document object

#### GET /api/documents/:id/download
Download a document file

**Response:** File download or presigned URL for S3 files

### License Management Endpoints

#### GET /api/employees/:id/state-licenses
Get all state medical licenses for an employee

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

#### POST /api/employees/:id/state-licenses
Add state license

**Required Role:** `admin` or `hr`

**Request:**
```json
{
  "licenseNumber": "CA789123",
  "state": "CA",
  "issueDate": "2020-03-01",
  "expirationDate": "2026-02-28",
  "status": "Active"
}
```

#### GET /api/employees/:id/dea-licenses
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

### API Key Management Endpoints

#### GET /api/api-keys
List all API keys (admin only)

**Required Role:** `admin`

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "External CRM Integration",
    "keyPrefix": "hrms_live_Ab3Cd5Ef",
    "permissions": ["read:employees", "read:documents"],
    "environment": "live",
    "isActive": true,
    "expiresAt": "2025-01-20T10:00:00Z",
    "lastUsedAt": "2024-01-19T15:30:00Z",
    "createdAt": "2024-01-01T10:00:00Z"
  }
]
```

#### POST /api/api-keys
Create new API key

**Required Role:** `admin`

**Request:**
```json
{
  "name": "External CRM Integration",
  "permissions": ["read:employees", "read:documents"],
  "environment": "live",
  "expiresAt": "2025-01-20T10:00:00Z"
}
```

**Response (201):**
```json
{
  "id": 1,
  "name": "External CRM Integration",
  "key": "hrms_live_Ab3Cd5Ef7Gh9Ij2Kl4Mn6Op8Qr0St...",
  "keyPrefix": "hrms_live_Ab3Cd5Ef",
  "permissions": ["read:employees", "read:documents"],
  "environment": "live",
  "expiresAt": "2025-01-20T10:00:00Z"
}
```

### Reports and Analytics Endpoints

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

#### GET /api/reports/stats
Get dashboard statistics

**Response (200):**
```json
{
  "totalEmployees": 150,
  "activeEmployees": 142,
  "expiringSoon": 8,
  "pendingDocs": 5,
  "totalDocuments": 1250,
  "storageUsed": "2.5 GB"
}
```

### Error Responses

All endpoints return consistent error responses:

**400 Bad Request:**
```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "workEmail",
      "message": "Invalid email format"
    }
  ]
}
```

**401 Unauthorized:**
```json
{
  "error": "Authentication required"
}
```

**403 Forbidden:**
```json
{
  "error": "Insufficient permissions"
}
```

**404 Not Found:**
```json
{
  "error": "Employee not found"
}
```

**429 Too Many Requests:**
```json
{
  "error": "Rate limit exceeded. Try again later."
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```

---

## Database Schema

### Overview

The database schema is designed specifically for healthcare HR management with comprehensive employee profiles, credential tracking, and compliance monitoring. Built with PostgreSQL and managed through Drizzle ORM.

### Core Tables

#### Users Table
Manages authentication and authorization for the HR system.

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,  -- Scrypt-hashed
  role VARCHAR(20) NOT NULL DEFAULT 'hr',  -- 'admin', 'hr', 'viewer'
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Roles:**
- `admin`: Full system access, user management, system configuration
- `hr`: Employee management, document upload, reporting
- `viewer`: Read-only access for viewing employee data and reports

#### Employees Table (Core Entity)
Central table storing comprehensive employee profiles for medical professionals.

```sql
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  
  -- Personal Information
  first_name VARCHAR(50) NOT NULL,
  middle_name VARCHAR(50),
  last_name VARCHAR(50) NOT NULL,
  date_of_birth DATE,
  ssn VARCHAR(255),  -- Encrypted
  
  -- Contact Information
  personal_email VARCHAR(100) UNIQUE,
  work_email VARCHAR(100) UNIQUE NOT NULL,
  cell_phone VARCHAR(20),
  work_phone VARCHAR(20),
  
  -- Home Address
  home_address1 VARCHAR(100),
  home_address2 VARCHAR(100),
  home_city VARCHAR(50),
  home_state VARCHAR(50),
  home_zip VARCHAR(10),
  
  -- Demographics
  gender VARCHAR(20),
  birth_city VARCHAR(50),
  birth_state VARCHAR(50),
  birth_country VARCHAR(50),
  
  -- Professional Information
  job_title VARCHAR(100),
  qualification VARCHAR(100),
  work_location VARCHAR(100),
  department VARCHAR(100),
  
  -- Regulatory/Compliance IDs
  npi_number VARCHAR(10),
  medicaid_number VARCHAR(50),
  medicare_ptan_number VARCHAR(50),
  dea_number VARCHAR(20),
  caqh_provider_id VARCHAR(50),
  caqh_username VARCHAR(100),
  caqh_password VARCHAR(255),  -- Encrypted
  nppes_username VARCHAR(100),
  nppes_password VARCHAR(255),  -- Encrypted
  
  -- Driver's License
  drivers_license_number VARCHAR(50),
  dl_state_issued VARCHAR(50),
  dl_issue_date DATE,
  
  -- Status and Metadata
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Employee-Related Entity Tables

#### Educations Table
Medical school, residency, fellowships, and continuing education.

```sql
CREATE TABLE educations (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  school_institution VARCHAR(200) NOT NULL,
  degree VARCHAR(100) NOT NULL,
  major VARCHAR(100),
  graduation_date DATE,
  start_date DATE,
  end_date DATE,
  gpa DECIMAL(3,2),
  honors VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Employments Table
Complete employment history with references.

```sql
CREATE TABLE employments (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  employer VARCHAR(200) NOT NULL,
  position VARCHAR(100) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  current_employer BOOLEAN DEFAULT FALSE,
  reason_for_leaving TEXT,
  supervisor_name VARCHAR(100),
  supervisor_phone VARCHAR(20),
  address1 VARCHAR(100),
  address2 VARCHAR(100),
  city VARCHAR(50),
  state VARCHAR(50),
  zip VARCHAR(10),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### State Licenses Table
State medical licenses and registrations.

```sql
CREATE TABLE state_licenses (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  license_number VARCHAR(50) NOT NULL,
  state VARCHAR(50) NOT NULL,
  issue_date DATE,
  expiration_date DATE,
  status VARCHAR(20) DEFAULT 'Active',
  license_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### DEA Licenses Table
DEA registrations for controlled substances.

```sql
CREATE TABLE dea_licenses (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  license_number VARCHAR(20) NOT NULL,
  state VARCHAR(50) NOT NULL,
  issue_date DATE,
  expiration_date DATE,
  schedules TEXT[],  -- Array of controlled substance schedules
  business_activity VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Board Certifications Table
Professional board certifications and specialties.

```sql
CREATE TABLE board_certifications (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  board_name VARCHAR(200) NOT NULL,
  certification VARCHAR(200) NOT NULL,
  issue_date DATE,
  expiration_date DATE,
  certificate_number VARCHAR(100),
  status VARCHAR(20) DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Documents Table
Secure document storage with metadata.

```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
  document_type VARCHAR(100) NOT NULL,
  file_path VARCHAR(500),
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  mime_type VARCHAR(100),
  storage_type VARCHAR(10) DEFAULT 'local',  -- 'local' or 's3'
  storage_key VARCHAR(500),  -- S3 object key
  s3_etag VARCHAR(100),  -- S3 ETag for integrity
  signed_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Additional Entity Tables

The system includes 11 entity tables for comprehensive employee management:

- **peer_references**: Professional references and contacts
- **emergency_contacts**: Emergency contact information
- **tax_forms**: W-4, I-9, and tax documentation
- **trainings**: Continuing education and training records
- **payer_enrollments**: Insurance payer enrollments
- **incident_logs**: Compliance and incident tracking

### System Tables

#### API Keys Table
API key management for external integrations.

```sql
CREATE TABLE api_keys (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,  -- bcrypt hashed
  key_prefix VARCHAR(50) NOT NULL,
  permissions TEXT[] NOT NULL,  -- Array of permission strings
  environment VARCHAR(10) NOT NULL,  -- 'live' or 'test'
  is_active BOOLEAN DEFAULT TRUE,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### Audits Table
Comprehensive audit logging for compliance.

```sql
CREATE TABLE audits (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  record_id INTEGER,
  action VARCHAR(10) NOT NULL,  -- 'INSERT', 'UPDATE', 'DELETE'
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW(),
  old_data JSONB,
  new_data JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT
);
```

#### S3 Configuration Table
Encrypted storage for AWS S3 settings.

```sql
CREATE TABLE s3_configuration (
  id SERIAL PRIMARY KEY,
  access_key_id VARCHAR(255),  -- Encrypted
  secret_access_key VARCHAR(255),  -- Encrypted
  region VARCHAR(50),
  bucket_name VARCHAR(255),
  endpoint VARCHAR(255),
  enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Database Relationships

```
users (1) ──── (N) audits
              │
employees (1) ──┬── (N) educations
                ├── (N) employments
                ├── (N) state_licenses
                ├── (N) dea_licenses
                ├── (N) board_certifications
                ├── (N) peer_references
                ├── (N) emergency_contacts
                ├── (N) tax_forms
                ├── (N) trainings
                ├── (N) payer_enrollments
                ├── (N) incident_logs
                ├── (N) documents
                └── (N) form_submissions

docuseal_templates (1) ──── (N) form_submissions
employee_invitations (1) ──── (N) form_submissions
```

### Key Constraints and Indexes

#### Primary Keys
- All tables use `SERIAL PRIMARY KEY` for auto-incrementing IDs

#### Foreign Key Constraints
- All employee-related tables cascade delete when employee is removed
- User references maintain referential integrity
- API key rotations link to parent keys

#### Unique Constraints
- `users.username` - Unique login identifiers
- `employees.work_email` - Unique work email addresses
- `employees.personal_email` - Unique personal emails (when provided)

#### Indexes
```sql
-- Performance indexes for common queries
CREATE INDEX idx_employees_status ON employees(status);
CREATE INDEX idx_employees_work_location ON employees(work_location);
CREATE INDEX idx_documents_employee_id ON documents(employee_id);
CREATE INDEX idx_audits_table_record ON audits(table_name, record_id);
CREATE INDEX idx_audits_changed_at ON audits(changed_at);

-- Unique indexes for business rules
CREATE UNIQUE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
```

### Migration Process

#### Schema Management
```bash
# Development: Push schema changes directly
npm run db:push

# Production: Use migrations (when available)
npm run db:migrate
```

#### Data Encryption
Sensitive fields are encrypted at the application level before storage:
- `employees.ssn` - Social Security Numbers
- `employees.caqh_password` - CAQH portal passwords
- `employees.nppes_password` - NPPES portal passwords
- `s3_configuration.access_key_id` - AWS credentials
- `s3_configuration.secret_access_key` - AWS credentials

#### Backup Strategy
```sql
-- Full database backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

-- Schema-only backup
pg_dump --schema-only $DATABASE_URL > schema_backup.sql

-- Data-only backup
pg_dump --data-only $DATABASE_URL > data_backup.sql
```

---

## Testing Guidelines

### Testing Strategy

The HR Management System uses a comprehensive testing approach covering unit tests, integration tests, and end-to-end testing to ensure reliability and compliance.

#### Testing Pyramid

```
    ┌─────────────────┐
    │   E2E Tests     │  ← Few, high-value user journeys
    │   (Playwright)  │
    ├─────────────────┤
    │ Integration     │  ← API endpoints, database operations
    │ Tests (Jest)    │
    ├─────────────────┤
    │   Unit Tests    │  ← Many, fast, isolated tests
    │   (Jest/Vitest) │
    └─────────────────┘
```

### Unit Testing

#### Frontend Unit Tests
Test individual React components and utility functions.

```typescript
// Example: useAuth hook testing
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

describe('useAuth', () => {
  it('should login user with valid credentials', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } }
    });
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.loginMutation.mutateAsync({
        username: 'test@example.com',
        password: 'password123'
      });
    });

    expect(result.current.user).toBeTruthy();
    expect(result.current.user?.username).toBe('test@example.com');
  });
});
```

#### Backend Unit Tests
Test individual functions and middleware.

```typescript
// Example: Password hashing testing
import { hashPassword, comparePasswords } from '../auth';

describe('Password Utilities', () => {
  it('should hash and verify passwords correctly', async () => {
    const password = 'testPassword123!';
    const hash = await hashPassword(password);
    
    expect(hash).toContain('.');
    expect(hash.length).toBeGreaterThan(32);
    
    const isValid = await comparePasswords(password, hash);
    expect(isValid).toBe(true);
    
    const isInvalid = await comparePasswords('wrongPassword', hash);
    expect(isInvalid).toBe(false);
  });
});
```

### Integration Testing

#### API Endpoint Testing
Test complete API workflows with database interactions.

```typescript
// Example: Employee API integration test
import request from 'supertest';
import { app } from '../server';
import { storage } from '../storage';

describe('Employee API', () => {
  let authCookie: string;
  
  beforeAll(async () => {
    // Setup test database
    await storage.reset();
    
    // Create test user and login
    const loginResponse = await request(app)
      .post('/api/login')
      .send({ username: 'test@hr.com', password: 'password123' });
    
    authCookie = loginResponse.headers['set-cookie'][0];
  });

  it('should create employee with valid data', async () => {
    const employeeData = {
      firstName: 'John',
      lastName: 'Doe',
      workEmail: 'john.doe@hospital.com',
      jobTitle: 'Physician',
      status: 'active'
    };

    const response = await request(app)
      .post('/api/employees')
      .set('Cookie', authCookie)
      .send(employeeData);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
    expect(response.body.firstName).toBe('John');
    expect(response.body.workEmail).toBe('john.doe@hospital.com');
  });

  it('should validate required fields', async () => {
    const invalidData = {
      firstName: 'John'
      // Missing required fields
    };

    const response = await request(app)
      .post('/api/employees')
      .set('Cookie', authCookie)
      .send(invalidData);

    expect(response.status).toBe(400);
    expect(response.body).toHaveProperty('error');
    expect(response.body.details).toBeInstanceOf(Array);
  });
});
```

#### Database Integration Tests
Test storage layer and data integrity.

```typescript
// Example: Storage layer testing
import { storage } from '../storage';
import { insertEmployeeSchema } from '@shared/schema';

describe('Employee Storage', () => {
  it('should encrypt sensitive data', async () => {
    const employeeData = {
      firstName: 'Jane',
      lastName: 'Smith',
      workEmail: 'jane@hospital.com',
      ssn: '123-45-6789'
    };

    const employee = await storage.createEmployee(employeeData);
    
    // SSN should be encrypted
    expect(employee.ssn).not.toBe('123-45-6789');
    expect(employee.ssn).toContain('.');
  });

  it('should maintain referential integrity', async () => {
    const employee = await storage.createEmployee({
      firstName: 'Test',
      lastName: 'User',
      workEmail: 'test@example.com'
    });

    // Add education record
    const education = await storage.createEducation(employee.id, {
      schoolInstitution: 'Harvard Medical School',
      degree: 'MD',
      graduationDate: new Date('2020-05-15')
    });

    // Delete employee should cascade
    await storage.deleteEmployee(employee.id);
    
    // Education should be deleted
    const educations = await storage.getEducations(employee.id);
    expect(educations).toHaveLength(0);
  });
});
```

### End-to-End Testing

#### User Journey Testing
Test complete workflows from user perspective.

```typescript
// Example: Employee onboarding E2E test
import { test, expect } from '@playwright/test';

test.describe('Employee Onboarding', () => {
  test('complete employee onboarding workflow', async ({ page }) => {
    // Login as HR user
    await page.goto('/auth');
    await page.fill('[data-testid="input-username"]', 'hr@company.com');
    await page.fill('[data-testid="input-password"]', 'password123');
    await page.click('[data-testid="button-login"]');

    // Navigate to employee creation
    await page.click('[data-testid="link-employees"]');
    await page.click('[data-testid="button-add-employee"]');

    // Fill employee form
    await page.fill('[data-testid="input-firstName"]', 'Dr. Sarah');
    await page.fill('[data-testid="input-lastName"]', 'Johnson');
    await page.fill('[data-testid="input-workEmail"]', 'sarah.johnson@hospital.com');
    await page.selectOption('[data-testid="select-jobTitle"]', 'Physician');

    // Submit form
    await page.click('[data-testid="button-submit"]');

    // Verify success
    await expect(page.locator('[data-testid="toast-success"]')).toBeVisible();
    await expect(page.locator('text=Dr. Sarah Johnson')).toBeVisible();

    // Add medical license
    await page.click('[data-testid="tab-licenses"]');
    await page.click('[data-testid="button-add-license"]');
    await page.fill('[data-testid="input-licenseNumber"]', 'MD123456');
    await page.selectOption('[data-testid="select-state"]', 'MA');
    await page.click('[data-testid="button-save"]');

    // Verify license added
    await expect(page.locator('text=MD123456')).toBeVisible();
  });
});
```

### Testing Commands

```bash
# Unit Tests
npm run test                 # Run all unit tests
npm run test:watch          # Run tests in watch mode
npm run test:coverage       # Run with coverage report

# Integration Tests
npm run test:integration    # Run API integration tests
npm run test:db             # Run database integration tests

# E2E Tests
npm run test:e2e            # Run end-to-end tests
npm run test:e2e:headed     # Run E2E tests with browser UI
npm run test:e2e:debug      # Run E2E tests in debug mode

# All Tests
npm run test:all            # Run complete test suite
```

### Test Data Management

#### Test Database
```bash
# Setup test database
createdb hr_management_test
export DATABASE_URL_TEST="postgresql://user:pass@localhost/hr_management_test"

# Reset test data before each test suite
npm run test:db:reset
```

#### Test Data Factories
```typescript
// Test data factory for employees
export const createTestEmployee = (overrides = {}) => ({
  firstName: 'Test',
  lastName: 'Employee',
  workEmail: `test.${Date.now()}@hospital.com`,
  jobTitle: 'Physician',
  status: 'active',
  ...overrides
});

export const createTestUser = (overrides = {}) => ({
  username: `testuser${Date.now()}`,
  password: 'testPassword123!',
  role: 'hr',
  ...overrides
});
```

### Testing Best Practices

#### Test Organization
- **Arrange, Act, Assert**: Clear test structure
- **Descriptive Names**: Test names describe the scenario
- **Single Responsibility**: One assertion per test when possible
- **Independent Tests**: Tests don't depend on each other

#### Data Isolation
- **Clean Slate**: Reset database before each test suite
- **Unique Data**: Use timestamps or UUIDs for unique test data
- **Cleanup**: Remove test data after completion

#### Mock Strategy
- **Mock External Services**: S3, SES, DocuSeal APIs
- **Real Database**: Use test database for integration tests
- **Partial Mocks**: Mock only what's necessary

#### Performance
- **Parallel Execution**: Run tests in parallel when possible
- **Smart Cleanup**: Only reset what's needed
- **Test Timeout**: Set appropriate timeouts for async operations

---

## Deployment Instructions

### Production Environment Setup

#### Prerequisites

- **Node.js 18+** LTS version
- **PostgreSQL 14+** or Neon serverless database
- **AWS Account** (optional, for S3 and SES)
- **Domain Name** with SSL certificate
- **Process Manager** (PM2 recommended)

### Environment Configuration

#### Production Environment Variables

```bash
# Database
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Security
SESSION_SECRET=your-very-secure-secret-key-min-32-chars
NODE_ENV=production
PORT=5000

# AWS Services (Optional)
AWS_ACCESS_KEY_ID=your_production_access_key
AWS_SECRET_ACCESS_KEY=your_production_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET_NAME=your-production-bucket
AWS_SES_FROM_EMAIL=noreply@yourcompany.com

# DocuSeal (Optional)
DOCUSEAL_API_KEY=your_production_docuseal_key
DOCUSEAL_BASE_URL=https://api.docuseal.co

# Security Headers
TRUST_PROXY=true
SECURE_COOKIES=true

# Rate Limiting
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100

# File Upload
MAX_FILE_SIZE=10485760  # 10MB
```

### Build and Deployment

#### Option 1: Replit Deployment (Recommended)

1. **Connect Repository**
   ```bash
   # Push code to GitHub
   git push origin main
   
   # Import repository to Replit
   # Go to replit.com -> Import from GitHub
   ```

2. **Configure Secrets**
   ```bash
   # In Replit, go to Tools -> Secrets
   # Add all environment variables from above
   ```

3. **Database Setup**
   ```bash
   # Provision Neon database in Replit
   # Copy connection string to DATABASE_URL secret
   
   # Run migrations
   npm run db:push
   ```

4. **Deploy**
   ```bash
   # Replit automatically deploys on code changes
   # Custom domain: Go to Tools -> Domain
   ```

#### Option 2: Traditional VPS Deployment

1. **Server Setup**
   ```bash
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2
   npm install -g pm2
   
   # Install PostgreSQL (if not using external)
   sudo apt-get install postgresql postgresql-contrib
   ```

2. **Application Deployment**
   ```bash
   # Clone repository
   git clone https://github.com/yourorg/hr-management-system.git
   cd hr-management-system
   
   # Install dependencies
   npm install
   
   # Build application
   npm run build
   
   # Set environment variables
   cp .env.example .env
   # Edit .env with production values
   
   # Run database migrations
   npm run db:push
   
   # Start with PM2
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

3. **PM2 Configuration (ecosystem.config.js)**
   ```javascript
   module.exports = {
     apps: [{
       name: 'hr-management-system',
       script: 'dist/index.js',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 5000
       },
       error_file: './logs/err.log',
       out_file: './logs/out.log',
       log_file: './logs/combined.log',
       time: true
     }]
   };
   ```

#### Option 3: Docker Deployment

1. **Dockerfile**
   ```dockerfile
   FROM node:18-alpine AS base

   # Install dependencies only when needed
   FROM base AS deps
   RUN apk add --no-cache libc6-compat
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production

   # Build the app
   FROM base AS builder
   WORKDIR /app
   COPY . .
   COPY --from=deps /app/node_modules ./node_modules
   RUN npm run build

   # Production image
   FROM base AS runner
   WORKDIR /app
   ENV NODE_ENV production
   
   RUN addgroup --system --gid 1001 nodejs
   RUN adduser --system --uid 1001 app
   
   COPY --from=builder /app/dist ./dist
   COPY --from=deps /app/node_modules ./node_modules
   COPY --from=builder /app/package.json ./package.json
   
   USER app
   EXPOSE 5000
   ENV PORT 5000
   
   CMD ["node", "dist/index.js"]
   ```

2. **Docker Compose**
   ```yaml
   version: '3.8'
   services:
     app:
       build: .
       ports:
         - "5000:5000"
       environment:
         - DATABASE_URL=${DATABASE_URL}
         - SESSION_SECRET=${SESSION_SECRET}
         - NODE_ENV=production
       depends_on:
         - postgres
       restart: unless-stopped

     postgres:
       image: postgres:14
       environment:
         POSTGRES_DB: hr_management
         POSTGRES_USER: ${DB_USER}
         POSTGRES_PASSWORD: ${DB_PASSWORD}
       volumes:
         - postgres_data:/var/lib/postgresql/data
       restart: unless-stopped

     nginx:
       image: nginx:alpine
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./nginx.conf:/etc/nginx/nginx.conf
         - ./ssl:/etc/nginx/ssl
       depends_on:
         - app
       restart: unless-stopped

   volumes:
     postgres_data:
   ```

### Reverse Proxy Configuration (Nginx)

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';";

    # Proxy to Node.js app
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # File upload size
    client_max_body_size 10M;
}
```

### Database Migration and Backup

#### Production Database Setup
```bash
# Run initial migration
npm run db:push

# Create first admin user (run once)
node -e "
const { storage } = require('./dist/storage');
storage.createUser({
  username: 'admin',
  passwordHash: 'hashed_password_here',
  role: 'admin'
}).then(() => console.log('Admin user created'));
"
```

#### Backup Strategy
```bash
#!/bin/bash
# backup.sh - Daily backup script

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups"
DB_NAME="hr_management"

# Create backup directory
mkdir -p $BACKUP_DIR

# Database backup
pg_dump $DATABASE_URL > $BACKUP_DIR/db_backup_$DATE.sql

# Compress backup
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/db_backup_$DATE.sql.gz s3://your-backup-bucket/

echo "Backup completed: db_backup_$DATE.sql.gz"
```

#### Cron Job for Automated Backups
```bash
# Add to crontab (crontab -e)
0 2 * * * /path/to/backup.sh >> /var/log/backup.log 2>&1
```

### Monitoring and Health Checks

#### Health Check Endpoint
```typescript
// Add to server routes
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await storage.testConnection();
    
    // Check external services
    const s3Status = await s3Service.healthCheck();
    const sesStatus = await sesService.healthCheck();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        database: 'connected',
        s3: s3Status ? 'connected' : 'disconnected',
        ses: sesStatus ? 'connected' : 'disconnected'
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});
```

#### Process Monitoring with PM2
```bash
# Monitor applications
pm2 monit

# View logs
pm2 logs hr-management-system

# Restart application
pm2 restart hr-management-system

# Auto-restart on file changes (development)
pm2 start ecosystem.config.js --watch
```

### Security Hardening

#### SSL/TLS Configuration
```bash
# Generate SSL certificate (Let's Encrypt)
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
0 12 * * * /usr/bin/certbot renew --quiet
```

#### Firewall Configuration
```bash
# UFW firewall rules
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw deny 5000  # Block direct access to Node.js
sudo ufw enable
```

#### Application Security
```typescript
// Add to server configuration
import helmet from 'helmet';
import compression from 'compression';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));

app.use(compression());
```

### Performance Optimization

#### Database Optimization
```sql
-- Add indexes for common queries
CREATE INDEX CONCURRENTLY idx_employees_search 
ON employees USING gin(to_tsvector('english', first_name || ' ' || last_name || ' ' || work_email));

CREATE INDEX CONCURRENTLY idx_documents_employee_type 
ON documents(employee_id, document_type);

CREATE INDEX CONCURRENTLY idx_audits_date_table 
ON audits(changed_at, table_name);

-- Analyze query performance
EXPLAIN ANALYZE SELECT * FROM employees WHERE status = 'active';
```

#### Application Caching
```typescript
// Add Redis caching (optional)
import Redis from 'redis';

const redis = Redis.createClient({
  url: process.env.REDIS_URL
});

// Cache employee data
const cacheEmployee = async (id: number, data: Employee) => {
  await redis.setex(`employee:${id}`, 300, JSON.stringify(data));
};

const getCachedEmployee = async (id: number): Promise<Employee | null> => {
  const cached = await redis.get(`employee:${id}`);
  return cached ? JSON.parse(cached) : null;
};
```

### Maintenance and Updates

#### Zero-Downtime Deployment
```bash
# Blue-green deployment with PM2
pm2 start ecosystem.config.js --name hr-management-blue
pm2 start ecosystem.config.js --name hr-management-green

# Update green instance
pm2 stop hr-management-green
# Deploy new code
pm2 start hr-management-green

# Switch traffic (update load balancer)
# Stop blue instance after verification
pm2 stop hr-management-blue
```

#### Database Maintenance
```bash
# Weekly maintenance script
#!/bin/bash

# Vacuum and analyze database
psql $DATABASE_URL -c "VACUUM ANALYZE;"

# Check for unused indexes
psql $DATABASE_URL -c "
SELECT schemaname, tablename, attname, n_distinct, correlation 
FROM pg_stats 
WHERE schemaname = 'public' 
ORDER BY n_distinct DESC;
"

# Monitor database size
psql $DATABASE_URL -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

---

## Troubleshooting

### Common Issues and Solutions

#### Database Connection Issues

**Problem:** `Database connection refused` or `Connection timeout`

**Solutions:**
```bash
# 1. Check DATABASE_URL format
echo $DATABASE_URL
# Should be: postgresql://username:password@host:port/database?sslmode=require

# 2. Test connection manually
psql $DATABASE_URL -c "SELECT 1"

# 3. Check firewall rules
telnet your-db-host 5432

# 4. Verify SSL requirements
psql "$DATABASE_URL&sslmode=disable" -c "SELECT 1"

# 5. Reset connection pool (if using)
npm restart
```

**Database Migration Errors:**
```bash
# Error: Data loss warning
npm run db:push --force  # Development only!

# Error: Permission denied
# Grant proper permissions to database user
GRANT ALL PRIVILEGES ON DATABASE hr_management TO your_user;
GRANT ALL ON SCHEMA public TO your_user;
```

#### Authentication Problems

**Problem:** `Session not persisting` or `Login fails`

**Solutions:**
```bash
# 1. Check SESSION_SECRET
echo $SESSION_SECRET
# Must be at least 32 characters

# 2. Clear session store
psql $DATABASE_URL -c "DELETE FROM session"

# 3. Check cookie settings
# In production, ensure HTTPS and secure cookies
NODE_ENV=production SECURE_COOKIES=true

# 4. Verify user credentials
psql $DATABASE_URL -c "SELECT username, role FROM users"
```

**API Key Authentication Issues:**
```bash
# Check API key format
echo "hrms_live_your_key_here" | cut -d'_' -f1-2
# Should output: hrms_live

# Verify key permissions
curl -H "Authorization: Bearer hrms_live_your_key" \
     http://localhost:5000/api/employees

# Check key expiration
psql $DATABASE_URL -c "
SELECT name, expires_at, is_active 
FROM api_keys 
WHERE key_prefix = 'hrms_live_your_prefix'
"
```

#### File Upload Problems

**Problem:** `File too large` or `Upload fails`

**Solutions:**
```bash
# 1. Check file size limits
echo $MAX_FILE_SIZE  # Should be 10485760 (10MB)

# 2. Verify upload directory permissions
ls -la server/uploads
chmod 755 server/uploads

# 3. Check available disk space
df -h

# 4. Test S3 configuration (if using)
aws s3 ls s3://your-bucket-name --profile your-profile

# 5. Verify MIME types
file --mime-type your-document.pdf
```

**S3 Integration Issues:**
```bash
# Test AWS credentials
aws sts get-caller-identity

# Check bucket permissions
aws s3api get-bucket-acl --bucket your-bucket-name

# Test S3 service directly
curl -X GET http://localhost:5000/api/storage/status
```

#### Performance Issues

**Problem:** `Slow queries` or `High memory usage`

**Database Performance:**
```sql
-- Find slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Check for missing indexes
SELECT schemaname, tablename, attname
FROM pg_stats
WHERE n_distinct = -1
AND schemaname = 'public';

-- Monitor connections
SELECT count(*), state 
FROM pg_stat_activity 
GROUP BY state;
```

**Memory Issues:**
```bash
# Monitor Node.js memory usage
node --inspect server/index.ts

# Check PM2 process memory
pm2 monit

# Set memory limits
pm2 start ecosystem.config.js --max-memory-restart 500M

# Enable garbage collection logging
node --expose-gc --trace-gc server/index.ts
```

#### Email Service Problems

**Problem:** `Email not sending` or `SES authentication failed`

**Solutions:**
```bash
# 1. Verify SES credentials
aws ses get-send-quota --region us-east-1

# 2. Check SES sending limits
aws ses get-send-statistics --region us-east-1

# 3. Verify email address verification
aws ses list-verified-email-addresses --region us-east-1

# 4. Test email sending
curl -X POST http://localhost:5000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{"to": "test@example.com", "subject": "Test", "body": "Test email"}'

# 5. Check SES sandbox mode
# New accounts are in sandbox - verify recipient addresses
```

#### DocuSeal Integration Issues

**Problem:** `DocuSeal API connection failed`

**Solutions:**
```bash
# 1. Test API key
curl -H "X-Auth-Token: your_api_key" \
     https://api.docuseal.co/templates

# 2. Check configuration in database
psql $DATABASE_URL -c "
SELECT base_url, enabled, last_test_success 
FROM docuseal_configurations 
WHERE enabled = true
"

# 3. Sync templates manually
curl -X POST http://localhost:5000/api/docuseal/sync-templates

# 4. Check webhook configuration
# Ensure DocuSeal webhooks point to your domain
```

### Debugging Tools and Techniques

#### Enable Debug Logging

```typescript
// Add to server/index.ts for detailed logging
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    console.log('Headers:', req.headers);
    console.log('Body:', req.body);
    console.log('Query:', req.query);
    next();
  });
}

// Database query logging with Drizzle
import { drizzle } from 'drizzle-orm/neon-http';

const db = drizzle(connection, { 
  schema,
  logger: process.env.NODE_ENV === 'development'
});
```

#### Error Monitoring

```typescript
// Add error tracking (example with simple logging)
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Error details:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    user: req.user?.id,
    timestamp: new Date().toISOString()
  });

  if (process.env.NODE_ENV === 'production') {
    // Send to error tracking service (Sentry, LogRocket, etc.)
    // errorTracker.captureException(err);
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal server error' 
      : err.message
  });
});
```

#### Health Check Script

```bash
#!/bin/bash
# health-check.sh - Comprehensive system health check

echo "HR Management System Health Check"
echo "================================"

# Check application response
echo "1. Application Health:"
curl -f http://localhost:5000/health || echo "❌ Application not responding"

# Check database connection
echo "2. Database Connection:"
psql $DATABASE_URL -c "SELECT 1" > /dev/null 2>&1 && echo "✅ Database OK" || echo "❌ Database connection failed"

# Check disk space
echo "3. Disk Space:"
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
  echo "❌ Disk usage high: ${DISK_USAGE}%"
else
  echo "✅ Disk usage OK: ${DISK_USAGE}%"
fi

# Check memory usage
echo "4. Memory Usage:"
MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEM_USAGE -gt 80 ]; then
  echo "❌ Memory usage high: ${MEM_USAGE}%"
else
  echo "✅ Memory usage OK: ${MEM_USAGE}%"
fi

# Check SSL certificate (if applicable)
echo "5. SSL Certificate:"
openssl s_client -connect your-domain.com:443 -servername your-domain.com < /dev/null 2>/dev/null | openssl x509 -noout -dates

echo "Health check completed."
```

#### Log Analysis

```bash
# Monitor application logs
tail -f logs/combined.log | grep ERROR

# Analyze error patterns
grep "ERROR" logs/combined.log | cut -d' ' -f5- | sort | uniq -c | sort -nr

# Monitor database performance
psql $DATABASE_URL -c "
SELECT query, total_time, mean_time, calls
FROM pg_stat_statements
WHERE calls > 100
ORDER BY total_time DESC
LIMIT 10;
"

# Check for security issues
grep "401\|403\|429" logs/access.log | tail -20
```

### Emergency Recovery Procedures

#### Database Recovery

```bash
# 1. Stop application
pm2 stop hr-management-system

# 2. Restore from backup
gunzip db_backup_YYYYMMDD_HHMMSS.sql.gz
psql $DATABASE_URL < db_backup_YYYYMMDD_HHMMSS.sql

# 3. Verify data integrity
psql $DATABASE_URL -c "
SELECT 
  table_name, 
  (xpath('/row/c/text()', xml_count))[1]::text::int as row_count
FROM (
  SELECT table_name, query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '') as xml_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
) t;
"

# 4. Restart application
pm2 start hr-management-system
```

#### Session Recovery

```bash
# Clear all sessions (forces re-login)
psql $DATABASE_URL -c "DELETE FROM session"

# Reset specific user session
psql $DATABASE_URL -c "DELETE FROM session WHERE sess::text LIKE '%user_id\":123%'"
```

#### Cache Reset

```bash
# Clear Redis cache (if using)
redis-cli FLUSHALL

# Clear application cache
rm -rf node_modules/.cache
npm run build
```

### Getting Help

#### Support Channels

1. **Documentation**: Check this guide and API documentation
2. **GitHub Issues**: Report bugs and feature requests
3. **Community**: Join the discussion forum
4. **Email Support**: support@yourcompany.com

#### When Reporting Issues

Include the following information:

1. **Environment**: Development/Production
2. **Version**: Git commit hash or tag
3. **Error Message**: Complete error with stack trace
4. **Steps to Reproduce**: Detailed steps that caused the issue
5. **Browser/OS**: For frontend issues
6. **Database Version**: PostgreSQL version
7. **Logs**: Relevant application and database logs

#### Useful Commands for Debugging

```bash
# System information
node --version
npm --version
psql --version

# Application status
pm2 status
pm2 logs hr-management-system --lines 50

# Database status
psql $DATABASE_URL -c "\l"  # List databases
psql $DATABASE_URL -c "\dt"  # List tables
psql $DATABASE_URL -c "\du"  # List users

# Network connectivity
curl -I http://localhost:5000
netstat -tlnp | grep :5000

# Environment variables (masked)
env | grep -E "(DATABASE|SESSION|AWS)" | sed 's/=.*/=***MASKED***/'
```

This comprehensive troubleshooting guide should help developers and administrators quickly identify and resolve common issues with the HR Management System.

---

*This developer guide is designed to be a living document. As the system evolves, please keep this guide updated with new features, API changes, and deployment procedures.*