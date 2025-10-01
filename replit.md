# replit.md

## Overview
This HR management system is designed for healthcare organizations to manage medical staff records, credentials, licenses, and compliance. It's a full-stack web application focused on healthcare-specific needs like medical and DEA licenses, board certifications, CAQH management, and regulatory compliance tracking. The project aims to provide a user-friendly interface to streamline complex HR processes in the medical field, addressing specific challenges such as managing 50+ data fields, documents, and forms required for healthcare onboarding.

## Recent Changes

### Onboarding Form Button Type Fix (October 1, 2025)
**Fixed "Add Document" button causing form to reset to Step 1.**

**Problem:**
Clicking "Add Document" in Step 9 (Documents Submission) triggered form submission, causing navigation reset to Step 1 and screen to disappear.

**Root Cause:**
- Entire onboarding wizard is wrapped in a `<form>` element
- Buttons without explicit `type` attribute default to `type="submit"`
- Clicking "Add Document" submitted the form instead of opening the dialog

**Fix:**
Added `type="button"` to all buttons in EmployeeDocumentsSubmission component:
- View, Replace, Upload buttons in document table
- Add Document button
- Remove file, Cancel, Upload buttons in dialogs

**Files Modified:**
- `client/src/components/forms/employee-documents-submission.tsx`: Lines 660, 671, 684, 706, 766, 801, 812

### Onboarding Draft Validation Schema Fix (October 1, 2025)
**Fixed validation errors when saving onboarding drafts with state licenses and other nested entities.**

**Problems:**
1. Draft schemas were missing `status` field (stateLicenses, deaLicenses)
2. Draft schemas were missing `employeeId` field (all 10 nested entity types)
3. `.strict()` validation rejected legitimate database fields

**Fix:**
- Added `status` field to stateLicenses and deaLicenses draft schemas
- Added `employeeId` field to all nested entity draft schemas
- Ensures form can save and reload existing data without validation errors

**Files Modified:**
- `server/routes.ts`: Lines 5453-5548 (added missing fields to draft schemas)

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query for server state, React Hook Form with Zod for form handling
- **UI Components**: Radix UI primitives with shadcn/ui design system, Tailwind CSS for styling
- **Build Tool**: Vite
- **Key Design Patterns**: Multi-step Forms, Table-based Data Display, Modal Workflows, Protected Routes, Optimistic Updates, Error Boundaries.

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Authentication**: Passport.js (local strategy, session-based)
- **Authorization**: Role-based access control (Admin, HR, Viewer roles)
- **File Uploads**: Multer middleware
- **Security**: Input validation, rate limiting, scrypt for password hashing
- **Audit System**: Comprehensive audit logging
- **Scheduled Tasks**: Node-cron for automated compliance checks

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Design**: Healthcare-focused (employees, licenses, certifications, documents, audit trails)
- **Data Encryption**: Application-level for sensitive fields
- **Session Storage**: Express-session with database-backed store
- **File Storage**: Local filesystem with Amazon S3 integration

### Security Architecture
- **Input Validation**: Express-validator with Zod schemas
- **CSRF Protection**: Session-based CSRF tokens
- **Rate Limiting**: Express-rate-limit
- **File Upload Security**: MIME type validation, file size limits
- **Password Security**: Scrypt hashing
- **Sensitive Data Encryption**: AES-256-GCM for PII
- **Onboarding Security Model**: Entity ownership verification, field whitelisting, array length limits, server-controlled fields, and transaction atomicity to prevent data tampering and ensure integrity.

### Compliance Features
- **Automated Monitoring**: Cron jobs for license expiration
- **Audit Trail**: Complete activity logging
- **Document Management**: Structured storage with categorization, S3-integrated, versioning, secure access
- **Expiration Alerts**: Proactive notifications
- **Reporting**: Dashboards and exportable reports
- **Multi-Location Management**: Hierarchical organization structure
- **License Tracking**: Comprehensive lifecycle management with categories and JSONB for custom data
- **Responsible Persons**: Assignment with notification preferences

### Onboarding System Architecture
- **Config-Driven Wizard**: A 12-step flow (e.g., Personal Info, Education, Licenses) for prospective employees, designed to break down complex data collection into manageable steps.
- **Three-Tier Validation Model**:
    1. **Save Draft**: No validation, allows incomplete data saving.
    2. **Step Navigation**: Validates only the current step using Zod schemas.
    3. **Final Submission**: Requires complete validation of all fields, documents, and forms.
- **Transaction Atomicity**: All employee data and 9 nested entity arrays (e.g., educations, licenses) are saved in a single database transaction using Drizzle ORM, with automatic rollback on error to prevent data corruption.
- **Entity Ownership Model**: Ensures `employeeId` verification for all nested entity updates to prevent unauthorized data modification.
- **Frontend Implementation**: Utilizes `FormProvider` for centralized state, `useFieldArray` for dynamic arrays (e.g., multiple licenses), and auto-save on navigation.
- **Testing Features**: Includes an admin-only test invitation generator and quick registration testing for the onboarding flow.

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL
- **Drizzle ORM**: Type-safe database toolkit

### Authentication & Security
- **Passport.js**: Authentication middleware
- **Express-session**: Session management
- **bcrypt**: Password hashing
- **Express-rate-limit**: Rate limiting middleware

### UI & Styling
- **Radix UI**: Accessible UI primitives
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Pre-built component library
- **Lucide React**: Icon library

### Development Tools
- **Vite**: Fast build tool
- **TypeScript**: Static type checking
- **ESBuild**: Fast JavaScript bundler
- **PostCSS**: CSS processing

### File Handling
- **Multer**: Multipart form data handling
- **Amazon S3**: Document storage and retrieval
- **DocuSeal**: Forms management system for document signing

### Automation
- **Node-cron**: Scheduled task execution

### State Management
- **TanStack Query**: Server state management
- **React Hook Form**: Form state management
- **Zod**: Runtime type validation

### Email Service
- **AWS SES**: For sending emails