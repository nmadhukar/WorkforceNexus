import { useState, useEffect } from "react";
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
import { EmployeeTaxDocumentation } from "@/components/forms/employee-tax-documentation";
import { EmployeeTrainingPayer } from "@/components/forms/employee-training-payer";
import { EmployeeForms } from "@/components/forms/employee-forms";
import { EmployeeReview } from "@/components/forms/employee-review";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { ClipboardList, CheckCircle, Save, FileText, AlertTriangle } from "lucide-react";
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
  const { data: existingOnboarding, isLoading: loadingOnboarding } = useQuery({
    queryKey: ["/api/onboarding/my-onboarding"],
    queryFn: async () => {
      const res = await fetch("/api/onboarding/my-onboarding", { credentials: "include" });
      if (!res.ok) {
        if (res.status === 404) {
          return null;
        }
        throw new Error('Failed to fetch onboarding data');
      }
      return res.json();
    }
  });

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
  const handleNext = () => {
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

  // 12-step onboarding process (excluding Incidents step which is for existing employees)
  const steps = [
    {
      title: "Personal Information",
      component: (
        <EmployeePersonalInfo
          data={formData}
          onChange={updateFormData}
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
          data-testid="step-references-contacts"
        />
      )
    },
    {
      title: "Tax Documentation",
      component: (
        <EmployeeTaxDocumentation
          data={formData}
          onChange={updateFormData}
          data-testid="step-tax-documentation"
        />
      )
    },
    {
      title: "Training & Payer Enrollment",
      component: (
        <EmployeeTrainingPayer
          data={formData}
          onChange={updateFormData}
          data-testid="step-training-payer"
        />
      )
    },
    {
      title: "Required Forms",
      component: (
        <EmployeeForms
          data={formData}
          onChange={updateFormData}
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

  if (loadingOnboarding) {
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
          canNext={true}
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