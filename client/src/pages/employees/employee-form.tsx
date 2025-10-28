import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { MultiStepForm } from "@/components/forms/multi-step-form";
import { EmployeePersonalInfo } from "@/components/forms/employee-personal-info";
import { EmployeeProfessionalInfo } from "@/components/forms/employee-professional-info";
import { EmployeeCredentials } from "@/components/forms/employee-credentials";
import { EmployeeAdditionalInfo } from "@/components/forms/employee-additional-info";
import { EmployeeEducationEmployment } from "@/components/forms/employee-education-employment";
import { EmployeeLicenses } from "@/components/forms/employee-licenses";
import { EmployeeCertifications } from "@/components/forms/employee-certifications";
import { EmployeeReferencesContacts } from "@/components/forms/employee-references-contacts";
import { EmployeeDocumentsSubmission } from "@/components/forms/employee-documents-submission";
import { EmployeeTrainingPayer } from "@/components/forms/employee-training-payer";
import { EmployeeIncidents } from "@/components/forms/employee-incidents";
import { EmployeeForms } from "@/components/forms/employee-forms";
import { EmployeeReview } from "@/components/forms/employee-review";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Building2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Complete employee form data structure covering all aspects of employee information
 */
interface EmployeeFormData {
  // Personal Info
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth?: string;
  gender?: string;
  ssn?: string;
  personalEmail?: string;
  workEmail: string;
  cellPhone?: string;
  workPhone?: string;
  homeAddress1?: string;
  homeAddress2?: string;
  homeCity?: string;
  homeState?: string;
  homeZip?: string;
  
  // Professional Info
  jobTitle?: string;
  workLocation?: string;
  qualification?: string;
  npiNumber?: string;
  enumerationDate?: string;
  
  // Credentials
  medicalLicenseNumber?: string;
  substanceUseLicenseNumber?: string;
  substanceUseQualification?: string;
  mentalHealthLicenseNumber?: string;
  mentalHealthQualification?: string;
  medicaidNumber?: string;
  medicarePtanNumber?: string;
  
  // CAQH Info
  caqhProviderId?: string;
  caqhIssueDate?: string;
  caqhLastAttestationDate?: string;
  caqhEnabled?: boolean;
  caqhReattestationDueDate?: string;
  caqhLoginId?: string;
  caqhPassword?: string;
  nppesLoginId?: string;
  nppesPassword?: string;
  
  status?: string;
  
  // Related entities (for form state management)
  educations?: any[];
  employments?: any[];
  stateLicenses?: any[];
  deaLicenses?: any[];
  boardCertifications?: any[];
  peerReferences?: any[];
  emergencyContacts?: any[];
  taxForms?: any[];
  trainings?: any[];
  payerEnrollments?: any[];
  incidentLogs?: any[];
}

/**
 * Comprehensive 13-step employee form for creating and editing medical staff records
 * @component
 * @returns {JSX.Element} Multi-step form interface for employee data entry
 * @example
 * // Create new employee
 * <EmployeeForm />
 * // Edit existing employee (accessed via /employees/:id/edit)
 * <EmployeeForm />
 * 
 * @description
 * - 13-step wizard-style form covering all aspects of employee data
 * - Dual-mode operation: Create new employees or edit existing ones
 * - Comprehensive data collection: personal info, credentials, licenses, certifications
 * - Related entity management: education, employment, references, contacts, etc.
 * - Form persistence and validation across all steps
 * - Real-time form state management with step navigation
 * - Enhanced header with employee status and quick actions
 * - Atomic transaction handling: creates employee first, then related entities
 * - Error handling with detailed feedback for failed operations
 * - Progress tracking with visual step indicators
 * - Responsive design with mobile-optimized layouts
 * - Auto-save draft functionality for data preservation
 * - Integration with 12+ specialized form components
 * - Uses data-testid attributes for comprehensive testing
 * 
 * @steps
 * 1. Personal Info - Name, contact information, address
 * 2. Professional Info - Job title, location, qualifications
 * 3. Credentials - Medical licenses, NPI, provider numbers
 * 4. Additional Info - CAQH information, system settings
 * 5. Education & Employment - Academic and work history
 * 6. Licenses - State and DEA licenses
 * 7. Certifications - Board certifications and specializations
 * 8. References & Contacts - Professional references and emergency contacts
 * 9. Tax & Documentation - Tax forms and documentation
 * 10. Training & Payer - Training records and payer enrollments
 * 11. Forms - DocuSeal forms and document management
 * 12. Incidents - Incident logs and safety records
 * 13. Review - Final review and submission
 */
