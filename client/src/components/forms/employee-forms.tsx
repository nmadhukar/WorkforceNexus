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
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
} from "lucide-react";

interface EmployeeFormsProps {
  data: any;
  onChange?: (data: any) => void;
  employeeId?: number;
  onboardingId?: number;
}

interface RequiredTemplate {
  id: number;
  templateId: string;
  name: string;
  description?: string;
  isRequired: boolean;
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
  onboardingId 
}: EmployeeFormsProps) {
  const { toast } = useToast();
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionDetail | null>(null);
  const [submissionModalOpen, setSubmissionModalOpen] = useState(false);
  const [sendingForm, setSendingForm] = useState<string | null>(null);

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
        description: "The form has been sent successfully.",
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
        description: "A reminder email has been sent successfully.",
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

  const getStatusBadge = (status: string, templateId?: string) => {
    const testId = templateId ? `status-badge-${templateId}` : undefined;
    
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
            Pending
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
    // Get employee email from data or use a default
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

  const handleViewSubmission = (submission: FormSubmission) => {
    // Create a detailed submission object for the modal
    const detail: SubmissionDetail = {
      submissionId: submission.submissionId,
      templateName: submission.templateName || requiredTemplates.find(t => t.templateId === submission.templateId)?.name || "Unknown Form",
      status: submission.status,
      createdAt: submission.createdAt,
      signers: [{
        name: data?.firstName && data?.lastName ? `${data.firstName} ${data.lastName}` : "Employee",
        email: submission.signerEmail || data?.workEmail || data?.email || "",
        status: submission.status,
        sentAt: submission.sentAt || undefined,
        openedAt: submission.openedAt || undefined,
        completedAt: submission.completedAt || undefined,
      }]
    };
    
    setSelectedSubmission(detail);
    setSubmissionModalOpen(true);
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
          <CardDescription>Please review and sign all required forms below</CardDescription>
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
          <CardDescription>Please review and sign all required forms below</CardDescription>
          
          {/* Progress indicator */}
          {requiredTemplates.length > 0 && (
            <div className="mt-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Forms Progress</span>
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
        
        <CardContent className="space-y-4">
          {/* DocuSeal configuration check */}
          {onboardingId && submissions.length === 0 && requiredTemplates.length > 0 && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Forms need to be sent to the employee. Click "Send Form" to initiate the signing process.
              </AlertDescription>
            </Alert>
          )}

          {/* Forms list */}
          {requiredTemplates.map((template) => {
            const submission = submissions.find(s => s.templateId === template.templateId);
            const isSending = sendingForm === template.templateId;
            
            return (
              <Card 
                key={template.templateId}
                data-testid={`form-card-${template.templateId}`}
                className="border"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <FileSignature className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-medium">{template.name}</h4>
                      </div>
                      {template.description && (
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      )}
                      {submission && (
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          {submission.sentAt && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Sent: {formatDate(submission.sentAt)}
                            </span>
                          )}
                          {submission.completedAt && (
                            <span className="flex items-center gap-1">
                              <CheckCircle className="h-3 w-3 text-green-600" />
                              Completed: {formatDate(submission.completedAt)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {submission ? (
                        <>
                          {getStatusBadge(submission.status, template.templateId)}
                          {submission.status !== 'completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewSubmission(submission)}
                              data-testid={`button-sign-now-${template.templateId}`}
                            >
                              <ChevronRight className="h-4 w-4 mr-1" />
                              View Details
                            </Button>
                          )}
                        </>
                      ) : (
                        <>
                          {getStatusBadge('pending', template.templateId)}
                          {onboardingId && (
                            <Button
                              size="sm"
                              onClick={() => handleSendForm(template.templateId)}
                              disabled={isSending || sendFormMutation.isPending}
                              data-testid={`button-sign-now-${template.templateId}`}
                            >
                              {isSending ? (
                                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4 mr-2" />
                              )}
                              Send Form
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </CardContent>
      </Card>

      {/* Submission Details Modal */}
      <Dialog open={submissionModalOpen} onOpenChange={setSubmissionModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Form Submission Details</DialogTitle>
            <DialogDescription>
              View and manage the signing process for this form
            </DialogDescription>
          </DialogHeader>
          
          {selectedSubmission && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Form:</span>
                  <span className="text-sm">{selectedSubmission.templateName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Submission ID:</span>
                  <span className="text-sm font-mono text-muted-foreground">
                    {selectedSubmission.submissionId}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Created:</span>
                  <span className="text-sm">{formatDate(selectedSubmission.createdAt)}</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="text-sm font-medium mb-3">Signers Status</h4>
                <div className="space-y-3">
                  {selectedSubmission.signers.map((signer) => (
                    <div key={signer.email} className="p-3 bg-muted/30 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{signer.name}</span>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {signer.email}
                          </div>
                          {signer.sentAt && (
                            <div className="text-xs text-muted-foreground">
                              Sent: {formatDate(signer.sentAt)}
                            </div>
                          )}
                          {signer.openedAt && (
                            <div className="text-xs text-muted-foreground">
                              Opened: {formatDate(signer.openedAt)}
                            </div>
                          )}
                          {signer.completedAt && (
                            <div className="text-xs text-green-600">
                              Completed: {formatDate(signer.completedAt)}
                            </div>
                          )}
                        </div>
                        
                        <div className="flex flex-col gap-2">
                          {signer.status !== 'completed' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => getSigningUrlMutation.mutate({
                                  submissionId: selectedSubmission.submissionId,
                                  signerEmail: signer.email,
                                })}
                                disabled={getSigningUrlMutation.isPending}
                              >
                                Sign Now
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => sendReminderMutation.mutate({
                                  submissionId: selectedSubmission.submissionId,
                                  signerEmail: signer.email,
                                })}
                                disabled={sendReminderMutation.isPending}
                              >
                                <Mail className="h-3 w-3 mr-1" />
                                Remind
                              </Button>
                            </>
                          )}
                          {signer.status === 'completed' && (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Signed
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}