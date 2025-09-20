# replit.md

## Overview

This is a comprehensive HR management system designed specifically for medical staff and healthcare organizations. The application provides a user-friendly interface for non-technical HR personnel to manage employee records, credentials, licenses, documents, and compliance requirements. Built as a full-stack web application using modern technologies, it focuses on healthcare-specific needs like medical licenses, DEA licenses, board certifications, CAQH provider management, and regulatory compliance tracking.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (December 20, 2024)

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