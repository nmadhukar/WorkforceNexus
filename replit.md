# replit.md

## Overview
This HR management system is tailored for healthcare organizations, enabling non-technical HR personnel to efficiently manage medical staff records, credentials, licenses, and compliance. It's a full-stack web application focusing on healthcare-specific needs such as medical and DEA licenses, board certifications, CAQH management, and regulatory compliance tracking. The project aims to provide a user-friendly interface to streamline complex HR processes in the medical field.

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
- **Input Validation**: Express-validator
- **CSRF Protection**: Session-based CSRF tokens
- **Rate Limiting**: Express-rate-limit
- **File Upload Security**: MIME type validation, file size limits
- **Password Security**: Scrypt hashing
- **Sensitive Data Encryption**: AES-256-GCM for PII data

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