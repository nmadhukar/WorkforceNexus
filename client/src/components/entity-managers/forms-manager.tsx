import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  FileSignature,
  Send,
  Download,
  Eye,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  Plus,
  Mail,
  FileCheck,
  PenTool,
  ClipboardSignature,
  FileText,
  AlertCircle,
  UserCheck,
  ClipboardList,
  SendHorizonal,
  User,
  Calendar,
  Hash,
} from "lucide-react";
import { Label } from "@/components/ui/label";

interface FormSubmission {
  id: number;
  employeeId: number;
  templateId: string;
  templateName: string;
  status: 'pending' | 'sent' | 'viewed' | 'completed' | 'expired' | 'declined';
  submittedAt: string | null;
  completedAt: string | null;
  documentUrl?: string | null;
  submissionUrl?: string | null;
  sentAt: string | null;
  viewedAt: string | null;
  metadata?: any;
  submissionData?: {
    employeeSigned?: boolean;
    hrSigned?: boolean;
    requiresHrSignature?: boolean;
    requiresEmployeeFirst?: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

interface SigningQueueItem {
  id: number;
  submissionId: string;
  templateName: string;
  status: 'pending' | 'sent' | 'opened' | 'completed';
  createdAt: string;
  signers: Array<{
    name: string;
    email: string;
    status: 'pending' | 'sent' | 'opened' | 'completed';
    sentAt?: string;
    completedAt?: string;
    isCurrentUser?: boolean;
  }>;
}

interface DocusealTemplate {
  id: number;
  templateId: string;
  name: string;
  description?: string;
  enabled: boolean;
  requiredForOnboarding: boolean;
  category?: string;
}

interface FormsManagerProps {
  employeeId: number;
}

interface Employee {
  id: number;
  userId: number | null;
  firstName: string;
  lastName: string;
  workEmail?: string;
  [key: string]: any;
}

export function FormsManager({ employeeId }: FormsManagerProps) {
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const [sendFormDialogOpen, setSendFormDialogOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [sendingForm, setSendingForm] = useState(false);
  const [activeTab, setActiveTab] = useState("sign");

  // Fetch employee data to get userId for context detection
  const { data: employee } = useQuery<Employee>({
    queryKey: [`/api/employees/${employeeId}`],
  });

  // Fetch current user's employee record if they have one
  const { data: currentUserEmployee } = useQuery<Employee | null>({
    queryKey: [`/api/employees/current-user`],
    enabled: !!currentUser,
    retry: false,
  });

  // Determine viewing context
  const isOwnProfile = !!(
    (employee?.userId && currentUser?.id && employee.userId === currentUser.id) ||
    (currentUserEmployee && currentUserEmployee.id === employeeId) ||
    (employee?.workEmail && currentUser?.username && 
     employee.workEmail.toLowerCase() === currentUser.username.toLowerCase())
  );
  
  const hasManagementRole = currentUser?.role === 'admin' || currentUser?.role === 'hr';
  const showEmployeeView = isOwnProfile || (!hasManagementRole);
  const isManagementView = hasManagementRole && !isOwnProfile;

  // Fetch signing queue with polling
  const { data: signingQueue = [], isLoading: signingQueueLoading } = useQuery<SigningQueueItem[]>({
    queryKey: [`/api/forms/signing-queue`, employeeId],
    queryFn: async () => {
      const response = await fetch(`/api/forms/signing-queue?employeeId=${employeeId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        // Return empty array if endpoint not found or not authenticated
        if (response.status === 404 || response.status === 401) {
          return [];
        }
        throw new Error('Failed to fetch signing queue');
      }
      return response.json();
    },
    refetchInterval: 15000, // Poll every 15 seconds
    retry: false,
  });

  // Fetch form submissions for send forms tab
  const { data: submissions = [], isLoading: submissionsLoading } = useQuery<FormSubmission[]>({
    queryKey: [`/api/forms/submissions?employeeId=${employeeId}`],
    enabled: hasManagementRole,
  });

  // Fetch available templates
  const { data: templates = [], isLoading: templatesLoading } = useQuery<DocusealTemplate[]>({
    queryKey: ["/api/admin/docuseal-templates"],
    enabled: sendFormDialogOpen && hasManagementRole,
  });

  // Sign Now mutation
  const signNowMutation = useMutation({
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
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Open Document",
        description: error.message || "Unable to open the signing page. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send Reminder mutation
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
      queryClient.invalidateQueries({ queryKey: [`/api/forms/signing-queue`] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Reminder",
        description: error.message || "Unable to send reminder. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Send form mutation
  const sendFormMutation = useMutation({
    mutationFn: async (templateId: string) => {
      return await apiRequest("POST", "/api/forms/send", {
        employeeId,
        templateId,
      });
    },
    onSuccess: () => {
      toast({
        title: "Form Sent",
        description: "The form has been sent to the employee successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/submissions?employeeId=${employeeId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/signing-queue`] });
      setSendFormDialogOpen(false);
      setSelectedTemplateId("");
      setSendingForm(false);
    },
    onError: (error: any) => {
      // Parse error response and show appropriate message
      let errorMessage = "There was an error sending the form. Please try again.";
      let actionMessage = "";
      
      if (error.errorType === 'TEMPLATE_NOT_FOUND') {
        errorMessage = "The selected form template could not be found.";
        actionMessage = "Please select a different template or contact your administrator to sync templates.";
      } else if (error.errorType === 'SERVICE_UNAVAILABLE') {
        errorMessage = "DocuSeal service is not configured.";
        actionMessage = "Please configure DocuSeal API settings in Settings > API Keys before sending forms.";
      } else if (error.errorType === 'NOT_FOUND') {
        errorMessage = error.message || "The requested resource could not be found.";
      } else if (error.errorType === 'INVALID_REQUEST') {
        errorMessage = error.message || "Invalid request. Please check the form details.";
      } else if (error.errorType === 'UNAUTHORIZED') {
        errorMessage = "DocuSeal API authentication failed.";
        actionMessage = "Please update your DocuSeal API key in Settings > API Keys.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Failed to Send Form",
        description: (
          <div className="space-y-2">
            <p>{errorMessage}</p>
            {actionMessage && (
              <p className="text-sm text-muted-foreground">{actionMessage}</p>
            )}
          </div>
        ) as any,
        variant: "destructive",
      });
      
      // Reset form state to allow closing the dialog
      setSendingForm(false);
      setSelectedTemplateId("");
    },
  });

