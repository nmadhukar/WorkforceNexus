/**
 * Test data factories for creating consistent test data across UI tests
 * @description Provides factory methods for generating test data for employees, users, documents, etc.
 */

export class TestDataFactory {
  private static counter = 0;

  /**
   * Get unique counter for generating unique test data
   */
  private static getUniqueId(): number {
    return ++this.counter;
  }

  /**
   * Generate test employee data
   * @param overrides - Optional overrides for specific fields
   */
  static createEmployee(overrides?: Partial<EmployeeTestData>): EmployeeTestData {
    const id = this.getUniqueId();
    
    return {
      // Personal Information
      firstName: `TestFirst${id}`,
      middleName: `TestMiddle${id}`,
      lastName: `TestLast${id}`,
      dateOfBirth: '1990-01-15',
      ssn: `123-45-${6780 + id}`,
      phone: `555-0${100 + id}`,
      email: `test.employee${id}@example.com`,
      address: `${id} Test Street`,
      city: 'Test City',
      state: 'NY',
      zipCode: `1000${id}`,
      
      // Professional Information
      employeeId: `EMP${id.toString().padStart(4, '0')}`,
      position: 'Test Physician',
      department: 'Emergency Medicine',
      location: 'Main Hospital',
      hireDate: '2023-01-01',
      salary: '150000',
      status: 'active' as const,
      
      ...overrides
    };
  }

  /**
   * Generate test user data
   * @param role - User role
   * @param overrides - Optional overrides
   */
  static createUser(role: 'admin' | 'hr' | 'viewer', overrides?: Partial<UserTestData>): UserTestData {
    const id = this.getUniqueId();
    
    return {
      username: `test${role}${id}`,
      password: 'test123!',
      confirmPassword: 'test123!',
      role,
      email: `test.${role}${id}@example.com`,
      ...overrides
    };
  }

  /**
   * Generate test invitation data
   * @param overrides - Optional overrides
   */
  static createInvitation(overrides?: Partial<InvitationTestData>): InvitationTestData {
    const id = this.getUniqueId();
    
    return {
      email: `test.invite${id}@example.com`,
      firstName: `InviteFirst${id}`,
      lastName: `InviteLast${id}`,
      position: 'Test Nurse',
      department: 'Internal Medicine',
      ...overrides
    };
  }

  /**
   * Generate test document data
   * @param overrides - Optional overrides
   */
  static createDocument(overrides?: Partial<DocumentTestData>): DocumentTestData {
    const id = this.getUniqueId();
    
    return {
      name: `Test Document ${id}`,
      category: 'Other',
      description: `Test document description ${id}`,
      filePath: 'tests/ui/fixtures/test-document.pdf',
      employeeId: undefined, // Will be set based on test context
      ...overrides
    };
  }

  /**
   * Generate test API key data
   * @param overrides - Optional overrides
   */
  static createApiKey(overrides?: Partial<ApiKeyTestData>): ApiKeyTestData {
    const id = this.getUniqueId();
    
    return {
      name: `Test API Key ${id}`,
      value: `test-api-key-${id}-${Date.now()}`,
      service: 'custom',
      ...overrides
    };
  }

  /**
   * Generate test settings data
   */
  static createSettingsData(): SettingsTestData {
    const id = this.getUniqueId();
    
    return {
      s3: {
        bucket: `test-bucket-${id}`,
        region: 'us-east-1',
        accessKey: `AKIA${id}TESTKEY`,
        secretKey: `test-secret-key-${id}`,
      },
      ses: {
        region: 'us-east-1',
        accessKey: `AKIA${id}SESKEY`,
        secretKey: `ses-secret-key-${id}`,
        fromEmail: `test${id}@example.com`,
      },
      docuseal: {
        apiKey: `ds-api-key-${id}`,
        webhookUrl: `https://example.com/webhook/${id}`,
      }
    };
  }

  /**
   * Generate multiple employees for bulk testing
   * @param count - Number of employees to generate
   * @param baseData - Base data to use for all employees
   */
  static createMultipleEmployees(count: number, baseData?: Partial<EmployeeTestData>): EmployeeTestData[] {
    return Array.from({ length: count }, () => this.createEmployee(baseData));
  }

