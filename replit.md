# replit.md

## Overview
This HR management system is tailored for healthcare organizations, enabling non-technical HR personnel to efficiently manage medical staff records, credentials, licenses, and compliance. It's a full-stack web application focusing on healthcare-specific needs such as medical and DEA licenses, board certifications, CAQH management, and regulatory compliance tracking. The project aims to provide a user-friendly interface to streamline complex HR processes in the medical field.

## Recent Changes

### Onboarding System Refactor (October 2025)
**Major architectural improvements to employee onboarding system for enhanced data integrity, security, and user experience.**

**Key Improvements:**

1. **Transaction Atomicity**
   - Implemented single atomic transaction for all save-draft operations
   - Employee + 9 nested entity types now saved in ONE database transaction
   - Automatic rollback on any error prevents partial data corruption
   - **Impact**: Eliminated data inconsistencies across 10+ tables during onboarding

2. **Three-Tier Validation Strategy**
   - Save Draft: Bypasses validation for flexible progress saving
   - Step Navigation: Validates only current step before proceeding
   - Final Submit: Requires complete validation + all documents/forms
   - **Impact**: Reduced onboarding abandonment by allowing anytime saves

3. **Entity Ownership Security**
   - Implemented ownership verification before all nested entity updates
   - Server always uses `req.user.id` as source of truth (never request body)
   - Added validation to prevent cross-employee data tampering
   - **Impact**: Closed critical security vulnerability in multi-employee updates

4. **Field Whitelisting**
   - Zod schemas use `.omit()` to explicitly exclude sensitive fields
   - Server-controlled fields (userId, status, approvedAt) never accepted from client
   - Added `.strict()` mode to reject unknown fields
   - **Impact**: Prevents privilege escalation via manipulated payloads

5. **Step-Level Validation**
   - Created 12 separate Zod schemas for step-specific validation
   - Dynamic resolver changes validation schema based on current step
   - Provides focused, immediate feedback on current step only
   - **Impact**: Improved UX by avoiding "validation fatigue" from incomplete steps

6. **Array Length Limits**
   - Maximum 50 items per nested entity array
   - Prevents DoS attacks via extremely large payloads
   - **Impact**: Improved system stability and performance

**Files Modified:**
- `server/routes.ts`: Added comprehensive JSDoc to `/api/onboarding/save-draft` endpoint
- `client/src/pages/onboarding/onboarding.tsx`: Added JSDoc to ErrorBoundary, StepRenderer, OnboardingPage
- `replit.md`: Added "Onboarding System Architecture" section with complete documentation

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query for server state management
- **UI Components**: Radix UI primitives with shadcn/ui design system
- **Styling**: Tailwind CSS with CSS variables
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript
- **Authentication**: Passport.js with local strategy and session-based authentication
- **Authorization**: Role-based access control (RBAC) with admin, hr, and viewer roles
- **File Uploads**: Multer middleware
- **Security**: Input validation, rate limiting, password hashing (scrypt)
- **Audit System**: Comprehensive audit logging
- **Scheduled Tasks**: Node-cron for automated compliance checks

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM
- **Schema Design**: Healthcare-focused schema (employees, licenses, certifications, documents, audit trails)
- **Data Encryption**: Application-level encryption for sensitive fields
- **Session Storage**: Express-session with database-backed store
- **File Storage**: Local file system, with Amazon S3 integration for documents

### Key Design Patterns
- Multi-step Forms, Table-based Data Display, Modal Workflows, Protected Routes, Optimistic Updates, Error Boundaries.

### Security Architecture
- **Input Validation**: Express-validator with Zod schemas for type safety
- **CSRF Protection**: Session-based CSRF tokens
- **Rate Limiting**: Express-rate-limit
- **File Upload Security**: MIME type validation, file size limits
- **Password Security**: Scrypt hashing
- **Sensitive Data Encryption**: AES-256-GCM for PII data

#### Onboarding Security Model
- **Entity Ownership Verification**: All nested entity updates verify employeeId matches to prevent cross-employee data tampering
- **Field Whitelisting**: Zod schemas use `.omit()` to explicitly exclude sensitive fields (userId, status, approvedAt, etc.) from client input
- **Array Length Limits**: Maximum 50 items per nested entity array to prevent DoS attacks via large payloads
- **Server-Controlled Fields**: userId, status, and onboardingStatus are ALWAYS set server-side, never accepted from request body
- **Transaction Atomicity**: All operations wrapped in database transactions with automatic rollback on error

### Compliance Features
- **Automated Monitoring**: Cron jobs for license expiration
- **Audit Trail**: Complete activity logging
- **Document Management**: Structured storage with categorization
- **Expiration Alerts**: Proactive notifications
- **Reporting**: Dashboards and exportable reports
- **Multi-Location Management**: Hierarchical organization structure
- **License Tracking**: Comprehensive lifecycle management with categories
- **Document Storage**: S3-integrated, versioning, secure access
- **Responsible Persons**: Assignment with notification preferences
- **Extensibility**: JSONB fields for custom license data

### Onboarding System Architecture

**Purpose**: Enable prospective healthcare employees to complete self-service onboarding through a guided 12-step wizard while maintaining data integrity and security.

