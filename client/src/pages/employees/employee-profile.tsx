import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/main-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Edit,
  Trash2,
  Printer,
  Download,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Award,
  Briefcase,
  GraduationCap,
  Shield,
  FileText,
  Users,
  AlertTriangle,
  CreditCard,
  UserCheck,
  Home,
  Clock,
  Building,
  Hash,
  BadgeIcon,
  Activity,
  IdCard,
  Stethoscope,
  User,
  MapPinned,
  FileCheck,
  UserPlus,
  FileSignature,
  Upload,
  CheckCircle2,
  X
} from "lucide-react";
import type { Employee } from "@/lib/types";
import { EducationsManager } from "@/components/entity-managers/educations-manager";
import { EmploymentsManager } from "@/components/entity-managers/employments-manager";
import { LicensesManager } from "@/components/entity-managers/licenses-manager";
import { PeerReferencesManager } from "@/components/entity-managers/peer-references-manager";
import { BoardCertificationsManager } from "@/components/entity-managers/board-certifications-manager";
import { EmergencyContactsManager } from "@/components/entity-managers/emergency-contacts-manager";
import { TaxFormsManager } from "@/components/entity-managers/tax-forms-manager";
import { TrainingsManager } from "@/components/entity-managers/trainings-manager";
import { PayerEnrollmentsManager } from "@/components/entity-managers/payer-enrollments-manager";
import { IncidentLogsManager } from "@/components/entity-managers/incident-logs-manager";
import { FormsManager } from "@/components/entity-managers/forms-manager";
import { DocumentUploader } from "@/components/documents/DocumentUploader";
import { DocumentList } from "@/components/documents/DocumentList";
import { EmployeeTasks } from "@/components/tasks/EmployeeTasks";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useDocuments } from "@/hooks/useDocuments";

/**
 * Comprehensive employee profile page displaying detailed employee information with tabbed navigation
 * @component
 * @returns {JSX.Element} Employee profile interface with detailed information cards and management tabs
 * @example
 * <EmployeeProfile />
 * // Accessed via route: /employees/:id
 * 
 * @description
 * - Displays comprehensive employee information in organized card layout
 * - Hero section with employee avatar, name, job title, and status
 * - Three main information cards: Contact Info, Professional Credentials, CAQH & System Info
 * - Tabbed navigation for managing related entities (education, employment, licenses, etc.)
 * - Breadcrumb navigation for easy traversal
 * - Quick action buttons: Edit, Print, Export
 * - Protected data display (SSN masking, tooltips for sensitive info)
 * - Status badges with color coding (active, inactive, on_leave)
 * - Professional credential display (NPI, Medical License, SSN, etc.)
 * - CAQH provider information with attestation tracking
 * - Integration with 11 entity managers for comprehensive data management
 * - Real-time data loading with skeleton states
 * - Error handling with user-friendly messages
 * - Uses data-testid attributes for testing automation
 * - Responsive design with mobile-optimized layouts
 */
