# HR Management System - Developer Guide

## Table of Contents
- [Overview](#overview)
- [System Requirements](#system-requirements)
- [Project Setup](#project-setup)
- [Architecture Overview](#architecture-overview)
- [Database Schema](#database-schema)
- [Development Workflow](#development-workflow)
- [Code Structure](#code-structure)
- [Testing Guidelines](#testing-guidelines)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [Healthcare Compliance](#healthcare-compliance)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)

## Overview

The HR Management System is a comprehensive web application designed specifically for healthcare organizations to manage medical staff information, credentials, and regulatory compliance. Built with modern technologies and designed with healthcare privacy in mind, it provides a secure, scalable solution for HR departments in hospitals and medical facilities.

### Technology Stack

**Frontend:**
- React 18 with TypeScript
- Vite for build tooling
- TanStack Query for data fetching
- React Hook Form for form management
- Tailwind CSS + shadcn/ui for styling
- Wouter for routing

**Backend:**
- Node.js with Express
- TypeScript
- Drizzle ORM
- PostgreSQL (Neon serverless)
- Passport.js for authentication
- Express Validator for request validation (using express-validator middleware)

**Infrastructure:**
- Replit for hosting
- Neon for serverless PostgreSQL
- Session-based authentication
- File storage for documents

## System Requirements

- Node.js 18+ 
- PostgreSQL 14+
- npm or yarn package manager
- 2GB RAM minimum
- 10GB storage for documents

## Project Setup

### 1. Clone the Repository

```bash
git clone [repository-url]
cd hr-management-system
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

The application uses PostgreSQL with Drizzle ORM. Database migrations are handled automatically.

```bash
# Push schema to database
npm run db:push

# If you encounter data-loss warnings
npm run db:push --force
```

### 4. Environment Configuration

Create a `.env` file in the root directory:

```env
# Database
DATABASE_URL=postgresql://username:password@host:port/database?sslmode=require

# Session
SESSION_SECRET=your-secret-key-min-32-chars

# File Upload
MAX_FILE_SIZE=10485760  # 10MB in bytes
UPLOAD_DIR=./server/uploads

# Optional: Email Configuration (for notifications)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASSWORD=your-email-password
```

### 5. Start Development Server

```bash
npm run dev
```

This starts both the Express backend (port 5000) and Vite frontend dev server.

Access the application at: `http://localhost:5000`

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Client Browser                      │
│                  (React + TypeScript)                 │
└────────────────────┬────────────────────────────────┘
                     │ HTTP/HTTPS
┌────────────────────▼────────────────────────────────┐
│                 Express Server                        │
│              (API Routes + Middleware)                │
├──────────────────────────────────────────────────────┤
│   Authentication  │  Validation  │  Audit Logging    │
├──────────────────────────────────────────────────────┤
│              Storage Interface Layer                  │
│                 (Drizzle ORM)                        │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│              PostgreSQL Database                      │
│                    (Neon)                            │
└──────────────────────────────────────────────────────┘
```

### Key Design Patterns

1. **Repository Pattern**: Storage interface abstracts database operations
2. **Middleware Pipeline**: Request validation, authentication, and auditing
3. **Type Safety**: Shared TypeScript types between frontend and backend
4. **Session Management**: PostgreSQL-backed session store
5. **Audit Trail**: Comprehensive logging for compliance

## Database Schema

### Core Tables

#### Users Table
Manages authentication and authorization.

```sql
users
├── id (PK)
├── username (unique)
├── password_hash
├── role (admin|hr|viewer)
└── created_at
```

#### Employees Table
Central entity storing comprehensive employee profiles.

```sql
employees
├── id (PK)
├── Personal Information
│   ├── first_name, middle_name, last_name
│   ├── date_of_birth, ssn (encrypted)
│   └── gender, birth_city, birth_state
├── Contact Information
│   ├── personal_email, work_email
│   ├── cell_phone, work_phone
│   └── home_address, city, state, zip
├── Professional Information
│   ├── job_title, qualification
│   ├── work_location, department
│   └── npi_number, medicaid_number
├── Regulatory/Compliance
│   ├── dea_number
│   ├── caqh_provider_id
│   └── medicare_ptan_number
└── Timestamps
    ├── created_at
    └── updated_at
```

#### Related Entity Tables

Each employee can have multiple records in these tables:

- **educations**: Medical school, residency, fellowships
- **employments**: Work history
- **state_licenses**: State medical licenses  
- **dea_licenses**: DEA registrations for controlled substances
- **board_certifications**: Board certifications
- **peer_references**: Professional references
- **emergency_contacts**: Emergency contact information
- **tax_forms**: W-4, I-9, tax documentation
- **trainings**: Continuing education and training
- **payer_enrollments**: Insurance payer enrollments
- **incident_logs**: Compliance and incident tracking
- **documents**: Uploaded files and documents

#### Audits Table
Tracks all data modifications for compliance.

```sql
audits
├── id (PK)
├── table_name
├── record_id
├── action (INSERT|UPDATE|DELETE)
├── changed_by (FK -> users)
├── changed_at
├── old_data (JSONB)
└── new_data (JSONB)
```

### Database Relationships

```
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
                └── (N) documents
```

## Development Workflow

### 1. Feature Development Process

```bash
# 1. Create feature branch
git checkout -b feature/your-feature-name

# 2. Make changes and test locally
npm run dev

# 3. Run type checking
npm run type-check

# 4. Run linting
npm run lint

# 5. Commit changes
git add .
git commit -m "feat: description of feature"

# 6. Push and create PR
git push origin feature/your-feature-name
```

### 2. Commit Message Convention

Follow conventional commits format:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test additions or changes
- `chore:` Build process or auxiliary tool changes

### 3. Code Review Checklist

- [ ] Type safety maintained
- [ ] Validation rules appropriate
- [ ] Audit logging implemented
- [ ] Error handling comprehensive
- [ ] Security considerations addressed
- [ ] Documentation updated
- [ ] Tests written/updated

## Code Structure

```
hr-management-system/
├── client/                    # Frontend application
│   ├── src/
│   │   ├── components/       # Reusable React components
│   │   │   ├── entity-managers/  # CRUD managers for entities
│   │   │   ├── forms/           # Form components
│   │   │   ├── layout/          # Layout components
│   │   │   ├── tables/          # Table components
│   │   │   └── ui/              # shadcn/ui components
│   │   ├── hooks/            # Custom React hooks
│   │   ├── lib/              # Utilities and helpers
│   │   ├── pages/            # Route components
│   │   └── main.tsx          # Application entry point
│   └── index.html
├── server/                    # Backend application
│   ├── middleware/           # Express middleware
│   │   ├── audit.ts         # Audit logging
│   │   ├── encryption.ts    # Data encryption
│   │   └── validation.ts    # Input validation
│   ├── services/            # Business logic services
│   ├── uploads/             # Document storage
│   ├── auth.ts              # Authentication setup
│   ├── db.ts                # Database connection
│   ├── index.ts             # Server entry point
│   ├── routes.ts            # API route definitions
│   ├── storage.ts           # Storage interface
│   └── vite.ts              # Vite integration
├── shared/                   # Shared code
│   └── schema.ts            # Database schema & types
├── docs/                     # Documentation
│   ├── API.md               # API documentation
│   └── DEVELOPER.md         # This file
└── package.json             # Dependencies & scripts
```

### Key Files Explained

- **shared/schema.ts**: Single source of truth for database schema and TypeScript types
- **server/storage.ts**: Database abstraction layer implementing repository pattern
- **server/routes.ts**: All API endpoint definitions
- **client/src/lib/queryClient.ts**: TanStack Query configuration
- **client/src/hooks/use-auth.tsx**: Authentication context and hooks

## Testing Guidelines

### Unit Testing

```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:coverage
```

### Integration Testing

Test API endpoints with authentication:

```javascript
// Example test structure
describe('Employee API', () => {
  it('should create employee with valid data', async () => {
    const response = await request(app)
      .post('/api/employees')
      .set('Cookie', authCookie)
      .send(validEmployeeData);
    
    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('id');
  });
});
```

### E2E Testing

Use Playwright or Cypress for end-to-end testing:

```bash
# Run E2E tests
npm run test:e2e
```

### Testing Checklist

- [ ] Unit tests for utility functions
- [ ] Integration tests for API endpoints
- [ ] Validation middleware tests
- [ ] Authentication flow tests
- [ ] File upload tests
- [ ] Database transaction tests
- [ ] Error handling tests

## Deployment

### Production Build

```bash
# Build frontend and backend
npm run build

# Start production server
npm run start
```

### Deployment on Replit

1. **Environment Variables**: Set in Replit Secrets
2. **Database**: Provision Neon PostgreSQL
3. **File Storage**: Configure persistent storage
4. **Domain**: Set up custom domain in Replit

### Production Checklist

- [ ] Environment variables configured
- [ ] Database migrations completed
- [ ] SSL/TLS enabled
- [ ] Rate limiting configured
- [ ] Error logging setup
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Security headers configured

### Security Headers

Add these headers in production:

```javascript
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
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `SESSION_SECRET` | Session encryption key (min 32 chars) | `your-very-long-secret-key-here` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `5000` |
| `NODE_ENV` | Environment | `development` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `10485760` (10MB) |
| `SESSION_MAX_AGE` | Session duration in ms | `86400000` (24 hours) |
| `RATE_LIMIT_WINDOW` | Rate limit window in ms | `900000` (15 minutes) |
| `RATE_LIMIT_MAX` | Max requests per window | `100` |

### Email Configuration (Optional)

For automated notifications:

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP server hostname |
| `SMTP_PORT` | SMTP server port |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `EMAIL_FROM` | From email address |

## Healthcare Compliance

### Healthcare Privacy Features

1. **Encryption**
   - All PHI encrypted at rest (AES-256)
   - TLS 1.2+ for data in transit
   - Password hashing with scrypt

2. **Access Control**
   - Role-based permissions
   - Session timeout after inactivity
   - Audit trail for all PHI access

3. **Audit Logging**
   - All data modifications logged
   - User access tracked
   - 7-year retention policy

4. **Data Integrity**
   - Input validation on all endpoints
   - Database constraints
   - Transaction support

### Regulatory Features

- **License Tracking**: Automated expiration monitoring
- **Credential Management**: CAQH, DEA, NPI tracking
- **Document Storage**: Secure file storage with encryption
- **Incident Reporting**: Comprehensive incident logging

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Reset database (development only!)
npm run db:push --force
```

#### Session Issues

```bash
# Clear session store
psql $DATABASE_URL -c "DELETE FROM session"

# Regenerate session secret
openssl rand -base64 32
```

#### File Upload Errors

```bash
# Check upload directory permissions
ls -la server/uploads

# Create if missing
mkdir -p server/uploads
chmod 755 server/uploads
```

#### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Clear build artifacts
rm -rf dist
npm run build
```

### Debug Mode

Enable debug logging:

```javascript
// In server/index.ts
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`, req.body);
    next();
  });
}
```

### Performance Monitoring

```javascript
// Add request timing
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
  });
  next();
});
```

## Contributing

### Getting Started

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Write/update tests
5. Update documentation
6. Submit a pull request

### Code Style Guidelines

- **TypeScript**: Strict mode enabled
- **React**: Functional components with hooks
- **Naming**: 
  - Components: PascalCase
  - Functions: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Files: kebab-case
- **Comments**: JSDoc for functions, inline for complex logic

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No console.logs left
- [ ] Audit logging implemented
```

### Review Process

1. Automated checks (linting, tests)
2. Code review by maintainer
3. Security review for sensitive changes
4. Documentation review
5. Merge to main branch

## Resources

### Documentation
- [React Documentation](https://react.dev)
- [Express Documentation](https://expressjs.com)
- [Drizzle ORM Documentation](https://orm.drizzle.team)
- [PostgreSQL Documentation](https://www.postgresql.org/docs)

### Healthcare Standards
- [HIPAA Compliance Guide](https://www.hhs.gov/hipaa)
- [NPI Registry](https://npiregistry.cms.hhs.gov)
- [DEA Registration](https://www.deadiversion.usdoj.gov)
- [CAQH ProView](https://www.caqh.org/solutions/caqh-proview)

### Support
- GitHub Issues for bug reports
- Discussions for questions
- Email: support@example.com

## License

Copyright (c) 2024 Healthcare HR Management System

This is proprietary software designed for healthcare organizations.
Unauthorized copying or distribution is prohibited.