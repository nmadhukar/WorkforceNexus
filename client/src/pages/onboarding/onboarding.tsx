import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
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
import { EmployeeForms } from "@/components/forms/employee-forms";
import { EmployeeReview } from "@/components/forms/employee-review";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ClipboardList, CheckCircle, Save, FileText, AlertTriangle, Upload, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

/**
 * Onboarding form data structure for prospective employees
 */
interface OnboardingFormData {
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
  
  // Document submission validation
  documentUploads?: any[];
  allRequiredDocumentsUploaded?: boolean;
  uploadedRequiredCount?: number;
  requiredDocumentsCount?: number;
  
  // Forms validation (DocuSeal)
  allFormsCompleted?: boolean;
  completedForms?: number;
  totalRequiredForms?: number;
  submissions?: any[];
}

/**
 * Onboarding page for prospective employees
 * 12-step form process for completing employee onboarding
 * @component
 * @returns {JSX.Element} Multi-step onboarding form interface
 */
export default function OnboardingPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [isCurrentStepValid, setIsCurrentStepValid] = useState(false);
  const formValidationRefs = useRef<{ [key: number]: () => Promise<boolean> }>({});
  const [formData, setFormData] = useState<OnboardingFormData>({
    firstName: "",
    lastName: "",
    workEmail: user?.username || "",
    status: "prospective",
    educations: [],
    employments: [],
    stateLicenses: [],
    deaLicenses: [],
    boardCertifications: [],
    peerReferences: [],
    emergencyContacts: [],
    taxForms: [],
    trainings: [],
    payerEnrollments: []
  });

  // Check if user is prospective_employee
  useEffect(() => {
    if (user?.role !== "prospective_employee") {
      toast({
        title: "Access Denied",
        description: "This page is only accessible to prospective employees completing onboarding.",
        variant: "destructive"
      });
      navigate("/");
    }
  }, [user, navigate, toast]);

  // Check if onboarding already exists for this user
  const { data: existingOnboarding, isLoading: loadingOnboarding, error: onboardingError } = useQuery({
    queryKey: ["/api/onboarding/my-onboarding"],
    enabled: !!user && user.role === "prospective_employee", // Only run if user is loaded and has correct role
    queryFn: async () => {
      console.log('[Onboarding] Fetching onboarding data...');
      const res = await fetch("/api/onboarding/my-onboarding", { credentials: "include" });
      console.log('[Onboarding] Response status:', res.status);
      if (!res.ok) {
        if (res.status === 404) {
          // 404 is normal for new users - they haven't started onboarding yet
          console.log('[Onboarding] No existing data (404) - starting fresh');
          return null;
        }
        // For actual errors (500, network issues, etc.), throw to trigger error state
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch onboarding data' }));
        console.error('[Onboarding] Error fetching data:', errorData);
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      const data = await res.json();
      console.log('[Onboarding] Data loaded successfully');
      return data;
    },
    retry: (failureCount, error) => {
      // Don't retry on 404s (normal state) or 401s (auth issues)
      if (error instanceof Error && 
          (error.message.includes('404') || error.message.includes('401'))) {
        return false;
      }
      // Retry other errors up to 2 times
      return failureCount < 2;
    }
  });

  // Debug: Log query state changes
  useEffect(() => {
    console.log('[Onboarding] Query state:', {
      loadingOnboarding,
      hasData: !!existingOnboarding,
      hasError: !!onboardingError,
      userLoaded: !!user,
      userRole: user?.role
    });
  }, [loadingOnboarding, existingOnboarding, onboardingError, user]);

  useEffect(() => {
    if (existingOnboarding) {
      setFormData({
        ...existingOnboarding,
        dateOfBirth: existingOnboarding.dateOfBirth ? existingOnboarding.dateOfBirth.split('T')[0] : undefined,
        enumerationDate: existingOnboarding.enumerationDate ? existingOnboarding.enumerationDate.split('T')[0] : undefined,
        caqhIssueDate: existingOnboarding.caqhIssueDate ? existingOnboarding.caqhIssueDate.split('T')[0] : undefined,
        caqhLastAttestationDate: existingOnboarding.caqhLastAttestationDate ? existingOnboarding.caqhLastAttestationDate.split('T')[0] : undefined,
        caqhReattestationDueDate: existingOnboarding.caqhReattestationDueDate ? existingOnboarding.caqhReattestationDueDate.split('T')[0] : undefined
      });
    }
  }, [existingOnboarding]);

  const saveDraftMutation = useMutation({
    mutationFn: async (data: OnboardingFormData) => {
      const response = await apiRequest("POST", "/api/onboarding/save-draft", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save draft');
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Draft Saved",
        description: "Your progress has been saved. You can continue later."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Save Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const submitOnboardingMutation = useMutation({
    mutationFn: async (data: OnboardingFormData) => {
      // Extract entity data from form
      const {
        educations, employments, stateLicenses, deaLicenses,
        boardCertifications, peerReferences, emergencyContacts,
        taxForms, trainings, payerEnrollments,
        ...employeeData
      } = data;
      
      // Remove NPI if it's empty or the test value
      if (employeeData.npiNumber === '' || employeeData.npiNumber === '1234567890') {
        delete employeeData.npiNumber;
      }
      
      console.log('[Onboarding] Submitting data with NPI:', employeeData.npiNumber || 'Not provided (optional)');
      
      // Submit onboarding data
      const response = await apiRequest("POST", "/api/onboarding/submit", {
        ...employeeData,
        educations,
        employments,
        stateLicenses,
        deaLicenses,
        boardCertifications,
        peerReferences,
        emergencyContacts,
        taxForms,
        trainings,
        payerEnrollments
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[Onboarding] Submission error:', error);
        
        // Throw error with user-friendly message
        if (response.status === 409) {
          // Unique constraint violation - use the server's message
          throw new Error(error.error || 'This information already exists in our system.');
        }
        throw new Error(error.error || 'Failed to submit onboarding');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Onboarding Submitted",
        description: "Your onboarding information has been submitted for review. HR will contact you soon.",
        duration: 10000
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/onboarding"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
      
      // Navigate to dashboard
      setTimeout(() => {
        navigate("/");
      }, 2000);
    },
    onError: (error: Error) => {
      console.error('[Onboarding] Mutation error:', error);
      
      // Display user-friendly error message
      toast({
        title: "Submission Failed",
        description: error.message || "Failed to submit onboarding. Please try again or contact HR for assistance.",
        variant: "destructive",
        duration: 10000
      });
    }
  });

  /**
   * Handle form submission
   */
  const handleSubmit = () => {
    // Validate all required documents are uploaded
    if (!formData.allRequiredDocumentsUploaded) {
      const missingCount = (formData.requiredDocumentsCount || 0) - (formData.uploadedRequiredCount || 0);
      toast({
        title: "Submission Blocked",
        description: `Please upload all required documents before submitting. You have ${missingCount} required document${missingCount > 1 ? 's' : ''} remaining. Navigate to Step 9 to upload documents.`,
        variant: "destructive",
        duration: 7000
      });
      return;
    }
    
    // Validate all required forms are signed
    if (!formData.allFormsCompleted) {
      const completedForms = formData.completedForms || 0;
      const totalRequiredForms = formData.totalRequiredForms || 0;
      const remaining = totalRequiredForms - completedForms;
      toast({
        title: "Submission Blocked",
        description: `Please complete all required forms before submitting. ${completedForms} of ${totalRequiredForms} forms are signed. Navigate to Step 11 to complete the remaining ${remaining} form${remaining > 1 ? 's' : ''}.`,
        variant: "destructive",
        duration: 7000
      });
      return;
    }
    
    submitOnboardingMutation.mutate(formData);
  };

  /**
   * Save draft progress
   */
  const handleSaveDraft = () => {
    saveDraftMutation.mutate(formData);
  };

  /**
   * Validates current step before advancing
   */
  const handleNext = async () => {
    // First validate the current step's form fields
    const isValid = await validateCurrentStep();
    if (!isValid) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields correctly before proceeding.",
        variant: "destructive",
        duration: 5000
      });
      return;
    }

    // Check if Documents Submission step (step 9) has validation requirement
    if (currentStep === 9) {
      if (!formData.allRequiredDocumentsUploaded) {
        const missingCount = (formData.requiredDocumentsCount || 0) - (formData.uploadedRequiredCount || 0);
        toast({
          title: "Cannot Proceed",
          description: `Please upload all required documents before continuing. You have ${missingCount} required document${missingCount > 1 ? 's' : ''} remaining.`,
          variant: "destructive",
          duration: 5000
        });
        return;
      }
    }
    
    // Check if Forms step (step 11) has validation requirement
    if (currentStep === 11) {
      if (!formData.allFormsCompleted) {
        const completedForms = formData.completedForms || 0;
        const totalRequiredForms = formData.totalRequiredForms || 0;
        toast({
          title: "Cannot Proceed",
          description: `Please complete all required forms. ${completedForms} of ${totalRequiredForms} forms signed.`,
          variant: "destructive",
          duration: 5000
        });
        return;
      }
    }
    
    if (currentStep < 12) {
      setCurrentStep(currentStep + 1);
      // Auto-save draft on step change
      if (existingOnboarding || formData.firstName) {
        saveDraftMutation.mutate(formData);
      }
    }
  };

  /**
   * Returns to the previous step
   */
  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  /**
   * Updates form data with partial data from step components
   */
  const updateFormData = (data: Partial<OnboardingFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  /**
   * Validation callback for child forms to report their validity
   */
  const handleValidationChange = (isValid: boolean) => {
    setIsCurrentStepValid(isValid);
  };

  /**
   * Register validation functions from child components
   */
  const registerValidation = (step: number, validationFn: () => Promise<boolean>) => {
    formValidationRefs.current[step] = validationFn;
  };

  /**
   * Validate current step before navigation
   */
  const validateCurrentStep = async (): Promise<boolean> => {
    const validationFn = formValidationRefs.current[currentStep];
    if (validationFn) {
      const isValid = await validationFn();
      setIsCurrentStepValid(isValid);
      return isValid;
    }
    return true; // Default to true for steps without validation
  };

  // 12-step onboarding process (excluding Incidents step which is for existing employees)
  const steps = [
    {
      title: "Personal Information",
      component: (
        <EmployeePersonalInfo
          data={formData}
          onChange={updateFormData}
          registerValidation={(fn) => registerValidation(1, fn)}
          onValidationChange={handleValidationChange}
          data-testid="step-personal-info"
        />
      )
    },
    {
      title: "Professional Details",
      component: (
        <EmployeeProfessionalInfo
          data={formData}
          onChange={updateFormData}
          registerValidation={(fn) => registerValidation(2, fn)}
          onValidationChange={handleValidationChange}
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
          registerValidation={(fn) => registerValidation(3, fn)}
          onValidationChange={handleValidationChange}
          data-testid="step-credentials"
        />
      )
    },
    {
      title: "Additional Information",
      component: (
        <EmployeeAdditionalInfo
          data={formData}
          onChange={updateFormData}
          registerValidation={(fn) => registerValidation(4, fn)}
          onValidationChange={handleValidationChange}
          data-testid="step-additional-info"
        />
      )
    },
    {
      title: "Education & Employment History",
      component: (
        <EmployeeEducationEmployment
          data={formData}
          onChange={updateFormData}
          registerValidation={(fn) => registerValidation(5, fn)}
          onValidationChange={handleValidationChange}
          data-testid="step-education-employment"
        />
      )
    },
    {
      title: "Professional Licenses",
      component: (
        <EmployeeLicenses
          data={formData}
          onChange={updateFormData}
          registerValidation={(fn) => registerValidation(6, fn)}
          onValidationChange={handleValidationChange}
          data-testid="step-licenses"
        />
      )
    },
    {
      title: "Board Certifications",
      component: (
        <EmployeeCertifications
          data={formData}
          onChange={updateFormData}
          registerValidation={(fn) => registerValidation(7, fn)}
          onValidationChange={handleValidationChange}
          data-testid="step-certifications"
        />
      )
    },
    {
      title: "References & Emergency Contacts",
      component: (
        <EmployeeReferencesContacts
          data={formData}
          onChange={updateFormData}
          registerValidation={(fn) => registerValidation(8, fn)}
          onValidationChange={handleValidationChange}
          data-testid="step-references-contacts"
        />
      )
    },
    {
      title: `Documents Submission${formData.allRequiredDocumentsUploaded ? ' ✓' : formData.uploadedRequiredCount ? ` (${formData.uploadedRequiredCount}/${formData.requiredDocumentsCount || 0})` : ''}`,
      component: (
        <EmployeeDocumentsSubmission
          data={formData}
          onChange={updateFormData}
          data-testid="step-documents-submission"
        />
      )
    },
    {
      title: "Training & Payer Enrollment",
      component: (
        <EmployeeTrainingPayer
          data={formData}
          onChange={updateFormData}
          registerValidation={(fn) => registerValidation(10, fn)}
          onValidationChange={handleValidationChange}
          data-testid="step-training-payer"
        />
      )
    },
    {
      title: `Required Forms${formData.allFormsCompleted ? ' ✓' : formData.completedForms ? ` (${formData.completedForms}/${formData.totalRequiredForms || 0} signed)` : ''}`,
      component: (
        <EmployeeForms
          data={formData}
          onChange={updateFormData}
          onboardingId={existingOnboarding?.id}
          data-testid="step-forms"
        />
      )
    },
    {
      title: "Review & Submit",
      component: (
        <EmployeeReview
          data={formData}
          data-testid="step-review"
        />
      )
    }
  ];

  // Handle loading state
  if (loadingOnboarding) {
    console.log('[Onboarding] Rendering loading state...');
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <ClipboardList className="w-12 h-12 text-primary mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground">Loading your onboarding information...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  console.log('[Onboarding] Rendering main form...');

  // Handle error state (but not 404 which is normal for new users)
  if (onboardingError) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Error Loading Onboarding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                {onboardingError instanceof Error 
                  ? onboardingError.message 
                  : 'Failed to load your onboarding information. Please try again or contact HR for assistance.'}
              </p>
              <div className="flex gap-2">
                <Button 
                  onClick={() => window.location.reload()} 
                  variant="default"
                  data-testid="button-reload-page"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Reload Page
                </Button>
                <Button 
                  onClick={() => navigate("/")} 
                  variant="outline"
                  data-testid="button-back-dashboard"
                >
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/5 via-background to-secondary/5">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  <ClipboardList className="w-6 h-6 text-primary" />
                  Employee Onboarding
                </CardTitle>
                <CardDescription className="mt-2">
                  Complete all 12 steps to finalize your onboarding process
                  {formData.totalRequiredForms && formData.totalRequiredForms > 0 && (
                    <span className="block mt-1">
                      <FileSignature className="inline w-3 h-3 mr-1" />
                      Forms: {formData.completedForms || 0}/{formData.totalRequiredForms} signed
                      {formData.allFormsCompleted && (
                        <CheckCircle className="inline w-3 h-3 ml-1 text-green-600" />
                      )}
                    </span>
                  )}
                  {formData.requiredDocumentsCount && formData.requiredDocumentsCount > 0 && (
                    <span className="block">
                      <Upload className="inline w-3 h-3 mr-1" />
                      Documents: {formData.uploadedRequiredCount || 0}/{formData.requiredDocumentsCount} uploaded
                      {formData.allRequiredDocumentsUploaded && (
                        <CheckCircle className="inline w-3 h-3 ml-1 text-green-600" />
                      )}
                    </span>
                  )}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {existingOnboarding && (
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    In Progress
                  </Badge>
                )}
                <Badge variant="secondary">
                  Step {currentStep} of 12
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveDraft}
                disabled={saveDraftMutation.isPending}
                data-testid="button-save-draft"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Progress
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
                data-testid="button-return-dashboard"
              >
                Return to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Info Alert */}
        {!existingOnboarding && (
          <Alert>
            <ClipboardList className="h-4 w-4" />
            <AlertTitle>Welcome to Onboarding!</AlertTitle>
            <AlertDescription>
              Please complete all 12 steps to submit your onboarding information. Your progress will be automatically saved as you move through the form.
            </AlertDescription>
          </Alert>
        )}

        {existingOnboarding && (
          <Alert className="border-yellow-200 bg-yellow-50">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertTitle>Continue Your Onboarding</AlertTitle>
            <AlertDescription className="text-yellow-800">
              You have an onboarding form in progress. Continue where you left off or review your submitted information.
            </AlertDescription>
          </Alert>
        )}

        {/* Multi-Step Form */}
        <MultiStepForm
          steps={steps}
          currentStep={currentStep}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSubmit={handleSubmit}
          isSubmitting={submitOnboardingMutation.isPending}
          canNext={isCurrentStepValid}
          canProceed={
            currentStep === 9 
              ? formData.allRequiredDocumentsUploaded 
              : currentStep === 11 
                ? formData.allFormsCompleted === true
                : undefined
          }
          proceedBlockedMessage={
            currentStep === 9 && !formData.allRequiredDocumentsUploaded
              ? `Please upload all ${(formData.requiredDocumentsCount || 0) - (formData.uploadedRequiredCount || 0)} remaining required documents before proceeding`
              : currentStep === 11 && !formData.allFormsCompleted
                ? `Complete all ${(formData.totalRequiredForms || 0) - (formData.completedForms || 0)} required forms before proceeding`
                : undefined
          }
        />

        {/* Additional Help Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              Required Documents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Please have the following documents ready:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Valid government-issued ID</li>
                <li>Social Security card</li>
                <li>Professional licenses and certifications</li>
                <li>Education transcripts or diplomas</li>
                <li>Employment verification letters</li>
                <li>Professional references contact information</li>
                <li>Emergency contact information</li>
                <li>Tax forms (W-4, state tax forms)</li>
                <li>Board certification documents</li>
                <li>DEA license (if applicable)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}