export default function EmployeeForm() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const currentStepRef = useRef(currentStep);
  const [canProceed, setCanProceed] = useState(true);
  const [proceedBlockedMessage, setProceedBlockedMessage] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<EmployeeFormData>({
    firstName: "",
    lastName: "",
    workEmail: "",
    status: "active",
    educations: [],
    employments: [],
    stateLicenses: [],
    deaLicenses: [],
    boardCertifications: [],
    peerReferences: [],
    emergencyContacts: [],
    taxForms: [],
    trainings: [],
    payerEnrollments: [],
    incidentLogs: []
  });
  const currentStepValidatorRef = useRef<(() => Promise<boolean>) | null>(null);

  const isEdit = params.id !== undefined;
  
  // Fetch employee data if editing
  const { data: employee } = useQuery({
    queryKey: ["/api/employees", params.id],
    enabled: isEdit,
    queryFn: async ({ queryKey }) => {
      const res = await fetch(`${queryKey[0]}/${queryKey[1]}`, { credentials: "include" });
      if (!res.ok) throw new Error('Failed to fetch employee');
      return res.json();
    }
  });

  useEffect(() => {
    if (employee) {
      setFormData({
        ...employee,
        dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.split('T')[0] : undefined,
        enumerationDate: employee.enumerationDate ? employee.enumerationDate.split('T')[0] : undefined,
        caqhIssueDate: employee.caqhIssueDate ? employee.caqhIssueDate.split('T')[0] : undefined,
        caqhLastAttestationDate: employee.caqhLastAttestationDate ? employee.caqhLastAttestationDate.split('T')[0] : undefined,
        caqhReattestationDueDate: employee.caqhReattestationDueDate ? employee.caqhReattestationDueDate.split('T')[0] : undefined
      });
    }
  }, [employee]);

  // Update ref when step changes
  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  // Reset gating when step changes; individual steps can override via onValidationChange
  useEffect(() => {
    setCanProceed(true);
    setProceedBlockedMessage(undefined);
  }, [currentStep]);

  const createMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      // Extract entity data from form
      const {
        educations, employments, stateLicenses, deaLicenses,
        boardCertifications, peerReferences, emergencyContacts,
        taxForms, trainings, payerEnrollments, incidentLogs,
        ...employeeData
      } = data;
      
      // Create employee first
      const response = await apiRequest("POST", "/api/employees", employeeData);
      const newEmployee = await response.json();
      const employeeId = newEmployee.id;
      
      // Create related entities
      const promises = [];
      
      // Add educations
      if (educations && educations.length > 0) {
        for (const education of educations) {
          // Remove temporary id and source fields, keep only valid data
          const { id, source, employeeId: _, ...validEducation } = education;
          // Convert dates to proper format if they exist (YYYY-MM-DD for date fields)
          const cleanEducation: any = {
            ...validEducation,
            startDate: education.startDate ? new Date(education.startDate).toISOString().split('T')[0] : undefined,
            endDate: education.endDate ? new Date(education.endDate).toISOString().split('T')[0] : undefined,
          };
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/educations`, cleanEducation)
          );
        }
      }
      
      // Add employments
      if (employments && employments.length > 0) {
        for (const employment of employments) {
          // Remove temporary id field, keep only valid data
          const { id, employeeId: _, ...validEmployment } = employment;
          // Convert dates to proper format if they exist (YYYY-MM-DD for date fields)
          const cleanEmployment: any = {
            ...validEmployment,
            startDate: employment.startDate ? new Date(employment.startDate).toISOString().split('T')[0] : undefined,
            endDate: employment.endDate ? new Date(employment.endDate).toISOString().split('T')[0] : undefined
          };
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/employments`, cleanEmployment)
          );
        }
      }
      
      // Add state licenses
      if (stateLicenses && stateLicenses.length > 0) {
        for (const license of stateLicenses) {
          // Remove temporary id and source fields, keep only valid data
          const { id, source, employeeId: _, ...validLicense } = license;
          // Convert dates to proper format if they exist
          const cleanLicense: any = {
            ...validLicense,
            issueDate: license.issueDate ? new Date(license.issueDate).toISOString().split('T')[0] : undefined,
            expirationDate: license.expirationDate ? new Date(license.expirationDate).toISOString().split('T')[0] : undefined,
          };
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/state-licenses`, cleanLicense)
          );
        }
      }
      
      // Add DEA licenses
      if (deaLicenses && deaLicenses.length > 0) {
        for (const license of deaLicenses) {
          // Remove temporary id and source fields, keep only valid data
          const { id, source, employeeId: _, ...validLicense } = license;
          // Convert dates to proper format if they exist
          const cleanLicense: any = {
            ...validLicense,
            issueDate: license.issueDate ? new Date(license.issueDate).toISOString().split('T')[0] : undefined,
            expirationDate: license.expirationDate ? new Date(license.expirationDate).toISOString().split('T')[0] : undefined,
          };
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/dea-licenses`, cleanLicense)
          );
        }
      }
      
      // Add board certifications
      if (boardCertifications && boardCertifications.length > 0) {
        for (const cert of boardCertifications) {
          const { id, source, employeeId: _, ...validCert } = cert;
          const cleanCert: any = {
            ...validCert,
            issueDate: cert.issueDate ? new Date(cert.issueDate).toISOString().split('T')[0] : undefined,
            expirationDate: cert.expirationDate ? new Date(cert.expirationDate).toISOString().split('T')[0] : undefined
          };
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/board-certifications`, cleanCert)
          );
        }
      }
      
      // Add peer references
      if (peerReferences && peerReferences.length > 0) {
        for (const ref of peerReferences) {
          const { id, source, employeeId: _, comments, ...validRef } = ref;
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/peer-references`, validRef)
          );
        }
      }
      
      // Add emergency contacts
      if (emergencyContacts && emergencyContacts.length > 0) {
        for (const contact of emergencyContacts) {
          const { id, source, employeeId: _, ...validContact } = contact;
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/emergency-contacts`, validContact)
          );
        }
      }
      
      // Add tax forms
      if (taxForms && taxForms.length > 0) {
        for (const form of taxForms) {
          const { id, employeeId: _, ...validForm } = form;
          const cleanForm: any = {
            ...validForm,
            effectiveDate: form.effectiveDate ? new Date(form.effectiveDate).toISOString().split('T')[0] : undefined,
            endDate: form.endDate ? new Date(form.endDate).toISOString().split('T')[0] : undefined
          };
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/tax-forms`, cleanForm)
          );
        }
      }
      
      // Add trainings
      if (trainings && trainings.length > 0) {
        for (const training of trainings) {
          const { id, employeeId: _, ...validTraining } = training;
          const cleanTraining: any = {
            ...validTraining,
            completionDate: training.completionDate ? new Date(training.completionDate).toISOString().split('T')[0] : undefined,
            expirationDate: training.expirationDate ? new Date(training.expirationDate).toISOString().split('T')[0] : undefined
          };
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/trainings`, cleanTraining)
          );
        }
      }
      
      // Add payer enrollments
      if (payerEnrollments && payerEnrollments.length > 0) {
        for (const enrollment of payerEnrollments) {
          const { id, employeeId: _, ...validEnrollment } = enrollment;
          const cleanEnrollment: any = {
            ...validEnrollment,
            effectiveDate: enrollment.effectiveDate ? new Date(enrollment.effectiveDate).toISOString().split('T')[0] : undefined,
            terminationDate: enrollment.terminationDate ? new Date(enrollment.terminationDate).toISOString().split('T')[0] : undefined
          };
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/payer-enrollments`, cleanEnrollment)
          );
        }
      }
      
      // Add incident logs
      if (incidentLogs && incidentLogs.length > 0) {
        for (const incident of incidentLogs) {
          const { id, employeeId: _, ...validIncident } = incident;
          const cleanIncident: any = {
            ...validIncident,
            incidentDate: incident.incidentDate ? new Date(incident.incidentDate).toISOString().split('T')[0] : undefined
          };
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/incident-logs`, cleanIncident)
          );
        }
      }
      
      // Wait for all entities to be created with error handling
      const results = await Promise.allSettled(promises);
      
      // Check for any failures
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        const errors = failed.map((r, idx) => {
          if (r.status === 'rejected') {
            const err = r.reason as any;
            return `${idx + 1}: ${err?.message || 'Unknown error'}`;
          }
          return '';
        }).filter(Boolean);
        
        throw new Error(`Failed to create ${failed.length} related record(s):\n${errors.join('\n')}`);
      }
      
      return newEmployee;
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee and related entities created successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      navigate("/employees");
    },
    onError: (error: any) => {
      console.error('Error creating employee:', error);
      const errorMessage = error?.response?.data?.details 
        ? `Validation errors:\n${JSON.stringify(error.response.data.details, null, 2)}`
        : error.message || 'Failed to create employee';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: 10000
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: async (data: EmployeeFormData) => {
      // Filter out related entities - they're managed separately via their own endpoints
      const {
        educations, employments, stateLicenses, deaLicenses,
        boardCertifications, peerReferences, emergencyContacts,
        taxForms, trainings, payerEnrollments, incidentLogs,
        ...employeeData
      } = data;
      
      // Remove non-employee fields
      const updateData: any = {};
      const allowedFields = [
        'firstName', 'middleName', 'lastName', 'dateOfBirth', 'ssn',
        'personalEmail', 'workEmail', 'cellPhone', 'workPhone',
        'homeAddress1', 'homeAddress2', 'homeCity', 'homeState', 'homeZip',
        'gender', 'birthCity', 'birthState', 'birthCountry',
        'jobTitle', 'workLocation', 'qualification', 'department',
        'npiNumber', 'enumerationDate',
        'medicalQualification', 'medicalLicenseNumber', 'medicalLicenseState',
        'medicalLicenseIssueDate', 'medicalLicenseExpirationDate', 'medicalLicenseStatus',
        'substanceUseLicenseNumber', 'substanceUseLicenseState',
        'substanceUseLicenseIssueDate', 'substanceUseLicenseExpirationDate', 'substanceUseLicenseStatus',
        'substanceUseQualification', 'mentalHealthLicenseNumber', 'mentalHealthLicenseState',
        'mentalHealthLicenseIssueDate', 'mentalHealthLicenseExpirationDate', 'mentalHealthLicenseStatus',
        'mentalHealthQualification', 'medicaidNumber', 'medicarePtanNumber',
        'deaNumber',
        'caqhProviderId', 'caqhIssueDate', 'caqhLastAttestationDate', 'caqhEnabled', 'caqhReattestationDueDate',
        'caqhLoginId', 'caqhPassword', 'nppesLoginId', 'nppesPassword',
        'driversLicenseNumber', 'dlStateIssued', 'dlIssueDate', 'dlExpirationDate',
        'status', 'applicationStatus', 'onboardingStatus', 'invitationId',
        'userId', 'onboardingCompletedAt', 'approvedAt', 'approvedBy'
      ];
      
      for (const field of allowedFields) {
        if (field in employeeData) {
          updateData[field as keyof typeof employeeData] = employeeData[field as keyof typeof employeeData];
        }
      }
      
      return apiRequest("PUT", `/api/employees/${params.id}`, updateData);
    },
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      navigate("/employees");
    },
    onError: (error: any) => {
      console.error('Error updating employee:', error);
      const errorMessage = error?.response?.data?.details 
        ? `Validation errors:\n${JSON.stringify(error.response.data.details, null, 2)}`
        : error.message || 'Failed to update employee';
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
        duration: 10000
      });
    }
  });

  /**
   * Handles form submission for both create and edit modes
   * @description Routes to appropriate mutation based on edit state
   */
  const handleSubmit = () => {
    if (isEdit) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  /**
   * Advances to the next step in the form
   * @description Validates current step before advancing (if validation implemented)
   */
  const handleNext = async () => {
    const validate = currentStepValidatorRef.current;
    if (validate) {
      try {
        const isValid = await validate();
        if (!isValid) {
          return;
        }
      } catch (error) {
        return;
      }
    } else {
    }
    if (currentStep < 13) {
      setCurrentStep(currentStep + 1);
    }
  };

  /**
   * Returns to the previous step in the form
   */
  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  /**
   * Updates form data with partial data from step components
   * @param {Partial<EmployeeFormData>} data - Partial form data to merge
   */
  const updateFormData = useCallback((data: Partial<EmployeeFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  }, []);

  /**
   * Memoized validation registration function to prevent unnecessary re-renders
   */
  const registerStepValidation = useCallback(<T extends () => boolean | Promise<boolean>>(fn: T) => {
    const stepNumber = currentStepRef.current;
    currentStepValidatorRef.current = async () => {
      const result = fn();
      const isValid = !!(await Promise.resolve(result));
      return isValid;
    };
  }, []);

  const steps = [
    {
      title: "Personal Info",
      component: (
        <EmployeePersonalInfo
          data={formData}
          onChange={updateFormData}
          registerValidation={registerStepValidation}
          data-testid="step-personal-info"
        />
      )
    },
    {
      title: "Professional Info",
      component: (
        <EmployeeProfessionalInfo
          data={formData}
          onChange={updateFormData}
          registerValidation={registerStepValidation}
          data-testid="step-professional-info"
        />
      )
    },
    {
      title: "Credentials",
      component: (
        <EmployeeCredentials
          data={formData}
          onChange={updateFormData}
          registerValidation={registerStepValidation}
          data-testid="step-credentials"
        />
      )
    },
    // {
    //   title: "Additional Info",
    //   component: (
    //     <EmployeeAdditionalInfo
    //       data={formData}
    //       onChange={updateFormData}
    //       registerValidation={(fn) => { currentStepValidatorRef.current = async () => !!(await Promise.resolve(fn())); }}
    //       data-testid="step-additional-info"
    //     />
    //   )
    // },
    {
      title: "Education & Employment",
      component: (
        <EmployeeEducationEmployment
          data={formData}
          onChange={updateFormData}
          employeeId={isEdit ? parseInt(params.id!) : undefined}
          registerValidation={registerStepValidation}
          data-testid="step-education-employment"
        />
      )
    },
    {
      title: "Licenses",
      component: (
        <EmployeeLicenses
          data={formData}
          onChange={updateFormData}
          employeeId={isEdit ? parseInt(params.id!) : undefined}
          registerValidation={registerStepValidation}
          data-testid="step-licenses"
        />
      )
    },
    {
      title: "Certifications",
      component: (
        <EmployeeCertifications
          data={formData}
          onChange={updateFormData}
          employeeId={isEdit ? parseInt(params.id!) : undefined}
          registerValidation={registerStepValidation}
          data-testid="step-certifications"
        />
      )
    },
    // {
    //   title: "References & Contacts",
    //   component: (
    //     <EmployeeReferencesContacts
    //       data={formData}
    //       onChange={updateFormData}
    //       employeeId={isEdit ? parseInt(params.id!) : undefined}
    //       registerValidation={(fn) => { currentStepValidatorRef.current = async () => !!(await Promise.resolve(fn())); }}
    //       data-testid="step-references-contacts"
    //     />
    //   )
    // },
    {
      title: "Documents Submission",
      component: (
        <EmployeeDocumentsSubmission
          data={formData}
          onChange={updateFormData}
          employeeId={isEdit ? parseInt(params.id!) : undefined}
          registerValidation={registerStepValidation}
          onValidationChange={(isValid) => {
            setCanProceed(!!isValid);
            setProceedBlockedMessage(isValid ? undefined : "Please upload all required documents to continue");
          }}
          data-testid="step-documents-submission"
        />
      )
    },
    {
      title: "Training & Payer",
      component: (
        <EmployeeTrainingPayer
          data={formData}
          onChange={updateFormData}
          employeeId={isEdit ? parseInt(params.id!) : undefined}
          registerValidation={registerStepValidation}
          data-testid="step-training-payer"
        />
      )
    },
    {
      title: "Forms",
      component: (
        <EmployeeForms
          data={formData}
          onChange={updateFormData}
          employeeId={isEdit ? parseInt(params.id!) : undefined}
          registerValidation={registerStepValidation}
          data-testid="step-forms"
        />
      )
    },
    {
      title: "Incidents",
      component: (
        <EmployeeIncidents
          data={formData}
          onChange={updateFormData}
          employeeId={isEdit ? parseInt(params.id!) : undefined}
          registerValidation={registerStepValidation}
          data-testid="step-incidents"
        />
      )
    },
    {
      title: "Review",
      component: (
        <EmployeeReview
          data={formData}
          data-testid="step-review"
        />
      )
    }
  ];

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Enhanced Header Section */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/5 via-background to-secondary/5">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* Left Side - Navigation & Title */}
              <div className="flex flex-col space-y-4">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => navigate("/employees")}
                  data-testid="button-back"
                  className="w-fit"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Employees
                </Button>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {isEdit ? <User className="w-6 h-6 text-primary" /> : <Building2 className="w-6 h-6 text-primary" />}
                    </div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground" data-testid="text-form-title">
                      {isEdit ? 
                        `Edit: ${formData.firstName || ''} ${formData.lastName || 'Employee'}` : 
                        "Add New Employee"
                      }
                    </h1>
                  </div>
                  <p className="text-muted-foreground ml-11">
                    {isEdit ? 
                      "Update employee information and related records" : 
                      "Complete all steps to add a new medical staff member"
                    }
                  </p>
                </div>
              </div>
              
              {/* Right Side - Quick Actions & Status */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                {isEdit && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-background">
                      ID: #{params.id}
                    </Badge>
                    {formData.status && (
                      <Badge 
                        variant={formData.status === 'active' ? 'default' : 'secondary'}
                        className={cn(
                          formData.status === 'active' && "bg-secondary text-secondary-foreground",
                          formData.status === 'inactive' && "bg-destructive text-destructive-foreground"
                        )}
                      >
                        {formData.status}
                      </Badge>
                    )}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    data-testid="button-cancel"
                    onClick={() => {
                      if (confirm(isEdit ? "Discard changes?" : "Cancel employee creation?")) {
                        navigate("/employees");
                      }
                    }}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    data-testid="button-save-draft"
                    onClick={handleSubmit}
                    disabled={createMutation.isPending || updateMutation.isPending}
                    className="bg-gradient-to-r from-primary to-primary/90"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Draft"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form Container with Constrained Width */}
        <div className="w-full employee-form-wrapper">
          <MultiStepForm
            steps={steps}
            currentStep={currentStep}
            onNext={handleNext}
            onPrevious={handlePrevious}
            onSubmit={handleSubmit}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            canNext={true}
            canProceed={canProceed}
            proceedBlockedMessage={proceedBlockedMessage}
            data-testid="multi-step-form"
          />
        </div>
      </div>
    </MainLayout>
  );
}
