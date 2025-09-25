# replit.md

## Overview

This is a comprehensive HR management system designed specifically for medical staff and healthcare organizations. The application provides a user-friendly interface for non-technical HR personnel to manage employee records, credentials, licenses, documents, and compliance requirements. Built as a full-stack web application using modern technologies, it focuses on healthcare-specific needs like medical licenses, DEA licenses, board certifications, CAQH provider management, and regulatory compliance tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- Enhanced employee profile page with professional enterprise-grade UI/UX design
- Added hero section with gradient backgrounds, large avatar, and quick action buttons
- Implemented breadcrumb navigation for better user orientation
- Created professional information cards with icons and improved typography
- Enhanced entity tabs with icons and smooth animations
- Added print-friendly layout and export functionality
- Improved responsive design for mobile and tablet devices
- Fixed horizontal scrolling issues on employee edit form
- Redesigned 12-step navigation with responsive layouts (horizontal on desktop, vertical on mobile)
- Added progress indicators and step completion tracking
- Improved form header with gradient design and status badges
- Added proper data-testid attributes for automated testing
- Added comprehensive code documentation with JSDoc comments throughout backend and frontend
- Created complete REST API documentation with all 60+ endpoints
- Created developer guide with setup, architecture, and deployment instructions
- Implemented secure API key mechanism for external application integration
- Added key rotation with automatic expiration and 24-hour grace period
- Created API key management UI with permissions system
- Enabled dual authentication (session-based for web, API keys for external apps)
- Integrated Amazon S3 storage for document uploads with automatic fallback to local storage
- Added secure S3 configuration with masked credentials in UI
- Implemented document migration utility from local to S3 storage
- Added presigned URLs for secure S3 document downloads
- Made AWS S3 settings configurable from admin interface only
- Implemented encrypted database storage for S3 credentials
- Added migration path from environment variables to database configuration
- **Integrated DocuSeal Forms Management System**:
  - Added DocuSeal API configuration in Settings (admin-only access)
  - Implemented automatic form template syncing from DocuSeal account
  - Created "Forms" tab in employee profiles for document signing workflows
  - Integrated forms into employee onboarding - required forms automatically sent upon invitation acceptance
  - Added form submission tracking with status indicators (pending, sent, viewed, completed)
  - Enabled template management with onboarding requirement flags
  - Fixed database schema issues for proper DocuSeal table creation
  - Resolved API request format errors throughout the application
- **Comprehensive Onboarding System Bug Fixes** (December 24, 2024):
  - Conducted end-to-end onboarding testing with sample employee creation and full workflow validation
  - Fixed critical API key authentication system that was preventing invitation creation
  - Resolved SES email service decryption failures that blocked invitation email sending
  - Implemented secure API key logging and production encryption key management
  - Fixed fundamental registration design flaw where existing employees couldn't complete onboarding
  - Resolved duplicate employee constraint violations during registration process
  - Fixed DocuSeal API format issues causing form submission failures (422 errors)
  - Enhanced TypeScript error handling and eliminated all compilation diagnostics
  - Added proper employee-user account linking for existing employee onboarding
  - Implemented graceful error handling throughout the invitation and registration workflow
- **Multi-Location Clinic Compliance Tracking System** (December 24, 2024):
  - Added comprehensive compliance management for multi-location healthcare organizations
  - Implemented hierarchical location structure supporting main organization and sub-locations
  - Created 5 new database tables: locations, license_types, responsible_persons, clinic_licenses, compliance_documents
  - Enhanced S3 service with compliance-specific document storage, versioning, and organized folder structure
  - Built 40+ RESTful API endpoints for complete CRUD operations across all compliance entities
  - Developed 5 frontend pages: Locations, Licenses, License Types, Responsible Persons, Compliance Documents
  - Added real-time expiration tracking with 30/60/90 day alerts and color-coded status indicators
  - Implemented document versioning with S3 integration and presigned URL generation
  - Created compliance dashboard with key metrics and export functionality (CSV/JSON)
  - Added responsible person management with primary/backup assignments and permission controls
  - Integrated compliance navigation into sidebar with collapsible submenu
  - Enhanced breadcrumb navigation to include all compliance pages
  - Built drag-and-drop document upload with progress tracking and file type validation
  - Added JSONB fields for extensibility allowing custom license data without schema changes
- **Deployment-Ready Email System with Proper Domain Handling** (September 25, 2025):
  - Fixed invitation link generation to use proper domain instead of localhost
  - Added intelligent base URL detection supporting custom domains, Replit deployments, and development
  - Configured trust proxy for accurate HTTPS detection behind proxies
  - Updated AWS SES credentials with proper permissions for real email sending
  - Successfully tested end-to-end email delivery with production-like functionality
- **Enhanced Security with Default Admin and Invitation-Only Registration** (September 25, 2025):
  - Implemented default admin/admin account creation on first deployment
  - Added forced password change requirement for default credentials
  - Disabled all public registrations - registration now requires invitation token
  - Implemented role-based invitation permissions:
    - Admin users can invite with any role (admin, hr, viewer)
    - HR users can only invite viewers
    - Viewers cannot invite anyone
  - Added intendedRole field to invitations to control registered user roles
  - Created PasswordChangeDialog component for forced password changes
  - Added role selector to invitation dialog with appropriate restrictions
  - Removed public registration tab from auth page except when invitation token present
  - All security features tested and verified working correctly