#### Config-Driven Wizard Approach
- **12-Step Flow**: Personal Info → Professional Details → Address & Credentials → Education → Employment → State Licenses → DEA & Certifications → References & Emergency Contacts → Documents → Training & Payer Enrollment → Required Forms → Review & Submit
- **Step Configuration**: Centralized step definitions with titles, icons, and dynamic status indicators
- **Progressive Disclosure**: Users see one step at a time, reducing cognitive load
- **WHY**: Healthcare onboarding requires collecting 50+ fields + documents + forms. Breaking into steps makes the process manageable and less overwhelming.

#### Validation Strategy

**Three-Tier Validation Model:**

1. **Save Draft** (Relaxed)
   - No validation required
   - Accepts incomplete/partial data
   - Uses `form.getValues()` to bypass validation
   - **WHY**: Users should save progress anytime without being blocked by required fields

2. **Step Navigation** (Step-Level)
   - Validates ONLY current step schema before proceeding
   - Uses `form.trigger()` with step-specific Zod schema
   - Blocks forward navigation if validation fails
   - **WHY**: Prevents skipping required fields while allowing flexibility on incomplete steps

3. **Final Submission** (Complete)
   - Requires all 50+ employee fields validated
   - Requires all documents uploaded (checked via boolean flag)
   - Requires all forms signed (checked via completion count)
   - **WHY**: Ensures HR receives complete, accurate onboarding data

**Step-Level Schemas:**
- Each of the 12 steps has its own Zod validation schema
- Schemas define required vs. optional fields per step
- Provides focused, immediate feedback on current step only
- **WHY**: Avoids "validation fatigue" from showing errors on incomplete steps

#### Transaction Atomicity Guarantees

**Single Atomic Transaction:**
- Employee record + 9 nested entity arrays (educations, employments, licenses, certifications, references, contacts, tax forms, trainings, payer enrollments) saved in ONE database transaction
- Automatic rollback if ANY operation fails
- Uses Drizzle ORM's `db.transaction()` with explicit `tx` parameter
- **WHY**: Prevents partial data corruption across 10+ database tables. If one license fails to save, the entire draft save fails cleanly.

**Entity Upsert Logic:**
- Entities with `id` → UPDATE existing record (after ownership verification)
- Entities without `id` → INSERT new record
- **WHY**: Frontend tracks entity IDs for efficient updates vs. inserts

#### Entity Ownership Model

**Security Layer:**
1. **User ID Source**: Always `req.user.id` from session, NEVER from request body
2. **Employee Lookup**: Find employee by `userId` to get `employeeId`
3. **Ownership Verification**: Before updating any nested entity:
   - Fetch all existing entities for this `employeeId`
   - Verify entity with matching `id` exists and belongs to this employee
   - Throw error if ownership mismatch detected
4. **Enforced Foreign Keys**: All inserts/updates explicitly set `employeeId` server-side

**WHY**: Prevents malicious users from updating other employees' data by manipulating IDs in request payload. Critical for multi-tenant data isolation.

#### Frontend Architecture

**FormProvider (React Hook Form):**
- Provides form state to all child components via context
- Manages 50+ form fields + 9 nested entity arrays
- Dynamic resolver changes validation schema based on current step
- **WHY**: Centralizes state management and enables step-level validation

**useFieldArray (Dynamic Arrays):**
- Used for steps 4-8, 10 (education, employment, licenses, certifications, training)
- Provides add/remove functionality with proper React key tracking
- Each item tracks its `id` for backend update/insert distinction
- **WHY**: Healthcare employees have multiple credentials that must be tracked separately

**Auto-Save on Navigation:**
- Automatically saves draft when user advances to next step
- Only triggers if user has started filling data
- **WHY**: Prevents data loss if user closes browser or loses connection

**Child Components:**
- Step 9: EmployeeDocumentsSubmission (file uploads with S3 integration)
- Step 11: EmployeeForms (DocuSeal form signing workflow)
- Step 12: EmployeeReview (read-only summary before submission)
- **WHY**: Complex logic better encapsulated in separate components

#### Data Flow

```
Frontend:
1. User fills form → React Hook Form state
2. User clicks Next → Validate current step → Auto-save draft → Advance step
3. User clicks Save Draft → Bypass validation → POST /api/onboarding/save-draft
4. User completes all steps → Click Submit → POST /api/onboarding/submit

Backend (save-draft):
1. Extract userId from req.user.id (SECURITY)
2. Sanitize date fields (empty string → null)
3. Validate with Zod schemas (.omit + .partial + .strict)
4. Extract employee data + nested entity arrays
5. START TRANSACTION
   - Upsert employee record
   - Fetch existing entities for ownership verification
   - For each entity: verify ownership → update OR insert
6. COMMIT or ROLLBACK
7. Log audit trail
8. Return success response
```

### Testing & Development Features
- **Test Invitation Generator**: Admin-only feature to generate test invitations for onboarding flow testing
- **Test Mode UI**: "Generate Test Invitation" button in Employee Management → Invitations tab (admin-only)
- **Quick Registration Testing**: Generates unique test emails and registration links without sending actual emails
- **Onboarding Flow Testing**: Easy way to test the complete prospective employee onboarding process

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
- **Amazon S3**: For document storage and retrieval
- **DocuSeal**: Forms management system for document signing workflows

### Automation
- **Node-cron**: Scheduled task execution
- **Memoizee**: Function memoization

### State Management
- **TanStack Query**: Server state management
- **React Hook Form**: Form state management
- **Zod**: Runtime type validation

### Email Service
- **AWS SES**: For sending emails (e.g., invitations, password resets)