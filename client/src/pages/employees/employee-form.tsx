import { useState, useEffect } from "react";
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
import { EmployeeTaxDocumentation } from "@/components/forms/employee-tax-documentation";
import { EmployeeTrainingPayer } from "@/components/forms/employee-training-payer";
import { EmployeeIncidents } from "@/components/forms/employee-incidents";
import { EmployeeReview } from "@/components/forms/employee-review";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, User, Building2, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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

export default function EmployeeForm() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
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
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/educations`, education)
          );
        }
      }
      
      // Add employments
      if (employments && employments.length > 0) {
        for (const employment of employments) {
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/employments`, employment)
          );
        }
      }
      
      // Add state licenses
      if (stateLicenses && stateLicenses.length > 0) {
        for (const license of stateLicenses) {
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/state-licenses`, license)
          );
        }
      }
      
      // Add DEA licenses
      if (deaLicenses && deaLicenses.length > 0) {
        for (const license of deaLicenses) {
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/dea-licenses`, license)
          );
        }
      }
      
      // Add board certifications
      if (boardCertifications && boardCertifications.length > 0) {
        for (const cert of boardCertifications) {
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/board-certifications`, cert)
          );
        }
      }
      
      // Add peer references
      if (peerReferences && peerReferences.length > 0) {
        for (const ref of peerReferences) {
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/peer-references`, ref)
          );
        }
      }
      
      // Add emergency contacts
      if (emergencyContacts && emergencyContacts.length > 0) {
        for (const contact of emergencyContacts) {
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/emergency-contacts`, contact)
          );
        }
      }
      
      // Add tax forms
      if (taxForms && taxForms.length > 0) {
        for (const form of taxForms) {
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/tax-forms`, form)
          );
        }
      }
      
      // Add trainings
      if (trainings && trainings.length > 0) {
        for (const training of trainings) {
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/trainings`, training)
          );
        }
      }
      
      // Add payer enrollments
      if (payerEnrollments && payerEnrollments.length > 0) {
        for (const enrollment of payerEnrollments) {
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/payer-enrollments`, enrollment)
          );
        }
      }
      
      // Add incident logs
      if (incidentLogs && incidentLogs.length > 0) {
        for (const incident of incidentLogs) {
          promises.push(
            apiRequest("POST", `/api/employees/${employeeId}/incident-logs`, incident)
          );
        }
      }
      
      // Wait for all entities to be created
      await Promise.all(promises);
      
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
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data: EmployeeFormData) => apiRequest("PUT", `/api/employees/${params.id}`, data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee updated successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      navigate("/employees");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleSubmit = () => {
    if (isEdit) {
      updateMutation.mutate(formData);
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleNext = () => {
    if (currentStep < 12) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const updateFormData = (data: Partial<EmployeeFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const steps = [
    {
      title: "Personal Info",
      component: (
        <EmployeePersonalInfo
          data={formData}
          onChange={updateFormData}
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
      title: "Additional Info",
      component: (
        <EmployeeAdditionalInfo
          data={formData}
          onChange={updateFormData}
          data-testid="step-additional-info"
        />
      )
    },
    {
      title: "Education & Employment",
      component: (
        <EmployeeEducationEmployment
          data={formData}
          onChange={updateFormData}
          employeeId={isEdit ? parseInt(params.id!) : undefined}
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
          data-testid="step-certifications"
        />
      )
    },
    {
      title: "References & Contacts",
      component: (
        <EmployeeReferencesContacts
          data={formData}
          onChange={updateFormData}
          employeeId={isEdit ? parseInt(params.id!) : undefined}
          data-testid="step-references-contacts"
        />
      )
    },
    {
      title: "Tax & Documentation",
      component: (
        <EmployeeTaxDocumentation
          data={formData}
          onChange={updateFormData}
          employeeId={isEdit ? parseInt(params.id!) : undefined}
          data-testid="step-tax-documentation"
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
          data-testid="step-training-payer"
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
            canNext={true} // Add validation logic here
            data-testid="multi-step-form"
          />
        </div>
      </div>
    </MainLayout>
  );
}
