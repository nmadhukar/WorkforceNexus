import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileSignature,
  CheckCircle,
  Clock,
  Send,
  User,
  Mail,
  Calendar,
  Hash,
  AlertCircle,
  RefreshCw,
  FileText,
  ChevronRight,
  Eye,
  PenTool,
  SendHorizonal,
  Users,
  Info,
  ExternalLink,
} from "lucide-react";

interface EmployeeFormsProps {
  data: any;
  onChange?: (data: any) => void;
  employeeId?: number;
  onboardingId?: number;
  onValidationChange?: (isValid: boolean) => void;
  registerValidation?: (fn: () => boolean) => void;
}

interface TemplateSigner {
  id: string;
  name: string;
  role: string;
  required: boolean;
}

interface RequiredTemplate {
  id: number;
  templateId: string;
  name: string;
  description?: string;
  isRequired: boolean;
  signers?: TemplateSigner[];
}

interface SubmissionSigner {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'pending' | 'sent' | 'opened' | 'completed';
  sentAt?: string;
  openedAt?: string;
  completedAt?: string;
}

interface FormSubmission {
  id: number;
  templateId: string;
  templateName?: string;
  submissionId: string;
  status: 'pending' | 'sent' | 'opened' | 'completed';
  signerEmail?: string;
  employeeId?: number;
  sentAt?: string | null;
  openedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  signers?: SubmissionSigner[];
}

interface SubmissionDetail {
  submissionId: string;
  templateName: string;
  status: string;
  createdAt: string;
  signers: Array<{
    name: string;
    email: string;
    status: 'pending' | 'sent' | 'opened' | 'completed';
    sentAt?: string;
    openedAt?: string;
    completedAt?: string;
  }>;
}

/**
 * Employee Forms Component
 * Displays and manages DocuSeal forms that require signing during onboarding
 */
