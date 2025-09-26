# Code Coverage Configuration

## Overview
Vitest has been configured with comprehensive code coverage tracking using V8 coverage provider with 85% thresholds for all metrics.

## Configuration Details

### Coverage Provider
- **Provider**: V8 (built-in Node.js coverage)
- **Location**: `vitest.config.ts`
- **Reports Directory**: `test-results/coverage/`

### Coverage Thresholds
All coverage metrics are set to **85%** minimum:
- Branches: 85%
- Functions: 85%
- Lines: 85%
- Statements: 85%

### Report Formats
The following coverage report formats are generated:
- **Text**: Console output showing coverage summary
- **HTML**: Interactive web-based coverage report at `test-results/coverage/index.html`
- **LCOV**: Detailed coverage data at `test-results/coverage/lcov.info` (for CI/CD integration)
- **JSON**: Machine-readable format at `test-results/coverage/coverage-final.json`

### Files Included in Coverage
- `server/**/*.ts` - All server-side TypeScript files
- `server/services/**/*.ts` - Service layer implementations
- `server/middleware/**/*.ts` - Express middleware
- `client/src/**/*.{ts,tsx}` - All client-side TypeScript/React files
- `shared/**/*.ts` - Shared schemas and types

### Files Excluded from Coverage
- Test files (`**/*.test.ts`, `**/*.spec.ts`)
- Configuration files (`**/*.config.ts`, `**/*.config.js`)
- Build outputs (`dist/**`, `coverage/**`, `test-results/**`)
- UI component library (`client/src/components/ui/**`)
- Type definitions (`**/*.d.ts`)
- Entry points (`index.ts`, `main.tsx`)
- Vite/database configs (`server/vite.ts`, `server/db.ts`)

## Running Coverage Tests

### Using the Coverage Script
```bash
# Run tests with coverage
./run-coverage.sh

# Or directly with npx
npx vitest run --coverage
```

### Viewing Coverage Reports

#### HTML Report (Recommended)
Open `test-results/coverage/index.html` in your browser for an interactive coverage report with:
- File-by-file coverage breakdown
- Line-by-line coverage highlighting
- Sortable metrics tables
- Coverage trends

#### Console Output
The text reporter shows a summary table in the console after test runs.

## Key Coverage Areas

### Employee Onboarding
- Routes: `server/routes.ts` - Employee creation and update endpoints
- Storage: `server/storage.ts` - Employee data persistence
- Services: `server/services/*.ts` - Background processing and validations

### Document Upload
- S3 Service: `server/services/s3Service.ts` - File upload to AWS S3
- File Handling: Document processing and validation logic
- Routes: Document upload endpoints in `server/routes.ts`

### HR Approval Workflows  
- Approval Logic: Employee status transitions and approval chains
- Role Transitions: Permission-based state changes
- Audit Trail: Activity logging and compliance tracking

## Interpreting Coverage Results

### Coverage Metrics
- **Statements**: Individual lines of executable code
- **Branches**: Decision points (if/else, switch cases, ternary operators)
- **Functions**: Function and method definitions
- **Lines**: Source lines containing executable code

### Watermarks
The HTML reporter uses color coding:
- 🔴 Red: Below 85% (failing threshold)
- 🟡 Yellow: 85-95% (meeting threshold)
- 🟢 Green: Above 95% (excellent coverage)

## Continuous Integration
The LCOV format output (`test-results/coverage/lcov.info`) can be integrated with:
- GitHub Actions coverage reporting
- SonarQube analysis
- Code coverage badges
- Pull request coverage checks

## Tips for Improving Coverage

1. **Focus on Critical Paths**: Prioritize testing business-critical functionality
2. **Test Edge Cases**: Include boundary conditions and error scenarios
3. **Mock External Dependencies**: Use mocks for S3, database, and email services
4. **Test Both Success and Failure**: Cover happy paths and error handling
5. **Review Uncovered Lines**: Use the HTML report to identify gaps

## Troubleshooting

### Coverage Not Generated
- Ensure tests are actually running: `npx vitest run`
- Check that `@vitest/coverage-v8` is installed
- Verify no syntax errors in `vitest.config.ts`

### Thresholds Failing
- Review the HTML report to identify uncovered code
- Add tests for missing branches and functions
- Consider if some files should be excluded from coverage

### Performance Issues
- Coverage collection adds overhead; use `--no-coverage` for faster development tests
- The `all: true` flag includes all source files, which may slow initial runs