  // Resend form mutation
  const resendFormMutation = useMutation({
    mutationFn: async (submissionId: number) => {
      return await apiRequest("POST", `/api/forms/submissions/${submissionId}/resend`);
    },
    onSuccess: () => {
      toast({
        title: "Form Resent",
        description: "The form has been resent to the employee successfully.",
      });
      queryClient.invalidateQueries({ queryKey: [`/api/forms/submissions?employeeId=${employeeId}`] });
    },
    onError: (error) => {
      toast({
        title: "Failed to Resend Form",
        description: "There was an error resending the form. Please try again.",
        variant: "destructive",
      });
    },
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      case 'sent':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200">
            <Mail className="w-3 h-3 mr-1" />
            Sent
          </Badge>
        );
      case 'opened':
      case 'viewed':
        return (
          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">
            <Eye className="w-3 h-3 mr-1" />
            Opened
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-gray-100 text-gray-800 border-gray-200">
            <XCircle className="w-3 h-3 mr-1" />
            Expired
          </Badge>
        );
      case 'declined':
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200">
            <XCircle className="w-3 h-3 mr-1" />
            Declined
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSendForm = async () => {
    if (!selectedTemplateId) {
      toast({
        title: "Template Required",
        description: "Please select a template to send.",
        variant: "destructive",
      });
      return;
    }
    
    setSendingForm(true);
    try {
      await sendFormMutation.mutateAsync(selectedTemplateId);
    } catch (error) {
      // Error is already handled in mutation onError callback
      // Just ensure the form state is reset
      setSendingForm(false);
    }
  };

  const handleDownloadForm = async (submission: FormSubmission) => {
    try {
      window.open(`/api/forms/submission/${submission.id}/download`, '_blank');
    } catch (error: any) {
      toast({
        title: "Failed to Download",
        description: "Unable to download document. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleViewForm = async (submission: FormSubmission) => {
    try {
      const response = await apiRequest("GET", `/api/forms/submissions/${submission.id}/sign`);
      const data = await response.json();
      if (data.signingUrl) {
        window.open(data.signingUrl, '_blank');
      }
    } catch (error: any) {
      toast({
        title: "Failed to Access Form",
        description: error.message || "Unable to retrieve form URL. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Sign Forms Tab Content
  const SignFormsTab = () => (
    <div className="space-y-4">
      {signingQueueLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : signingQueue.length === 0 ? (
        <div className="text-center py-12">
          <ClipboardSignature className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-4">
            {showEmployeeView 
              ? "No documents require your signature at this time" 
              : "No forms are pending signatures"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {signingQueue.map((item) => (
            <Card key={item.submissionId} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileSignature className="h-4 w-4" />
                      {item.templateName}
                    </CardTitle>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {item.submissionId}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(item.createdAt)}
                      </span>
                    </div>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-sm font-medium text-muted-foreground">Signers Status:</div>
                  {item.signers && Array.isArray(item.signers) && item.signers.length > 0 ? (
                    item.signers.map((signer) => {
                      // For employee view, only show their own signer info
                      if (showEmployeeView && !signer.isCurrentUser) {
                        return null;
                      }
                      
                      return (
                        <div key={signer.email} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{signer.name}</span>
                            {signer.isCurrentUser && (
                              <Badge variant="secondary" className="text-xs">You</Badge>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {signer.email}
                          </div>
                          {signer.sentAt && (
                            <div className="text-xs text-muted-foreground">
                              Email sent on {formatDate(signer.sentAt)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {signer.status === 'completed' ? (
                            <Badge className="bg-green-100 text-green-800 border-green-200">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Signed
                            </Badge>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                onClick={() => signNowMutation.mutate({
                                  submissionId: item.submissionId,
                                  signerEmail: signer.email,
                                })}
                                disabled={signNowMutation.isPending}
                                data-testid={`button-sign-now-${item.submissionId}-${signer.email}`}
                              >
                                {signNowMutation.isPending ? (
                                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <PenTool className="h-4 w-4 mr-2" />
                                )}
                                Sign Now
                              </Button>
                              {!showEmployeeView && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => sendReminderMutation.mutate({
                                    submissionId: item.submissionId,
                                    signerEmail: signer.email,
                                  })}
                                  disabled={sendReminderMutation.isPending}
                                  data-testid={`button-send-reminder-${item.submissionId}-${signer.email}`}
                                >
                                  {sendReminderMutation.isPending ? (
                                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                  ) : (
                                    <Mail className="h-4 w-4 mr-2" />
                                  )}
                                  Send Reminder
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  }).filter(Boolean)
                  ) : (
                    <div className="text-sm text-muted-foreground py-2">
                      No signers information available
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // Send Forms Tab Content
  const SendFormsTab = () => (
    <>
      <div className="flex justify-end mb-4">
        <Button
          onClick={() => setSendFormDialogOpen(true)}
          size="sm"
          data-testid="button-send-form"
        >
          <Plus className="h-4 w-4 mr-2" />
          Send New Form
        </Button>
      </div>

      {submissionsLoading ? (
        <div className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-12">
          <FileCheck className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-muted-foreground mb-4">
            No forms have been sent to this employee yet.
          </p>
          <Button
            variant="outline"
            onClick={() => setSendFormDialogOpen(true)}
            data-testid="button-send-first-form"
          >
            <Send className="h-4 w-4 mr-2" />
            Send First Form
          </Button>
        </div>
      ) : (
        <div className="relative overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Form Template</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent Date</TableHead>
                <TableHead>Completed Date</TableHead>
                <TableHead>Required Signers</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {submissions.map((submission) => (
                <TableRow key={submission.id} data-testid={`form-submission-${submission.id}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileSignature className="h-4 w-4 text-muted-foreground" />
                      {submission.templateName}
                    </div>
                  </TableCell>
                  <TableCell>{getStatusBadge(submission.status)}</TableCell>
                  <TableCell>{formatDate(submission.sentAt || submission.createdAt)}</TableCell>
                  <TableCell>{formatDate(submission.completedAt)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Badge 
                        variant={submission.metadata?.employeeSigned || submission.submissionData?.employeeSigned ? "default" : "outline"} 
                        className={`text-xs ${
                          submission.metadata?.employeeSigned || submission.submissionData?.employeeSigned 
                            ? "bg-green-100 text-green-800 border-green-200" 
                            : ""
                        }`}
                      >
                        {(submission.metadata?.employeeSigned || submission.submissionData?.employeeSigned) ? (
                          <>
                            <UserCheck className="h-3 w-3 mr-1" />
                            Employee
                          </>
                        ) : (
                          <>Employee</>  
                        )}
                      </Badge>
                      
                      {(submission.metadata?.requiresHrSignature || submission.submissionData?.requiresHrSignature) && (
                        <>
                          <Badge 
                            variant={(submission.metadata?.hrSigned || submission.submissionData?.hrSigned) ? "default" : "outline"} 
                            className={`text-xs ${
                              (submission.metadata?.hrSigned || submission.submissionData?.hrSigned)
                                ? "bg-green-100 text-green-800 border-green-200" 
                                : ""
                            }`}
                          >
                            {(submission.metadata?.hrSigned || submission.submissionData?.hrSigned) ? (
                              <>
                                <UserCheck className="h-3 w-3 mr-1" />
                                HR
                              </>
                            ) : (
                              <>HR</>  
                            )}
                          </Badge>
                          {!(submission.metadata?.hrSigned || submission.submissionData?.hrSigned) && 
                           (submission.metadata?.employeeSigned || submission.submissionData?.employeeSigned) && (
                            <AlertCircle className="h-3 w-3 text-amber-500" />
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {submission.status === 'completed' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownloadForm(submission)}
                                data-testid={`button-download-${submission.id}`}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Download document</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {submission.status !== 'completed' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewForm(submission)}
                                data-testid={`button-view-${submission.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View form submission</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      {(submission.status === 'sent' || submission.status === 'viewed') && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => resendFormMutation.mutate(submission.id)}
                                disabled={resendFormMutation.isPending}
                                data-testid={`button-resend-${submission.id}`}
                              >
                                {resendFormMutation.isPending ? (
                                  <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Send className="h-4 w-4" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Resend form to employee</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={sendFormDialogOpen} onOpenChange={setSendFormDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send Form to Employee</DialogTitle>
            <DialogDescription>
              Select a form template to send to this employee for completion.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template">Select Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger id="template">
                  <SelectValue placeholder="Choose a form template" />
                </SelectTrigger>
                <SelectContent>
                  {templatesLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : templates.length === 0 ? (
                    <div className="text-center py-4 space-y-2">
                      <AlertCircle className="h-8 w-8 mx-auto text-amber-500" />
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium">No form templates available</p>
                        <p className="text-xs mt-1">
                          Please configure DocuSeal and sync templates in Settings → API Keys
                        </p>
                      </div>
                    </div>
                  ) : templates.filter(t => t.enabled).length === 0 ? (
                    <div className="text-center py-4 space-y-2">
                      <AlertCircle className="h-8 w-8 mx-auto text-amber-500" />
                      <div className="text-sm text-muted-foreground">
                        <p className="font-medium">No enabled templates</p>
                        <p className="text-xs mt-1">
                          All templates are currently disabled
                        </p>
                      </div>
                    </div>
                  ) : (
                    templates.filter(t => t.enabled).map((template) => (
                      <SelectItem key={template.id} value={template.id.toString()}>
                        <div className="flex items-center gap-2">
                          <FileSignature className="h-4 w-4" />
                          <div>
                            <div>{template.name}</div>
                            {template.description && (
                              <div className="text-xs text-muted-foreground">
                                {template.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSendFormDialogOpen(false);
                  setSelectedTemplateId("");
                }}
                disabled={sendingForm}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSendForm}
                disabled={sendingForm || !selectedTemplateId}
              >
                {sendingForm ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Form
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  // Determine which tabs to show based on role
  const tabsList = hasManagementRole ? (
    <TabsList className="grid w-full grid-cols-2">
      <TabsTrigger value="sign" data-testid="tab-sign-forms">
        <ClipboardSignature className="h-4 w-4 mr-2" />
        Sign Forms
      </TabsTrigger>
      <TabsTrigger value="send" data-testid="tab-send-forms">
        <SendHorizonal className="h-4 w-4 mr-2" />
        Send Forms
      </TabsTrigger>
    </TabsList>
  ) : (
    <TabsList className="grid w-full grid-cols-1">
      <TabsTrigger value="sign" data-testid="tab-sign-forms">
        <ClipboardSignature className="h-4 w-4 mr-2" />
        Sign Forms
      </TabsTrigger>
    </TabsList>
  );

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          {showEmployeeView ? "My Documents" : "Document Forms"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {tabsList}
          
          <TabsContent value="sign" className="mt-4">
            <SignFormsTab />
          </TabsContent>
          
          {hasManagementRole && (
            <TabsContent value="send" className="mt-4">
              <SendFormsTab />
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}