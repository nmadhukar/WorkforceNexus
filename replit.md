# replit.md

## Overview
This HR management system is designed for healthcare organizations to manage medical staff records, credentials, licenses, and compliance. It's a full-stack web application focused on healthcare-specific needs like medical and DEA licenses, board certifications, CAQH management, and regulatory compliance tracking. The project aims to provide a user-friendly interface to streamline complex HR processes in the medical field, addressing specific challenges such as managing 50+ data fields, documents, and forms required for healthcare onboarding.

## Recent Changes

### Complete S3 Document Storage Implementation (October 23, 2025)
**Implemented production-ready S3 document storage system with comprehensive frontend/backend integration.**

**Backend Changes:**
1. **Enhanced S3Service** (`server/services/s3Service.ts`):
   - Added key generation methods for all document types (employee, compliance, onboarding, facility)
   - Hierarchical S3 key structure: `employees/{id}/documents/{type}/{timestamp}-{slug}`
   - Batch operations: `uploadFiles()`, `deleteFiles()`, `listDocumentsByEmployee()`, `listDocumentsByLocation()`
   - Presigned URL generation with configurable expiry (default 1 hour)
   - Retry logic with exponential backoff (max 3 retries)
   - Configuration methods: `reconfigure()`, `testConnection()`, `getBucketInfo()`
   - Advanced filename slugification with Unicode support

2. **S3 Migration Service** (`server/services/migration/s3MigrationService.ts`):
   - Bulk migration tool for moving local documents to S3
   - Methods: `migrateEmployeeDocuments()`, `migrateComplianceDocuments()`, `migrateAllDocuments()`
   - Progress tracking with console logging and statistics
   - Error handling and resumability (skips already-migrated documents)
   - Dry-run mode and validation options
   - Rollback capability via `rollbackDocument()`
   - Batch processing (default 15 files per batch)

3. **API Endpoints** (`server/routes.ts`):
   - 26 new S3 management endpoints
   - Configuration: GET/POST `/api/admin/s3/config`, POST `/api/admin/s3/test`
   - Migration: POST `/api/admin/s3/migration/{employee|compliance|onboarding|all}`
   - Documents: GET `/api/documents/employee/:id`, GET `/api/documents/compliance/:id`
   - Downloads: GET `/api/documents/:id/presigned-url`, GET `/api/documents/:id/download`
   - Management: DELETE `/api/documents/:id`, GET `/api/documents/batch/download`
   - All endpoints with authentication, authorization, and input validation

**Frontend Changes:**
1. **useDocuments Hook** (`client/src/hooks/useDocuments.ts`):
   - React Query hook for document management
   - Functions: `upload`, `deleteDoc`, `download`, `getPresignedUrl`
   - Automatic cache invalidation after mutations
   - Download fallback: tries presigned URL first, falls back to direct download

2. **DocumentUploader Component** (`client/src/components/documents/DocumentUploader.tsx`):
   - Drag-and-drop file upload with visual feedback
   - Multiple file selection with preview thumbnails
   - Document type selector and notes field
   - Per-file upload progress tracking
   - Client-side validation (file type and size)
   - Complete data-testid coverage for testing

3. **DocumentList Component** (`client/src/components/documents/DocumentList.tsx`):
   - Responsive table with striped rows
   - File type icons and color-coded badges
   - Search and filter by document type
   - Sort by name, type, date, or size
   - Download via presigned URLs with fallback
   - Delete with confirmation dialog
   - Empty state and loading skeletons

4. **Page Integrations**:
   - Added "Documents" tab to employee profile (`client/src/pages/employees/employee-profile.tsx`)
   - Added compliance documents section to compliance dashboard (`client/src/pages/compliance/compliance-dashboard.tsx`)
   - S3 configuration already exists in Settings page (no changes needed)

**Bug Fixes:**
- Fixed `useDocuments` endpoint URL from `/api/employees/:id/documents` to `/api/documents/employee/:id`
- Fixed route validation: changed `:employeeId` to `:id` to match `validateId()` middleware
- Added null check for `mimeType` in `getFileIcon()` to prevent runtime errors

**Files Modified:**
- `server/services/s3Service.ts` (enhanced with 15+ new methods)
- `server/services/migration/s3MigrationService.ts` (new file, 718 lines)
- `server/routes.ts` (added 26 S3 endpoints)
- `client/src/hooks/useDocuments.ts` (new file, 286 lines)
- `client/src/components/documents/DocumentUploader.tsx` (new file, 439 lines)
- `client/src/components/documents/DocumentList.tsx` (new file, 435 lines)
- `client/src/pages/employees/employee-profile.tsx` (added Documents tab)
- `client/src/pages/compliance/compliance-dashboard.tsx` (added Compliance Documents section)
- `design_guidelines.md` (new file with BambooHR-inspired design system)

**Benefits:**
- Complete document lifecycle management (upload, download, delete, migrate)
- Scalable S3 storage with automatic fallback to local storage
- Enterprise-grade features: versioning, metadata, tags, batch operations
- Admin tools for configuration and migration
- Reusable frontend components with excellent UX
- Production-ready with comprehensive error handling

### Qualification Fields Converted to Dropdowns (October 12, 2025)
**Converted Substance Use Qualification and Mental Health Qualification from text inputs to dropdown select fields.**

**Changes:**
1. **Substance Use Qualification** - Now a required dropdown with 25 predefined options (LPC, LCDC III, LCDC II, LSW, LMFT, LPN, RN, PSY assistant, CDC-A, C-T, SW-A, SW-T, MFT-T, CPS variants, MD/DO, CNS, CNP, PA, LISW, LIMFT, LPCC, LICDC)
2. **Mental Health Qualification** - Now a required dropdown with 26 predefined options (LPC, LSW, LMFT, LPN, RN, PSY assistant, C-T, SW-A, SW-T, MFT-T, QMHS variants, CMS variants, MD/DO, CNS, CNP, PA, LISW, LIMFT, LPCC)
3. Both fields marked as mandatory with red asterisk (*)
4. Validation schemas updated to require selection

**Files Modified:**
- `client/src/pages/onboarding/onboarding.tsx`: Lines 113-114 (validation), Lines 795-885 (UI dropdowns)
- `client/src/components/forms/employee-credentials.tsx`: Lines 5 (imports), Lines 19-20 (validation), Lines 195-286 (UI dropdowns)

**Benefits:**
- Standardized qualification values across all records
- Improved data consistency and reporting accuracy
- Better user experience with predefined options
- Eliminates typos and inconsistent entries

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