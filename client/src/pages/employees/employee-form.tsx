import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/main-layout";
import { MultiStepForm } from "@/components/forms/multi-step-form";
import { EmployeePersonalInfo } from "@/components/forms/employee-personal-info";
import { EmployeeProfessionalInfo } from "@/components/forms/employee-professional-info";
import { EmployeeCredentials } from "@/components/forms/employee-credentials";
import { EmployeeAdditionalInfo } from "@/components/forms/employee-additional-info";
import { EmployeeReview } from "@/components/forms/employee-review";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    status: "active"
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
    mutationFn: (data: EmployeeFormData) => apiRequest("POST", "/api/employees", data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee created successfully"
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
    if (currentStep < 5) {
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
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate("/employees")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground" data-testid="text-form-title">
              {isEdit ? "Edit Employee" : "Add New Employee"}
            </h1>
            <p className="text-muted-foreground">
              {isEdit ? "Update employee information" : "Complete all steps to add a new medical staff member"}
            </p>
          </div>
        </div>

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
    </MainLayout>
  );
}