  /**
   * Generate test data for different departments
   */
  static createEmployeeByDepartment(department: string): EmployeeTestData {
    const positions = {
      'Emergency Medicine': 'Emergency Physician',
      'Internal Medicine': 'Internist',
      'Pediatrics': 'Pediatrician',
      'Surgery': 'Surgeon',
      'Cardiology': 'Cardiologist',
      'Nursing': 'Registered Nurse',
    };

    return this.createEmployee({
      department,
      position: positions[department as keyof typeof positions] || 'General Practitioner'
    });
  }

  /**
   * Generate realistic test files for document upload testing
   */
  static getTestFiles(): TestFileData[] {
    return [
      {
        path: 'tests/ui/fixtures/test-document.pdf',
        name: 'test-document.pdf',
        type: 'application/pdf',
        shouldSucceed: true,
        category: 'License'
      },
      {
        path: 'tests/ui/fixtures/test-image.jpg',
        name: 'test-image.jpg',
        type: 'image/jpeg',
        shouldSucceed: true,
        category: 'ID Card'
      },
      {
        path: 'tests/ui/fixtures/test-doc.docx',
        name: 'test-doc.docx',
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        shouldSucceed: true,
        category: 'Certificate'
      },
      {
        path: 'tests/ui/fixtures/test-large.zip',
        name: 'test-large.zip',
        type: 'application/zip',
        shouldSucceed: false, // Assuming large files are rejected
        category: 'Other'
      }
    ];
  }

  /**
   * Reset counter for consistent test data across test runs
   */
  static resetCounter(): void {
    this.counter = 0;
  }

  /**
   * Generate test data based on specific scenario
   */
  static createScenarioData(scenario: TestScenario): ScenarioTestData {
    switch (scenario) {
      case 'employee-onboarding':
        return {
          invitation: this.createInvitation(),
          user: this.createUser('viewer'),
          employee: this.createEmployee({ status: 'active' }),
          documents: [
            this.createDocument({ category: 'License', name: 'Medical License' }),
            this.createDocument({ category: 'Certificate', name: 'Board Certification' })
          ]
        };
      
      case 'bulk-employee-import':
        return {
          employees: this.createMultipleEmployees(10),
          documents: this.getTestFiles().slice(0, 2).map(file => ({
            name: file.name,
            category: file.category,
            filePath: file.path,
            description: `Test document from ${file.name}`
          }))
        };
      
      case 'settings-configuration':
        return {
          user: this.createUser('admin'),
          settings: this.createSettingsData(),
          apiKeys: [
            this.createApiKey({ service: 's3' }),
            this.createApiKey({ service: 'ses' })
          ]
        };
      
      default:
        throw new Error(`Unknown scenario: ${scenario}`);
    }
  }
}

// Type definitions for test data
export interface EmployeeTestData {
  // Personal Information
  firstName: string;
  middleName?: string;
  lastName: string;
  dateOfBirth: string;
  ssn: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  
  // Professional Information
  employeeId: string;
  position: string;
  department: string;
  location: string;
  hireDate: string;
  salary: string;
  status: 'active' | 'inactive' | 'on_leave';
}

export interface UserTestData {
  username: string;
  password: string;
  confirmPassword?: string;
  role: 'admin' | 'hr' | 'viewer';
  email?: string;
}

export interface InvitationTestData {
  email: string;
  firstName: string;
  lastName: string;
  position: string;
  department: string;
}

export interface DocumentTestData {
  name: string;
  category: string;
  description?: string;
  filePath: string;
  employeeId?: string;
}

export interface ApiKeyTestData {
  name: string;
  value: string;
  service: 'openai' | 's3' | 'ses' | 'docuseal' | 'custom';
}

export interface SettingsTestData {
  s3: {
    bucket: string;
    region: string;
    accessKey: string;
    secretKey: string;
  };
  ses: {
    region: string;
    accessKey: string;
    secretKey: string;
    fromEmail: string;
  };
  docuseal: {
    apiKey: string;
    webhookUrl: string;
  };
}

export interface TestFileData {
  path: string;
  name: string;
  type: string;
  shouldSucceed: boolean;
  category: string;
}

export type TestScenario = 'employee-onboarding' | 'bulk-employee-import' | 'settings-configuration';

export interface ScenarioTestData {
  invitation?: InvitationTestData;
  user?: UserTestData;
  employee?: EmployeeTestData;
  employees?: EmployeeTestData[];
  documents?: DocumentTestData[];
  settings?: SettingsTestData;
  apiKeys?: ApiKeyTestData[];
}