export function EmployeeForms({ 
  data, 
  onChange, 
  employeeId,
  onboardingId,
  onValidationChange,
  registerValidation
}: EmployeeFormsProps) {
  const { toast } = useToast();
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionDetail | null>(null);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [sendingForm, setSendingForm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("sign");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailDialogData, setEmailDialogData] = useState<{templateId: string; signer: TemplateSigner} | null>(null);
  const [emailInput, setEmailInput] = useState("");

  // Only show forms when we have either an employee ID or an onboarding ID
  const canShowForms = !!(employeeId || onboardingId);

  // Fetch required templates
  const { data: requiredTemplates = [], isLoading: templatesLoading } = useQuery<RequiredTemplate[]>({
    queryKey: ["/api/onboarding/required-forms"],
    enabled: canShowForms,
    retry: 2,
  });

  // Fetch form submissions for onboarding
  const { 
    data: submissions = [], 
    isLoading: submissionsLoading,
    refetch: refetchSubmissions 
  } = useQuery<FormSubmission[]>({
    queryKey: [`/api/onboarding/${onboardingId}/form-submissions`],
    enabled: !!onboardingId,
    refetchInterval: 15000, // Poll every 15 seconds
    retry: false,
  });

  // Calculate validation data
  useEffect(() => {
    if (onChange && requiredTemplates.length > 0) {
      const completedForms = submissions.filter(s => s.status === 'completed').length;
      const totalRequiredForms = requiredTemplates.length;
      const allFormsCompleted = completedForms === totalRequiredForms && totalRequiredForms > 0;

      const formData = {
        ...data,
        submissions: submissions.map(s => ({
          templateId: s.templateId,
          submissionId: s.submissionId,
          status: s.status
        })),
        completedForms,
        totalRequiredForms,
        allFormsCompleted,
        requiredTemplates: requiredTemplates.map(t => t.templateId)
      };

      onChange(formData);
    }
  }, [submissions, requiredTemplates, data, onChange]);

  // Send form mutation
  const sendFormMutation = useMutation({
    mutationFn: async ({ templateId, email }: { templateId: string; email: string }) => {
      if (!onboardingId) {
        throw new Error("Onboarding ID is required");
      }
      
      return await apiRequest("POST", `/api/onboarding/${onboardingId}/send-form`, {
        templateId,
        signerEmail: email,
        employeeId: employeeId || null
      });
    },
    onSuccess: () => {
      toast({
        title: "Form Sent",
        description: "The form has been sent successfully to the employee.",
      });
      refetchSubmissions();
      setSendingForm(null);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Form",
        description: error.message || "Unable to send the form. Please try again.",
        variant: "destructive",
      });
      setSendingForm(null);
    },
  });

  // Get signing URL mutation
  const getSigningUrlMutation = useMutation({
    mutationFn: async ({ submissionId, signerEmail }: { submissionId: string; signerEmail: string }) => {
      const response = await apiRequest(
        "GET", 
        `/api/forms/submissions/${submissionId}/sign?signer=${encodeURIComponent(signerEmail)}`
      );
      return response.json();
    },
    onSuccess: (data) => {
      if (data.signingUrl) {
        window.open(data.signingUrl, '_blank');
        toast({
          title: "Opening Signing Page",
          description: "The document has been opened in a new tab for signing.",
        });
      }
      setSubmissionModalOpen(false);
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Open Document",
        description: error.message || "Unable to open the signing page. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send reminder mutation
  const sendReminderMutation = useMutation({
    mutationFn: async ({ submissionId, signerEmail }: { submissionId: string; signerEmail: string }) => {
      return await apiRequest("POST", `/api/forms/submissions/${submissionId}/remind`, {
        signerEmail,
      });
    },
    onSuccess: () => {
      toast({
        title: "Reminder Sent",
        description: "A reminder email has been sent to the employee.",
      });
      refetchSubmissions();
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Reminder",
        description: error.message || "Unable to send reminder. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string, templateId?: string, signerId?: string) => {
    const testId = templateId && signerId ? `status-badge-${templateId}-${signerId}` : 
                   templateId ? `status-badge-${templateId}` : undefined;
    
    switch (status) {
      case 'completed':
        return (
          <Badge 
            className="bg-green-100 text-green-800 border-green-200"
            data-testid={testId}
          >
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'sent':
        return (
          <Badge 
            className="bg-blue-100 text-blue-800 border-blue-200"
            data-testid={testId}
          >
            <Send className="w-3 h-3 mr-1" />
            Sent
          </Badge>
        );
      case 'opened':
        return (
          <Badge 
            className="bg-indigo-100 text-indigo-800 border-indigo-200"
            data-testid={testId}
          >
            <Eye className="w-3 h-3 mr-1" />
            Opened
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge 
            className="bg-gray-100 text-gray-800 border-gray-200"
            data-testid={testId}
          >
            <Clock className="w-3 h-3 mr-1" />
            Not Sent
          </Badge>
        );
    }
  };

  const formatDate = (date: string | null | undefined) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSendForm = async (templateId: string) => {
    const email = data?.workEmail || data?.email || "";
    
    if (!email) {
      toast({
        title: "Email Required",
        description: "Please provide an employee email address before sending forms.",
        variant: "destructive",
      });
      return;
    }

    setSendingForm(templateId);
    await sendFormMutation.mutateAsync({ templateId, email });
  };

  // New function to send form to individual signer
  const handleSendToSigner = async (templateId: string, signer: TemplateSigner, email: string) => {
    if (!email) {
      toast({
        title: "Email Required",
        description: `Please provide an email address for ${signer.name || signer.role}.`,
        variant: "destructive",
      });
      return;
    }

    setSendingForm(`${templateId}-${signer.id}`);
    try {
      await sendFormMutation.mutateAsync({ templateId, email });
    } finally {
      setSendingForm(null);
    }
  };

  // Function to prompt for signer email
  const promptForSignerEmail = (templateId: string, signer: TemplateSigner) => {
    setEmailDialogData({ templateId, signer });
    setEmailInput("");
    setEmailDialogOpen(true);
  };

  // Handle email submission from dialog
  const handleEmailSubmit = async () => {
    if (!emailDialogData) return;
    
    if (!emailInput || !emailInput.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return;
    }

    setEmailDialogOpen(false);
    await handleSendToSigner(emailDialogData.templateId, emailDialogData.signer, emailInput);
    setEmailDialogData(null);
  };

  const handleSignNow = (submission: FormSubmission, signerEmail?: string) => {
    const email = signerEmail || submission.signerEmail || data?.workEmail || data?.email || "";
    if (email) {
      getSigningUrlMutation.mutate({
        submissionId: submission.submissionId,
        signerEmail: email,
      });
    }
  };

  const handleSignerReminder = (submission: FormSubmission, signerEmail: string) => {
    sendReminderMutation.mutate({
      submissionId: submission.submissionId,
      signerEmail: signerEmail,
    });
  };

  // If no employee or onboarding context, show waiting message
  if (!canShowForms) {
    return (
      <Card data-testid="docuseal-forms-section">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-muted-foreground" />
            <CardTitle>DocuSeal Forms</CardTitle>
          </div>
          <CardDescription>
            Forms will be available after the employee is created. Complete the initial setup and save the employee first.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Loading state
  if (templatesLoading || submissionsLoading) {
    return (
      <Card data-testid="docuseal-forms-section">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-muted-foreground" />
            <CardTitle>DocuSeal Forms</CardTitle>
          </div>
          <CardDescription>Loading forms...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Empty state - no forms configured
  if (requiredTemplates.length === 0) {
    return (
      <Card data-testid="docuseal-forms-section">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-muted-foreground" />
            <CardTitle>DocuSeal Forms</CardTitle>
          </div>
          <CardDescription>Please review and sign all required forms below</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              No forms are currently required for onboarding.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card data-testid="docuseal-forms-section">
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileSignature className="w-5 h-5 text-muted-foreground" />
            <CardTitle>DocuSeal Forms</CardTitle>
          </div>
          <CardDescription>Manage and sign all required onboarding forms</CardDescription>
          
          {/* Progress indicator */}
          {requiredTemplates.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Overall Progress</span>
                <span className="font-medium">
                  {submissions.filter(s => s.status === 'completed').length} / {requiredTemplates.length} completed
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${(submissions.filter(s => s.status === 'completed').length / requiredTemplates.length) * 100}%`
                  }}
                />
              </div>
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="sign" className="flex items-center gap-2">
                <PenTool className="h-4 w-4" />
                Sign Forms
              </TabsTrigger>
              <TabsTrigger value="send" className="flex items-center gap-2">
                <SendHorizonal className="h-4 w-4" />
                Send Forms
              </TabsTrigger>
            </TabsList>

            {/* Sign Forms Tab */}
            <TabsContent value="sign" className="space-y-4 mt-4">
              <Alert className="border-blue-200 bg-blue-50">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-900">
                  <strong>For Employees:</strong> Click "Sign Form" to complete your required documents.
                  <br />
                  <strong>For HR:</strong> You can facilitate in-person signing by clicking "Sign Form" while the employee is present.
                </AlertDescription>
              </Alert>

              {requiredTemplates.map((template) => {
                const submission = submissions.find(s => s.templateId === template.templateId);
                const templateSigners = template.signers || [{ id: 'default', name: 'Employee', role: 'employee', required: true }];
                const submissionSigners = submission?.signers || [];
                
                return (
                  <Card 
                    key={template.templateId}
                    data-testid={`form-card-sign-${template.templateId}`}
                    className="border"
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Template Header */}
                        <div className="flex items-center gap-2">
                          <FileSignature className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-medium">{template.name}</h4>
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        )}
                        
                        {/* Signers List */}
                        <div className="space-y-2 mt-3">
                          <div className="text-sm font-medium text-muted-foreground">Signers:</div>
                          <div className="space-y-2">
                            {templateSigners.map((templateSigner, index) => {
                              // Find the corresponding submission signer
                              const submissionSigner = submissionSigners.find(
                                s => s.role === templateSigner.role || s.id === templateSigner.id
                              ) || submissionSigners[index];
                              
                              const signerStatus = submissionSigner?.status || (submission ? 'pending' : 'pending');
                              const signerEmail = submissionSigner?.email || 
                                                  (templateSigner.role === 'employee' ? (data?.workEmail || data?.email || '') : '');
                              const canSignerSign = submissionSigner && ['sent', 'opened'].includes(signerStatus);
                              
                              return (
                                <div 
                                  key={`${template.templateId}-${templateSigner.id}`}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                  data-testid={`signer-row-${template.templateId}-${templateSigner.id}`}
                                >
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <User className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-sm font-medium">
                                        {templateSigner.name || `Signer ${index + 1}`}
                                        {templateSigner.role && ` (${templateSigner.role})`}
                                      </span>
                                    </div>
                                    {signerEmail && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Mail className="h-3 w-3" />
                                        <span>{signerEmail}</span>
                                      </div>
                                    )}
                                    {submissionSigner && (
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        {submissionSigner.sentAt && (
                                          <span className="flex items-center gap-1">
                                            <Send className="h-3 w-3" />
                                            Sent: {formatDate(submissionSigner.sentAt)}
                                          </span>
                                        )}
                                        {submissionSigner.openedAt && (
                                          <span className="flex items-center gap-1">
                                            <Eye className="h-3 w-3" />
                                            Opened: {formatDate(submissionSigner.openedAt)}
                                          </span>
                                        )}
                                        {submissionSigner.completedAt && (
                                          <span className="flex items-center gap-1">
                                            <CheckCircle className="h-3 w-3 text-green-600" />
                                            Done: {formatDate(submissionSigner.completedAt)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {getStatusBadge(signerStatus, template.templateId, templateSigner.id)}
                                    {submission ? (
                                      signerStatus === 'completed' ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled
                                          data-testid={`button-sign-${template.templateId}-${templateSigner.id}`}
                                        >
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          Signed
                                        </Button>
                                      ) : canSignerSign ? (
                                        <Button
                                          size="sm"
                                          onClick={() => handleSignNow(submission, signerEmail)}
                                          disabled={getSigningUrlMutation.isPending}
                                          data-testid={`button-sign-${template.templateId}-${templateSigner.id}`}
                                        >
                                          <PenTool className="h-4 w-4 mr-2" />
                                          Sign
                                        </Button>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled
                                          data-testid={`button-sign-${template.templateId}-${templateSigner.id}`}
                                        >
                                          <Clock className="h-4 w-4 mr-2" />
                                          Pending
                                        </Button>
                                      )
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="secondary"
                                        onClick={() => setActiveTab("send")}
                                        data-testid={`button-sign-${template.templateId}-${templateSigner.id}`}
                                      >
                                        <SendHorizonal className="h-4 w-4 mr-2" />
                                        Go to Send Tab
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>

            {/* Send Forms Tab */}
            <TabsContent value="send" className="space-y-4 mt-4">
              <Alert>
                <Users className="h-4 w-4" />
                <AlertDescription>
                  Send forms to employees for electronic signing or facilitate in-person signing. 
                  Sent forms can be accessed from the "Sign Forms" tab.
                </AlertDescription>
              </Alert>

              {requiredTemplates.map((template) => {
                const submission = submissions.find(s => s.templateId === template.templateId);
                const isSending = sendingForm === template.templateId;
                const templateSigners = template.signers || [{ id: 'default', name: 'Employee', role: 'employee', required: true }];
                const submissionSigners = submission?.signers || [];
                
                return (
                  <Card 
                    key={template.templateId}
                    data-testid={`form-card-send-${template.templateId}`}
                    className="border"
                  >
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {/* Template Header */}
                        <div className="flex items-center gap-2">
                          <FileSignature className="h-4 w-4 text-muted-foreground" />
                          <h4 className="font-medium">{template.name}</h4>
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground">{template.description}</p>
                        )}
                        
                        {/* Signers Management */}
                        <div className="space-y-2 mt-3">
                          <div className="text-sm font-medium text-muted-foreground">Manage Signers:</div>
                          <div className="space-y-2">
                            {templateSigners.map((templateSigner, index) => {
                              // Find the corresponding submission signer
                              const submissionSigner = submissionSigners.find(
                                s => s.role === templateSigner.role || s.id === templateSigner.id
                              ) || submissionSigners[index];
                              
                              const signerStatus = submissionSigner?.status || (submission ? 'pending' : 'pending');
                              const signerEmail = submissionSigner?.email || 
                                                  (templateSigner.role === 'employee' ? (data?.workEmail || data?.email || '') : '');
                              const isCompleted = signerStatus === 'completed';
                              
                              return (
                                <div 
                                  key={`${template.templateId}-${templateSigner.id}`}
                                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                                  data-testid={`signer-manage-row-${template.templateId}-${templateSigner.id}`}
                                >
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <User className="h-3 w-3 text-muted-foreground" />
                                      <span className="text-sm font-medium">
                                        {templateSigner.name || `Signer ${index + 1}`}
                                        {templateSigner.role && ` (${templateSigner.role})`}
                                      </span>
                                    </div>
                                    {signerEmail && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Mail className="h-3 w-3" />
                                        <span>{signerEmail}</span>
                                      </div>
                                    )}
                                    {submissionSigner && (
                                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                        {submissionSigner.sentAt && (
                                          <span className="flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            Sent: {formatDate(submissionSigner.sentAt)}
                                          </span>
                                        )}
                                        {submissionSigner.completedAt && (
                                          <span className="flex items-center gap-1">
                                            <CheckCircle className="h-3 w-3 text-green-600" />
                                            Done: {formatDate(submissionSigner.completedAt)}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  
                                  <div className="flex items-center gap-2">
                                    {getStatusBadge(signerStatus, template.templateId, templateSigner.id)}
                                    {submission ? (
                                      isCompleted ? (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          disabled
                                          data-testid={`button-manage-${template.templateId}-${templateSigner.id}`}
                                        >
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          Done
                                        </Button>
                                      ) : (
                                        <div className="flex gap-2">
                                          {signerStatus !== 'pending' && signerEmail && (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              onClick={() => handleSignerReminder(submission, signerEmail)}
                                              disabled={sendReminderMutation.isPending}
                                              data-testid={`button-remind-${template.templateId}-${templateSigner.id}`}
                                            >
                                              <RefreshCw className="h-4 w-4 mr-2" />
                                              Remind
                                            </Button>
                                          )}
                                          {signerEmail && (
                                            <Button
                                              size="sm"
                                              onClick={() => handleSignNow(submission, signerEmail)}
                                              disabled={getSigningUrlMutation.isPending}
                                              data-testid={`button-view-${template.templateId}-${templateSigner.id}`}
                                            >
                                              <ExternalLink className="h-4 w-4 mr-2" />
                                              View
                                            </Button>
                                          )}
                                        </div>
                                      )
                                    ) : (() => {
                                      const isSendingCurrent = sendingForm === `${template.templateId}-${templateSigner.id}`;
                                      return (onboardingId || employeeId) && (
                                        <Button
                                          size="sm"
                                          onClick={() => {
                                            // If signer doesn't have email and isn't employee, prompt for email
                                            if (!signerEmail && templateSigner.role !== 'employee') {
                                              promptForSignerEmail(template.templateId, templateSigner);
                                            } else if (signerEmail) {
                                              handleSendToSigner(template.templateId, templateSigner, signerEmail);
                                            } else {
                                              // For employee role, use the employee's email
                                              const employeeEmail = data?.workEmail || data?.email || "";
                                              if (employeeEmail) {
                                                handleSendToSigner(template.templateId, templateSigner, employeeEmail);
                                              } else {
                                                toast({
                                                  title: "Email Required",
                                                  description: "Please provide an employee email address before sending forms.",
                                                  variant: "destructive",
                                                });
                                              }
                                            }
                                          }}
                                          disabled={isSendingCurrent || sendFormMutation.isPending}
                                          data-testid={`button-send-${template.templateId}-${templateSigner.id}`}
                                        >
                                          {isSendingCurrent ? (
                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                          ) : (
                                            <Send className="h-4 w-4 mr-2" />
                                          )}
                                          Send Form
                                        </Button>
                                      );
                                    })()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Email Input Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Enter Signer Email</DialogTitle>
            <DialogDescription>
              Please provide the email address for {emailDialogData?.signer.name || emailDialogData?.signer.role}.
              The form will be sent to this email for signing.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="signer-email">Email Address</Label>
              <Input
                id="signer-email"
                type="email"
                placeholder="signer@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleEmailSubmit();
                  }
                }}
                data-testid="input-signer-email"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEmailDialogOpen(false);
                setEmailDialogData(null);
                setEmailInput("");
              }}
              data-testid="button-cancel-email"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEmailSubmit}
              disabled={!emailInput || !emailInput.includes('@')}
              data-testid="button-submit-email"
            >
              <Send className="h-4 w-4 mr-2" />
              Send Form
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}