- **Comprehensive Email System with Password Reset and User Profile Management** (September 25, 2025):
  - Fixed critical production login issue - admin/admin credentials now work immediately after deployment
  - Added comprehensive password reset email functionality with professional HTML/text templates
  - Integrated password reset with AWS SES service for reliable email delivery
  - Created "Forgot Password?" link on login page with full reset workflow
  - Implemented reset password page with token validation and secure password update
  - Added user profile dropdown menu in header with Profile Settings, Change Password, and Logout
  - Created profile settings dialog allowing users to update email addresses
  - Implemented voluntary password change accessible from user dropdown
  - Enhanced error handling for email sending with fallback logging in development
  - Added 24-hour expiration for password reset tokens with clear user messaging
  - Tested and verified all email functionality working in production environment

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript for type safety and component-based development
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Components**: Radix UI primitives with shadcn/ui design system for consistent, accessible components
- **Styling**: Tailwind CSS with CSS variables for theming and responsive design
- **Form Handling**: React Hook Form with Zod validation for robust form management
- **Build Tool**: Vite for fast development and optimized production builds

### Backend Architecture
- **Runtime**: Node.js with Express.js framework for RESTful API endpoints
- **Language**: TypeScript throughout for consistent type safety
- **Authentication**: Passport.js with local strategy and session-based authentication
- **Authorization**: Role-based access control (RBAC) with admin, hr, and viewer roles
- **File Uploads**: Multer middleware for handling document uploads with type validation
- **Security**: Input validation, rate limiting, and password hashing with scrypt
- **Audit System**: Comprehensive audit logging for all data changes and user actions
- **Scheduled Tasks**: Node-cron for automated compliance checks and expiration alerts

### Data Storage
- **Database**: PostgreSQL with Drizzle ORM for type-safe database interactions
- **Schema Design**: Comprehensive healthcare-focused schema including employees, licenses, certifications, documents, and audit trails
- **Data Encryption**: Sensitive fields (SSN, passwords) are encrypted at the application level
- **Session Storage**: Express-session with database-backed session store
- **File Storage**: Local file system with organized directory structure for documents

### Key Design Patterns
- **Multi-step Forms**: Progressive form completion for complex employee onboarding
- **Table-based Data Display**: Paginated, filterable, and searchable data tables
- **Modal Workflows**: Dialog-based interfaces for focused data entry and editing
- **Protected Routes**: Authentication-required pages with automatic redirection
- **Optimistic Updates**: Client-side state updates with server synchronization
- **Error Boundaries**: Graceful error handling and user feedback

### Security Architecture
- **Input Validation**: Express-validator for request validation and sanitization
- **CSRF Protection**: Session-based CSRF tokens
- **Rate Limiting**: Express-rate-limit to prevent abuse
- **File Upload Security**: MIME type validation and file size limits
- **Password Security**: Scrypt hashing with salt for password storage
- **Sensitive Data Encryption**: AES-256-GCM encryption for PII data

### Compliance Features
- **Automated Monitoring**: Cron jobs for license expiration tracking
- **Audit Trail**: Complete activity logging for regulatory compliance
- **Document Management**: Structured document storage with categorization
- **Expiration Alerts**: Proactive notifications for credential renewals
- **Reporting**: Compliance dashboards and exportable reports

### Compliance Tracking Features
- **Multi-Location Management**: Hierarchical organization structure with main clinic and unlimited sub-locations
- **License Tracking**: Comprehensive license lifecycle management with categories (Medical, Pharmacy, Facility, Business)
- **Document Storage**: S3-integrated document management with versioning, categories, and secure access
- **Expiration Monitoring**: Automated tracking with configurable alerts at 30, 60, and 90 days
- **Responsible Persons**: Assignment of primary and backup responsible parties with notification preferences
- **Compliance Dashboard**: Real-time metrics, status summaries, and exportable compliance reports
- **Audit Trail**: Complete activity logging for all compliance-related changes
- **Extensibility**: JSONB fields allow adding custom license data without database migrations

## External Dependencies

### Database Services
- **Neon Database**: Serverless PostgreSQL database with connection pooling
- **Drizzle ORM**: Type-safe database toolkit for schema management and queries

### Authentication & Security
- **Passport.js**: Authentication middleware with local strategy support
- **Express-session**: Session management with database persistence
- **bcrypt**: Password hashing for user credentials
- **Express-rate-limit**: Rate limiting middleware for API protection

### UI & Styling
- **Radix UI**: Accessible, unstyled UI primitives for complex components
- **Tailwind CSS**: Utility-first CSS framework for rapid styling
- **shadcn/ui**: Pre-built component library with consistent design system
- **Lucide React**: Icon library for consistent iconography

### Development Tools
- **Vite**: Fast build tool with HMR for development
- **TypeScript**: Static type checking across frontend and backend
- **ESBuild**: Fast JavaScript bundler for production builds
- **PostCSS**: CSS processing with Tailwind and Autoprefixer

### File Handling
- **Multer**: Multipart form data handling for file uploads
- **MIME Type Detection**: File type validation for security

### Automation
- **Node-cron**: Scheduled task execution for compliance monitoring
- **Memoizee**: Function memoization for performance optimization

### State Management
- **TanStack Query**: Server state management with caching and synchronization
- **React Hook Form**: Form state management with validation
- **Zod**: Runtime type validation and schema definition