export default function EmployeeProfile() {
  const params = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const employeeId = parseInt(params.id || "0");
  const lastUpdated = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  // Fetch the employee's own data if they are an employee
  const { data: ownEmployeeData } = useQuery<Partial<Employee>>({
    queryKey: ["/api/employee/profile"],
    enabled: user?.role === "employee"
  });

  const { data: employee, isLoading, error } = useQuery<Employee>({
    queryKey: ["/api/employees", employeeId],
    enabled: !!employeeId
  });

  // State for approval modal
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Fetch existing approval checklist (for modal)
  const { data: existingChecklist } = useQuery<any>({
    queryKey: ["/api/employees", employeeId, "approval-checklist"],
    enabled: !!employeeId && showApprovalModal,
  });
  
  // Fetch checklist data for the checklist documents tab (always enabled)
  const { data: checklistData } = useQuery<any>({
    queryKey: ["/api/employees", employeeId, "approval-checklist"],
    enabled: !!employeeId,
  });
  
  const [isUploadingDocuments, setIsUploadingDocuments] = useState(false);
  
  // Fetch existing approval-related documents for this employee when modal is open
  const { documents: approvalDocuments = [], isLoading: isApprovalDocsLoading, refetch: refetchApprovalDocuments } = useDocuments({
    employeeId,
    enabled: !!employeeId && showApprovalModal,
  });
  
  // Fetch approval documents for checklist tab view (always enabled)
  const { documents: checklistTabDocuments = [] } = useDocuments({
    employeeId,
    enabled: !!employeeId,
  });
  

  // Radio button selections (default to 'no')
  // For urineDrugScreen / bciFbiCheck:
  //   - "No"  => Initiated (requires initiated date)
  //   - "Yes" => Completed (requires uploaded document)
  const [approvalSelections, setApprovalSelections] = useState<Record<string, 'yes' | 'no'>>({
    cpiTraining: 'no',
    cprTraining: 'no',
    crisisPrevention: 'no',
    federalExclusions: 'no',
    stateExclusions: 'no',
    samGovExclusion: 'no',
    urineDrugScreen: 'no',
    bciFbiCheck: 'no',
    laptopSetup: 'no',
    emailSetup: 'no',
    emrSetup: 'no',
    phoneSetup: 'no',
  });

  // Uploaded documents (only for 'yes' selections that need uploads)
  const [uploadedDocuments, setUploadedDocuments] = useState<Record<string, File | null>>({
    cpiTraining: null,
    cprTraining: null,
    crisisPrevention: null,
    federalExclusions: null,
    stateExclusions: null,
    samGovExclusion: null,
    urineDrugScreen: null,
    bciFbiCheck: null,
  });

  // Initiated dates for background checks (date-only, YYYY-MM-DD)
  const [initiatedDates, setInitiatedDates] = useState<Record<string, string>>({
    urineDrugScreen: "",
    bciFbiCheck: "",
  });

  // Track which existing documents have been dismissed (to allow re-upload)
  const [dismissedExistingDocs, setDismissedExistingDocs] = useState<Set<string>>(new Set());

  // Document type mapping for API
  const documentTypeLabels: Record<string, string> = {
    cpiTraining: 'CPI_Training',
    cprTraining: 'CPR_Training',
    crisisPrevention: 'Crisis_Prevention_De_Escalation',
    bciFbiCheck: 'BCI_FBI_Check',
    federalExclusions: 'Federal_Exclusions',
    stateExclusions: 'State_Exclusions',
    samGovExclusion: 'SAM_Gov_Exclusion',
    urineDrugScreen: 'Urine_Drug_Screen',
  };

  // Helpers: find existing approval document by checklist key (for modal)
  const getExistingApprovalDoc = (key: string) => {
    const type = documentTypeLabels[key];
    return approvalDocuments.find((d: any) => d.documentType === type);
  };
  const hasExistingApprovalDoc = (key: string) => !!getExistingApprovalDoc(key);
  
  // Helper: find document for checklist tab view
  const getChecklistTabDoc = (key: string) => {
    const type = documentTypeLabels[key];
    return checklistTabDocuments.find((d: any) => d.documentType === type);
  };

  // Load existing checklist data when modal opens
  useEffect(() => {
    if (existingChecklist && showApprovalModal) {
      setApprovalSelections({
        cpiTraining: existingChecklist.cpiTraining || 'no',
        cprTraining: existingChecklist.cprTraining || 'no',
        crisisPrevention: existingChecklist.crisisPrevention || 'no',
        federalExclusions: existingChecklist.federalExclusions || 'no',
        stateExclusions: existingChecklist.stateExclusions || 'no',
        samGovExclusion: existingChecklist.samGovExclusion || 'no',
        urineDrugScreen: existingChecklist.urineDrugScreen || 'no',
        bciFbiCheck: existingChecklist.bciFbiCheck || 'no',
        laptopSetup: existingChecklist.laptopSetup || 'no',
        emailSetup: existingChecklist.emailSetup || 'no',
        emrSetup: existingChecklist.emrSetup || 'no',
        phoneSetup: existingChecklist.phoneSetup || 'no',
      });

      // Normalize initiated dates from API (timestamps) to YYYY-MM-DD for the date input
      setInitiatedDates(prev => ({
        ...prev,
        urineDrugScreen: existingChecklist.urineDrugScreenInitiatedAt
          ? new Date(existingChecklist.urineDrugScreenInitiatedAt).toISOString().split("T")[0]
          : prev.urineDrugScreen,
        bciFbiCheck: existingChecklist.bciFbiCheckInitiatedAt
          ? new Date(existingChecklist.bciFbiCheckInitiatedAt).toISOString().split("T")[0]
          : prev.bciFbiCheck,
      }));
    }
  }, [existingChecklist, showApprovalModal]);

  // When opening the modal for a new checklist, default initiated dates to today if empty
  useEffect(() => {
    if (showApprovalModal && !existingChecklist) {
      const today = new Date().toISOString().split("T")[0];
      setInitiatedDates(prev => ({
        urineDrugScreen: prev.urineDrugScreen || today,
        bciFbiCheck: prev.bciFbiCheck || today,
      }));
    }
  }, [showApprovalModal, existingChecklist]);

  // Reset dismissed documents when modal opens/closes and refetch documents
  useEffect(() => {
    if (showApprovalModal) {
      // Reset dismissed state when modal opens
      setDismissedExistingDocs(new Set());
      // Clear any pending uploads when modal opens
      setUploadedDocuments({
        cpiTraining: null,
        cprTraining: null,
        crisisPrevention: null,
        federalExclusions: null,
        stateExclusions: null,
        samGovExclusion: null,
        urineDrugScreen: null,
        bciFbiCheck: null,
      });
      // Refetch documents to ensure we have the latest data
      if (employeeId) {
        refetchApprovalDocuments();
      }
    }
  }, [showApprovalModal, employeeId, refetchApprovalDocuments]);

  // Approval mutation
  const approveMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/employees/${employeeId}/approve`, {}),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee approved successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId] });
      setShowApprovalModal(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to approve employee",
        variant: "destructive"
      });
    }
  });

  // Rejection mutation
  const rejectMutation = useMutation({
    mutationFn: (reason?: string) => 
      apiRequest("POST", `/api/employees/${employeeId}/reject`, { reason }),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Employee application rejected"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to reject employee",
        variant: "destructive"
      });
    }
  });

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-3">
            <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="text-muted-foreground animate-pulse">Loading employee profile...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Check if employee is trying to view someone else's profile
  const isOwnProfile = user?.role === "employee" && ownEmployeeData?.id === employeeId;
  const canViewProfile = user?.role === "admin" || user?.role === "hr" || 
                         (user?.role === "employee" && isOwnProfile);

  if (!canViewProfile) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Access Denied</h3>
              <p className="text-muted-foreground mb-4">
                {user?.role === "employee" 
                  ? "You can only view your own profile. Please use 'My Portal' to access your information."
                  : "You don't have permission to view this profile."}
              </p>
              <Button 
                onClick={() => navigate(user?.role === "employee" ? "/employee-portal" : "/")} 
                variant="outline"
              >
                {user?.role === "employee" ? "Go to My Portal" : "Return to Dashboard"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (error || !employee) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md w-full">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Failed to Load Profile</h3>
              <p className="text-muted-foreground mb-4">Unable to fetch employee information</p>
              <Button onClick={() => navigate("/employees")} variant="outline">
                Return to Employees
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  /**
   * Generates user initials from first and last name
   * @param {string} firstName - Employee's first name
   * @param {string} lastName - Employee's last name
   * @returns {string} Uppercase initials for avatar display
   */
  const getUserInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  /**
   * Returns styled status badge based on employee status
   * @param {string} status - Employee status (active, inactive, on_leave)
   * @returns {JSX.Element} Styled badge with icon and gradient colors
   */
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Badge className="bg-gradient-to-r from-secondary/20 to-secondary/10 text-secondary border-secondary/30 px-3 py-1">
            <Activity className="w-3 h-3 mr-1" />
            Active
          </Badge>
        );
      case 'inactive':
        return (
          <Badge className="bg-gradient-to-r from-destructive/20 to-destructive/10 text-destructive border-destructive/30 px-3 py-1">
            <Activity className="w-3 h-3 mr-1" />
            Inactive
          </Badge>
        );
      case 'on_leave':
        return (
          <Badge className="bg-gradient-to-r from-accent/20 to-accent/10 text-accent-foreground border-accent/30 px-3 py-1">
            <Clock className="w-3 h-3 mr-1" />
            On Leave
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  /**
   * Formats date string to human-readable format
   * @param {string | null | undefined} date - Date string to format
   * @returns {string} Formatted date or "Not provided" fallback
   */
  const formatDate = (date: string | null | undefined) => {
    if (!date) return "Not provided";
    return new Date(date).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  /**
   * Formats phone number to standard US format
   * @param {string | null | undefined} phone - Raw phone number
   * @returns {string} Formatted phone number or "Not provided" fallback
   */
  const formatPhoneNumber = (phone: string | null | undefined) => {
    if (!phone) return "Not provided";
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  /**
   * Triggers browser print dialog for profile printing
   */
  const handlePrint = () => {
    window.print();
  };

  /**
   * Handles employee data export functionality
   * @description Placeholder for PDF export functionality
   */
  const handleExport = () => {
    // Export functionality placeholder
    console.log('Exporting employee data...');
  };

  /**
   * Handles radio button selection changes
   * @param {string} key - The field key
   * @param {'yes' | 'no'} value - Selected value
   */
  const handleSelectionChange = (key: string, value: 'yes' | 'no') => {
    setApprovalSelections(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Clear uploaded file if user selects 'no'
    if (value === 'no' && uploadedDocuments.hasOwnProperty(key)) {
      setUploadedDocuments(prev => ({
        ...prev,
        [key]: null
      }));
    }

    // For background checks, when switching to "Initiated" (no), ensure we have a default date
    if ((key === 'urineDrugScreen' || key === 'bciFbiCheck') && value === 'no') {
      setInitiatedDates(prev => ({
        ...prev,
        [key]: prev[key] || new Date().toISOString().split("T")[0],
      }));
    }
  };

  const handleInitiatedDateChange = (key: string, value: string) => {
    setInitiatedDates(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  /**
   * Handles file upload for approval documents
   * @param {string} documentKey - The key identifying which document is being uploaded
   * @param {React.ChangeEvent<HTMLInputElement>} event - The file input change event
   */
  const handleFileUpload = (documentKey: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setUploadedDocuments(prev => ({
      ...prev,
      [documentKey]: file
    }));
    
    // Clear dismissed state when new file is selected
    if (file) {
      setDismissedExistingDocs(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentKey);
        return newSet;
      });
    }
  };

  /**
   * Removes an uploaded file
   * @param {string} documentKey - The key identifying which document to remove
   */
  const handleRemoveFile = (documentKey: string) => {
    setUploadedDocuments(prev => ({
      ...prev,
      [documentKey]: null
    }));
  };

  /**
   * Dismisses an existing document to allow re-upload
   * @param {string} documentKey - The key identifying which document to dismiss
   */
  const handleDismissExistingDoc = (documentKey: string) => {
    setDismissedExistingDocs(prev => new Set(prev).add(documentKey));
  };

  /**
   * Checks if all 5 required background check documents are uploaded
   * @returns {boolean} True if all 5 mandatory docs are "yes" with documents uploaded
   */
  const areAllRequiredBackgroundChecksComplete = () => {
    const mandatoryFields = ['federalExclusions', 'stateExclusions', 'samGovExclusion', 'urineDrugScreen', 'bciFbiCheck'];
    
    // For exclusions (federal/state/SAM): must be 'yes' AND have documents uploaded.
    // For urineDrugScreen / bciFbiCheck:
    //   - EITHER 'yes' with document (Completed)
    //   - OR 'no' with an Initiated date recorded (Initiated)
    for (const field of mandatoryFields) {
      const selection = approvalSelections[field];
      const hasNewDocument = !!uploadedDocuments[field];
      const hasPrevDocument = hasExistingApprovalDoc(field) && !dismissedExistingDocs.has(field);

      if (field === 'urineDrugScreen' || field === 'bciFbiCheck') {
        const initiated = initiatedDates[field];
        const hasCompletedWithDoc = selection === 'yes' && (hasNewDocument || hasPrevDocument);
        const hasInitiatedWithDate = selection === 'no' && !!initiated;

        if (!hasCompletedWithDoc && !hasInitiatedWithDate) {
          return false;
        }
      } else {
        if (selection !== 'yes' || !(hasNewDocument || hasPrevDocument)) {
          return false;
        }
      }
    }
    
    return true;
  };

  /**
   * Checks if any field marked "yes" is missing its document
   * @returns {boolean} True if all "yes" selections have documents
   */
  const areAllSelectedDocumentsValid = () => {
    // Check all fields that need documents (training + background checks)
    const fieldsWithDocs = ['cpiTraining', 'cprTraining', 'crisisPrevention', 'federalExclusions', 'stateExclusions', 'samGovExclusion', 'urineDrugScreen', 'bciFbiCheck'];
    
    for (const field of fieldsWithDocs) {
      // If 'yes' is selected, document must be uploaded
      const hasNewDocument = !!uploadedDocuments[field];
      const hasPrevDocument = hasExistingApprovalDoc(field) && !dismissedExistingDocs.has(field);
      
      if (approvalSelections[field] === 'yes' && !(hasNewDocument || hasPrevDocument)) {
        return false;
      }
    }
    
    return true;
  };

  /**
   * Uploads approval documents to the server
   */
  const uploadApprovalDocuments = async (): Promise<boolean> => {
    try {
      setIsUploadingDocuments(true);
      
      // Collect all documents that need to be uploaded (where 'yes' is selected)
      const docsToUpload: { key: string; file: File }[] = [];
      
      Object.entries(uploadedDocuments).forEach(([key, file]) => {
        if (file && approvalSelections[key] === 'yes') {
          docsToUpload.push({ key, file });
        }
      });
      
      if (docsToUpload.length === 0) {
        return true; // No documents to upload
      }
      
      // Create FormData for multipart upload
      const formData = new FormData();
      
      // Add all files and their types
      const documentTypes: string[] = [];
      docsToUpload.forEach(({ key, file }) => {
        formData.append('documents', file);
        documentTypes.push(documentTypeLabels[key]);
      });
      
      // Add metadata
      formData.append('documentTypes', JSON.stringify(documentTypes));
      formData.append('selections', JSON.stringify(approvalSelections));
      
      // Upload documents using fetch
      const response = await fetch(`/api/employees/${employeeId}/approval-documents`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload documents');
      }
      
      const result = await response.json();
      
      // Refresh documents list to show newly uploaded files
      queryClient.invalidateQueries({ queryKey: ["/api/documents/employee", employeeId] });
      
      toast({
        title: "Documents Uploaded",
        description: `Successfully uploaded ${result.uploaded} document(s).`,
      });
      
      return true;
    } catch (error) {
      console.error('Error uploading documents:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload documents",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsUploadingDocuments(false);
    }
  };

  /**
   * Handles the approval process with documents
   */
  const handleApprovalSubmit = async () => {
    // Validate initiated dates for background checks when they are in "Initiated" state
    const initiatedKeys: Array<keyof typeof initiatedDates> = ['urineDrugScreen', 'bciFbiCheck'];
    for (const key of initiatedKeys) {
      if (approvalSelections[key] === 'no' && !initiatedDates[key]) {
        toast({
          title: "Missing Initiated Date",
          description: "Please select an initiated date for all background checks marked as Initiated.",
          variant: "destructive",
        });
        return;
      }
    }

    // Validate that any field marked "yes" has a document
    if (!areAllSelectedDocumentsValid()) {
      toast({
        title: "Missing Required Information",
        description: "Please upload documents for all fields marked 'Yes'.",
        variant: "destructive"
      });
      return;
    }
    
    // Upload documents first (if any)
    const uploadSuccess = await uploadApprovalDocuments();
    
    if (!uploadSuccess) {
      toast({
        title: "Upload Failed",
        description: "Documents must be uploaded before saving. Please try again.",
        variant: "destructive"
      });
      return;
    }
    
    // Save checklist data to database
    try {
      await apiRequest("POST", `/api/employees/${employeeId}/approval-checklist`, {
        ...approvalSelections,
        urineDrugScreenInitiatedAt: initiatedDates.urineDrugScreen || null,
        bciFbiCheckInitiatedAt: initiatedDates.bciFbiCheck || null,
      });
      
      // Invalidate queries to refresh data (checklist and documents)
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId, "approval-checklist"] });
      queryClient.invalidateQueries({ queryKey: ["/api/documents/employee", employeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees", employeeId] });
      
      // Check if all 5 required background checks are complete
      const allBackgroundChecksComplete = areAllRequiredBackgroundChecksComplete();
      
      if (allBackgroundChecksComplete) {
        // All 5 required documents uploaded → Approve employee
        toast({
          title: "Checklist Saved",
          description: "All required documents uploaded. Approving employee...",
        });
        
        // Approve the employee
        approveMutation.mutate();
      } else {
        // Not all required documents → Just save, don't approve
        toast({
          title: "Checklist Saved",
          description: "Checklist saved successfully. Employee not approved yet - missing required background checks.",
          variant: "default"
        });
        // Close modal and refresh data
        setShowApprovalModal(false);
      }
      
    } catch (error) {
      console.error('Error saving checklist:', error);
      toast({
        title: "Error",
        description: "Failed to save checklist data. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Helper function to render approval field with radio buttons and optional upload
  const renderApprovalField = (
    key: string,
    label: string,
    icon: any,
    isMandatory: boolean,
    needsUpload: boolean,
    index: number
  ) => {
    const Icon = icon;
    const selection = approvalSelections[key];
    const initiatedDate = initiatedDates[key];
    const file = uploadedDocuments[key];
    const isInitiatedCompletionField = key === 'urineDrugScreen' || key === 'bciFbiCheck';

    return (
      <Card key={key} className="border hover:border-primary/50 transition-colors">
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  {index}. {label}
                  {isMandatory && <span className="text-destructive text-xs">*</span>}
                </Label>
              </div>
            </div>

            {/* Radio Buttons */}
            <RadioGroup
              value={selection}
              onValueChange={(value) => handleSelectionChange(key, value as 'yes' | 'no')}
              className="flex gap-4 ml-8"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id={`${key}-yes`} />
                <Label htmlFor={`${key}-yes`} className="cursor-pointer font-normal">
                  {isInitiatedCompletionField ? 'Completed' : 'Yes'}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id={`${key}-no`} />
                <Label htmlFor={`${key}-no`} className="cursor-pointer font-normal">
                  {isInitiatedCompletionField ? 'Initiated' : 'No'}
                </Label>
              </div>
            </RadioGroup>

            {/* File Upload (only shown if "Completed" is selected and field needs upload) */}
            {needsUpload && selection === 'yes' && (
              <div className="ml-8 mt-2">
                {file ? (
                  <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-md">
                    <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                    <span className="text-xs text-green-700 truncate flex-1">
                      {file.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 hover:bg-green-100"
                      onClick={() => handleRemoveFile(key)}
                    >
                      <X className="w-3 h-3 text-green-600" />
                    </Button>
                  </div>
                ) : getExistingApprovalDoc(key) && !dismissedExistingDocs.has(key) ? (() => {
                  const existingDoc = getExistingApprovalDoc(key)!;
                  const isImageDoc = existingDoc.mimeType?.startsWith('image/') || false;
                  return (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-md">
                      <FileCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <span className="text-xs text-blue-700 truncate flex-1">
                        {existingDoc.fileName}
                      </span>
                      <div className="flex items-center gap-1">
                        <a
                          href={`/api/documents/${existingDoc.id}/download`}
                          target={isImageDoc ? "_blank" : undefined}
                          rel={isImageDoc ? "noopener noreferrer" : undefined}
                          className="text-xs text-blue-700 underline hover:text-blue-900"
                        >
                          {isImageDoc ? "View" : "Download"}
                        </a>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 hover:bg-blue-100"
                          onClick={() => handleDismissExistingDoc(key)}
                          title="Remove and re-upload"
                        >
                          <X className="w-3 h-3 text-blue-600" />
                        </Button>
                      </div>
                    </div>
                  );
                })() : (
                  <>
                    <Label
                      htmlFor={`doc-${key}`}
                      className="flex items-center justify-center gap-2 p-2 border-2 border-dashed border-muted-foreground/25 rounded-md hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer"
                    >
                      <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Click to attach document
                      </span>
                    </Label>
                    <Input
                      id={`doc-${key}`}
                      type="file"
                      className="hidden"
                      onChange={(e) => handleFileUpload(key, e)}
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    />
                  </>
                )}
              </div>
            )}

            {isInitiatedCompletionField && selection === 'no' && (
              <div className="ml-8 mt-2 space-y-1">
                <Label className="text-xs text-muted-foreground">
                  Initiated Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  className="w-full"
                  value={initiatedDate || ""}
                  onChange={(e) => handleInitiatedDateChange(key, e.target.value)}
                />
              </div>
            )}

          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <TooltipProvider>
      <MainLayout>
        <div className="space-y-6">
          {/* Breadcrumb Navigation */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/dashboard">
                    <Home className="h-4 w-4" />
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/employees">Employees</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>
                  {employee.firstName} {employee.lastName}
                </BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          {/* Hero Section */}
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border border-primary/10 shadow-sm">
            <div className="absolute inset-0 bg-grid-pattern opacity-5" />
            <div className="relative p-8">
              <div className="flex flex-col lg:flex-row items-center lg:items-start justify-between gap-6">
                <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
                  <Avatar className="h-32 w-32 border-4 border-background shadow-xl ring-4 ring-primary/10">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/70 text-primary-foreground text-4xl font-bold">
                      {getUserInitials(employee.firstName, employee.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center lg:text-left space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight" data-testid="text-employee-name">
                      {employee.firstName} {employee.middleName ? `${employee.middleName} ` : ''}{employee.lastName}
                    </h1>
                    <div className="flex flex-col lg:flex-row items-center lg:items-start gap-3">
                      <p className="text-xl text-muted-foreground font-medium">
                        {employee.jobTitle || "Healthcare Professional"}
                      </p>
                      {employee.workLocation && (
                        <div className="flex items-center text-muted-foreground">
                          <MapPinned className="w-4 h-4 mr-1" />
                          <span>{employee.workLocation}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 pt-2">
                      {getStatusBadge(employee.status)}
                      <span className="text-sm text-muted-foreground">
                        <Clock className="w-3 h-3 inline mr-1" />
                        Last updated: {lastUpdated}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={() => navigate(`/employees/${employeeId}/edit`)}
                        size="lg"
                        data-testid="button-edit"
                        className="shadow-sm"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Profile
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit employee information</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handlePrint}
                        variant="outline"
                        size="lg"
                        data-testid="button-print"
                        className="shadow-sm"
                      >
                        <Printer className="w-4 h-4 mr-2" />
                        Print
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Print profile</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleExport}
                        variant="outline"
                        size="lg"
                        data-testid="button-export"
                        className="shadow-sm"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Export
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export as PDF</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          {/* Approval Section - Shows only for pending employees when user is HR/Admin */}
          {((employee as any)?.applicationStatus === 'pending') && (user?.role === 'admin' || user?.role === 'hr') && (
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader className="bg-warning/10">
                <CardTitle className="flex items-center text-lg">
                  <UserCheck className="w-5 h-5 mr-2 text-warning" />
                  Pending Approval
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="p-4 bg-background rounded-lg border border-warning/20">
                    <p className="text-sm text-muted-foreground mb-4">
                      This employee registration is pending approval. Review their information and decide whether to approve or reject their application.
                    </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        onClick={() => setShowApprovalModal(true)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="bg-green-600 hover:bg-green-700"
                        data-testid="button-approve-employee"
                      >
                        <UserCheck className="w-4 h-4 mr-2" />
                        Approve Employee
                      </Button>
                      <Button
                        onClick={() => rejectMutation.mutate(undefined)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        variant="destructive"
                        data-testid="button-reject-employee"
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        {rejectMutation.isPending ? "Rejecting..." : "Reject Application"}
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                    <Shield className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="text-sm text-muted-foreground">
                      <p className="font-medium">What happens after approval?</p>
                      <ul className="mt-1 space-y-1 ml-2">
                        <li>• Employee role changes from Prospective Employee to Employee</li>
                        <li>• They gain access to the self-service portal</li>
                        <li>• They can view and manage their own information</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Information Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact & Personal Information Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow border-muted/50">
              <CardHeader className="bg-gradient-to-br from-muted/30 to-muted/10 border-b">
                <CardTitle className="flex items-center text-lg">
                  <User className="w-5 h-5 mr-2 text-primary" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Work Email</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm font-medium" data-testid="text-work-email">
                            {employee.workEmail || "Not provided"}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>Primary work email</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Personal Email</p>
                      <p className="text-sm font-medium">
                        {employee.personalEmail || "Not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Phone</p>
                      <p className="text-sm font-medium">
                        {formatPhoneNumber(employee.cellPhone)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Home Address</p>
                      <p className="text-sm font-medium">
                        {employee.homeAddress1 || "Not provided"}
                        {employee.homeAddress2 && <><br />{employee.homeAddress2}</>}
                        {(employee.homeCity || employee.homeState || employee.homeZip) && (
                          <>
                            <br />
                            {[employee.homeCity, employee.homeState, employee.homeZip].filter(Boolean).join(", ")}
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Date of Birth</p>
                      <p className="text-sm font-medium">
                        {formatDate(employee.dateOfBirth)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Professional Credentials Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow border-muted/50">
              <CardHeader className="bg-gradient-to-br from-primary/10 to-primary/5 border-b">
                <CardTitle className="flex items-center text-lg">
                  <Stethoscope className="w-5 h-5 mr-2 text-primary" />
                  Professional Credentials
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Hash className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">NPI Number</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm font-semibold text-primary">
                            {employee.npiNumber || "Not provided"}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>National Provider Identifier</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <FileCheck className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Medical License</p>
                      <p className="text-sm font-semibold text-primary">
                        {employee.medicalLicenseNumber || "Not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <IdCard className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">SSN</p>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-sm font-medium">
                            {employee.ssn ? "***-**-" + employee.ssn.slice(-4) : "Not provided"}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent>Social Security Number (Protected)</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="flex items-start gap-3">
                    <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Medicaid Number</p>
                      <p className="text-sm font-medium">
                        {employee.medicaidNumber || "Not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Medicare PTAN</p>
                      <p className="text-sm font-medium">
                        {employee.medicarePtanNumber || "Not provided"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CAQH & System Information Card */}
            <Card className="shadow-sm hover:shadow-md transition-shadow border-muted/50">
              <CardHeader className="bg-gradient-to-br from-secondary/10 to-secondary/5 border-b">
                <CardTitle className="flex items-center text-lg">
                  <Shield className="w-5 h-5 mr-2 text-secondary" />
                  CAQH & System Info
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <BadgeIcon className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CAQH Provider ID</p>
                      <p className="text-sm font-semibold">
                        {employee.caqhProviderId || "Not provided"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Activity className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">CAQH Status</p>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={employee.caqhEnabled ? "default" : "secondary"}
                          className={employee.caqhEnabled ? "bg-secondary/10 text-secondary border-secondary/30" : ""}
                        >
                          {employee.caqhEnabled ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      {employee.caqhLastAttestationDate && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Last Attestation: {formatDate(employee.caqhLastAttestationDate)}
                        </p>
                      )}
                    </div>
                  </div>

                  <Separator className="my-3" />

                  <div className="flex items-start gap-3">
                    <Building className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Work Location</p>
                      <p className="text-sm font-medium">
                        {employee.workLocation || "Not assigned"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <UserPlus className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Account Created</p>
                      <p className="text-sm font-medium">
                        {formatDate(employee.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <Hash className="w-4 h-4 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Employee ID</p>
                      <p className="text-sm font-medium">
                        #{employee.id.toString().padStart(6, '0')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Enhanced Tabs Section with Vertical Navigation */}
          <Card className="shadow-sm border-muted/50">
            <CardHeader className="bg-gradient-to-r from-muted/20 to-transparent border-b">
              <CardTitle className="text-xl flex items-center">
                <FileText className="w-5 h-5 mr-2 text-primary" />
                Employee Records & Documentation
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs defaultValue="education" className="flex flex-col lg:flex-row w-full" orientation="vertical">
                {/* Desktop: Vertical sidebar, Mobile: Collapsible navigation */}
                <div className="lg:w-64 w-full lg:border-r border-b lg:border-b-0 bg-muted/5">
                  <div className="lg:hidden p-3 border-b bg-muted/10">
                    <p className="text-sm font-medium text-muted-foreground">Navigate Sections</p>
                  </div>
                  <TabsList className="flex flex-col h-full w-full bg-transparent rounded-none p-2 gap-1 max-h-[400px] lg:max-h-full overflow-y-auto lg:overflow-visible">
                    <TabsTrigger 
                      value="education"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                    >
                      <GraduationCap className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">Education</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="employment"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                    >
                      <Briefcase className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">Employment History</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="state-licenses"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                    >
                      <Shield className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">State Licenses</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="dea-licenses"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                    >
                      <Shield className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">DEA Licenses</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="certifications"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                    >
                      <Award className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">Board Certifications</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="trainings"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                    >
                      <GraduationCap className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">Training & Courses</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="references"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                    >
                      <UserCheck className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">Peer References</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="emergency"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                    >
                      <Users className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">Emergency Contacts</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="tax"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                    >
                      <FileText className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">Tax Forms</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="forms"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                      data-testid="tab-forms"
                    >
                      <FileSignature className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">DocuSeal Forms</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="documents"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                      data-testid="tab-documents"
                    >
                      <FileCheck className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">Documents</span>
                    </TabsTrigger>
                  <TabsTrigger 
                    value="tasks"
                    className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                    data-testid="tab-tasks"
                  >
                    <FileText className="w-4 h-4 mr-3 flex-shrink-0" />
                    <span className="text-left">Tasks</span>
                  </TabsTrigger>
                    <TabsTrigger 
                      value="checklist-documents"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                      data-testid="tab-checklist-documents"
                    >
                      <FileSignature className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">Checklist Documents</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="payer"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                    >
                      <CreditCard className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">Payer Enrollments</span>
                    </TabsTrigger>
                    <TabsTrigger 
                      value="incidents"
                      className="w-full justify-start data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-l-2 data-[state=active]:border-primary rounded-md h-10 px-3 hover:bg-muted/50 transition-colors"
                    >
                      <AlertTriangle className="w-4 h-4 mr-3 flex-shrink-0" />
                      <span className="text-left">Incident Reports</span>
                    </TabsTrigger>
                  </TabsList>
                </div>
                
                <div className="flex-1 p-4 lg:p-6 min-h-[500px]">
                  <TabsContent value="education" className="mt-0 animate-in fade-in-50 duration-300">
                    <EducationsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="employment" className="mt-0 animate-in fade-in-50 duration-300">
                    <EmploymentsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="state-licenses" className="mt-0 animate-in fade-in-50 duration-300">
                    <LicensesManager employeeId={employeeId} type="state" />
                  </TabsContent>
                  
                  <TabsContent value="dea-licenses" className="mt-0 animate-in fade-in-50 duration-300">
                    <LicensesManager employeeId={employeeId} type="dea" />
                  </TabsContent>
                  
                  <TabsContent value="certifications" className="mt-0 animate-in fade-in-50 duration-300">
                    <BoardCertificationsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="trainings" className="mt-0 animate-in fade-in-50 duration-300">
                    <TrainingsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="references" className="mt-0 animate-in fade-in-50 duration-300">
                    <PeerReferencesManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="emergency" className="mt-0 animate-in fade-in-50 duration-300">
                    <EmergencyContactsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="tax" className="mt-0 animate-in fade-in-50 duration-300">
                    <TaxFormsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="payer" className="mt-0 animate-in fade-in-50 duration-300">
                    <PayerEnrollmentsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="incidents" className="mt-0 animate-in fade-in-50 duration-300">
                    <IncidentLogsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="forms" className="mt-0 animate-in fade-in-50 duration-300">
                    <FormsManager employeeId={employeeId} />
                  </TabsContent>
                  
                  <TabsContent value="documents" className="mt-0 animate-in fade-in-50 duration-300">
                    <div className="space-y-6">
                      <DocumentUploader employeeId={employeeId} />
                      <DocumentList employeeId={employeeId} />
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="tasks" className="mt-0 animate-in fade-in-50 duration-300">
                    <EmployeeTasks employeeId={employeeId} employeeName={`${employee.firstName} ${employee.lastName}`} />
                  </TabsContent>
                  
                  <TabsContent value="checklist-documents" className="mt-0 animate-in fade-in-50 duration-300">
                    <div className="space-y-6">
                      <div className="border-b pb-4">
                        <h3 className="text-xl font-semibold mb-2">Approval Checklist Documents</h3>
                        <p className="text-sm text-muted-foreground">
                          View the status of all approval checklist items and their associated documents.
                        </p>
                      </div>
                      
                      {!checklistData ? (
                        <Card>
                          <CardContent className="pt-6 pb-6 text-center">
                            <FileCheck className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                            <p className="text-muted-foreground">No checklist data found for this employee.</p>
                          </CardContent>
                        </Card>
                      ) : (
                        <Card>
                          <CardContent className="p-0">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[40%]">Checklist Item</TableHead>
                                  {/* <TableHead className="w-[15%]">Category</TableHead> */}
                                  <TableHead className="w-[15%] text-center">Status</TableHead>
                                  <TableHead className="w-[15%] text-center">Document</TableHead>
                                  <TableHead className="w-[15%] text-center">Action</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {/* Optional Training Section */}
                                {[
                                  { key: 'cpiTraining', label: 'CPI Training Completed', icon: GraduationCap, category: 'Optional Training', required: false },
                                  { key: 'cprTraining', label: 'CPR Training Completed', icon: Activity, category: 'Optional Training', required: false },
                                  { key: 'crisisPrevention', label: 'Crisis Prevention/De-Escalation Training Completed', icon: Shield, category: 'Optional Training', required: false },
                                ].map(({ key, label, icon: Icon, category, required }) => {
                                  const status = checklistData[key] || 'no';
                                  const doc = getChecklistTabDoc(key);
                                  const isImageDoc = doc?.mimeType?.startsWith('image/') || false;
                                  
                                  return (
                                    <TableRow key={key}>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                                          <span className="font-medium">{label}</span>
                                        </div>
                                      </TableCell>
                                      {/* <TableCell>
                                        <span className="text-sm text-muted-foreground">{category}</span>
                                      </TableCell> */}
                                      <TableCell className="text-center">
                                        <Badge 
                                          variant={status === 'yes' ? 'default' : 'secondary'} 
                                          className={`text-xs ${status === 'yes' ? 'bg-green-100 text-green-800 border-green-200' : ''}`}
                                        >
                                          {status === 'yes' ? 'Yes' : 'No'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {doc ? (
                                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                            <FileCheck className="w-3 h-3 mr-1" />
                                            Uploaded
                                          </Badge>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {doc ? (
                                          <a
                                            href={`/api/documents/${doc.id}/download`}
                                            target={isImageDoc ? "_blank" : undefined}
                                            rel={isImageDoc ? "noopener noreferrer" : undefined}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/5 rounded border border-primary/20 hover:border-primary/40 transition-colors"
                                          >
                                            {isImageDoc ? (
                                              <>
                                                <FileCheck className="w-3 h-3" />
                                                View
                                              </>
                                            ) : (
                                              <>
                                                <Download className="w-3 h-3" />
                                                Download
                                              </>
                                            )}
                                          </a>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                                
                                {/* Required Background Checks Section */}
                                {[
                                  { key: 'federalExclusions', label: 'Federal Exclusions', icon: AlertTriangle, category: 'Required Checks', required: true },
                                  { key: 'stateExclusions', label: 'State Exclusions', icon: AlertTriangle, category: 'Required Checks', required: true },
                                  { key: 'samGovExclusion', label: 'SAM.gov Exclusion', icon: FileCheck, category: 'Required Checks', required: true },
                                  { key: 'urineDrugScreen', label: 'Urine Drug Screen', icon: Stethoscope, category: 'Required Checks', required: true },
                                  { key: 'bciFbiCheck', label: 'BCI/FBI Check', icon: Shield, category: 'Required Checks', required: true },
                                ].map(({ key, label, icon: Icon, category, required }) => {
                                  const status = checklistData[key] || 'no';
                                  const doc = getChecklistTabDoc(key);
                                  const isImageDoc = doc?.mimeType?.startsWith('image/') || false;
                                  const isInitiatedField = key === 'urineDrugScreen' || key === 'bciFbiCheck';
                                  const initiatedAt =
                                    key === 'urineDrugScreen'
                                      ? checklistData.urineDrugScreenInitiatedAt
                                      : key === 'bciFbiCheck'
                                      ? checklistData.bciFbiCheckInitiatedAt
                                      : null;
                                  
                                  return (
                                    <TableRow key={key} className={required ? "bg-red-50/30" : ""}>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                                          <div className="flex items-center gap-1">
                                            <span className="font-medium">{label}</span>
                                            {required && <span className="text-destructive text-sm font-semibold">*</span>}
                                          </div>
                                        </div>
                                      </TableCell>
                                      {/* <TableCell>
                                        <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-200">
                                          {category}
                                        </Badge>
                                      </TableCell> */}
                                      <TableCell className="text-center">
                                        <div className="flex flex-col items-center gap-1">
                                          <Badge 
                                            variant={status === 'yes' ? 'default' : 'secondary'} 
                                            className={`text-xs ${status === 'yes' ? 'bg-green-100 text-green-800 border-green-200' : ''}`}
                                          >
                                            {isInitiatedField
                                              ? status === 'yes'
                                                ? 'Completed'
                                                : initiatedAt
                                                ? 'Initiated'
                                                : 'No'
                                              : status === 'yes'
                                              ? 'Yes'
                                              : 'No'}
                                          </Badge>
                                          {isInitiatedField && initiatedAt && (
                                            <h5 className="text-xs font-normal">
                                              Initiated: {formatDate(initiatedAt)}
                                            </h5>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {doc ? (
                                          <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                            <FileCheck className="w-3 h-3 mr-1" />
                                            Uploaded
                                          </Badge>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        {doc ? (
                                          <a
                                            href={`/api/documents/${doc.id}/download`}
                                            target={isImageDoc ? "_blank" : undefined}
                                            rel={isImageDoc ? "noopener noreferrer" : undefined}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/5 rounded border border-primary/20 hover:border-primary/40 transition-colors"
                                          >
                                            {isImageDoc ? (
                                              <>
                                                <FileCheck className="w-3 h-3" />
                                                View
                                              </>
                                            ) : (
                                              <>
                                                <Download className="w-3 h-3" />
                                                Download
                                              </>
                                            )}
                                          </a>
                                        ) : (
                                          <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                                
                                {/* Equipment & System Setup Section */}
                                {[
                                  { key: 'laptopSetup', label: 'Laptop Ordered/Setup', icon: Building, category: 'Equipment Setup', required: false },
                                  { key: 'emailSetup', label: 'Email Setup', icon: Mail, category: 'Equipment Setup', required: false },
                                  { key: 'emrSetup', label: 'EMR Setup', icon: FileText, category: 'Equipment Setup', required: false },
                                  { key: 'phoneSetup', label: 'Phone Setup', icon: Phone, category: 'Equipment Setup', required: false },
                                ].map(({ key, label, icon: Icon, category }) => {
                                  const status = checklistData[key] || 'no';
                                  
                                  return (
                                    <TableRow key={key}>
                                      <TableCell>
                                        <div className="flex items-center gap-2">
                                          <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                                          <span className="font-medium">{label}</span>
                                        </div>
                                      </TableCell>
                                      {/* <TableCell>
                                        <span className="text-sm text-muted-foreground">{category}</span>
                                      </TableCell> */}
                                      <TableCell className="text-center">
                                        <Badge 
                                          variant={status === 'yes' ? 'default' : 'secondary'} 
                                          className={`text-xs ${status === 'yes' ? 'bg-green-100 text-green-800 border-green-200' : ''}`}
                                        >
                                          {status === 'yes' ? 'Yes' : 'No'}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <span className="text-xs text-muted-foreground">N/A</span>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <span className="text-xs text-muted-foreground">—</span>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Approval Documents Modal */}
        <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center text-2xl">
                <UserCheck className="w-6 h-6 mr-2 text-green-600" />
                Employee Approval Checklist
              </DialogTitle>
              <DialogDescription className="space-y-2">
                <p>
                  Please complete the following checklist for employee approval. Upload documents where required when "Yes" is selected.
                </p>
              </DialogDescription>
            </DialogHeader>

            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-4 py-2">
                {/* Optional Training Section */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4" />
                    Optional Training (Attach document if completed)
                  </h3>
                  {renderApprovalField('cpiTraining', 'CPI Training Completed', GraduationCap, false, true, 1)}
                  {renderApprovalField('cprTraining', 'CPR Training Completed', Activity, false, true, 2)}
                  {renderApprovalField('crisisPrevention', 'Crisis Prevention/De-Escalation Training Completed', Shield, false, true, 3)}
                </div>

                <Separator />

                {/* Mandatory Checks Section */}
                <div>
                  <h3 className="text-sm font-semibold text-destructive mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Required Background Checks & Screenings
                  </h3>
                  {renderApprovalField('federalExclusions', 'Federal Exclusions', AlertTriangle, true, true, 4)}
                  {renderApprovalField('stateExclusions', 'State Exclusions', AlertTriangle, true, true, 5)}
                  {renderApprovalField('samGovExclusion', 'SAM.gov Exclusion', FileCheck, true, true, 6)}
                  {renderApprovalField('urineDrugScreen', 'Urine Drug Screen', Stethoscope, true, true, 7)}
                  {renderApprovalField('bciFbiCheck', 'BCI/FBI Check', Shield, true, true, 8)}
                </div>

                <Separator />

                {/* Setup Section (No uploads) */}
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    Equipment & System Setup
                  </h3>
                  {renderApprovalField('laptopSetup', 'Laptop Ordered/Setup', Building, false, false, 9)}
                  {renderApprovalField('emailSetup', 'Email Setup', Mail, false, false, 10)}
                  {renderApprovalField('emrSetup', 'EMR Setup', FileText, false, false, 11)}
                  {renderApprovalField('phoneSetup', 'Phone Setup', Phone, false, false, 12)}
                </div>

                {/* Summary */}
                <Card className={`border-2 ${areAllRequiredBackgroundChecksComplete() ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {areAllRequiredBackgroundChecksComplete() ? (
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                        )}
                        <span className="font-medium">Approval Status</span>
                      </div>
                      <Badge 
                        variant={areAllRequiredBackgroundChecksComplete() ? "default" : "secondary"}
                        className={`text-base px-3 py-1 ${
                          areAllRequiredBackgroundChecksComplete() 
                            ? 'bg-green-600 hover:bg-green-700' 
                            : 'bg-amber-600 text-white hover:bg-amber-700'
                        }`}
                      >
                        {areAllRequiredBackgroundChecksComplete() ? 'Ready to Approve ✓' : 'Save Checklist Only'}
                      </Badge>
                    </div>
                    {areAllRequiredBackgroundChecksComplete() ? (
                      <p className="text-sm text-green-700 mt-2 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        All 5 required background checks uploaded. Employee will be approved.
                      </p>
                    ) : (
                      <p className="text-sm text-amber-700 mt-2 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" />
                        Missing required background checks. Checklist will be saved without approval.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </ScrollArea>

            <DialogFooter className="flex-col sm:flex-row gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowApprovalModal(false)}
                disabled={approveMutation.isPending || isUploadingDocuments}
              >
                Cancel
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      type="button"
                      onClick={handleApprovalSubmit}
                      disabled={!areAllSelectedDocumentsValid() || approveMutation.isPending || isUploadingDocuments}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50"
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      {isUploadingDocuments 
                        ? "Uploading Documents..." 
                        : approveMutation.isPending 
                        ? "Approving..." 
                        : areAllRequiredBackgroundChecksComplete()
                        ? "Complete Approval"
                        : "Save Checklist"}
                    </Button>
                  </div>
                </TooltipTrigger>
                {!areAllSelectedDocumentsValid() ? (
                  <TooltipContent>
                    <p>Please upload documents for all fields where "Yes" is selected</p>
                  </TooltipContent>
                ) : !areAllRequiredBackgroundChecksComplete() ? (
                  <TooltipContent>
                    <p>Missing required background checks. Will save checklist only (no approval)</p>
                  </TooltipContent>
                ) : (
                  <TooltipContent>
                    <p>All required documents uploaded. Will approve employee</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </MainLayout>
    </TooltipProvider>
  );
}